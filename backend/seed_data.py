from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List
from models import DonorSchema, RecipientSchema, DriverSchema, DonationSchema, DispatchEventSchema, RescueRecordSchema, PilotDataResponse

def get_bengaluru_seed(now: datetime = None) -> PilotDataResponse:
    if now is None:
        now = datetime.now(timezone.utc)

    iso = lambda dt: dt.isoformat()

    donors = [
        DonorSchema(id="donor-toit", name="Toit Brewpub & Kitchen", area="Indiranagar", latitude=12.9793, longitude=77.6406, license_no="11220334000451", license_verified=False),
        DonorSchema(id="donor-truffles", name="Truffles Cafe", area="Koramangala", latitude=12.9352, longitude=77.6245, license_no="11221334000912", license_verified=False),
        DonorSchema(id="donor-hotel-anne", name="Hotel Annapurna Grand", area="Majestic", latitude=12.9767, longitude=77.5713, license_no="11219334001200", license_verified=False),
        DonorSchema(id="donor-bakers", name="The Baker's Dozen", area="HSR Layout", latitude=12.9121, longitude=77.6446, license_no="11222334000311", license_verified=False),
        DonorSchema(id="donor-green", name="Green Farm Organics", area="Whitefield", latitude=12.9698, longitude=77.7499, license_no="11220334000109", license_verified=False),
        DonorSchema(id="donor-canteen", name="City Tech Canteen", area="Electronic City", latitude=12.8452, longitude=77.6602, license_no="11221334000543", license_verified=False),
        DonorSchema(id="donor-mtr", name="MTR Heritage Restaurant", area="Lalbagh", latitude=12.9554, longitude=77.5855, license_no="11218334000001", license_verified=False),
        DonorSchema(id="donor-nandini", name="Nandini Deluxe Sweets", area="Malleshwaram", latitude=13.0031, longitude=77.5643, license_no="11220334000789", license_verified=False),
        DonorSchema(id="donor-palette", name="The Daily Palette Catering", area="Jayanagar", latitude=12.9250, longitude=77.5938, license_no="11221334000678", license_verified=False),
        DonorSchema(id="donor-mysore", name="Mysore Tiffin Room", area="Basavanagudi", latitude=12.9416, longitude=77.5742, license_no="11222334000889", license_verified=False),
    ]

    recipients = [
        RecipientSchema(id="recipient-ashraya", name="Ashraya Night Shelter", area="Majestic", latitude=12.9780, longitude=77.5730, capacity_kg=120.0, reserved_kg=40.0, accepts=["cooked_hot", "cooked_cold", "bakery"], need_level=5, approved=True, is_open=True, reliability=0.98),
        RecipientSchema(id="recipient-devi", name="Devi Charitable Trust Kitchen", area="Jayanagar", latitude=12.9280, longitude=77.5890, capacity_kg=80.0, reserved_kg=25.0, accepts=["cooked_hot", "produce", "packaged"], need_level=4, approved=True, is_open=True, reliability=0.94),
        RecipientSchema(id="recipient-naya", name="Naya Savera Community Center", area="Malleshwaram", latitude=13.0010, longitude=77.5710, capacity_kg=95.0, reserved_kg=20.0, accepts=["cooked_hot", "cooked_cold", "bakery", "packaged"], need_level=4, approved=True, is_open=True, reliability=0.96),
        RecipientSchema(id="recipient-sarthi", name="Sarthi Children's Home", area="Whitefield", latitude=12.9730, longitude=77.7420, capacity_kg=60.0, reserved_kg=15.0, accepts=["cooked_hot", "bakery", "produce", "packaged"], need_level=5, approved=True, is_open=True, reliability=0.99),
        RecipientSchema(id="recipient-udaya", name="Udaya Hope Shelter", area="Indiranagar", latitude=12.9750, longitude=77.6380, capacity_kg=75.0, reserved_kg=30.0, accepts=["cooked_hot", "bakery", "cooked_cold"], need_level=3, approved=True, is_open=True, reliability=0.92),
    ]

    drivers = [
        DriverSchema(id="driver-rajesh", name="Rajesh Kumar", latitude=12.9720, longitude=77.5750, availability=True, vehicle="Bike", capacity_kg=30.0),
        DriverSchema(id="driver-kiran", name="Kiran Shetty", latitude=12.9310, longitude=77.6200, availability=True, vehicle="Auto", capacity_kg=60.0),
        DriverSchema(id="driver-ankita", name="Ankita Sharma", latitude=12.9760, longitude=77.6410, availability=True, vehicle="Bike", capacity_kg=25.0),
        DriverSchema(id="driver-meera", name="Meera Nair", latitude=12.9680, longitude=77.7460, availability=False, vehicle="Eco Van", capacity_kg=100.0),
        DriverSchema(id="driver-priya", name="Priya Das", latitude=12.9150, longitude=77.6400, availability=True, vehicle="Bike", capacity_kg=25.0),
        DriverSchema(id="driver-karthik", name="Karthik V.", latitude=13.0020, longitude=77.5680, availability=True, vehicle="Auto", capacity_kg=55.0),
    ]

    donations = [
        DonationSchema(id="d-1001", donor_id="donor-toit", item="Fresh Dal Makhani & Jeera Rice (40 servings)", category="cooked_hot", qty_kg=18.0, prepared_at=iso(now - timedelta(minutes=45)), temp_c=72.0, safe_until=iso(now + timedelta(hours=3, minutes=15)), status="posted", created_at=iso(now - timedelta(minutes=40))),
        DonationSchema(id="d-1002", donor_id="donor-truffles", item="Assorted Pasta & Garlic Bread", category="cooked_hot", qty_kg=14.0, prepared_at=iso(now - timedelta(hours=1)), temp_c=65.0, safe_until=iso(now + timedelta(hours=3)), status="posted", created_at=iso(now - timedelta(minutes=50))),
        DonationSchema(id="d-1003", donor_id="donor-bakers", item="Whole wheat loafs & vegetable puffs", category="bakery", qty_kg=12.0, prepared_at=iso(now - timedelta(hours=3)), temp_c=None, safe_until=iso(now + timedelta(hours=7)), status="matched", recipient_id="recipient-udaya", driver_id="driver-ankita", created_at=iso(now - timedelta(hours=2))),
        DonationSchema(id="d-1004", donor_id="donor-green", item="Fresh bell peppers & spinach crates", category="produce", qty_kg=30.0, prepared_at=iso(now - timedelta(hours=2)), temp_c=None, safe_until=iso(now + timedelta(hours=16)), status="accepted", recipient_id="recipient-sarthi", driver_id="driver-meera", created_at=iso(now - timedelta(hours=1, minutes=30))),
        DonationSchema(id="d-1005", donor_id="donor-canteen", item="Sambar, Rasam & Rice (60 servings)", category="cooked_hot", qty_kg=28.0, prepared_at=iso(now - timedelta(hours=1, minutes=15)), temp_c=74.0, safe_until=iso(now + timedelta(hours=2, minutes=45)), status="picked_up", recipient_id="recipient-devi", driver_id="driver-kiran", created_at=iso(now - timedelta(hours=1))),
        DonationSchema(id="d-1006", donor_id="donor-hotel-anne", item="Buffet Dinner Rice & Sabzi (50 servings)", category="cooked_hot", qty_kg=22.0, prepared_at=iso(now - timedelta(hours=6)), temp_c=63.0, safe_until=iso(now - timedelta(hours=2)), status="delivered", recipient_id="recipient-ashraya", driver_id="driver-rajesh", created_at=iso(now - timedelta(hours=6))),
        DonationSchema(id="d-1007", donor_id="donor-mtr", item="Packaged sweets & breakfast mix", category="packaged", qty_kg=15.0, prepared_at=iso(now - timedelta(hours=5)), temp_c=None, safe_until=iso(now + timedelta(hours=19)), status="delivered", recipient_id="recipient-ashraya", driver_id="driver-rajesh", created_at=iso(now - timedelta(hours=5))),
        DonationSchema(id="d-1008", donor_id="donor-mysore", item="Idli & Chutney batch from morning", category="cooked_hot", qty_kg=10.0, prepared_at=iso(now - timedelta(hours=8)), temp_c=32.0, safe_until=iso(now - timedelta(hours=4)), status="expired", created_at=iso(now - timedelta(hours=8))),
    ]

    dispatch_events = [
        DispatchEventSchema(id="e-1", donation_id="d-1006", event_type="delivered", message="Rajesh delivered 22 kg from Hotel Annapurna to Ashraya Night Shelter.", created_at=iso(now - timedelta(hours=2))),
        DispatchEventSchema(id="e-2", donation_id="d-1007", event_type="delivered", message="Rajesh delivered 15 kg from MTR Heritage to Ashraya Night Shelter.", created_at=iso(now - timedelta(hours=1, minutes=30))),
        DispatchEventSchema(id="e-3", donation_id="d-1005", event_type="picked_up", message="Kiran Shetty picked up 28 kg from City Tech Canteen.", created_at=iso(now - timedelta(minutes=25))),
        DispatchEventSchema(id="e-4", donation_id="d-1003", event_type="matched", message="The Baker's Dozen matched with Udaya Hope Shelter.", created_at=iso(now - timedelta(minutes=15))),
    ]

    records = [
        RescueRecordSchema(id="rec-1", donation_id="d-1006", quantity_kg=22.0, temperature_c=63.0, area="Majestic", delivered_at=iso(now - timedelta(hours=2)), consume_by=iso(now - timedelta(hours=2))),
        RescueRecordSchema(id="rec-2", donation_id="d-1007", quantity_kg=15.0, temperature_c=None, area="Lalbagh", delivered_at=iso(now - timedelta(hours=1, minutes=30)), consume_by=iso(now + timedelta(hours=19))),
    ]

    return PilotDataResponse(
        donors=donors,
        recipients=recipients,
        drivers=drivers,
        donations=donations,
        dispatch_events=dispatch_events,
        records=records
    )
