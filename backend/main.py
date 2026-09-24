from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict, Any, List

from models import (
    PilotDataResponse, DonationCreate, DonationSchema,
    NLPParseRequest, NLPParseResponse, MatchCandidate, RouteComparisonResult
)
from database import db
from nlp_intake import parse_donor_message
from matching_engine import match_donation_to_recipients
from routing_engine import compare_routing_strategies
from config import GEMINI_API_KEY, ORS_API_KEY, SUPABASE_URL

app = FastAPI(
    title="AaharSetu Food Rescue Routing Engine",
    description="Real-Time Food Rescue Routing & Safe Food Coordination API for AMIHACKS 1.0",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/health")
def get_health() -> Dict[str, Any]:
    return {
        "ok": True,
        "service": "AaharSetu Real-Time Food Rescue Routing",
        "routing": "ors" if ORS_API_KEY else "haversine",
        "gemini": bool(GEMINI_API_KEY),
        "telegram": False,
        "deployed": "local",
        "supabase_configured": bool(SUPABASE_URL),
        "city": "Bengaluru, India"
    }

@app.get("/api/pilot-data", response_model=PilotDataResponse)
def get_pilot_data():
    return db.get_snapshot()

@app.post("/api/donations/intake-nlp", response_model=NLPParseResponse)
def intake_nlp(request: NLPParseRequest):
    if not request.text or len(request.text.strip()) == 0:
        raise HTTPException(status_code=400, detail="Text message cannot be empty")
    return parse_donor_message(request.text)

@app.post("/api/donations", response_model=DonationSchema)
def create_donation(donation: DonationCreate):
    return db.create_donation(donation)

@app.get("/api/donations/{id}/matches", response_model=List[MatchCandidate])
def get_matches(id: str):
    snapshot = db.get_snapshot()
    donation = next((d for d in snapshot.donations if d.id == id), None)
    if not donation:
        raise HTTPException(status_code=404, detail="Donation not found")
    donor = next((dn for dn in snapshot.donors if dn.id == donation.donor_id), None)
    if not donor:
        raise HTTPException(status_code=404, detail="Donor profile not found")
    return match_donation_to_recipients(donation, donor, snapshot.recipients)

@app.post("/api/donations/{id}/match", response_model=DonationSchema)
def match_donation(id: str):
    snapshot = db.get_snapshot()
    donation = next((d for d in snapshot.donations if d.id == id), None)
    if not donation:
        raise HTTPException(status_code=404, detail="Donation not found")
    donor = next((dn for dn in snapshot.donors if dn.id == donation.donor_id), None)
    matches = match_donation_to_recipients(donation, donor, snapshot.recipients)
    top_match = next((m for m in matches if m.is_deliverable), None)

    recipient_id = top_match.recipient.id if top_match else snapshot.recipients[0].id
    available_driver = next((dr for dr in snapshot.drivers if dr.availability), snapshot.drivers[0])

    updated = db.update_status(id, "matched", recipient_id=recipient_id, driver_id=available_driver.id)
    return updated

@app.post("/api/donations/{id}/pickup", response_model=DonationSchema)
def pickup_donation(id: str):
    updated = db.update_status(id, "picked_up")
    if not updated:
        raise HTTPException(status_code=404, detail="Donation not found")
    return updated

@app.post("/api/donations/{id}/deliver", response_model=DonationSchema)
def deliver_donation(id: str):
    updated = db.update_status(id, "delivered")
    if not updated:
        raise HTTPException(status_code=404, detail="Donation not found")
    return updated

@app.post("/api/donations/{id}/escalate", response_model=DonationSchema)
def escalate_donation(id: str):
    updated = db.escalate_donation(id)
    if not updated:
        raise HTTPException(status_code=404, detail="Donation not found")
    return updated


@app.get("/api/routes/compare", response_model=RouteComparisonResult)
def get_route_comparison():
    snapshot = db.get_snapshot()
    return compare_routing_strategies(
        snapshot.donations,
        snapshot.donors,
        snapshot.recipients,
        snapshot.drivers
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
