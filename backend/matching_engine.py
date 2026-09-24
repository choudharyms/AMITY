import math
from datetime import datetime, timezone
from typing import List, Tuple, Optional
from models import DonationSchema, RecipientSchema, MatchCandidate, MatchScoreBreakdown, DonorSchema
from safety_engine import parse_iso, is_rescue_viable
from config import ORS_API_KEY
import httpx

EARTH_RADIUS_KM = 6371.0

def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Computes distance between two coordinates in kilometers.
    """
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2.0)**2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2.0)**2
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return EARTH_RADIUS_KM * c

def estimate_transit_time_minutes(distance_km: float) -> int:
    """
    Bengaluru city traffic estimate: ~18 km/h average speed in city conditions + 5m setup.
    """
    return max(8, int((distance_km / 18.0) * 60) + 5)

def road_estimates(donor: DonorSchema, recipients: List[RecipientSchema]) -> dict:
    if not recipients:
        return {}
    if not ORS_API_KEY:
        raise RuntimeError("OpenRouteService is not configured")
    coordinates = [[donor.longitude, donor.latitude]] + [
        [recipient.longitude, recipient.latitude] for recipient in recipients
    ]
    try:
        response = httpx.post(
            "https://api.openrouteservice.org/v2/matrix/driving-car",
            headers={"Authorization": ORS_API_KEY, "Content-Type": "application/json"},
            json={"locations": coordinates, "sources": [0], "destinations": list(range(1, len(coordinates))), "metrics": ["distance", "duration"]},
            timeout=15.0,
        )
        response.raise_for_status()
        payload = response.json()
        distances, durations = payload["distances"][0], payload["durations"][0]
        return {
            recipient.id: (float(distances[index]) / 1000.0, max(1, int(float(durations[index]) / 60.0)))
            for index, recipient in enumerate(recipients)
            if distances[index] is not None and durations[index] is not None
        }
    except (httpx.HTTPError, KeyError, IndexError, TypeError, ValueError) as exc:
        raise RuntimeError("OpenRouteService could not estimate recipient routes") from exc

def match_donation_to_recipients(
    donation: DonationSchema,
    donor: DonorSchema,
    recipients: List[RecipientSchema],
    current_time: Optional[datetime] = None
) -> List[MatchCandidate]:
    """
    Ranks recipient shelters using the 5-factor weighted scoring formula:
    Score = 0.35*time_slack + 0.25*proximity + 0.20*need + 0.10*capacity + 0.10*reliability
    Applies strict hard filters (FSSAI window, category acceptance, available capacity, open status).
    """
    now = current_time or datetime.now(timezone.utc)
    safe_until_dt = parse_iso(donation.safe_until)
    candidates: List[MatchCandidate] = []
    estimates = road_estimates(donor, recipients)

    for r in recipients:
        estimate = estimates.get(r.id)
        if not estimate:
            continue
        dist_km, transit_mins = estimate

        # 1. Hard Filter: Safety Window & Transit Viability
        viable, remaining_mins, reason_str = is_rescue_viable(safe_until_dt, transit_mins, now)
        if not viable:
            candidates.append(MatchCandidate(
                recipient=r,
                score_breakdown=MatchScoreBreakdown(
                    time_slack_score=0.0, proximity_score=0.0, need_score=0.0,
                    capacity_score=0.0, reliability_score=0.0, total_score=0.0,
                    reasons=[f"Blocked by Safety Engine: {reason_str}"]
                ),
                estimated_transit_minutes=transit_mins,
                is_deliverable=False,
                blocking_reason=reason_str
            ))
            continue

        # 2. Hard Filter: Category Acceptance
        if donation.category not in r.accepts:
            candidates.append(MatchCandidate(
                recipient=r,
                score_breakdown=MatchScoreBreakdown(
                    time_slack_score=0.0, proximity_score=0.0, need_score=0.0,
                    capacity_score=0.0, reliability_score=0.0, total_score=0.0,
                    reasons=[f"Category Mismatch: shelter does not accept '{donation.category}'"]
                ),
                estimated_transit_minutes=transit_mins,
                is_deliverable=False,
                blocking_reason=f"Shelter does not accept {donation.category}"
            ))
            continue

        # 3. Hard Filter: Recipient Operational & Approved
        if not r.approved or not r.is_open:
            candidates.append(MatchCandidate(
                recipient=r,
                score_breakdown=MatchScoreBreakdown(
                    time_slack_score=0.0, proximity_score=0.0, need_score=0.0,
                    capacity_score=0.0, reliability_score=0.0, total_score=0.0,
                    reasons=["Shelter is closed or pending administrative verification"]
                ),
                estimated_transit_minutes=transit_mins,
                is_deliverable=False,
                blocking_reason="Shelter is closed or unapproved"
            ))
            continue

        # 4. Hard Filter: Capacity Fit
        available_capacity = max(0.0, r.capacity_kg - r.reserved_kg)
        if available_capacity < donation.qty_kg:
            candidates.append(MatchCandidate(
                recipient=r,
                score_breakdown=MatchScoreBreakdown(
                    time_slack_score=0.0, proximity_score=0.0, need_score=0.0,
                    capacity_score=0.0, reliability_score=0.0, total_score=0.0,
                    reasons=[f"Capacity Exceeded: Needs {donation.qty_kg}kg, only {available_capacity}kg free"]
                ),
                estimated_transit_minutes=transit_mins,
                is_deliverable=False,
                blocking_reason="Insufficient storage capacity"
            ))
            continue

        # --- COMPUTE WEIGHTED SCORE ---
        # Factor A: Time Slack (Weight 0.35)
        # Slack = remaining minutes beyond required transit + buffer
        required_mins = transit_mins + 35
        slack_mins = max(0, remaining_mins - required_mins)
        time_slack_score = min(1.0, slack_mins / 90.0) # max out at 90 min slack

        # Factor B: Proximity (Weight 0.25)
        # Closer is better; 1km = 1.0, 15km = 0.0
        proximity_score = max(0.0, min(1.0, 1.0 - (dist_km / 15.0)))

        # Factor C: Need Level (Weight 0.20)
        # Scale 1-5
        need_score = min(1.0, max(0.1, r.need_level / 5.0))

        # Factor D: Capacity Fit (Weight 0.10)
        # How well the donation utilizes available room without overloading
        capacity_score = min(1.0, max(0.2, donation.qty_kg / max(1.0, available_capacity)))

        # Factor E: Reliability Score (Weight 0.10)
        reliability_score = min(1.0, max(0.1, r.reliability))

        # Total Weighted Score
        total_score = round(
            (0.35 * time_slack_score) +
            (0.25 * proximity_score) +
            (0.20 * need_score) +
            (0.10 * capacity_score) +
            (0.10 * reliability_score),
            4
        )

        reasons = [
            f"Time Slack: {round(time_slack_score*100)}% ({slack_mins}m buffer before safe window closes)",
            f"Proximity: {round(proximity_score*100)}% ({dist_km:.1f} km away, ~{transit_mins}m transit)",
            f"Need Priority: Level {r.need_level}/5 ({round(need_score*100)}%)",
            f"Capacity Fit: {available_capacity:.0f}kg free space for {donation.qty_kg:.0f}kg payload",
            f"Reliability: {round(r.reliability*100)}% verified acceptance rate"
        ]

        candidates.append(MatchCandidate(
            recipient=r,
            score_breakdown=MatchScoreBreakdown(
                time_slack_score=round(time_slack_score, 3),
                proximity_score=round(proximity_score, 3),
                need_score=round(need_score, 3),
                capacity_score=round(capacity_score, 3),
                reliability_score=round(reliability_score, 3),
                total_score=total_score,
                reasons=reasons
            ),
            estimated_transit_minutes=transit_mins,
            is_deliverable=True,
            blocking_reason=None
        ))

    # Sort deliverable first, then by total score descending
    candidates.sort(key=lambda c: (c.is_deliverable, c.score_breakdown.total_score), reverse=True)
    return candidates
