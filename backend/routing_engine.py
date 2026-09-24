from datetime import datetime, timezone, timedelta
from itertools import permutations
from typing import Any, Dict, List, Tuple

import httpx

from config import ORS_API_KEY
from models import DonationSchema, DonorSchema, RecipientSchema, DriverSchema, RouteComparisonResult
from safety_engine import parse_iso


def compare_routing_strategies(
    donations: List[DonationSchema],
    donors: List[DonorSchema],
    recipients: List[RecipientSchema],
    drivers: List[DriverSchema],
) -> RouteComparisonResult:
    """Compare a nearest-road-first route with a deadline-aware road route."""
    now = datetime.now(timezone.utc)
    donor_map = {donor.id: donor for donor in donors}
    jobs: List[Dict[str, Any]] = []
    for donation in donations:
        if donation.status not in ("posted", "matched", "accepted"):
            continue
        donor = donor_map.get(donation.donor_id)
        if donor:
            jobs.append({
                "name": f"Pickup: {donor.name} ({donation.item})",
                "area": donor.area,
                "lat": donor.latitude,
                "lng": donor.longitude,
                "type": "pickup",
                "safe_until": donation.safe_until,
            })
    jobs = jobs[:6]
    active_driver = next((driver for driver in drivers if driver.availability), None)
    if not jobs or not active_driver:
        return RouteComparisonResult(
            joint_route_km=0.0, greedy_baseline_km=0.0, km_saved=0.0,
            pct_distance_saved=0.0, joint_missed_deadlines=0,
            greedy_missed_deadlines=0, stops_count=0, computed_at=now.isoformat(),
        )
    if not ORS_API_KEY:
        raise RuntimeError("OpenRouteService is not configured")

    coordinates = [[active_driver.longitude, active_driver.latitude]] + [
        [job["lng"], job["lat"]] for job in jobs
    ]
    try:
        matrix_response = httpx.post(
            "https://api.openrouteservice.org/v2/matrix/driving-car",
            headers={"Authorization": ORS_API_KEY, "Content-Type": "application/json"},
            json={"locations": coordinates, "metrics": ["distance", "duration"]},
            timeout=20.0,
        )
        matrix_response.raise_for_status()
        matrix = matrix_response.json()
        distances = matrix["distances"]
        durations = matrix["durations"]
    except (httpx.HTTPError, KeyError, IndexError, TypeError, ValueError) as exc:
        raise RuntimeError("OpenRouteService could not estimate city road routes") from exc

    def itinerary_metrics(order: Tuple[int, ...]) -> Tuple[int, float, float]:
        current_index = 0
        current_time = now
        total_distance = 0.0
        total_duration = 0.0
        missed = 0
        for job_index in order:
            matrix_index = job_index + 1
            distance = distances[current_index][matrix_index]
            duration = durations[current_index][matrix_index]
            if distance is None or duration is None:
                return len(order), float("inf"), float("inf")
            total_distance += float(distance)
            total_duration += float(duration)
            current_time += timedelta(seconds=float(duration) + 600)
            if current_time > parse_iso(jobs[job_index]["safe_until"]):
                missed += 1
            current_index = matrix_index
        return missed, total_distance, total_duration

    remaining = set(range(len(jobs)))
    greedy_order: List[int] = []
    current_index = 0
    while remaining:
        next_job = min(
            remaining,
            key=lambda job_index: (
                distances[current_index][job_index + 1]
                if distances[current_index][job_index + 1] is not None else float("inf"),
                job_index,
            ),
        )
        if distances[current_index][next_job + 1] is None or durations[current_index][next_job + 1] is None:
            raise RuntimeError("OpenRouteService found an unreachable pickup location")
        greedy_order.append(next_job)
        current_index = next_job + 1
        remaining.remove(next_job)

    # At most six stops are considered, so exhaustive ordering is bounded at 720 routes.
    joint_order = min(
        permutations(range(len(jobs))),
        key=lambda order: (*itinerary_metrics(order), order),
    )

    def road_result(order: Tuple[int, ...] | List[int]) -> Tuple[float, int]:
        route_coordinates = [coordinates[0]] + [coordinates[index + 1] for index in order]
        try:
            response = httpx.post(
                "https://api.openrouteservice.org/v2/directions/driving-car/json",
                headers={"Authorization": ORS_API_KEY, "Content-Type": "application/json"},
                json={"coordinates": route_coordinates},
                timeout=20.0,
            )
            response.raise_for_status()
            route = response.json()["routes"][0]
            summary = route["summary"]
            segments = route["segments"]
            if len(segments) != len(order):
                raise ValueError("Route segment count did not match the stop sequence")
        except (httpx.HTTPError, KeyError, IndexError, TypeError, ValueError) as exc:
            raise RuntimeError("OpenRouteService could not calculate this city route") from exc

        current_time = now
        missed = 0
        for index, job_index in enumerate(order):
            current_time += timedelta(seconds=float(segments[index]["duration"]) + 600)
            if current_time > parse_iso(jobs[job_index]["safe_until"]):
                missed += 1
        return round(float(summary["distance"]) / 1000.0, 2), missed

    greedy_km, greedy_missed = road_result(greedy_order)
    joint_km, joint_missed = road_result(joint_order)
    km_saved = round(greedy_km - joint_km, 2)
    pct_saved = round((km_saved / max(1.0, greedy_km)) * 100, 1)
    return RouteComparisonResult(
        joint_route_km=joint_km,
        greedy_baseline_km=greedy_km,
        km_saved=km_saved,
        pct_distance_saved=pct_saved,
        joint_missed_deadlines=joint_missed,
        greedy_missed_deadlines=greedy_missed,
        stops_count=len(jobs),
        computed_at=now.isoformat(),
    )
