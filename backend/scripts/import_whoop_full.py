import json
import os
import time
import random
import httpx
from datetime import datetime
from supabase import create_client

# =====================================================
# 🔐 Supabase connection
# =====================================================
SUPABASE_URL = os.getenv("SUPABASE_URL", "https://wqfbpvqfwmmhatkunday.supabase.co")
SUPABASE_KEY = os.getenv(
    "SUPABASE_KEY",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndxZmJwdnFmd21taGF0a3VuZGF5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjQyNzAwNSwiZXhwIjoyMDc4MDAzMDA1fQ.QTU0gsoXvt_iyaZNZEm4jfVwfW8M1Fq5r8Phnse82Kg",
)
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# =====================================================
# 📂 Load WHOOP JSON
# =====================================================
with open("whoop_full_data.json", "r") as f:
    full_data = json.load(f)

summary = {}

def to_str(value):
    """Convert any value safely to string or None."""
    if value is None:
        return None
    return str(value)

def safe_get(d, key):
    """Safely get nested key."""
    if not isinstance(d, dict):
        return None
    return d.get(key)

def extract_date(ts):
    """Extract YYYY-MM-DD from WHOOP timestamps."""
    if not ts:
        return None
    try:
        return datetime.fromisoformat(ts.replace("Z", "+00:00")).date().isoformat()
    except Exception:
        return None

def batch_upsert(table, data, batch_size=200, retries=3):
    """Upsert in safe chunks with retries to avoid SSL drops."""
    total = len(data)
    for i in range(0, total, batch_size):
        chunk = data[i : i + batch_size]
        for attempt in range(retries):
            try:
                supabase.table(table).upsert(chunk).execute()
                print(f"✅ Uploaded {len(chunk)} → {table} ({i+len(chunk)}/{total})")
                time.sleep(random.uniform(0.2, 0.6))
                break
            except httpx.ReadError:
                print(f"⚠️ SSL drop on {table} batch {i//batch_size+1}, retrying... ({attempt+1}/{retries})")
                time.sleep(2 ** attempt)
            except Exception as e:
                print(f"❌ Failed batch {i//batch_size+1} in {table}: {e}")
                break

# =====================================================
# 🧹 Truncate old data (optional but clean)
# =====================================================
print("🧹 Clearing existing WHOOP tables...")
for tbl in ["whoop_recovery", "whoop_sleep", "whoop_workouts"]:
    try:
        supabase.table(tbl).delete().neq("id", "NULL").execute()
    except Exception as e:
        print(f"⚠️ Could not clear {tbl}: {e}")

# =====================================================
# 🟩 1. Recovery
# =====================================================
recovery = []
for r in full_data.get("recovery", []):
    score = r.get("score") or {}
    recovery.append({
        "cycle_id": to_str(r.get("cycle_id")),
        "recovery_score": to_str(safe_get(score, "recovery_score")),
        "resting_heart_rate": to_str(safe_get(score, "resting_heart_rate")),
        "hrv_rmssd_milli": to_str(safe_get(score, "hrv_rmssd_milli")),
        "spo2_percentage": to_str(safe_get(score, "spo2_percentage")),
        "skin_temp_celsius": to_str(safe_get(score, "skin_temp_celsius")),
        "record_date": extract_date(r.get("created_at")),  # 🕐 Added
    })

if recovery:
    print(f"Uploading {len(recovery)} recovery rows...")
    batch_upsert("whoop_recovery", recovery)
    summary["recovery"] = len(recovery)

# =====================================================
# 🟩 2. Sleep
# =====================================================
sleep = []
for s in full_data.get("sleep", []):
    score = s.get("score") or {}
    stage = score.get("stage_summary") or {}
    sleep.append({
        "id": to_str(s.get("id")),
        "cycle_id": to_str(s.get("cycle_id")),
        "start": to_str(s.get("start")),
        "end": to_str(s.get("end")),
        "sleep_performance_percentage": to_str(safe_get(score, "sleep_performance_percentage")),
        "sleep_efficiency_percentage": to_str(safe_get(score, "sleep_efficiency_percentage")),
        "rem_sleep_hours": to_str((safe_get(stage, "total_rem_sleep_time_milli") or 0) / 3600000.0),
        "deep_sleep_hours": to_str((safe_get(stage, "total_slow_wave_sleep_time_milli") or 0) / 3600000.0),
        "respiratory_rate": to_str(safe_get(score, "respiratory_rate")),
        "record_date": extract_date(s.get("end")),  # 🕐 Added
    })

if sleep:
    print(f"Uploading {len(sleep)} sleep records...")
    batch_upsert("whoop_sleep", sleep)
    summary["sleep"] = len(sleep)

# =====================================================
# 🟩 3. Workouts
# =====================================================
workouts = []
for w in full_data.get("workouts", []):
    score = w.get("score") or {}
    workouts.append({
        "id": to_str(w.get("id")),
        "sport_name": to_str(w.get("sport_name")),
        "strain": to_str(safe_get(score, "strain")),
        "average_heart_rate": to_str(safe_get(score, "average_heart_rate")),
        "max_heart_rate": to_str(safe_get(score, "max_heart_rate")),
        "kilojoule": to_str(safe_get(score, "kilojoule")),
        "distance_meter": to_str(safe_get(score, "distance_meter")),
        "altitude_gain_meter": to_str(safe_get(score, "altitude_gain_meter")),
        "record_date": extract_date(w.get("end")),  # 🕐 Added
    })

if workouts:
    print(f"Uploading {len(workouts)} workouts...")
    batch_upsert("whoop_workouts", workouts)
    summary["workouts"] = len(workouts)

# =====================================================
# ✅ Done
# =====================================================
print("\n✅ WHOOP import complete!")
print(summary)