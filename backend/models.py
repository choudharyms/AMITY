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

class DriverSchema(BaseModel):
    id: str
    name: str
    latitude: float
    longitude: float
    availability: bool = True
    vehicle: str = "Bike"
    capacity_kg: float = 25.0
    is_synthetic: bool = True

class DonationCreate(BaseModel):
    donor_id: str
    item: str
    category: Category
    qty_kg: float
    prepared_at: str
    temp_c: Optional[float] = None
    safe_until: Optional[str] = None
    source_text: Optional[str] = None

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

class DispatchEventSchema(BaseModel):
    id: str
    donation_id: str
    event_type: str
    message: str
    created_at: str

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

class RouteComparisonResult(BaseModel):
    joint_route_km: float
    greedy_baseline_km: float
    km_saved: float
    pct_distance_saved: float
    joint_missed_deadlines: int
    greedy_missed_deadlines: int
    stops_count: int
    computed_at: str
