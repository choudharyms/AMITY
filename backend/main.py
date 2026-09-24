from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from auth import authenticated_user, require_roles
from cities import CITY_BY_ID, CITY_DIRECTORY
from config import ALLOWED_ORIGINS, GEMINI_API_KEY, ORS_API_KEY, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
from matching_engine import match_donation_to_recipients
from models import DonationCreate, DonationSchema, MatchCandidate, NLPParseRequest, NLPParseResponse, RouteComparisonResult
from nlp_intake import parse_donor_message
from routing_engine import compare_routing_strategies
from safety_engine import calculate_safe_window, parse_iso
from supabase_gateway import db
from notifications import notifications

app = FastAPI(
    title="AaharSetu Food Rescue API",
    description="Authenticated, city-scoped food rescue coordination API.",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PATCH", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)


class ProfileUpdate(BaseModel):
    display_name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    organization: Optional[str] = Field(default=None, max_length=160)
    phone: Optional[str] = Field(default=None, max_length=40)
    fssai_license: Optional[str] = Field(default=None, max_length=40)
    area: Optional[str] = Field(default=None, max_length=160)
    active_city_id: Optional[str] = None


def require_city(city_id: str) -> str:
    if city_id not in CITY_BY_ID:
        raise HTTPException(status_code=422, detail="Choose a supported city")
    return city_id


def snapshot_as_models(access_token: str, city_id: str):
    data = db.snapshot(access_token, city_id)
    return (
        [DonationSchema.model_validate(row) for row in data["donations"]],
        data,
    )


@app.get("/api/health")
def get_health() -> Dict[str, Any]:
    notifications.reload_config()
    return {
        "ok": True,
        "service": "AaharSetu",
        "database": "supabase" if db.configured else "unavailable",
        "routing": "ors" if ORS_API_KEY else "unavailable",
        "gemini": bool(GEMINI_API_KEY),
        "telegram": bool(notifications.bot_token),
        "telegram_target": bool(notifications.chat_id),
        "web_push": bool(notifications.vapid_public_key),
        "web_push_subscribers": len(notifications._subscriptions),
        "deployed": "configured",
        "cities": len(CITY_DIRECTORY),
    }


@app.get("/api/cities")
def get_cities() -> List[Dict[str, object]]:
    return CITY_DIRECTORY


@app.get("/api/me")
def get_me(user: Dict[str, Any] = Depends(authenticated_user)) -> Dict[str, Any]:
    return user["profile"]


@app.patch("/api/me")
def update_me(payload: ProfileUpdate, user: Dict[str, Any] = Depends(authenticated_user)) -> Dict[str, Any]:
    values = payload.model_dump(exclude_unset=True)
    if "active_city_id" in values:
        values["active_city_id"] = require_city(values["active_city_id"])
    if not values:
        return user["profile"]
    return db.update_profile(user["token"], user["id"], values)


@app.get("/api/pilot-data")
def get_pilot_data(
    city_id: str = Query(default="blr"),
    user: Dict[str, Any] = Depends(authenticated_user),
) -> Dict[str, Any]:
    return db.snapshot(user["token"], require_city(city_id))


@app.post("/api/donations/intake-nlp", response_model=NLPParseResponse)
def intake_nlp(
    request: NLPParseRequest,
    _: Dict[str, Any] = Depends(require_roles("donor", "coordinator")),
):
    if not request.text or not request.text.strip():
        raise HTTPException(status_code=400, detail="Text message cannot be empty")
    if len(request.text) > 2000:
        raise HTTPException(status_code=413, detail="Text message is too long")
    return parse_donor_message(request.text)


@app.post("/api/donations", response_model=DonationSchema)
def create_donation(
    intent: DonationCreate,
    city_id: str = Query(default="blr"),
    user: Dict[str, Any] = Depends(require_roles("donor", "coordinator")),
):
    selected_city = require_city(city_id)
    if intent.city_id != "blr" and intent.city_id != selected_city:
        raise HTTPException(status_code=422, detail="Donation city does not match the selected network")
    try:
        prepared_at = parse_iso(intent.prepared_at)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    if prepared_at > datetime.now(timezone.utc):
        raise HTTPException(status_code=422, detail="Preparation time cannot be in the future")
    safe_until, _, _ = calculate_safe_window(intent.category, prepared_at, intent.temp_c)
    values = {
        "city_id": selected_city,
        "donor_id": intent.donor_id,
        "item": intent.item.strip(),
        "category": intent.category,
        "qty_kg": intent.qty_kg,
        "prepared_at": prepared_at.isoformat(),
        "temp_c": intent.temp_c,
        "safe_until": safe_until.isoformat(),
        "status": "posted",
        "raw_text": intent.source_text,
        "is_synthetic": False,
    }
    result = db.create_donation(user["token"], values)
    try:
        notifications.broadcast_alert(
            title="🌿 New Donation Posted",
            body=f"{values['qty_kg']} kg of {values['item']} ({values['category']}) posted in {selected_city.upper()}! Safe until {safe_until.strftime('%H:%M UTC')}.",
            data={"donation_id": result.get("id") if isinstance(result, dict) else getattr(result, "id", None), "city_id": selected_city, "url": "/"},
            city_id=selected_city,
        )
    except Exception:
        pass
    return result


@app.get("/api/donations/{donation_id}/matches", response_model=List[MatchCandidate])
def get_matches(
    donation_id: str,
    city_id: str = Query(default="blr"),
    user: Dict[str, Any] = Depends(require_roles("coordinator")),
):
    _, snapshot = snapshot_as_models(user["token"], require_city(city_id))
    donations = [DonationSchema.model_validate(row) for row in snapshot["donations"]]
    donation = next((item for item in donations if item.id == donation_id), None)
    if not donation:
        raise HTTPException(status_code=404, detail="Donation not found")
    donor = next((item for item in snapshot["donors"] if item["id"] == donation.donor_id), None)
    if not donor:
        raise HTTPException(status_code=404, detail="Donor profile not found")
    from models import DonorSchema, RecipientSchema
    candidates = [RecipientSchema.model_validate(row) for row in snapshot["recipients"]]
    try:
        return match_donation_to_recipients(donation, DonorSchema.model_validate(donor), candidates)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@app.post("/api/donations/{donation_id}/match", response_model=DonationSchema)
def match_donation(
    donation_id: str,
    city_id: str = Query(default="blr"),
    user: Dict[str, Any] = Depends(require_roles("coordinator")),
):
    _, snapshot = snapshot_as_models(user["token"], require_city(city_id))
    donations = [DonationSchema.model_validate(row) for row in snapshot["donations"]]
    donation = next((item for item in donations if item.id == donation_id), None)
    if not donation:
        raise HTTPException(status_code=404, detail="Donation not found")
    donor_row = next((item for item in snapshot["donors"] if item["id"] == donation.donor_id), None)
    drivers = [
        item for item in snapshot["drivers"]
        if item.get("availability") and item.get("capacity_kg", 0) >= donation.qty_kg
    ]
    if not donor_row or not drivers:
        raise HTTPException(status_code=409, detail="No donor or available driver is registered in this city")
    from models import DonorSchema, RecipientSchema
    try:
        candidates = match_donation_to_recipients(
            donation,
            DonorSchema.model_validate(donor_row),
            [RecipientSchema.model_validate(row) for row in snapshot["recipients"]],
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    top_match = next((candidate for candidate in candidates if candidate.is_deliverable), None)
    if not top_match:
        raise HTTPException(status_code=409, detail="No safe, available recipient can receive this donation")
    matched = db.assign_match(user["token"], donation_id, city_id, top_match.recipient.id, drivers[0]["id"])
    try:
        driver_name = drivers[0].get("name", "Assigned driver")
        notifications.broadcast_alert(
            title="🤝 Rescue Matched & Dispatched",
            body=f"{donation.item} ({donation.qty_kg} kg) assigned to {driver_name} for recipient {top_match.recipient.name}!",
            data={"donation_id": donation_id, "city_id": city_id, "url": "/"},
            city_id=city_id,
        )
    except Exception:
        pass
    return matched


@app.post("/api/donations/{donation_id}/pickup", response_model=DonationSchema)
def pickup_donation(
    donation_id: str,
    city_id: str = Query(default="blr"),
    user: Dict[str, Any] = Depends(require_roles("driver")),
):
    selected_city = require_city(city_id)
    return db.confirm_stage(user["token"], donation_id, selected_city, "pickup")


@app.post("/api/donations/{donation_id}/deliver", response_model=DonationSchema)
def deliver_donation(
    donation_id: str,
    city_id: str = Query(default="blr"),
    user: Dict[str, Any] = Depends(require_roles("recipient", "shelter")),
):
    selected_city = require_city(city_id)
    return db.confirm_stage(user["token"], donation_id, selected_city, "delivery")


@app.post("/api/donations/{id}/escalate", response_model=DonationSchema)
def escalate_donation(id: str):
    updated = db.escalate_donation(id)
    if not updated:
        raise HTTPException(status_code=404, detail="Donation not found")
    try:
        notifications.broadcast_alert(
            title="🚨 CRITICAL: Safe Window Closing Soon!",
            body=f"Donation #{id[:8]} safe window is expiring! Priority escalated to urgent dispatch.",
            data={"donation_id": id, "url": "/"},
            city_id=None,
        )
    except Exception:
        pass
    return updated


@app.get("/api/routes/compare", response_model=RouteComparisonResult)
def get_route_comparison(
    city_id: str = Query(default="blr"),
    user: Dict[str, Any] = Depends(require_roles("coordinator")),
):
    if not ORS_API_KEY:
        raise HTTPException(status_code=503, detail="OpenRouteService is not configured")
    _, snapshot = snapshot_as_models(user["token"], require_city(city_id))
    from models import DonorSchema, DriverSchema, RecipientSchema
    try:
        return compare_routing_strategies(
            [DonationSchema.model_validate(row) for row in snapshot["donations"]],
            [DonorSchema.model_validate(row) for row in snapshot["donors"]],
            [RecipientSchema.model_validate(row) for row in snapshot["recipients"]],
            [DriverSchema.model_validate(row) for row in snapshot["drivers"]],
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


# ==================== TELEGRAM NOTIFICATION ROUTES ====================

class TelegramConfigureRequest(BaseModel):
    chat_id: str


@app.get("/api/telegram/status")
def telegram_status() -> Dict[str, Any]:
    return notifications.get_telegram_status()


@app.post("/api/telegram/detect")
def telegram_detect() -> Dict[str, Any]:
    return notifications.detect_telegram_chat()


@app.post("/api/telegram/configure")
def telegram_configure(payload: TelegramConfigureRequest) -> Dict[str, Any]:
    return notifications.set_telegram_chat(payload.chat_id)


@app.post("/api/telegram/test-alert")
def telegram_test_alert() -> Dict[str, Any]:
    res = notifications.send_telegram_alert(
        "🚨 *AaharSetu Live Alert Test*\n\n"
        "This is a verified test broadcast from the AaharSetu Emergency Food Rescue Coordination System.\n"
        "Your Telegram connection is working and ready for real-time dispatch alerts! 🟢"
    )
    if not res.get("sent"):
        raise HTTPException(status_code=400, detail=res.get("error", "Failed to send Telegram test message"))
    return res


# ==================== WEB PUSH NOTIFICATION ROUTES ====================

class PushSubscribeRequest(BaseModel):
    subscription: Dict[str, Any]
    city_id: Optional[str] = "blr"


class PushUnsubscribeRequest(BaseModel):
    endpoint: str


class PushTestRequest(BaseModel):
    title: Optional[str] = "🌿 AaharSetu Food Rescue Alert"
    body: Optional[str] = "Test notification: Web push and emergency dispatch systems are operational!"
    city_id: Optional[str] = None


@app.get("/api/push/vapid-public-key")
def push_public_key() -> Dict[str, str]:
    pub_key = notifications.get_vapid_public_key()
    if not pub_key:
        raise HTTPException(status_code=503, detail="VAPID keys are not configured")
    return {"publicKey": pub_key}


@app.post("/api/push/subscribe")
def push_subscribe(payload: PushSubscribeRequest) -> Dict[str, Any]:
    try:
        return notifications.add_push_subscription(payload.subscription, payload.city_id or "blr")
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/api/push/unsubscribe")
def push_unsubscribe(payload: PushUnsubscribeRequest) -> Dict[str, Any]:
    return notifications.remove_push_subscription(payload.endpoint)


@app.post("/api/push/test")
def push_test(payload: PushTestRequest) -> Dict[str, Any]:
    return notifications.broadcast_alert(
        title=payload.title or "🌿 AaharSetu Food Rescue Alert",
        body=payload.body or "Emergency dispatch test notification.",
        data={"url": "/", "type": "test_alert"},
        city_id=payload.city_id,
        send_telegram=False,
    )
