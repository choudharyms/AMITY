-- ============================================================================
-- AaharSetu (आहारसेतु) Comprehensive Database Seed Script
--
-- Instructions:
-- 1. Open Supabase Dashboard -> SQL Editor
-- 2. Paste and run this script
-- 3. Live donors, volunteer drivers, shelters, and real-time rescues will be populated.
-- ============================================================================

BEGIN;

-- 1. CITIES (Municipal Food Rescue Networks)
INSERT INTO public.cities (id, name, state, latitude, longitude, timezone, active) VALUES
('blr', 'Bengaluru', 'Karnataka', 12.9716, 77.5946, 'Asia/Kolkata', true),
('mum', 'Mumbai', 'Maharashtra', 19.0760, 72.8777, 'Asia/Kolkata', true),
('del', 'Delhi', 'Delhi', 28.6139, 77.2090, 'Asia/Kolkata', true),
('maa', 'Chennai', 'Tamil Nadu', 13.0827, 80.2707, 'Asia/Kolkata', true),
('hyd', 'Hyderabad', 'Telangana', 17.3850, 78.4867, 'Asia/Kolkata', true),
('pun', 'Pune', 'Maharashtra', 18.5204, 73.8567, 'Asia/Kolkata', true),
('kol', 'Kolkata', 'West Bengal', 22.5726, 88.3639, 'Asia/Kolkata', true),
('amd', 'Ahmedabad', 'Gujarat', 23.0225, 72.5714, 'Asia/Kolkata', true),
('jai', 'Jaipur', 'Rajasthan', 26.9124, 75.7873, 'Asia/Kolkata', true),
('lko', 'Lucknow', 'Uttar Pradesh', 26.8467, 80.9462, 'Asia/Kolkata', true)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name, state = EXCLUDED.state,
    latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude,
    timezone = EXCLUDED.timezone, active = true;


-- 2. FOOD DONORS (Restaurants, Caterers, Bakeries, Corporate Canteens)
INSERT INTO public.donors (id, city_id, name, type, area, latitude, longitude, contact, license_no, license_verified, is_synthetic) VALUES
-- Bengaluru
('donor-blr-01', 'blr', 'Toit Brewpub & Kitchen', 'restaurant', 'Indiranagar', 12.9784, 77.6408, '+91 98450 11223', '11220034000451', true, true),
('donor-blr-02', 'blr', 'Truffles Gourmet Diner', 'cafe', 'Koramangala', 12.9352, 77.6245, '+91 98450 22334', '11220134000912', true, true),
('donor-blr-03', 'blr', 'Hotel Annapurna Grand', 'hotel', 'Majestic', 12.9767, 77.5713, '+91 98450 33445', '11220234001200', true, true),
('donor-blr-04', 'blr', 'The Baker''s Dozen Artisan', 'bakery', 'HSR Layout', 12.9121, 77.6446, '+91 98450 44556', '11220334000311', false, true),
('donor-blr-05', 'blr', 'Green Farm Organics Market', 'market', 'Whitefield', 12.9698, 77.7499, '+91 98450 55667', '11220434000109', false, true),
('donor-blr-06', 'blr', 'City Tech Campus Cafeteria', 'cafeteria', 'Electronic City', 12.8452, 77.6602, '+91 98450 66778', '11220534000543', false, true),
('donor-blr-07', 'blr', 'MTR Heritage Bhavan', 'restaurant', 'Lalbagh', 12.9554, 77.5855, '+91 98450 77889', '11220634000001', true, true),
('donor-blr-08', 'blr', 'Nandini Deluxe Sweets', 'sweetshop', 'Malleshwaram', 13.0031, 77.5643, '+91 98450 88990', '11220734000789', false, true),
('donor-blr-09', 'blr', 'The Daily Palette Caterers', 'caterer', 'Jayanagar', 12.9250, 77.5938, '+91 98450 99001', '11220834000678', false, true),
('donor-blr-10', 'blr', 'Mysore Tiffin Room', 'restaurant', 'Basavanagudi', 12.9416, 77.5742, '+91 98450 10112', '11220934000889', false, true),
-- Mumbai
('donor-mum-01', 'mum', 'Pali Village Cafe & Bakery', 'cafe', 'Bandra', 19.0596, 72.8295, '+91 98200 11223', '1122003400MUM1', true, true),
('donor-mum-02', 'mum', 'JW Banquet & Kitchen', 'hotel', 'Andheri', 19.1136, 72.8697, '+91 98200 22334', '1122013400MUM2', true, true),
('donor-mum-03', 'mum', 'Britannia & Co. Heritage', 'restaurant', 'Colaba', 18.9067, 72.8147, '+91 98200 33445', '1122023400MUM3', true, true),
-- Delhi
('donor-del-01', 'del', 'Wenger''s Deli & Confectionery', 'bakery', 'Connaught Place', 28.6304, 77.2177, '+91 98100 11223', '1122003400DEL1', true, true),
('donor-del-02', 'del', 'Social Heritage Kitchen', 'restaurant', 'Hauz Khas', 28.5494, 77.2001, '+91 98100 22334', '1122013400DEL2', true, true)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name, type = EXCLUDED.type, area = EXCLUDED.area,
    latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude,
    contact = EXCLUDED.contact, license_no = EXCLUDED.license_no,
    license_verified = EXCLUDED.license_verified;


-- 3. RECIPIENTS / SHELTERS (Night Shelters, Children''s Homes, Community Kitchens)
INSERT INTO public.recipients (id, city_id, name, area, latitude, longitude, capacity_kg, reserved_kg, accepts, need_level, open_hours, approved, is_open, reliability, is_synthetic) VALUES
-- Bengaluru
('recip-blr-01', 'blr', 'Ashraya Night Shelter', 'Majestic', 12.9780, 77.5730, 120.0, 40.0, '["cooked_hot", "cooked_cold", "bakery"]'::jsonb, 5, '08:00 - 23:00', true, true, 0.98, true),
('recip-blr-02', 'blr', 'Devi Charitable Trust Kitchen', 'Jayanagar', 12.9280, 77.5890, 80.0, 25.0, '["cooked_hot", "produce", "packaged"]'::jsonb, 4, '07:00 - 22:00', true, true, 0.94, true),
('recip-blr-03', 'blr', 'Naya Savera Community Center', 'Malleshwaram', 13.0010, 77.5710, 95.0, 20.0, '["cooked_hot", "cooked_cold", "bakery", "packaged"]'::jsonb, 4, '08:30 - 21:30', true, true, 0.96, true),
('recip-blr-04', 'blr', 'Sarthi Children''s Home', 'Whitefield', 12.9730, 77.7420, 60.0, 15.0, '["cooked_hot", "bakery", "produce", "packaged"]'::jsonb, 5, '08:00 - 21:00', true, true, 0.99, true),
('recip-blr-05', 'blr', 'Udaya Hope Shelter', 'Indiranagar', 12.9750, 77.6380, 75.0, 30.0, '["cooked_hot", "bakery", "cooked_cold"]'::jsonb, 3, '09:00 - 22:00', true, true, 0.92, true),
('recip-blr-06', 'blr', 'Amara Senior Care Kitchen', 'Basavanagudi', 12.9410, 77.5740, 50.0, 10.0, '["cooked_cold", "bakery", "packaged"]'::jsonb, 3, '08:00 - 20:00', true, true, 0.91, true),
('recip-blr-07', 'blr', 'Kavya Evening Relief Shelter', 'HSR Layout', 12.9090, 77.6510, 40.0, 0.0, '["packaged", "produce", "bakery"]'::jsonb, 2, '10:00 - 22:00', true, true, 0.88, true),
('recip-blr-08', 'blr', 'Shanti Bhavan Relief Center', 'Electronic City', 12.8440, 77.6620, 160.0, 0.0, '["cooked_hot", "cooked_cold", "packaged", "produce", "bakery"]'::jsonb, 4, '07:00 - 23:00', true, true, 0.95, true),
-- Mumbai
('recip-mum-01', 'mum', 'Asha Daan Missionaries of Charity', 'Byculla', 18.9750, 72.8360, 140.0, 35.0, '["cooked_hot", "cooked_cold", "bakery"]'::jsonb, 5, '07:00 - 22:00', true, true, 0.97, true),
('recip-mum-02', 'mum', 'Snehasadan Children Home', 'Andheri', 19.1180, 72.8620, 90.0, 20.0, '["cooked_hot", "produce", "packaged"]'::jsonb, 4, '08:00 - 21:00', true, true, 0.95, true),
-- Delhi
('recip-del-01', 'del', 'Rain Basera Night Shelter', 'Kashmere Gate', 28.6670, 77.2280, 150.0, 45.0, '["cooked_hot", "cooked_cold", "packaged"]'::jsonb, 5, '06:00 - 23:30', true, true, 0.98, true)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name, area = EXCLUDED.area,
    latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude,
    capacity_kg = EXCLUDED.capacity_kg, reserved_kg = EXCLUDED.reserved_kg,
    accepts = EXCLUDED.accepts, need_level = EXCLUDED.need_level,
    open_hours = EXCLUDED.open_hours, approved = EXCLUDED.approved,
    is_open = EXCLUDED.is_open, reliability = EXCLUDED.reliability;


-- 4. VOLUNTEER DRIVERS (Two-wheelers, Auto-rickshaws, Electric Rescue Vans)
INSERT INTO public.drivers (id, city_id, name, latitude, longitude, availability, vehicle, capacity_kg, telegram_id, reliability, is_synthetic) VALUES
-- Bengaluru
('driver-blr-01', 'blr', 'Rajesh Kumar', 12.9720, 77.5750, true, 'Bike (Hero Splendor)', 30.0, '@rajesh_blr', 0.98, true),
('driver-blr-02', 'blr', 'Kiran Shetty', 12.9310, 77.6200, true, 'Auto-Rickshaw', 60.0, '@kiran_shetty', 0.95, true),
('driver-blr-03', 'blr', 'Ankita Sharma', 12.9760, 77.6410, true, 'Electric Scooter (Ather 450X)', 25.0, '@ankita_rescue', 0.96, true),
('driver-blr-04', 'blr', 'Meera Nair', 12.9680, 77.7460, false, 'Eco Van (Tata Ace EV)', 100.0, '@meera_blr', 0.92, true),
('driver-blr-05', 'blr', 'Priya Das', 12.9150, 77.6400, true, 'Bike (Honda Activa)', 25.0, '@priya_d', 0.94, true),
('driver-blr-06', 'blr', 'Karthik V.', 13.0020, 77.5680, true, 'Auto-Rickshaw (Bajaj RE)', 55.0, '@karthik_v', 0.93, true),
('driver-blr-07', 'blr', 'Sunil Gowda', 12.8480, 77.6610, true, 'Delivery Van (Mahindra Bolero)', 150.0, '@sunil_blr', 0.97, true),
('driver-blr-08', 'blr', 'Deepa Menon', 12.9230, 77.5910, true, 'Electric Bike', 20.0, '@deepa_m', 0.99, true),
-- Mumbai
('driver-mum-01', 'mum', 'Sanjay More', 19.0600, 72.8310, true, 'Bike (TVS Apache)', 25.0, '@sanjay_mum', 0.96, true),
('driver-mum-02', 'mum', 'Pooja Jadhav', 19.1150, 72.8710, true, 'Auto-Rickshaw', 60.0, '@pooja_j', 0.94, true),
-- Delhi
('driver-del-01', 'del', 'Vikram Singh', 28.6310, 77.2190, true, 'Electric Scooter (Ola S1)', 30.0, '@vikram_del', 0.97, true),
('driver-del-02', 'del', 'Harpreet Kaur', 28.5510, 77.2020, true, 'Auto-Rickshaw', 55.0, '@harpreet_del', 0.95, true)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name, latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude,
    availability = EXCLUDED.availability, vehicle = EXCLUDED.vehicle,
    capacity_kg = EXCLUDED.capacity_kg, telegram_id = EXCLUDED.telegram_id,
    reliability = EXCLUDED.reliability;


-- 5. REAL-TIME COUNTDOWN & DELIVERED RESCUE DONATIONS
INSERT INTO public.donations (id, city_id, donor_id, item, category, qty_kg, prepared_at, temp_c, safe_until, status, recipient_id, driver_id, raw_text, is_synthetic, created_at) VALUES
-- Active Rescues (Bengaluru)
('d-blr-101', 'blr', 'donor-blr-01', 'Fresh Dal Makhani & Jeera Rice (40 servings)', 'cooked_hot', 18.0, NOW() - INTERVAL '45 minutes', 72.0, NOW() + INTERVAL '3 hours 15 minutes', 'posted', null, null, '40 plates fresh dal makhani and jeera rice from evening banquet kitchen', true, NOW() - INTERVAL '40 minutes'),
('d-blr-102', 'blr', 'donor-blr-02', 'Assorted Pasta & Garlic Bread Trays', 'cooked_hot', 14.0, NOW() - INTERVAL '1 hour', 65.0, NOW() + INTERVAL '2 hours 45 minutes', 'posted', null, null, 'Surplus pasta marinara and 3 trays garlic bread Koramangala cafe', true, NOW() - INTERVAL '50 minutes'),
('d-blr-103', 'blr', 'donor-blr-04', 'Whole Wheat Loaves & Vegetable Puffs', 'bakery', 12.0, NOW() - INTERVAL '3 hours', null, NOW() + INTERVAL '6 hours 30 minutes', 'matched', 'recip-blr-05', 'driver-blr-03', 'Surplus morning bakery bake wheat bread and 30 veg puffs', true, NOW() - INTERVAL '2 hours'),
('d-blr-104', 'blr', 'donor-blr-05', 'Fresh Bell Peppers, Carrots & Spinach Crates', 'produce', 30.0, NOW() - INTERVAL '2 hours', null, NOW() + INTERVAL '14 hours', 'accepted', 'recip-blr-04', 'driver-blr-04', '30 kg mixed fresh market produce crates Whitefield store', true, NOW() - INTERVAL '1 hour 30 minutes'),
('d-blr-105', 'blr', 'donor-blr-06', 'Sambar, Rasam & Steamed Rice (60 servings)', 'cooked_hot', 28.0, NOW() - INTERVAL '1 hour 15 minutes', 74.0, NOW() + INTERVAL '2 hours 15 minutes', 'picked_up', 'recip-blr-02', 'driver-blr-02', 'Bulk south Indian lunch surplus 60 plates Electronic City tech cafeteria', true, NOW() - INTERVAL '1 hour'),
-- Delivered Rescues (Historical Impact)
('d-blr-106', 'blr', 'donor-blr-03', 'Buffet Dinner Rice & Paneer Butter Masala (50 servings)', 'cooked_hot', 22.0, NOW() - INTERVAL '6 hours', 63.0, NOW() - INTERVAL '2 hours', 'delivered', 'recip-blr-01', 'driver-blr-01', 'Grand buffet surplus delivered safely to Majestic shelter', true, NOW() - INTERVAL '6 hours'),
('d-blr-107', 'blr', 'donor-blr-07', 'Packaged Sweets & Instant Breakfast Mixes', 'packaged', 15.0, NOW() - INTERVAL '5 hours', null, NOW() + INTERVAL '18 hours', 'delivered', 'recip-blr-01', 'driver-blr-01', 'Packaged food packets delivered safely to shelter', true, NOW() - INTERVAL '5 hours'),
('d-blr-108', 'blr', 'donor-blr-09', 'South Indian Meals & Curd Rice (35 servings)', 'cooked_cold', 16.0, NOW() - INTERVAL '4 hours', 12.0, NOW() + INTERVAL '4 hours', 'delivered', 'recip-blr-06', 'driver-blr-05', 'Chilled curd rice and vegetable meals delivered to elder care', true, NOW() - INTERVAL '4 hours'),
-- Expired Rescue for Realism
('d-blr-109', 'blr', 'donor-blr-10', 'Idli & Chutney Morning Batch (20 servings)', 'cooked_hot', 10.0, NOW() - INTERVAL '8 hours', 32.0, NOW() - INTERVAL '4 hours', 'expired', null, null, 'Morning idli batch safe window expired without volunteer pickup', true, NOW() - INTERVAL '8 hours')
ON CONFLICT (id) DO UPDATE SET
    item = EXCLUDED.item, category = EXCLUDED.category, qty_kg = EXCLUDED.qty_kg,
    prepared_at = EXCLUDED.prepared_at, temp_c = EXCLUDED.temp_c,
    safe_until = EXCLUDED.safe_until, status = EXCLUDED.status,
    recipient_id = EXCLUDED.recipient_id, driver_id = EXCLUDED.driver_id;


-- 6. MATCHES
INSERT INTO public.matches (id, city_id, donation_id, recipient_id, score, reasons, state) VALUES
('m-blr-01', 'blr', 'd-blr-103', 'recip-blr-05', 0.895, '[{"factor": "time_slack", "score": 0.95}, {"factor": "proximity", "score": 0.88}, {"factor": "need", "score": 0.80}]'::jsonb, 'accepted'),
('m-blr-02', 'blr', 'd-blr-104', 'recip-blr-04', 0.940, '[{"factor": "time_slack", "score": 0.98}, {"factor": "proximity", "score": 0.95}, {"factor": "need", "score": 1.00}]'::jsonb, 'accepted')
ON CONFLICT (id) DO UPDATE SET
    score = EXCLUDED.score, reasons = EXCLUDED.reasons, state = EXCLUDED.state;


-- 7. DISPATCH AUDIT EVENTS
INSERT INTO public.dispatch_events (id, city_id, donation_id, driver_id, event_type, message, created_at) VALUES
('e-blr-01', 'blr', 'd-blr-106', 'driver-blr-01', 'delivered', 'Rajesh Kumar delivered 22 kg from Hotel Annapurna Grand to Ashraya Night Shelter within temperature safety limit.', NOW() - INTERVAL '2 hours'),
('e-blr-02', 'blr', 'd-blr-107', 'driver-blr-01', 'delivered', 'Rajesh Kumar delivered 15 kg from MTR Heritage Bhavan to Ashraya Night Shelter.', NOW() - INTERVAL '1 hour 30 minutes'),
('e-blr-03', 'blr', 'd-blr-108', 'driver-blr-05', 'delivered', 'Priya Das delivered 16 kg from The Daily Palette to Amara Senior Care Kitchen.', NOW() - INTERVAL '1 hour'),
('e-blr-04', 'blr', 'd-blr-105', 'driver-blr-02', 'picked_up', 'Kiran Shetty picked up 28 kg from City Tech Campus Cafeteria. En route to Devi Charitable Trust.', NOW() - INTERVAL '25 minutes'),
('e-blr-05', 'blr', 'd-blr-103', 'driver-blr-03', 'matched', 'The Baker''s Dozen matched with Udaya Hope Shelter. Ankita Sharma assigned.', NOW() - INTERVAL '15 minutes'),
('e-blr-06', 'blr', 'd-blr-101', null, 'posted', 'Toit Brewpub & Kitchen posted 18 kg of Fresh Dal Makhani & Jeera Rice.', NOW() - INTERVAL '40 minutes')
ON CONFLICT (id) DO UPDATE SET
    message = EXCLUDED.message, event_type = EXCLUDED.event_type;


-- 8. VERIFIED DELIVERY RECORDS (For Municipal Impact Analytics)
INSERT INTO public.records (id, city_id, donation_id, quantity_kg, temperature_c, area, delivered_at, consume_by, created_at) VALUES
('rec-blr-01', 'blr', 'd-blr-106', 22.0, 63.0, 'Majestic', NOW() - INTERVAL '2 hours', NOW() + INTERVAL '2 hours', NOW() - INTERVAL '2 hours'),
('rec-blr-02', 'blr', 'd-blr-107', 15.0, null, 'Majestic', NOW() - INTERVAL '1 hour 30 minutes', NOW() + INTERVAL '18 hours', NOW() - INTERVAL '1 hour 30 minutes'),
('rec-blr-03', 'blr', 'd-blr-108', 16.0, 12.0, 'Basavanagudi', NOW() - INTERVAL '1 hour', NOW() + INTERVAL '4 hours', NOW() - INTERVAL '1 hour')
ON CONFLICT (id) DO UPDATE SET
    quantity_kg = EXCLUDED.quantity_kg, temperature_c = EXCLUDED.temperature_c,
    area = EXCLUDED.area, delivered_at = EXCLUDED.delivered_at, consume_by = EXCLUDED.consume_by;

COMMIT;
