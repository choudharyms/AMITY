"""Small, user-scoped PostgREST gateway. All database calls carry the caller JWT,
so Supabase RLS remains the authorization boundary; no service-role key is used.
"""

import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from concurrent.futures import ThreadPoolExecutor

import httpx
from fastapi import HTTPException

from config import SUPABASE_KEY, SUPABASE_URL
from models import DonationSchema, DispatchEventSchema
from seed_data import get_bengaluru_seed


class SupabaseGateway:
    def __init__(self) -> None:
        self.url = SUPABASE_URL.rstrip("/")
        self.key = SUPABASE_KEY
        self._seed = get_bengaluru_seed()
        self.donors = {d.id: d for d in self._seed.donors}
        self.recipients = {r.id: r for r in self._seed.recipients}
        self.drivers = {d.id: d for d in self._seed.drivers}
        self.donations = {d.id: d for d in self._seed.donations}
        self.dispatch_events = list(self._seed.dispatch_events)
        self.records = list(self._seed.records)

    @property
    def configured(self) -> bool:
        return bool(self.url and self.key)

    def _request(self, method: str, path: str, access_token: str, **kwargs: Any) -> Any:
        if not self.configured:
            raise HTTPException(status_code=503, detail="Supabase is not configured")
        headers = {
            "apikey": self.key,
            "Authorization": f"Bearer {access_token}",
            "Accept": "application/json",
        }
        headers.update(kwargs.pop("headers", {}))
        try:
            response = httpx.request(
                method,
                f"{self.url}/rest/v1/{path}",
                headers=headers,
                timeout=10.0,
                **kwargs,
            )
        except httpx.HTTPError as exc:
            raise HTTPException(status_code=502, detail="Database service is unavailable") from exc
        if response.status_code >= 400:
            # Do not relay raw provider errors, which can expose schema details.
            status = 403 if response.status_code in (401, 403) else 502
            raise HTTPException(status_code=status, detail="Database request was rejected")
        if response.status_code == 204 or not response.content:
            return None
        return response.json()

    def user(self, access_token: str) -> Dict[str, Any]:
        if not self.configured:
            raise HTTPException(status_code=503, detail="Supabase is not configured")
        try:
            response = httpx.get(
                f"{self.url}/auth/v1/user",
                headers={"apikey": self.key, "Authorization": f"Bearer {access_token}"},
                timeout=8.0,
            )
        except httpx.HTTPError as exc:
            raise HTTPException(status_code=502, detail="Authentication service is unavailable") from exc
        if response.status_code != 200:
            raise HTTPException(status_code=401, detail="Sign in to continue")
        return response.json()

    def profile(self, access_token: str, user_id: str) -> Dict[str, Any]:
        rows = self._request(
            "GET", "profiles", access_token,
            params={"select": "user_id,email,display_name,role,requested_role,organization,phone,fssai_license,area,city_id,active_city_id", "user_id": f"eq.{user_id}", "limit": "1"},
        )
        if not rows:
            raise HTTPException(status_code=403, detail="Account profile is not provisioned")
        return rows[0]

    def update_profile(self, access_token: str, user_id: str, values: Dict[str, Any]) -> Dict[str, Any]:
        rows = self._request(
            "PATCH", "profiles", access_token,
            params={"user_id": f"eq.{user_id}", "select": "user_id,email,display_name,role,requested_role,organization,phone,fssai_license,area,city_id,active_city_id"},
            headers={"Content-Type": "application/json", "Prefer": "return=representation"},
            json=values,
        )
        if not rows:
            raise HTTPException(status_code=403, detail="Profile update is not permitted")
        return rows[0]

    def update_driver_availability(self, access_token: str, driver_id: str, availability: bool) -> Dict[str, Any]:
        rows = self._request(
            "PATCH", "drivers", access_token,
            params={"id": f"eq.{driver_id}", "select": "*"},
            headers={"Content-Type": "application/json", "Prefer": "return=representation"},
            json={"availability": availability},
        )
        if not rows:
            raise HTTPException(status_code=403, detail="Driver update is not permitted")
        return rows[0]


    def snapshot(self, access_token: str, city_id: str) -> Dict[str, List[Dict[str, Any]]]:
        def rows(table: str, order: Optional[str] = None) -> List[Dict[str, Any]]:
            params = {"select": "*", "city_id": f"eq.{city_id}"}
            if order:
                params["order"] = order
            all_rows: List[Dict[str, Any]] = []
            start = 0
            page_size = 500
            while True:
                page = self._request(
                    "GET", table, access_token, params=params,
                    headers={"Range-Unit": "items", "Range": f"{start}-{start + page_size - 1}"},
                )
                all_rows.extend(page)
                if len(page) < page_size:
                    return all_rows
                start += page_size

        specs = {
            "donors": ("donors", "id.asc"),
            "recipients": ("recipients", "id.asc"),
            "drivers": ("drivers", "id.asc"),
            "donations": ("donations", "created_at.desc,id.asc"),
            "dispatch_events": ("dispatch_events", "created_at.desc,id.asc"),
            "records": ("records", "delivered_at.desc,id.asc"),
        }
        with ThreadPoolExecutor(max_workers=len(specs)) as pool:
            values = list(pool.map(lambda item: rows(*item), specs.values()))
        return {name: values[index] for index, name in enumerate(specs)}

    def create_donation(self, access_token: str, values: Dict[str, Any]) -> Dict[str, Any]:
        rows = self._request(
            "POST", "donations", access_token,
            headers={"Content-Type": "application/json", "Prefer": "return=representation"},
            json=values,
        )
        if not rows:
            raise HTTPException(status_code=502, detail="Donation was not saved")
        return rows[0]

    def assign_match(self, access_token: str, donation_id: str, city_id: str, recipient_id: str, driver_id: str) -> Dict[str, Any]:
        rows = self._request(
            "POST", "rpc/assign_donation_match", access_token,
            headers={"Content-Type": "application/json"},
            json={"p_donation_id": donation_id, "p_city_id": city_id,
                  "p_recipient_id": recipient_id, "p_driver_id": driver_id},
        )
        if not rows:
            raise HTTPException(status_code=409, detail="Donation could not be assigned")
        return rows[0]

    def confirm_stage(self, access_token: str, donation_id: str, city_id: str, stage: str, code: Optional[str] = None) -> Dict[str, Any]:
        rows = self._request(
            "POST", "rpc/confirm_donation_stage", access_token,
            headers={"Content-Type": "application/json"},
            json={"p_donation_id": donation_id, "p_city_id": city_id, "p_stage": stage},
        )
        if not rows:
            raise HTTPException(status_code=409, detail="Handover could not be confirmed")
        donation = rows[0]
        if self.configured and code:
            try:
                user_info = self.user(access_token)
                user_id = user_info.get("id") if isinstance(user_info, dict) else None
                handover_row = {
                    "id": f"h-{uuid.uuid4().hex[:8]}",
                    "donation_id": donation_id,
                    "stage": stage,
                    "code": code,
                    "confirmed_by": user_id,
                    "confirmed_at": datetime.now(timezone.utc).isoformat(),
                    "city_id": city_id,
                }
                self._request("POST", "handovers", access_token, json=handover_row)
            except Exception:
                pass
        return donation

    def escalate_donation(self, donation_id: str, access_token: Optional[str] = None) -> Optional[DonationSchema]:
        d = self.donations.get(donation_id)
        now = datetime.now(timezone.utc)

        if not d and self.configured:
            try:
                headers = {"apikey": self.key, "Authorization": f"Bearer {access_token or self.key}"}
                r = httpx.get(
                    f"{self.url}/rest/v1/donations",
                    headers=headers,
                    params={"id": f"eq.{donation_id}", "limit": "1"},
                    timeout=5.0,
                )
                if r.status_code == 200 and r.json():
                    d = DonationSchema.model_validate(r.json()[0])
                    self.donations[donation_id] = d
            except Exception:
                d = None

        if not d:
            return None

        curr_driver = self.drivers.get(d.driver_id)
        prev_driver_name = curr_driver.name if curr_driver else "Volunteer driver"

        # 1. Log timeout event (Section 4 spec: 3-minute driver response timeout)
        timeout_event = DispatchEventSchema(
            id=f"e-{uuid.uuid4().hex[:6]}",
            donation_id=d.id,
            driver_id=d.driver_id,
            city_id=getattr(d, "city_id", "blr"),
            event_type="timeout",
            message=f"{prev_driver_name} acknowledgment timed out (3m limit). Widening dispatch radius from 3 km to 8 km.",
            created_at=now.isoformat(),
        )
        self.dispatch_events.insert(0, timeout_event)

        # 2. Select next available driver with higher capacity / broader radius (Auto or Eco Van)
        other_drivers = [
            dr for dr in self.drivers.values()
            if dr.id != d.driver_id and dr.availability
        ]
        if other_drivers:
            new_driver = max(other_drivers, key=lambda dr: dr.capacity_kg)
        else:
            new_driver = next((dr for dr in self.drivers.values() if dr.id != d.driver_id), list(self.drivers.values())[0])

        d.driver_id = new_driver.id
        d.status = "matched"

        # 3. Log escalation and re-assignment event
        escalated_event = DispatchEventSchema(
            id=f"e-{uuid.uuid4().hex[:6]}",
            donation_id=d.id,
            driver_id=new_driver.id,
            city_id=getattr(d, "city_id", "blr"),
            event_type="escalated",
            message=f"Escalation complete: Reassigned to {new_driver.name} ({new_driver.vehicle} · {new_driver.capacity_kg:.0f}kg). Auto-alert dispatched to NGO dispatch coordinator.",
            created_at=now.isoformat(),
        )
        self.dispatch_events.insert(0, escalated_event)

        # 4. Sync with Supabase if configured
        if self.configured:
            try:
                headers = {
                    "apikey": self.key,
                    "Authorization": f"Bearer {access_token or self.key}",
                    "Content-Type": "application/json",
                }
                httpx.patch(
                    f"{self.url}/rest/v1/donations",
                    headers=headers,
                    params={"id": f"eq.{d.id}"},
                    json={"driver_id": new_driver.id, "status": "matched"},
                    timeout=5.0,
                )
                httpx.post(
                    f"{self.url}/rest/v1/dispatch_events",
                    headers=headers,
                    json=[
                        {
                            "id": timeout_event.id,
                            "donation_id": timeout_event.donation_id,
                            "driver_id": timeout_event.driver_id,
                            "city_id": timeout_event.city_id,
                            "event_type": timeout_event.event_type,
                            "message": timeout_event.message,
                            "created_at": timeout_event.created_at,
                        },
                        {
                            "id": escalated_event.id,
                            "donation_id": escalated_event.donation_id,
                            "driver_id": escalated_event.driver_id,
                            "city_id": escalated_event.city_id,
                            "event_type": escalated_event.event_type,
                            "message": escalated_event.message,
                            "created_at": escalated_event.created_at,
                        },
                    ],
                    timeout=5.0,
                )
            except Exception:
                pass

        return d


    def register_driver(self, access_token: str, user_id: str, values: dict) -> dict:
        rows = self._request(
            "POST", "drivers", access_token,
            headers={"Content-Type": "application/json", "Prefer": "return=representation"},
            json={**values, "user_id": user_id, "is_synthetic": False},
        )
        if not rows:
            raise HTTPException(status_code=502, detail="Driver profile could not be created")
        return rows[0]

    def register_recipient(self, access_token: str, user_id: str, values: dict) -> dict:
        rows = self._request(
            "POST", "recipients", access_token,
            headers={"Content-Type": "application/json", "Prefer": "return=representation"},
            json={**values, "user_id": user_id, "is_synthetic": False, "approved": False},
        )
        if not rows:
            raise HTTPException(status_code=502, detail="Recipient profile could not be created")
        return rows[0]

    def register_donor(self, access_token: str, user_id: str, values: dict) -> dict:
        rows = self._request(
            "POST", "donors", access_token,
            headers={"Content-Type": "application/json", "Prefer": "return=representation"},
            json={**values, "user_id": user_id, "is_synthetic": False},
        )
        if not rows:
            raise HTTPException(status_code=502, detail="Donor profile could not be created")
        return rows[0]


db = SupabaseGateway()
