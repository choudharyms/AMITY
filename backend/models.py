from datetime import datetime
from typing import List, Optional, Dict, Any, Literal
from pydantic import BaseModel, Field

Category = Literal["cooked_hot", "cooked_cold", "packaged", "produce", "bakery"]
RescueStatus = Literal["posted", "matched", "accepted", "picked_up", "delivered", "expired", "cancelled"]

class DonorSchema(BaseModel):
    id: str
    name: str
    area: str
    latitude: float
    longitude: float
    license_no: Optional[str] = None
    license_verified: bool = False
    is_synthetic: bool = True
    city_id: str = "blr"

class RecipientSchema(BaseModel):
    id: str
    name: str
    area: str
    latitude: float
    longitude: float
    capacity_kg: float
    reserved_kg: float = 0.0
    accepts: List[Category]
    need_level: int = 3
    approved: bool = True
    is_open: bool = True
    reliability: float = 0.95
    is_synthetic: bool = True
    city_id: str = "blr"

class DriverSchema(BaseModel):
    id: str
    name: str
    latitude: float
    longitude: float
    availability: bool = True
    vehicle: str = "Bike"
    capacity_kg: float = 25.0
    is_synthetic: bool = True
    city_id: str = "blr"
    user_id: Optional[str] = None

class DonationCreate(BaseModel):
    city_id: str = "blr"
    donor_id: str = Field(min_length=1, max_length=120)
    item: str = Field(min_length=1, max_length=120)
    category: Category
    qty_kg: float = Field(gt=0, le=10000)
    prepared_at: str = Field(min_length=10, max_length=40)
    temp_c: Optional[float] = Field(default=None, ge=-50, le=150)
    safe_until: Optional[str] = None
    source_text: Optional[str] = Field(default=None, max_length=2000)

class DonationSchema(BaseModel):
    id: str
    donor_id: str
    item: str
    category: Category
    qty_kg: float
    prepared_at: str
    temp_c: Optional[float] = None
    safe_until: str
    status: RescueStatus = "posted"
    created_at: str
    is_synthetic: bool = True
    recipient_id: Optional[str] = None
    driver_id: Optional[str] = None
    city_id: str = "blr"

class DispatchEventSchema(BaseModel):
    id: str
    donation_id: str
    event_type: str
    message: str
    created_at: str
    driver_id: Optional[str] = None
    city_id: str = "blr"

class RescueRecordSchema(BaseModel):
    id: str
    donation_id: str
    quantity_kg: float
    temperature_c: Optional[float] = None
    area: str
    delivered_at: str
    consume_by: str

class PilotDataResponse(BaseModel):
    donors: List[DonorSchema]
    recipients: List[RecipientSchema]
    drivers: List[DriverSchema]
    donations: List[DonationSchema]
    dispatch_events: List[DispatchEventSchema]
    records: List[RescueRecordSchema]

class NLPParseRequest(BaseModel):
    text: str

class NLPParseResponse(BaseModel):
    item: str
    category: Category
    qty_kg: float
    temp_c: Optional[float]
    window_hours: float
    prepared_at_iso: str
    safe_until_iso: str
    confidence: float
    notes: str

class MatchScoreBreakdown(BaseModel):
    time_slack_score: float
    proximity_score: float
    need_score: float
    capacity_score: float
    reliability_score: float
    total_score: float
    reasons: List[str]

class MatchCandidate(BaseModel):
    recipient: RecipientSchema
    score_breakdown: MatchScoreBreakdown
    estimated_transit_minutes: int
    is_deliverable: bool
    blocking_reason: Optional[str] = None

class VRPStopDetail(BaseModel):
    donation_id: str = ""
    name: str
    area: str
    stop_type: str = "pickup"
    arrival_time: str
    deadline: str
    missed: bool = False
    leg_km: float = 0.0
    slack_minutes: int = 0

class VRPDriverRoute(BaseModel):
    driver_id: str
    driver_name: str
    vehicle: str = "Bike"
    total_km: float = 0.0
    stops: int = 0
    missed_deadlines: int = 0
    stop_sequence: List[str] = []

class RouteComparisonResult(BaseModel):
    joint_route_km: float
    greedy_baseline_km: float
    km_saved: float
    pct_distance_saved: float
    joint_missed_deadlines: int
    greedy_missed_deadlines: int
    stops_count: int
    computed_at: str
    solver: str = "2-opt-heuristic"
    computation_ms: int = 0
    joint_stops: List[VRPStopDetail] = []
    greedy_stops: List[VRPStopDetail] = []
    driver_routes: List[VRPDriverRoute] = []

class SettingsSchema(BaseModel):
    mode: Literal["pilot", "live"] = "pilot"
    city: str = "Bengaluru, India"
    weight_slack: float = 0.35
    weight_proximity: float = 0.25
    weight_need: float = 0.20
    weight_capacity: float = 0.10
    weight_reliability: float = 0.10
    dispatch_buffer_mins: int = 35

class UserProfileSchema(BaseModel):
    id: str
    email: Optional[str] = None
    display_name: str
    role: Literal["coordinator", "donor", "driver", "shelter"] = "coordinator"
    organization: Optional[str] = "Bengaluru Food Rescue Network"
    phone: Optional[str] = "+91 98765 43210"
    fssai_license: Optional[str] = None
    area: str = "Indiranagar, Bengaluru"

class ActiveRoutePath(BaseModel):
    donation_id: str
    item: str
    qty_kg: float
    status: str
    safe_until: str
    donor_id: str
    donor_name: str
    donor_area: str
    donor_coords: List[float]
    recipient_id: Optional[str] = None
    recipient_name: Optional[str] = None
    recipient_area: Optional[str] = None
    recipient_coords: Optional[List[float]] = None
    driver_id: Optional[str] = None
    driver_name: Optional[str] = None
    driver_coords: Optional[List[float]] = None
    distance_km: float
    geometry: Dict[str, Any]


# ---------- Self-registration request models ----------

class DriverRegister(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    area: str = Field(default="", max_length=160)
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    vehicle: str = Field(default="Bike", max_length=60)
    capacity_kg: float = Field(default=25.0, gt=0, le=5000)
    phone: Optional[str] = Field(default=None, max_length=40)


class RecipientRegister(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    area: str = Field(min_length=1, max_length=160)
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    capacity_kg: float = Field(default=50.0, gt=0, le=50000)
    need_level: int = Field(default=3, ge=1, le=5)
    accepts: List[Category] = Field(default_factory=lambda: ["cooked_hot", "cooked_cold", "packaged", "produce", "bakery"])
    open_hours: Optional[str] = Field(default="09:00 - 22:00", max_length=60)
    phone: Optional[str] = Field(default=None, max_length=40)


class DonorRegister(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    area: str = Field(min_length=1, max_length=160)
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    organization: Optional[str] = Field(default=None, max_length=160)
    fssai_license: Optional[str] = Field(default=None, max_length=40)
    phone: Optional[str] = Field(default=None, max_length=40)
