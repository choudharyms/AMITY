from datetime import datetime, timezone, timedelta
from typing import Tuple, Optional
from models import Category

# FSSAI / IFSA Guideline Constants
DEFAULT_HOT_WINDOW_HOURS = 4.0      # Temp >= 60 C
STRICT_HOT_WINDOW_HOURS = 2.0       # Temp < 65 C (cooling or unknown)
COLD_CHAIN_WINDOW_HOURS = 6.0       # Temp <= 5 C
COLD_BROKEN_WINDOW_HOURS = 2.5      # Temp > 5 C
BAKERY_WINDOW_HOURS = 10.0
PRODUCE_WINDOW_HOURS = 18.0
PACKAGED_WINDOW_HOURS = 24.0

MINIMUM_DISPATCH_BUFFER_MINUTES = 35 # Minimum time needed for driver pickup & delivery

def parse_iso(ts_str: str) -> datetime:
    try:
        # Handle trailing Z or offsets
        dt = datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except (TypeError, ValueError) as exc:
        raise ValueError("Invalid ISO-8601 timestamp") from exc

def calculate_safe_window(
    category: Category,
    prepared_at_dt: datetime,
    temp_c: Optional[float] = None
) -> Tuple[datetime, float, str]:
    """
    Computes safe_until datetime, safe_window_hours, and rationale based on FSSAI/IFSA guidelines.
    """
    if category == "cooked_hot":
        if temp_c is not None and temp_c >= 60.0:
            window_hours = DEFAULT_HOT_WINDOW_HOURS
            rationale = "FSSAI Guideline: Cooked food held above 60°C is safe for up to 4 hours."
        else:
            window_hours = STRICT_HOT_WINDOW_HOURS
            rationale = "FSSAI Strict Rule: Cooked food below 65°C must be consumed within 2 hours."
    elif category == "cooked_cold":
        if temp_c is not None and temp_c <= 5.0:
            window_hours = COLD_CHAIN_WINDOW_HOURS
            rationale = "Cold-chain verified (<= 5°C): safe for 6 hours."
        else:
            window_hours = COLD_BROKEN_WINDOW_HOURS
            rationale = "Chilled food above 5°C: window reduced to 2.5 hours."
    elif category == "bakery":
        window_hours = BAKERY_WINDOW_HOURS
        rationale = "Bakery & baked goods: standard 10-hour ambient recovery window."
    elif category == "produce":
        window_hours = PRODUCE_WINDOW_HOURS
        rationale = "Fresh fruits & raw produce: 18-hour handling window."
    elif category == "packaged":
        window_hours = PACKAGED_WINDOW_HOURS
        rationale = "Commercial packaged goods: within manufacturer expiry."
    else:
        window_hours = 4.0
        rationale = "Standard food recovery window applied."

    safe_until_dt = prepared_at_dt + timedelta(hours=window_hours)
    return safe_until_dt, window_hours, rationale

def is_rescue_viable(
    safe_until_dt: datetime,
    estimated_transit_minutes: int = 20,
    current_time: Optional[datetime] = None
) -> Tuple[bool, int, str]:
    """
    Checks if a rescue is physically dispatchable before the food safety countdown expires.
    """
    now = current_time or datetime.now(timezone.utc)
    remaining_seconds = (safe_until_dt - now).total_seconds()
    remaining_minutes = int(remaining_seconds // 60)

    if remaining_minutes <= 0:
        return False, 0, "Safety window has expired. Food cannot be legally or ethically distributed."

    required_minutes = estimated_transit_minutes + MINIMUM_DISPATCH_BUFFER_MINUTES
    if remaining_minutes < required_minutes:
        return False, remaining_minutes, f"Remaining time ({remaining_minutes}m) is less than required transit + handling buffer ({required_minutes}m)."

    return True, remaining_minutes, f"Viable rescue: {remaining_minutes}m remaining (slack: {remaining_minutes - required_minutes}m)."
