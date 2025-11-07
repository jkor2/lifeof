from fastapi import APIRouter, HTTPException
from core.database import engine
from sqlalchemy import text
from datetime import datetime
import statistics

router = APIRouter(prefix="/charts", tags=["Charts"])


# =====================================================
# 🔧 Helper Functions
# =====================================================
def safe_float(val):
    try:
        return float(val) if val not in [None, ""] else None
    except:
        return None


def _avg(values):
    """Return rounded mean of numeric list (ignores None)."""
    clean = [v for v in values if v is not None]
    return round(statistics.fmean(clean), 2) if clean else None


# =====================================================
# 📊 WHOOP Charts Endpoint
# =====================================================
@router.get("/overview")
async def get_whoop_charts():
    """
    Return combined WHOOP analytics for Recovery, Sleep, and Workouts
    with advanced derived stats and insights.
    """
    try:
        async with engine.connect() as conn:
            # === RECOVERY ===
            recovery = (
                await conn.execute(
                    text("""
                        SELECT record_date, recovery_score, resting_heart_rate, hrv_rmssd_milli,
                               spo2_percentage, skin_temp_celsius
                        FROM whoop_recovery
                        WHERE record_date IS NOT NULL
                        ORDER BY record_date ASC
                    """)
                )
            ).mappings().all()

            # === SLEEP ===
            sleep = (
                await conn.execute(
                    text("""
                        SELECT record_date, sleep_performance_percentage, sleep_efficiency_percentage,
                               rem_sleep_hours, deep_sleep_hours, respiratory_rate,
                               EXTRACT(EPOCH FROM ("end" - "start")) / 3600 AS total_sleep_hours
                        FROM whoop_sleep
                        WHERE record_date IS NOT NULL
                        ORDER BY record_date ASC
                    """)
                )
            ).mappings().all()

            # === WORKOUTS ===
            workouts = (
                await conn.execute(
                    text("""
                        SELECT record_date, sport_name, strain, average_heart_rate, max_heart_rate,
                               kilojoule, distance_meter, altitude_gain_meter
                        FROM whoop_workouts
                        WHERE record_date IS NOT NULL
                        ORDER BY record_date ASC
                    """)
                )
            ).mappings().all()

        # =====================================================
        # 🩺 RECOVERY ANALYTICS
        # =====================================================
        recovery_trend = [
            {
                "date": r["record_date"],
                "recovery_score": safe_float(r["recovery_score"]),
                "rhr": safe_float(r["resting_heart_rate"]),
                "hrv": safe_float(r["hrv_rmssd_milli"]),
                "spo2": safe_float(r["spo2_percentage"]),
                "temp": safe_float(r["skin_temp_celsius"]),
            }
            for r in recovery
        ]

        avg_recovery = {
            "recovery_score": _avg([r["recovery_score"] for r in recovery_trend]),
            "rhr": _avg([r["rhr"] for r in recovery_trend]),
            "hrv": _avg([r["hrv"] for r in recovery_trend]),
            "spo2": _avg([r["spo2"] for r in recovery_trend]),
            "temp": _avg([r["temp"] for r in recovery_trend]),
        }

        recovery_insights = []
        if avg_recovery["hrv"] and avg_recovery["hrv"] < 50:
            recovery_insights.append("Low HRV trend — potential stress or overtraining.")
        if avg_recovery["rhr"] and avg_recovery["rhr"] > 60:
            recovery_insights.append("Elevated RHR — body still recovering from workload.")
        if avg_recovery["spo2"] and avg_recovery["spo2"] < 95:
            recovery_insights.append("Slight drop in SpO₂ levels — prioritize breathing quality.")
        if avg_recovery["temp"] and avg_recovery["temp"] > 36.8:
            recovery_insights.append("Skin temperature elevated — possible early fatigue or illness.")

        # =====================================================
        # 😴 SLEEP ANALYTICS
        # =====================================================
        sleep_trend = [
            {
                "date": s["record_date"],
                "performance": safe_float(s["sleep_performance_percentage"]),
                "efficiency": safe_float(s["sleep_efficiency_percentage"]),
                "rem": safe_float(s["rem_sleep_hours"]),
                "deep": safe_float(s["deep_sleep_hours"]),
                "total": safe_float(s["total_sleep_hours"]),
                "resp_rate": safe_float(s["respiratory_rate"]),
            }
            for s in sleep
        ]

        avg_sleep = {
            "performance": _avg([s["performance"] for s in sleep_trend]),
            "efficiency": _avg([s["efficiency"] for s in sleep_trend]),
            "rem": _avg([s["rem"] for s in sleep_trend]),
            "deep": _avg([s["deep"] for s in sleep_trend]),
            "total": _avg([s["total"] for s in sleep_trend]),
            "resp_rate": _avg([s["resp_rate"] for s in sleep_trend]),
        }

        sleep_insights = []
        if avg_sleep["efficiency"] and avg_sleep["efficiency"] < 85:
            sleep_insights.append("Sleep efficiency below optimal — maintain a consistent bedtime.")
        if avg_sleep["deep"] and avg_sleep["deep"] < 1.0:
            sleep_insights.append("Low deep sleep — reduce stimulants and screens before bed.")
        if avg_sleep["resp_rate"] and avg_sleep["resp_rate"] > 18:
            sleep_insights.append("Elevated respiratory rate — possible signs of poor recovery.")
        if avg_sleep["total"] and avg_sleep["total"] < 7:
            sleep_insights.append("Average sleep below 7 hours — aim for 7–8 hours nightly.")
        if avg_sleep["rem"] and avg_sleep["rem"] < 1.5:
            sleep_insights.append("Low REM sleep — may indicate mental or emotional fatigue.")

        # =====================================================
        # 🏋️ WORKOUT ANALYTICS
        # =====================================================
        workout_trend = [
            {
                "date": w["record_date"],
                "strain": safe_float(w["strain"]),
                "avg_hr": safe_float(w["average_heart_rate"]),
                "max_hr": safe_float(w["max_heart_rate"]),
                "distance": safe_float(w["distance_meter"]),
                "altitude_gain": safe_float(w["altitude_gain_meter"]),
                "energy": safe_float(w["kilojoule"]),
                "sport": w["sport_name"],
            }
            for w in workouts
        ]

        avg_workouts = {
            "strain": _avg([w["strain"] for w in workout_trend]),
            "avg_hr": _avg([w["avg_hr"] for w in workout_trend]),
            "distance": _avg([w["distance"] for w in workout_trend]),
            "altitude_gain": _avg([w["altitude_gain"] for w in workout_trend]),
            "energy": _avg([w["energy"] for w in workout_trend]),
        }

        workout_insights = []
        if avg_workouts["strain"] and avg_workouts["strain"] > 15:
            workout_insights.append("High training load — ensure recovery and proper hydration.")
        elif avg_workouts["strain"] and avg_workouts["strain"] < 10:
            workout_insights.append("Light training trend — could add higher intensity sessions.")
        if avg_workouts["distance"] and avg_workouts["distance"] < 3000:
            workout_insights.append("Low weekly distance — aim for longer endurance sessions.")
        if avg_workouts["energy"] and avg_workouts["energy"] > 2000:
            workout_insights.append("Strong energy output trend — keep balancing with rest.")

        # =====================================================
        # 🧬 LONGEVITY INDEX (Composite)
        # =====================================================
        longevity_score = None
        if avg_recovery["recovery_score"] and avg_sleep["efficiency"] and avg_workouts["strain"]:
            longevity_score = round(
                (avg_recovery["recovery_score"] * 0.4)
                + (avg_sleep["efficiency"] * 0.4)
                + (20 - avg_workouts["strain"]) * 0.2,
                1,
            )

        longevity_insights = []
        if longevity_score is not None:
            if longevity_score > 80:
                longevity_insights.append("Excellent physiological balance — maintain this mix.")
            elif longevity_score > 60:
                longevity_insights.append("Good longevity potential — improve sleep for optimal performance.")
            else:
                longevity_insights.append("Fatigue warning — strain outweighs recovery capacity.")

        # =====================================================
        # ✅ Return structured response
        # =====================================================
        return {
            "recovery": {
                "trend": recovery_trend,
                "averages": avg_recovery,
                "insights": recovery_insights,
            },
            "sleep": {
                "trend": sleep_trend,
                "averages": avg_sleep,
                "insights": sleep_insights,
            },
            "workouts": {
                "trend": workout_trend,
                "averages": avg_workouts,
                "insights": workout_insights,
            },
            "longevity": {
                "score": longevity_score,
                "insights": longevity_insights,
            },
            "generated_at": datetime.utcnow().isoformat() + "Z",
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))