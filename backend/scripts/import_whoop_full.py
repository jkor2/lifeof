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
    if value is None:
        return None
    return str(value)

def safe_get(d, key):
    return d.get(key) if isinstance(d, dict) else None

def extract_date(ts):
    if not ts:
        return None
    try:
        return datetime.fromisoformat(ts.replace("Z", "+00:00")).date().isoformat()
    except Exception:
        return None

def to_hours(ms):
    return round((ms or 0) / 1000 / 60 / 60, 2)

def batch_upsert(table, data, batch_size=200, retries=3):
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
        "record_date": extract_date(r.get("created_at")),
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
    needed = score.get("sleep_needed") or {}

    sleep.append({
        "id": to_str(s.get("id")),
        "cycle_id": to_str(s.get("cycle_id")),
        "start": to_str(s.get("start")),
        "end": to_str(s.get("end")),
        "timezone_offset": to_str(s.get("timezone_offset")),
        "nap": str(s.get("nap", False)),
        "score_state": to_str(s.get("score_state")),
        "sleep_performance_percentage": to_str(safe_get(score, "sleep_performance_percentage")),
        "sleep_efficiency_percentage": to_str(safe_get(score, "sleep_efficiency_percentage")),
        "sleep_consistency_percentage": to_str(safe_get(score, "sleep_consistency_percentage")),
        "respiratory_rate": to_str(safe_get(score, "respiratory_rate")),
        "light_sleep_hours": str(to_hours(safe_get(stage, "total_light_sleep_time_milli"))),
        "deep_sleep_hours": str(to_hours(safe_get(stage, "total_slow_wave_sleep_time_milli"))),
        "rem_sleep_hours": str(to_hours(safe_get(stage, "total_rem_sleep_time_milli"))),
        "total_in_bed_hours": str(to_hours(safe_get(stage, "total_in_bed_time_milli"))),
        "total_awake_hours": str(to_hours(safe_get(stage, "total_awake_time_milli"))),
        "disturbance_count": to_str(safe_get(stage, "disturbance_count")),
        "sleep_cycle_count": to_str(safe_get(stage, "sleep_cycle_count")),
        "baseline_need_hours": str(to_hours(safe_get(needed, "baseline_milli"))),
        "need_from_sleep_debt_hours": str(to_hours(safe_get(needed, "need_from_sleep_debt_milli"))),
        "need_from_strain_hours": str(to_hours(safe_get(needed, "need_from_recent_strain_milli"))),
        "record_date": extract_date(s.get("end")),
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
        "record_date": extract_date(w.get("end")),
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