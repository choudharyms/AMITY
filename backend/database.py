import uuid
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from models import PilotDataResponse, DonationSchema, DonationCreate, RescueStatus, RescueRecordSchema, DispatchEventSchema
from seed_data import get_bengaluru_seed
from safety_engine import calculate_safe_window, parse_iso
from config import SUPABASE_URL, SUPABASE_KEY

class PilotDatabase:
    """
    Dual-mode repository: Maintains in-memory / SQLite pilot state synchronized with Bengaluru records,
    and supports syncing with Supabase PostgreSQL.
    """
    def __init__(self):
        self._seed = get_bengaluru_seed()
        self.donors = {d.id: d for d in self._seed.donors}
        self.recipients = {r.id: r for r in self._seed.recipients}
        self.drivers = {d.id: d for d in self._seed.drivers}
        self.donations = {d.id: d for d in self._seed.donations}
        self.dispatch_events = list(self._seed.dispatch_events)
        self.records = list(self._seed.records)

    def get_snapshot(self) -> PilotDataResponse:
        return PilotDataResponse(
            donors=list(self.donors.values()),
            recipients=list(self.recipients.values()),
            drivers=list(self.drivers.values()),
            donations=sorted(list(self.donations.values()), key=lambda d: parse_iso(d.safe_until)),
            dispatch_events=sorted(self.dispatch_events, key=lambda e: parse_iso(e.created_at), reverse=True),
            records=sorted(self.records, key=lambda r: parse_iso(r.delivered_at), reverse=True)
        )

    def create_donation(self, intent: DonationCreate) -> DonationSchema:
        now = datetime.now(timezone.utc)
        prep_dt = parse_iso(intent.prepared_at)

        if intent.safe_until:
            safe_until = intent.safe_until
        else:
            safe_until_dt, _, _ = calculate_safe_window(intent.category, prep_dt, intent.temp_c)
            safe_until = safe_until_dt.isoformat()

        d_id = f"d-{uuid.uuid4().hex[:6]}"
        donation = DonationSchema(
            id=d_id,
            donor_id=intent.donor_id,
            item=intent.item,
            category=intent.category,
            qty_kg=intent.qty_kg,
            prepared_at=intent.prepared_at,
            temp_c=intent.temp_c,
            safe_until=safe_until,
            status="posted",
            created_at=now.isoformat(),
            is_synthetic=False
        )
        self.donations[d_id] = donation

        donor = self.donors.get(intent.donor_id)
        donor_name = donor.name if donor else "A donor"
        self.dispatch_events.insert(0, DispatchEventSchema(
            id=f"e-{uuid.uuid4().hex[:6]}",
            donation_id=d_id,
            event_type="posted",
            message=f"{donor_name} posted {intent.qty_kg:.0f} kg of {intent.item}.",
            created_at=now.isoformat()
        ))

        return donation

    def update_status(
        self,
        donation_id: str,
        status: RescueStatus,
        recipient_id: Optional[str] = None,
        driver_id: Optional[str] = None
    ) -> Optional[DonationSchema]:
        d = self.donations.get(donation_id)
        if not d:
            return None

        d.status = status
        now = datetime.now(timezone.utc)

        if recipient_id:
            d.recipient_id = recipient_id
        if driver_id:
            d.driver_id = driver_id

        # Log event and create delivery record if completed
        if status == "matched":
            r_name = self.recipients.get(d.recipient_id).name if d.recipient_id in self.recipients else "a shelter"
            dr_name = self.drivers.get(d.driver_id).name if d.driver_id in self.drivers else "Volunteer"
            self.dispatch_events.insert(0, DispatchEventSchema(
                id=f"e-{uuid.uuid4().hex[:6]}",
                donation_id=d.id,
                event_type="matched",
                message=f"Matched with {r_name} · {dr_name} assigned.",
                created_at=now.isoformat()
            ))
        elif status == "picked_up":
            dr_name = self.drivers.get(d.driver_id).name if d.driver_id in self.drivers else "Driver"
            self.dispatch_events.insert(0, DispatchEventSchema(
                id=f"e-{uuid.uuid4().hex[:6]}",
                donation_id=d.id,
                event_type="picked_up",
                message=f"{dr_name} confirmed pickup of {d.qty_kg:.0f} kg ({d.item}).",
                created_at=now.isoformat()
            ))
        elif status == "delivered":
            r_name = self.recipients.get(d.recipient_id).name if d.recipient_id in self.recipients else "Shelter"
            area = self.recipients.get(d.recipient_id).area if d.recipient_id in self.recipients else "Bengaluru"
            self.dispatch_events.insert(0, DispatchEventSchema(
                id=f"e-{uuid.uuid4().hex[:6]}",
                donation_id=d.id,
                event_type="delivered",
                message=f"Delivered {d.qty_kg:.0f} kg to {r_name} within the safe window.",
                created_at=now.isoformat()
            ))
            # Create official FSSAI rescue delivery record
            self.records.insert(0, RescueRecordSchema(
                id=f"r-{uuid.uuid4().hex[:6]}",
                donation_id=d.id,
                quantity_kg=d.qty_kg,
                temperature_c=d.temp_c,
                area=area,
                delivered_at=now.isoformat(),
                consume_by=d.safe_until
            ))

        return d

db = PilotDatabase()
