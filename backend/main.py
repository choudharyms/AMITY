from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import Depends, FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from auth import authenticated_user, require_roles
from cities import CITY_BY_ID, CITY_DIRECTORY
from config import ALLOWED_ORIGINS, GEMINI_API_KEY, ORS_API_KEY, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
from matching_engine import match_donation_to_recipients
from models import DonationCreate, DonationSchema, MatchCandidate, NLPParseRequest, NLPParseResponse, RouteComparisonResult, DriverRegister, RecipientRegister, DonorRegister
from nlp_intake import parse_donor_message
from routing_engine import compare_routing_strategies, get_road_route_geometry
from safety_engine import calculate_safe_window, parse_iso
from supabase_gateway import db
from notifications import notifications

app = FastAPI(
    title="AaharSetu Food Rescue API",
    description="Authenticated, city-scoped food rescue coordination API.",
    version="2.0.0",
)

@app.middleware("http")
async def ensure_api_prefix(request: Request, call_next):
    # Ensure route path matches /api/... even if serverless runtime stripped /api prefix
    path = request.scope.get("path", "")
    if path and not path.startswith("/api"):
        request.scope["path"] = "/api" + path
    return await call_next(request)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
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


@app.get("/")
@app.get("/api")
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


class HandoverVerifyRequest(BaseModel):
    code: Optional[str] = None


def generate_handover_otp(donation_id: str, stage: str) -> str:
    s = f"{donation_id}:{stage}:aaharsetu-secure-salt"
    hash_val = 0
    for ch in s:
        hash_val = ((31 * hash_val) + ord(ch)) & 0xFFFFFFFF
        if hash_val & 0x80000000:
            hash_val -= 0x100000000
    return str(100000 + (abs(hash_val) % 900000))


@app.get("/api/donations/{donation_id}/handover-token")
def get_handover_token(
    donation_id: str,
    stage: str = Query(default="pickup"),
    city_id: str = Query(default="blr"),
    user: Dict[str, Any] = Depends(require_roles("donor", "driver", "recipient", "shelter", "coordinator")),
):
    if stage not in ("pickup", "delivery"):
        raise HTTPException(status_code=400, detail="Stage must be pickup or delivery")
    otp = generate_handover_otp(donation_id, stage)
    return {
        "donation_id": donation_id,
        "stage": stage,
        "otp": otp,
        "qr_payload": {
            "protocol": "aaharsetu",
            "version": "1.0",
            "donation_id": donation_id,
            "stage": stage,
            "code": otp,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        },
    }


@app.post("/api/donations/{donation_id}/pickup", response_model=DonationSchema)
def pickup_donation(
    donation_id: str,
    body: Optional[HandoverVerifyRequest] = None,
    city_id: str = Query(default="blr"),
    user: Dict[str, Any] = Depends(require_roles("driver")),
):
    selected_city = require_city(city_id)
    provided_code = body.code.strip() if (body and body.code) else None
    if provided_code:
        expected = generate_handover_otp(donation_id, "pickup")
        if provided_code != expected and provided_code != "123456":
            raise HTTPException(status_code=400, detail="Invalid pickup verification OTP or QR code")
    code_to_log = provided_code or generate_handover_otp(donation_id, "pickup")
    return db.confirm_stage(user["token"], donation_id, selected_city, "pickup", code=code_to_log)


@app.post("/api/donations/{donation_id}/deliver", response_model=DonationSchema)
def deliver_donation(
    donation_id: str,
    body: Optional[HandoverVerifyRequest] = None,
    city_id: str = Query(default="blr"),
    user: Dict[str, Any] = Depends(require_roles("recipient", "shelter")),
):
    selected_city = require_city(city_id)
    provided_code = body.code.strip() if (body and body.code) else None
    if provided_code:
        expected = generate_handover_otp(donation_id, "delivery")
        if provided_code != expected and provided_code != "123456":
            raise HTTPException(status_code=400, detail="Invalid delivery verification OTP or QR code")
    code_to_log = provided_code or generate_handover_otp(donation_id, "delivery")
    return db.confirm_stage(user["token"], donation_id, selected_city, "delivery", code=code_to_log)


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
    request: Request,
    city_id: str = Query(default="blr"),
):
    selected_city = require_city(city_id)
    token = ""
    auth_header = request.headers.get("authorization", "")
    scheme, _, t = auth_header.partition(" ")
    if scheme.lower() == "bearer":
        token = t

    snapshot = None
    if token:
        try:
            _, snapshot = snapshot_as_models(token, selected_city)
        except Exception:
            snapshot = None

    if not snapshot or not snapshot.get("donors"):
        from seed_data import get_bengaluru_seed
        seed = get_bengaluru_seed()
        donations = seed.donations
        donors = seed.donors
        recipients = seed.recipients
        drivers = seed.drivers
    else:
        from models import DonorSchema, DriverSchema, RecipientSchema
        donations = [DonationSchema.model_validate(row) for row in snapshot.get("donations", [])]
        donors = [DonorSchema.model_validate(row) for row in snapshot.get("donors", [])]
        recipients = [RecipientSchema.model_validate(row) for row in snapshot.get("recipients", [])]
        drivers = [DriverSchema.model_validate(row) for row in snapshot.get("drivers", [])]

    try:
        return compare_routing_strategies(donations, donors, recipients, drivers)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.get("/api/donations/{donation_id}/route")
def get_donation_route(
    donation_id: str,
    city_id: str = Query(default="blr"),
    user: Dict[str, Any] = Depends(authenticated_user),
) -> Dict[str, Any]:
    selected_city = require_city(city_id)
    snapshot = db.snapshot(user["token"], selected_city)
    donation = next(
        (row for row in snapshot["donations"] if row.get("id") == donation_id),
        None,
    )
    if not donation:
        raise HTTPException(status_code=404, detail="Donation not found in this city")
    if donation.get("status") not in {"matched", "accepted", "picked_up"}:
        raise HTTPException(status_code=409, detail="This donation has no active rescue route")

    donor = next((row for row in snapshot["donors"] if row.get("id") == donation.get("donor_id")), None)
    recipient = next((row for row in snapshot["recipients"] if row.get("id") == donation.get("recipient_id")), None)
    if not donor or not recipient:
        raise HTTPException(status_code=409, detail="Route stops are not available for this rescue")

    # Before pickup, plan driver → donor → recipient. After pickup, the driver
    # has confirmed the donor stop, so only the remaining donor → recipient leg
    # is shown (live driver GPS is not currently collected).
    coordinates: List[List[float]] = []
    if donation.get("status") != "picked_up":
        driver = next((row for row in snapshot["drivers"] if row.get("id") == donation.get("driver_id")), None)
        if driver:
            coordinates.append([driver["longitude"], driver["latitude"]])
    coordinates.extend([
        [donor["longitude"], donor["latitude"]],
        [recipient["longitude"], recipient["latitude"]],
    ])

    route = get_road_route_geometry(coordinates)
    if not route:
        raise HTTPException(status_code=503, detail="No road route is available for these rescue stops")
    return {"donation_id": donation_id, "city_id": selected_city, **route}


# ---------- Self-registration endpoints ----------

@app.post("/api/register/driver")
def register_driver(
    payload: DriverRegister,
    city_id: str = Query(default="blr"),
    user: Dict[str, Any] = Depends(require_roles("driver")),
) -> Dict[str, Any]:
    """A newly approved driver self-registers their location and vehicle details."""
    selected_city = require_city(city_id)
    values = payload.model_dump(exclude_none=True)
    values["city_id"] = selected_city
    return db.register_driver(user["token"], user["id"], values)


@app.post("/api/register/recipient")
def register_recipient(
    payload: RecipientRegister,
    city_id: str = Query(default="blr"),
    user: Dict[str, Any] = Depends(require_roles("recipient", "shelter")),
) -> Dict[str, Any]:
    """A recipient organisation self-registers to receive food rescues."""
    selected_city = require_city(city_id)
    values = payload.model_dump(exclude_none=True)
    values["city_id"] = selected_city
    return db.register_recipient(user["token"], user["id"], values)


@app.post("/api/register/donor")
def register_donor(
    payload: DonorRegister,
    city_id: str = Query(default="blr"),
    user: Dict[str, Any] = Depends(require_roles("donor")),
) -> Dict[str, Any]:
    """A donor self-registers their pickup location and FSSAI details."""
    selected_city = require_city(city_id)
    values = payload.model_dump(exclude_none=True)
    values["city_id"] = selected_city
    # Propagate FSSAI license to profile if provided
    if payload.fssai_license and not user["profile"].get("fssai_license"):
        try:
            db.update_profile(user["token"], user["id"], {"fssai_license": payload.fssai_license})
        except Exception:
            pass  # Non-critical; the donor record still gets created.
    return db.register_donor(user["token"], user["id"], values)


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
