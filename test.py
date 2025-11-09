from datetime import datetime, timezone, timedelta

# Convert UTC string like "2025-11-09T13:26:02.403Z" to EST-aware datetime
def to_est_datetime(utc_str):
    if not utc_str:
        return None
    try:
        # Parse UTC ISO string
        dt_utc = datetime.fromisoformat(utc_str.replace("Z", "+00:00"))
        # Convert to Eastern Time (handles DST automatically if you want)
        est_offset = timedelta(hours=-5)
        dt_est = dt_utc + est_offset
        return dt_est
    except Exception:
        return None

def extract_est_date(ts):
    """Returns just the EST date (YYYY-MM-DD) for record_date fields."""
    dt_est = to_est_datetime(ts)
    return dt_est.date().isoformat() if dt_est else None


print(extract_est_date("2025-11-09T02:28:43.376Z"))