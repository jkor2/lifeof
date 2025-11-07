import os
import json
import time
import secrets
import requests
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException
from dotenv import load_dotenv
from supabase import create_client

# =====================================================
# 🌍 Load environment variables
# =====================================================
load_dotenv()  # ✅ Ensures .env is read both locally and in Docker

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_KEY")
DATABASE_URL = os.getenv("CONNECTION_STRING")

WHOOP_CLIENT_ID = os.getenv("WHOOP_CLIENT_ID")
WHOOP_CLIENT_SECRET = os.getenv("WHOOP_CLIENT_SECRET")
WHOOP_REDIRECT_URI = os.getenv("WHOOP_REDIRECT_URI")

WHOOP_AUTH_URL = "https://api.prod.whoop.com/oauth/oauth2/auth"
WHOOP_TOKEN_URL = "https://api.prod.whoop.com/oauth/oauth2/token"
WHOOP_API_BASE = "https://api.prod.whoop.com/developer/v2"

ACCESS_FILE = "whoop_tokens.json"

# =====================================================
# 🧩 Initialize Supabase Client
# =====================================================
if not SUPABASE_URL or not SUPABASE_KEY:
    raise RuntimeError("❌ Missing SUPABASE_URL or SUPABASE_KEY in environment!")

SUPABASE = create_client(SUPABASE_URL, SUPABASE_KEY)
router = APIRouter(prefix="/whoop", tags=["WHOOP"])

# =====================================================
# 🔧 Helpers
# =====================================================
def save_tokens(tokens):
    tokens["expires_at"] = time.time() + tokens.get("expires_in", 3600)
    with open(ACCESS_FILE, "w") as f:
        json.dump(tokens, f, indent=2)


def load_tokens():
    if os.path.exists(ACCESS_FILE):
        with open(ACCESS_FILE, "r") as f:
            return json.load(f)
    return None


def token_expired(tokens):
    return time.time() >= tokens.get("expires_at", 0)


def refresh_token(tokens):
    """Request new token using refresh_token and save it."""
    if "refresh_token" not in tokens:
        raise HTTPException(400, "⚠️ Missing refresh_token. Please reauthorize WHOOP with offline scope.")

    data = {
        "grant_type": "refresh_token",
        "refresh_token": tokens["refresh_token"],
        "client_id": WHOOP_CLIENT_ID,
        "client_secret": WHOOP_CLIENT_SECRET,
        "scope": "offline",
    }

    res = requests.post(WHOOP_TOKEN_URL, data=data)
    if res.status_code != 200:
        raise HTTPException(res.status_code, f"Failed to refresh token: {res.text}")
    new_tokens = res.json()
    save_tokens(new_tokens)
    return new_tokens


def ensure_valid_token():
    tokens = load_tokens()
    if not tokens:
        raise HTTPException(400, "⚠️ No WHOOP tokens found — please authorize first via /whoop/auth")

    if token_expired(tokens):
        print("🔄 WHOOP token expired, refreshing...")
        tokens = refresh_token(tokens)
    return tokens


# =====================================================
# 🔗 Step 1: Redirect user to WHOOP authorization
# =====================================================
@router.get("/auth")
def get_auth_url():
    scopes = "offline read:recovery read:cycles read:sleep read:workout read:profile read:body_measurement"
    state = secrets.token_urlsafe(16)
    url = (
        f"{WHOOP_AUTH_URL}?client_id={WHOOP_CLIENT_ID}"
        f"&response_type=code&scope={scopes}"
        f"&redirect_uri={WHOOP_REDIRECT_URI}"
        f"&state={state}"
    )
    return {"auth_url": url}


# =====================================================
# 🔑 Step 2: Callback (exchange code for tokens)
# =====================================================
@router.get("/auth/whoop/callback")
def whoop_callback(code: str = None, state: str = None):
    if not code:
        raise HTTPException(400, "Missing authorization code")

    data = {
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": WHOOP_REDIRECT_URI,
        "client_id": WHOOP_CLIENT_ID,
        "client_secret": WHOOP_CLIENT_SECRET,
    }

    res = requests.post(WHOOP_TOKEN_URL, data=data)
    if res.status_code != 200:
        raise HTTPException(res.status_code, res.text)

    tokens = res.json()
    save_tokens(tokens)

    has_refresh = "refresh_token" in tokens
    return {
        "message": "✅ WHOOP connected successfully!",
        "has_refresh_token": has_refresh,
        "tokens": tokens if not has_refresh else "Stored securely ✅"
    }


# =====================================================
# 📊 Step 3: Fetch WHOOP Data (auto-refresh built-in)
# =====================================================
@router.get("/data")
def get_whoop_data():
    tokens = ensure_valid_token()
    headers = {"Authorization": f"Bearer {tokens['access_token']}"}

    endpoints = {
        "profile": f"{WHOOP_API_BASE}/user/profile/basic",
        "body_measurement": f"{WHOOP_API_BASE}/user/measurement/body",
        "recovery": f"{WHOOP_API_BASE}/recovery?limit=3",
        "cycles": f"{WHOOP_API_BASE}/cycle?limit=3",
        "sleep": f"{WHOOP_API_BASE}/activity/sleep?limit=3",
        "workouts": f"{WHOOP_API_BASE}/activity/workout?limit=3",
    }

    data = {}
    for key, url in endpoints.items():
        r = requests.get(url, headers=headers)
        print(f"📡 WHOOP {key}: {r.status_code}")

        if r.status_code == 401:  # expired or invalid token
            print(f"⚠️ Token invalid for {key}, refreshing...")
            tokens = refresh_token(tokens)
            headers["Authorization"] = f"Bearer {tokens['access_token']}"
            r = requests.get(url, headers=headers)

        try:
            data[key] = r.json()
        except ValueError:
            data[key] = {
                "error": f"Non-JSON response ({r.status_code})",
                "text": r.text[:300],
            }

    return data


# =====================================================
# 🩺 Step 4: Connection Status
# =====================================================
@router.get("/status")
def whoop_status():
    tokens = load_tokens()
    if not tokens:
        return {"connected": False, "message": "❌ Not connected to WHOOP"}

    expired = token_expired(tokens)
    expires_in = int(tokens.get("expires_at", 0) - time.time())
    has_refresh = "refresh_token" in tokens

    return {
        "connected": not expired,
        "message": "✅ Connected to WHOOP" if not expired else "⚠️ Token expired — reconnect required",
        "expires_in": expires_in,
        "has_refresh_token": has_refresh,
    }


# =====================================================
# 🕰️ Step 5: Full historical sync (260 days)
# =====================================================
def fetch_all_whoop_data(endpoint: str, headers: dict, limit: int = 25):
    """Fetch all pages from a WHOOP endpoint using nextToken pagination."""
    url = f"{endpoint}?limit={limit}"
    all_records = []

    while url:
        r = requests.get(url, headers=headers)
        if r.status_code != 200:
            print(f"❌ Error fetching {url}: {r.status_code}")
            break

        data = r.json()
        records = data.get("records", [])
        all_records.extend(records)

        next_token = data.get("next_token")
        if next_token:
            url = f"{endpoint}?limit={limit}&nextToken={next_token}"
        else:
            url = None

    print(f"✅ Retrieved {len(all_records)} from {endpoint}")
    return all_records


@router.get("/data/full")
def get_full_whoop_history():
    tokens = ensure_valid_token()
    headers = {"Authorization": f"Bearer {tokens['access_token']}"}

    endpoints = {
        "recovery": f"{WHOOP_API_BASE}/recovery",
        "sleep": f"{WHOOP_API_BASE}/activity/sleep",
        "workouts": f"{WHOOP_API_BASE}/activity/workout",
    }

    full_data = {}
    for key, url in endpoints.items():
        full_data[key] = fetch_all_whoop_data(url, headers)

    with open("whoop_full_data.json", "w") as f:
        json.dump(full_data, f, indent=2)

    return {"message": "✅ Full WHOOP history fetched", "summary": {k: len(v) for k, v in full_data.items()}}


# =====================================================
# 🔄 Step 6: Daily Sync (fetch latest WHOOP data + insert)
# =====================================================
def extract_date(ts):
    """Convert timestamp to YYYY-MM-DD."""
    if not ts:
        return None
    try:
        return datetime.fromisoformat(ts.replace("Z", "+00:00")).date().isoformat()
    except Exception:
        return None


@router.get("/sync/latest")
@router.post("/sync/latest")
def sync_latest_whoop_data():
    """
    Fetches the *most recent* WHOOP recovery, sleep, and workout data (limit=1 each)
    and inserts them into the Supabase tables with record_date (skips duplicate recovery).
    """
    tokens = ensure_valid_token()
    headers = {"Authorization": f"Bearer {tokens['access_token']}"}

    endpoints = {
        "recovery": f"{WHOOP_API_BASE}/recovery?limit=1",
        "sleep": f"{WHOOP_API_BASE}/activity/sleep?limit=1",
        "workouts": f"{WHOOP_API_BASE}/activity/workout?limit=1",
    }

    results = {}
    for key, url in endpoints.items():
        r = requests.get(url, headers=headers)
        if r.status_code != 200:
            results[key] = {"error": r.text}
            continue

        data = r.json().get("records", [])
        if not data:
            results[key] = {"message": "No new records"}
            continue

        record = data[0]
        if key == "recovery":
            score = record.get("score") or {}
            record_date = extract_date(record.get("created_at"))

            # ⚠️ Skip if recovery already exists for this date
            existing = SUPABASE.table("whoop_recovery").select("record_date").eq("record_date", record_date).execute()
            if existing.data:
                results[key] = {"message": f"⚠️ Recovery for {record_date} already exists — skipped"}
                continue

            insert = {
                "cycle_id": str(record.get("cycle_id")),
                "recovery_score": str(score.get("recovery_score")),
                "resting_heart_rate": str(score.get("resting_heart_rate")),
                "hrv_rmssd_milli": str(score.get("hrv_rmssd_milli")),
                "spo2_percentage": str(score.get("spo2_percentage")),
                "skin_temp_celsius": str(score.get("skin_temp_celsius")),
                "record_date": record_date,
            }
            SUPABASE.table("whoop_recovery").insert(insert).execute()

        elif key == "sleep":
            score = record.get("score") or {}
            stage = score.get("stage_summary") or {}
            insert = {
                "id": str(record.get("id")),
                "cycle_id": str(record.get("cycle_id")),
                "start": str(record.get("start")),
                "end": str(record.get("end")),
                "sleep_performance_percentage": str(score.get("sleep_performance_percentage")),
                "sleep_efficiency_percentage": str(score.get("sleep_efficiency_percentage")),
                "rem_sleep_hours": str((stage.get("total_rem_sleep_time_milli") or 0) / 3600000.0),
                "deep_sleep_hours": str((stage.get("total_slow_wave_sleep_time_milli") or 0) / 3600000.0),
                "respiratory_rate": str(score.get("respiratory_rate")),
                "record_date": extract_date(record.get("end")),
            }
            SUPABASE.table("whoop_sleep").upsert(insert).execute()

        elif key == "workouts":
            score = record.get("score") or {}
            insert = {
                "id": str(record.get("id")),
                "sport_name": str(record.get("sport_name")),
                "strain": str(score.get("strain")),
                "average_heart_rate": str(score.get("average_heart_rate")),
                "max_heart_rate": str(score.get("max_heart_rate")),
                "kilojoule": str(score.get("kilojoule")),
                "distance_meter": str(score.get("distance_meter")),
                "altitude_gain_meter": str(score.get("altitude_gain_meter")),
                "record_date": extract_date(record.get("end")),
            }
            SUPABASE.table("whoop_workouts").upsert(insert).execute()

        results[key] = {"message": "Inserted latest record ✅"}

    return {
        "message": "✅ WHOOP latest data synced successfully",
        "details": results,
        "timestamp": datetime.utcnow().isoformat() + "Z",
    }