-- AaharSetu (आहारसेतु) Database Seed
-- Bengaluru Pilot Network: Donors, Recipients, Drivers, and Real-Time Countdown Donations

-- Clean existing demo data (idempotent)
DELETE FROM records;
DELETE FROM handovers;
DELETE FROM dispatch_events;
DELETE FROM matches;
DELETE FROM donations;
DELETE FROM drivers;
DELETE FROM recipients;
DELETE FROM donors;

-- 1. DONORS (Bengaluru Restaurants, Kitchens, Bakeries)
INSERT INTO donors (id, name, type, area, latitude, longitude, contact, license_no, license_verified, is_synthetic) VALUES
('donor-toit', 'Toit Brewpub & Kitchen', 'restaurant', 'Indiranagar', 12.9793, 77.6406, '+91 98450 11223', '11220334000451', false, true),
('donor-truffles', 'Truffles Cafe', 'cafe', 'Koramangala', 12.9352, 77.6245, '+91 98450 22334', '11221334000912', false, true),
('donor-hotel-anne', 'Hotel Annapurna Grand', 'hotel', 'Majestic', 12.9767, 77.5713, '+91 98450 33445', '11219334001200', false, true),
('donor-bakers', 'The Baker''s Dozen', 'bakery', 'HSR Layout', 12.9121, 77.6446, '+91 98450 44556', '11222334000311', false, true),
('donor-green', 'Green Farm Organics', 'market', 'Whitefield', 12.9698, 77.7499, '+91 98450 55667', '11220334000109', false, true),
('donor-canteen', 'City Tech Canteen', 'cafeteria', 'Electronic City', 12.8452, 77.6602, '+91 98450 66778', '11221334000543', false, true),
('donor-mtr', 'MTR Heritage Restaurant', 'restaurant', 'Lalbagh', 12.9554, 77.5855, '+91 98450 77889', '11218334000001', false, true),
('donor-nandini', 'Nandini Deluxe Sweets', 'sweetshop', 'Malleshwaram', 13.0031, 77.5643, '+91 98450 88990', '11220334000789', false, true),
('donor-palette', 'The Daily Palette Catering', 'caterer', 'Jayanagar', 12.9250, 77.5938, '+91 98450 99001', '11221334000678', false, true),
('donor-mysore', 'Mysore Tiffin Room', 'restaurant', 'Basavanagudi', 12.9416, 77.5742, '+91 98450 10112', '11222334000889', false, true);

-- 2. RECIPIENTS (Bengaluru Shelters, Orphanages, Community Kitchens)
INSERT INTO recipients (id, name, area, latitude, longitude, capacity_kg, reserved_kg, accepts, need_level, open_hours, approved, is_open, reliability, is_synthetic) VALUES
('recip-ashraya', 'Ashraya Night Shelter', 'Majestic', 12.9780, 77.5730, 120.0, 40.0, '["cooked_hot", "cooked_cold", "bakery"]'::jsonb, 5, '08:00 - 23:00', true, true, 0.98, true),
('recip-devi', 'Devi Charitable Trust Kitchen', 'Jayanagar', 12.9280, 77.5890, 80.0, 25.0, '["cooked_hot", "produce", "packaged"]'::jsonb, 4, '07:00 - 22:00', true, true, 0.94, true),
('recip-naya', 'Naya Savera Community Center', 'Malleshwaram', 13.0010, 77.5710, 95.0, 20.0, '["cooked_hot", "cooked_cold", "bakery", "packaged"]'::jsonb, 4, '08:30 - 21:30', true, true, 0.96, true),
('recip-sarthi', 'Sarthi Children''s Home', 'Whitefield', 12.9730, 77.7420, 60.0, 15.0, '["cooked_hot", "bakery", "produce", "packaged"]'::jsonb, 5, '08:00 - 21:00', true, true, 0.99, true),
('recip-udaya', 'Udaya Hope Shelter', 'Indiranagar', 12.9750, 77.6380, 75.0, 30.0, '["cooked_hot", "bakery", "cooked_cold"]'::jsonb, 3, '09:00 - 22:00', true, true, 0.92, true),
('recip-amara', 'Amara Senior Care Kitchen', 'Jayanagar', 12.9240, 77.5780, 50.0, 10.0, '["cooked_cold", "bakery", "packaged"]'::jsonb, 3, '08:00 - 20:00', true, true, 0.91, true),
('recip-kavya', 'Kavya Evening Shelter', 'HSR Layout', 12.9090, 77.6510, 40.0, 0.0, '["packaged", "produce", "bakery"]'::jsonb, 2, '10:00 - 22:00', true, true, 0.88, true),
('recip-shanti', 'Shanti Bhavan Relief Center', 'Whitefield', 12.9698, 77.7500, 160.0, 0.0, '["cooked_hot", "cooked_cold", "packaged", "produce", "bakery"]'::jsonb, 4, '07:00 - 23:00', true, true, 0.95, true);

-- 3. VOLUNTEER DRIVERS
INSERT INTO drivers (id, name, latitude, longitude, availability, vehicle, capacity_kg, telegram_id, reliability, is_synthetic) VALUES
('driver-rajesh', 'Rajesh Kumar', 12.9720, 77.5750, true, 'Bike', 30.0, '@rajesh_blr', 0.98, true),
('driver-kiran', 'Kiran Shetty', 12.9310, 77.6200, true, 'Auto', 60.0, '@kiran_shetty', 0.95, true),
('driver-ankita', 'Ankita Sharma', 12.9760, 77.6410, true, 'Bike', 25.0, '@ankita_rescue', 0.96, true),
('driver-meera', 'Meera Nair', 12.9680, 77.7460, false, 'Eco Van', 100.0, '@meera_blr', 0.92, true),
('driver-priya', 'Priya Das', 12.9150, 77.6400, true, 'Bike', 25.0, '@priya_d', 0.94, true),
('driver-karthik', 'Karthik V.', 13.0020, 77.5680, true, 'Auto', 55.0, '@karthik_v', 0.93, true);

-- 4. DONATIONS (Active Real-Time Countdowns)
INSERT INTO donations (id, donor_id, item, category, qty_kg, prepared_at, temp_c, safe_until, status, recipient_id, driver_id, raw_text, is_synthetic, created_at) VALUES
('d-1001', 'donor-toit', 'Fresh Dal Makhani & Jeera Rice (40 servings)', 'cooked_hot', 18.0, NOW() - INTERVAL '45 minutes', 72.0, NOW() + INTERVAL '3 hours 15 minutes', 'posted', null, null, 'Fresh dal and rice 40 plates hot Indiranagar kitchen', true, NOW() - INTERVAL '40 minutes'),
('d-1002', 'donor-truffles', 'Assorted Pasta & Garlic Bread Trays', 'cooked_hot', 14.0, NOW() - INTERVAL '1 hour', 65.0, NOW() + INTERVAL '3 hours', 'posted', null, null, 'Pasta and garlic bread 14kg hot Koramangala', true, NOW() - INTERVAL '50 minutes'),
('d-1003', 'donor-bakers', 'Whole Wheat Loaves & Vegetable Puffs', 'bakery', 12.0, NOW() - INTERVAL '3 hours', null, NOW() + INTERVAL '7 hours', 'matched', 'recip-udaya', 'driver-ankita', 'Breads and puffs 12kg HSR layout', true, NOW() - INTERVAL '2 hours'),
('d-1004', 'donor-green', 'Fresh Bell Peppers & Spinach Crates', 'produce', 30.0, NOW() - INTERVAL '2 hours', null, NOW() + INTERVAL '16 hours', 'accepted', 'recip-sarthi', 'driver-meera', '30 kg fresh vegetables crates Whitefield', true, NOW() - INTERVAL '1 hour 30 minutes'),
('d-1005', 'donor-canteen', 'Sambar, Rasam & Steamed Rice (60 servings)', 'cooked_hot', 28.0, NOW() - INTERVAL '1 hour 15 minutes', 74.0, NOW() + INTERVAL '2 hours 45 minutes', 'picked_up', 'recip-devi', 'driver-kiran', 'Sambar rice bulk 28kg Electronic City', true, NOW() - INTERVAL '1 hour'),
('d-1006', 'donor-hotel-anne', 'Buffet Dinner Rice & Paneer Sabzi (50 servings)', 'cooked_hot', 22.0, NOW() - INTERVAL '6 hours', 63.0, NOW() - INTERVAL '2 hours', 'delivered', 'recip-ashraya', 'driver-rajesh', 'Dinner buffet surplus Majestic', true, NOW() - INTERVAL '6 hours'),
('d-1007', 'donor-mtr', 'Packaged Sweets & Instant Breakfast Mixes', 'packaged', 15.0, NOW() - INTERVAL '5 hours', null, NOW() + INTERVAL '19 hours', 'delivered', 'recip-ashraya', 'driver-rajesh', 'Packaged snacks Lalbagh', true, NOW() - INTERVAL '5 hours'),
('d-1008', 'donor-mysore', 'Idli & Chutney Morning Batch', 'cooked_hot', 10.0, NOW() - INTERVAL '8 hours', 32.0, NOW() - INTERVAL '4 hours', 'expired', null, null, 'Idli breakfast batch Basavanagudi', true, NOW() - INTERVAL '8 hours');

-- 5. MATCHES
INSERT INTO matches (id, donation_id, recipient_id, score, reasons, state) VALUES
('m-101', 'd-1003', 'recip-udaya', 0.895, '[{"factor": "time_slack", "score": 0.95}, {"factor": "proximity", "score": 0.88}, {"factor": "need", "score": 0.80}]'::jsonb, 'accepted'),
('m-102', 'd-1004', 'recip-sarthi', 0.940, '[{"factor": "time_slack", "score": 0.98}, {"factor": "proximity", "score": 0.95}, {"factor": "need", "score": 1.00}]'::jsonb, 'accepted');

-- 6. DISPATCH AUDIT EVENTS
INSERT INTO dispatch_events (id, donation_id, driver_id, event_type, message, created_at) VALUES
('e-1', 'd-1006', 'driver-rajesh', 'delivered', 'Rajesh delivered 22 kg from Hotel Annapurna Grand to Ashraya Night Shelter within safe window.', NOW() - INTERVAL '2 hours'),
('e-2', 'd-1007', 'driver-rajesh', 'delivered', 'Rajesh delivered 15 kg from MTR Heritage to Ashraya Night Shelter.', NOW() - INTERVAL '1 hour 30 minutes'),
('e-3', 'd-1005', 'driver-kiran', 'picked_up', 'Kiran Shetty picked up 28 kg from City Tech Canteen. En route to Devi Charitable Trust.', NOW() - INTERVAL '25 minutes'),
('e-4', 'd-1003', 'driver-ankita', 'matched', 'The Baker''s Dozen matched with Udaya Hope Shelter. Ankita assigned.', NOW() - INTERVAL '15 minutes'),
('e-5', 'd-1001', null, 'posted', 'Toit Brewpub & Kitchen posted 18 kg of Fresh Dal Makhani & Jeera Rice.', NOW() - INTERVAL '40 minutes');

-- 7. FSSAI AUDIT RECORDS (Delivered & Verified)
INSERT INTO records (id, donation_id, quantity_kg, temperature_c, area, delivered_at, consume_by) VALUES
('rec-1', 'd-1006', 22.0, 63.0, 'Majestic', NOW() - INTERVAL '2 hours', NOW() - INTERVAL '2 hours'),
('rec-2', 'd-1007', 15.0, null, 'Lalbagh', NOW() - INTERVAL '1 hour 30 minutes', NOW() + INTERVAL '19 hours');
