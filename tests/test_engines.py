import unittest
from datetime import datetime, timezone, timedelta
from safety_engine import calculate_safe_window, is_rescue_viable
from matching_engine import haversine_distance, estimate_transit_time_minutes, match_donation_to_recipients
from routing_engine import compute_greedy_baseline, compute_joint_vrp
from nlp_intake import rule_based_fallback_parse
from models import DonorSchema, RecipientSchema, DriverSchema, DonationSchema

class TestAaharSetuEngines(unittest.TestCase):

    def test_safety_engine_fssai_rules(self):
        now = datetime.now(timezone.utc)
        
        # Cooked hot >= 60C -> 4 hour window
        safe_until, window, rationale = calculate_safe_window("cooked_hot", now, temp_c=72.0)
        self.assertEqual(window, 4.0)
        self.assertIn("60", rationale)

        # Cooked hot < 65C / cooling -> strict 2 hour window
        safe_until_strict, window_strict, _ = calculate_safe_window("cooked_hot", now, temp_c=58.0)
        self.assertEqual(window_strict, 2.0)

        # Viability check: remaining time must exceed transit + buffer
        viable, rem_mins, _ = is_rescue_viable(now + timedelta(hours=2), estimated_transit_minutes=20, current_time=now)
        self.assertTrue(viable)
        self.assertGreaterEqual(rem_mins, 115)

        # Expired or too late
        not_viable, _, _ = is_rescue_viable(now + timedelta(minutes=25), estimated_transit_minutes=20, current_time=now)
        self.assertFalse(not_viable)

    def test_haversine_and_transit(self):
        # Indiranagar to Koramangala (~5-6 km)
        dist = haversine_distance(12.9793, 77.6406, 12.9352, 77.6245)
        self.assertTrue(4.0 <= dist <= 7.0)
        transit_mins = estimate_transit_time_minutes(dist)
        self.assertGreaterEqual(transit_mins, 15)

    def test_matching_engine_filters_and_scores(self):
        now = datetime.now(timezone.utc)
        donor = DonorSchema(id="d-1", name="Cafe", area="Indiranagar", latitude=12.9793, longitude=77.6406)
        
        good_recipient = RecipientSchema(
            id="r-good", name="Shelter A", area="Indiranagar", latitude=12.9750, longitude=77.6380,
            capacity_kg=100.0, reserved_kg=10.0, accepts=["cooked_hot"], need_level=5,
            approved=True, is_open=True, reliability=0.98
        )
        unapproved_recipient = RecipientSchema(
            id="r-unapproved", name="Shelter B", area="Indiranagar", latitude=12.9750, longitude=77.6380,
            capacity_kg=100.0, reserved_kg=10.0, accepts=["cooked_hot"], need_level=5,
            approved=False, is_open=True, reliability=0.98
        )

        donation = DonationSchema(
            id="don-1", donor_id="d-1", item="Biryani", category="cooked_hot", qty_kg=20.0,
            prepared_at=now.isoformat(), temp_c=70.0,
            safe_until=(now + timedelta(hours=3)).isoformat(),
            status="posted", created_at=now.isoformat()
        )

        matches = match_donation_to_recipients(donation, donor, [good_recipient, unapproved_recipient], current_time=now)
        self.assertEqual(len(matches), 2)
        self.assertEqual(matches[0].recipient.id, "r-good")
        self.assertTrue(matches[0].is_deliverable)
        self.assertGreater(matches[0].score_breakdown.total_score, 0.5)
        
        # Second should be blocked due to lack of approval
        self.assertEqual(matches[1].recipient.id, "r-unapproved")
        self.assertFalse(matches[1].is_deliverable)

    def test_joint_vrp_vs_greedy(self):
        now = datetime.now(timezone.utc)
        driver = DriverSchema(id="dr-1", name="Volunteer", latitude=12.9700, longitude=77.6000, availability=True, capacity_kg=50.0)
        
        jobs = [
            {"name": "Stop 1", "area": "Indiranagar", "lat": 12.9780, "lng": 77.6400, "type": "pickup", "safe_until": (now + timedelta(hours=1, minutes=10)).isoformat()},
            {"name": "Stop 2", "area": "Koramangala", "lat": 12.9350, "lng": 77.6200, "type": "pickup", "safe_until": (now + timedelta(hours=4)).isoformat()},
            {"name": "Stop 3", "area": "Majestic", "lat": 12.9760, "lng": 77.5710, "type": "pickup", "safe_until": (now + timedelta(hours=3)).isoformat()},
        ]

        greedy_km, greedy_missed, _ = compute_greedy_baseline(jobs, driver, now)
        joint_km, joint_missed, _ = compute_joint_vrp(jobs, driver, now)

        self.assertEqual(joint_missed, 0)
        self.assertLessEqual(joint_km, greedy_km + 1.0)

    def test_nlp_fallback_parsing(self):
        text = "Tiffin center se 35 plates paneer biryani garam hai, 15 kg ready abhi"
        parsed = rule_based_fallback_parse(text)
        self.assertTrue("Biryani" in parsed.item or "Paneer" in parsed.item)
        self.assertEqual(parsed.category, "cooked_hot")
        self.assertGreater(parsed.qty_kg, 0)
        self.assertEqual(parsed.temp_c, 70.0)

    def test_timeout_escalation(self):
        from database import db
        # Escalate d-1003 (which is in matched status)
        escalated = db.escalate_donation("d-1003")
        self.assertIsNotNone(escalated)
        self.assertEqual(escalated.status, "matched")
        
        # Check that dispatch events logged the timeout and escalation
        recent_events = db.dispatch_events[:2]
        event_types = [e.event_type for e in recent_events]
        self.assertIn("timeout", event_types)
        self.assertIn("escalated", event_types)

if __name__ == '__main__':
    unittest.main()

