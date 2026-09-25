/**
 * AaharSetu (आहारसेतु) Database Seeder Script
 * 
 * Usage:
 *   node --env-file=.env --experimental-strip-types scripts/seed.ts
 *   npm run seed
 *   npm run seed -- --all
 *   npm run seed -- --clean
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_KEY || process.env.SUPABASE_KEY || ''

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('\x1b[31m%s\x1b[0m', '❌ Error: Supabase credentials missing!')
  console.error('Please ensure VITE_SUPABASE_URL and VITE_SUPABASE_KEY (or SUPABASE_SERVICE_ROLE_KEY) are set in .env')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
})

function parseJwtRole(token: string): string {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString())
    return payload.role || 'anon'
  } catch {
    return 'unknown'
  }
}

const keyRole = parseJwtRole(SUPABASE_KEY)

const args = process.argv.slice(2)
const isClean = args.includes('--clean')
const seedAllCities = args.includes('--all')
const targetCity = args.find((_, i, a) => a[i - 1] === '--city') || (seedAllCities ? 'all' : 'blr')

console.log('\x1b[32m%s\x1b[0m', '🌱 AaharSetu Database Seeder')
console.log(`Connecting to Supabase at: \x1b[36m${SUPABASE_URL}\x1b[0m`)
console.log(`Auth Key Role: \x1b[35m${keyRole.toUpperCase()}\x1b[0m`)
console.log(`Mode: Target Territory = \x1b[33m${targetCity.toUpperCase()}\x1b[0m | Clean Existing = \x1b[33m${isClean}\x1b[0m\n`)

if (keyRole === 'anon') {
  console.log('\x1b[33m%s\x1b[0m', 'ℹ️  Notice: Using Supabase "anon" key.')
  console.log('If Row Level Security (RLS) restricts public table inserts in your Supabase project:')
  console.log('  • Set \x1b[32mSUPABASE_SERVICE_ROLE_KEY\x1b[0m in your .env file to seed via this CLI script.')
  console.log('  • OR open Supabase SQL Editor and execute: \x1b[36msupabase/seed_data.sql\x1b[0m (runs with superuser privileges).\n')
}

// 1. CITIES DIRECTORY
const CITIES = [
  { id: 'blr', name: 'Bengaluru', state: 'Karnataka', latitude: 12.9716, longitude: 77.5946, timezone: 'Asia/Kolkata', active: true },
  { id: 'mum', name: 'Mumbai', state: 'Maharashtra', latitude: 19.0760, longitude: 72.8777, timezone: 'Asia/Kolkata', active: true },
  { id: 'del', name: 'Delhi', state: 'Delhi', latitude: 28.6139, longitude: 77.2090, timezone: 'Asia/Kolkata', active: true },
  { id: 'maa', name: 'Chennai', state: 'Tamil Nadu', latitude: 13.0827, longitude: 80.2707, timezone: 'Asia/Kolkata', active: true },
  { id: 'hyd', name: 'Hyderabad', state: 'Telangana', latitude: 17.3850, longitude: 78.4867, timezone: 'Asia/Kolkata', active: true },
  { id: 'pun', name: 'Pune', state: 'Maharashtra', latitude: 18.5204, longitude: 73.8567, timezone: 'Asia/Kolkata', active: true },
  { id: 'kol', name: 'Kolkata', state: 'West Bengal', latitude: 22.5726, longitude: 88.3639, timezone: 'Asia/Kolkata', active: true },
  { id: 'amd', name: 'Ahmedabad', state: 'Gujarat', latitude: 23.0225, longitude: 72.5714, timezone: 'Asia/Kolkata', active: true },
  { id: 'jai', name: 'Jaipur', state: 'Rajasthan', latitude: 26.9124, longitude: 75.7873, timezone: 'Asia/Kolkata', active: true },
  { id: 'lko', name: 'Lucknow', state: 'Uttar Pradesh', latitude: 26.8467, longitude: 80.9462, timezone: 'Asia/Kolkata', active: true },
]

// 2. DONORS (Restaurants, Caterers, Bakeries, Tech Canteens)
const DONORS = [
  // Bengaluru
  { id: 'donor-blr-01', city_id: 'blr', name: 'Toit Brewpub & Kitchen', type: 'restaurant', area: 'Indiranagar', latitude: 12.9784, longitude: 77.6408, contact: '+91 98450 11223', license_no: '11220034000451', license_verified: true, is_synthetic: true },
  { id: 'donor-blr-02', city_id: 'blr', name: 'Truffles Gourmet Diner', type: 'cafe', area: 'Koramangala', latitude: 12.9352, longitude: 77.6245, contact: '+91 98450 22334', license_no: '11220134000912', license_verified: true, is_synthetic: true },
  { id: 'donor-blr-03', city_id: 'blr', name: 'Hotel Annapurna Grand', type: 'hotel', area: 'Majestic', latitude: 12.9767, longitude: 77.5713, contact: '+91 98450 33445', license_no: '11220234001200', license_verified: true, is_synthetic: true },
  { id: 'donor-blr-04', city_id: 'blr', name: 'The Baker\'s Dozen Artisan', type: 'bakery', area: 'HSR Layout', latitude: 12.9121, longitude: 77.6446, contact: '+91 98450 44556', license_no: '11220334000311', license_verified: false, is_synthetic: true },
  { id: 'donor-blr-05', city_id: 'blr', name: 'Green Farm Organics Market', type: 'market', area: 'Whitefield', latitude: 12.9698, longitude: 77.7499, contact: '+91 98450 55667', license_no: '11220434000109', license_verified: false, is_synthetic: true },
  { id: 'donor-blr-06', city_id: 'blr', name: 'City Tech Campus Cafeteria', type: 'cafeteria', area: 'Electronic City', latitude: 12.8452, longitude: 77.6602, contact: '+91 98450 66778', license_no: '11220534000543', license_verified: false, is_synthetic: true },
  { id: 'donor-blr-07', city_id: 'blr', name: 'MTR Heritage Bhavan', type: 'restaurant', area: 'Lalbagh', latitude: 12.9554, longitude: 77.5855, contact: '+91 98450 77889', license_no: '11220634000001', license_verified: true, is_synthetic: true },
  { id: 'donor-blr-08', city_id: 'blr', name: 'Nandini Deluxe Sweets', type: 'sweetshop', area: 'Malleshwaram', latitude: 13.0031, longitude: 77.5643, contact: '+91 98450 88990', license_no: '11220734000789', license_verified: false, is_synthetic: true },
  { id: 'donor-blr-09', city_id: 'blr', name: 'The Daily Palette Caterers', type: 'caterer', area: 'Jayanagar', latitude: 12.9250, longitude: 77.5938, contact: '+91 98450 99001', license_no: '11220834000678', license_verified: false, is_synthetic: true },
  { id: 'donor-blr-10', city_id: 'blr', name: 'Mysore Tiffin Room', type: 'restaurant', area: 'Basavanagudi', latitude: 12.9416, longitude: 77.5742, contact: '+91 98450 10112', license_no: '11220934000889', license_verified: false, is_synthetic: true },
  // Mumbai
  { id: 'donor-mum-01', city_id: 'mum', name: 'Pali Village Cafe & Bakery', type: 'cafe', area: 'Bandra', latitude: 19.0596, longitude: 72.8295, contact: '+91 98200 11223', license_no: '1122003400MUM1', license_verified: true, is_synthetic: true },
  { id: 'donor-mum-02', city_id: 'mum', name: 'JW Banquet & Kitchen', type: 'hotel', area: 'Andheri', latitude: 19.1136, longitude: 72.8697, contact: '+91 98200 22334', license_no: '1122013400MUM2', license_verified: true, is_synthetic: true },
  { id: 'donor-mum-03', city_id: 'mum', name: 'Britannia & Co. Heritage', type: 'restaurant', area: 'Colaba', latitude: 18.9067, longitude: 72.8147, contact: '+91 98200 33445', license_no: '1122023400MUM3', license_verified: true, is_synthetic: true },
  // Delhi
  { id: 'donor-del-01', city_id: 'del', name: 'Wenger\'s Deli & Confectionery', type: 'bakery', area: 'Connaught Place', latitude: 28.6304, longitude: 77.2177, contact: '+91 98100 11223', license_no: '1122003400DEL1', license_verified: true, is_synthetic: true },
  { id: 'donor-del-02', city_id: 'del', name: 'Social Heritage Kitchen', type: 'restaurant', area: 'Hauz Khas', latitude: 28.5494, longitude: 77.2001, contact: '+91 98100 22334', license_no: '1122013400DEL2', license_verified: true, is_synthetic: true },
]

// 3. RECIPIENTS / SHELTERS (Night Shelters, Children's Homes, Community Kitchens)
const RECIPIENTS = [
  // Bengaluru
  { id: 'recip-blr-01', city_id: 'blr', name: 'Ashraya Night Shelter', area: 'Majestic', latitude: 12.9780, longitude: 77.5730, capacity_kg: 120.0, reserved_kg: 40.0, accepts: ['cooked_hot', 'cooked_cold', 'bakery'], need_level: 5, open_hours: '08:00 - 23:00', approved: true, is_open: true, reliability: 0.98, is_synthetic: true },
  { id: 'recip-blr-02', city_id: 'blr', name: 'Devi Charitable Trust Kitchen', area: 'Jayanagar', latitude: 12.9280, longitude: 77.5890, capacity_kg: 80.0, reserved_kg: 25.0, accepts: ['cooked_hot', 'produce', 'packaged'], need_level: 4, open_hours: '07:00 - 22:00', approved: true, is_open: true, reliability: 0.94, is_synthetic: true },
  { id: 'recip-blr-03', city_id: 'blr', name: 'Naya Savera Community Center', area: 'Malleshwaram', latitude: 13.0010, longitude: 77.5710, capacity_kg: 95.0, reserved_kg: 20.0, accepts: ['cooked_hot', 'cooked_cold', 'bakery', 'packaged'], need_level: 4, open_hours: '08:30 - 21:30', approved: true, is_open: true, reliability: 0.96, is_synthetic: true },
  { id: 'recip-blr-04', city_id: 'blr', name: 'Sarthi Children\'s Home', area: 'Whitefield', latitude: 12.9730, longitude: 77.7420, capacity_kg: 60.0, reserved_kg: 15.0, accepts: ['cooked_hot', 'bakery', 'produce', 'packaged'], need_level: 5, open_hours: '08:00 - 21:00', approved: true, is_open: true, reliability: 0.99, is_synthetic: true },
  { id: 'recip-blr-05', city_id: 'blr', name: 'Udaya Hope Shelter', area: 'Indiranagar', latitude: 12.9750, longitude: 77.6380, capacity_kg: 75.0, reserved_kg: 30.0, accepts: ['cooked_hot', 'bakery', 'cooked_cold'], need_level: 3, open_hours: '09:00 - 22:00', approved: true, is_open: true, reliability: 0.92, is_synthetic: true },
  { id: 'recip-blr-06', city_id: 'blr', name: 'Amara Senior Care Kitchen', area: 'Basavanagudi', latitude: 12.9410, longitude: 77.5740, capacity_kg: 50.0, reserved_kg: 10.0, accepts: ['cooked_cold', 'bakery', 'packaged'], need_level: 3, open_hours: '08:00 - 20:00', approved: true, is_open: true, reliability: 0.91, is_synthetic: true },
  { id: 'recip-blr-07', city_id: 'blr', name: 'Kavya Evening Relief Shelter', area: 'HSR Layout', latitude: 12.9090, longitude: 77.6510, capacity_kg: 40.0, reserved_kg: 0.0, accepts: ['packaged', 'produce', 'bakery'], need_level: 2, open_hours: '10:00 - 22:00', approved: true, is_open: true, reliability: 0.88, is_synthetic: true },
  { id: 'recip-blr-08', city_id: 'blr', name: 'Shanti Bhavan Relief Center', area: 'Electronic City', latitude: 12.8440, longitude: 77.6620, capacity_kg: 160.0, reserved_kg: 0.0, accepts: ['cooked_hot', 'cooked_cold', 'packaged', 'produce', 'bakery'], need_level: 4, open_hours: '07:00 - 23:00', approved: true, is_open: true, reliability: 0.95, is_synthetic: true },
  // Mumbai
  { id: 'recip-mum-01', city_id: 'mum', name: 'Asha Daan Missionaries of Charity', area: 'Byculla', latitude: 18.9750, longitude: 72.8360, capacity_kg: 140.0, reserved_kg: 35.0, accepts: ['cooked_hot', 'cooked_cold', 'bakery'], need_level: 5, open_hours: '07:00 - 22:00', approved: true, is_open: true, reliability: 0.97, is_synthetic: true },
  { id: 'recip-mum-02', city_id: 'mum', name: 'Snehasadan Children Home', area: 'Andheri', latitude: 19.1180, longitude: 72.8620, capacity_kg: 90.0, reserved_kg: 20.0, accepts: ['cooked_hot', 'produce', 'packaged'], need_level: 4, open_hours: '08:00 - 21:00', approved: true, is_open: true, reliability: 0.95, is_synthetic: true },
  // Delhi
  { id: 'recip-del-01', city_id: 'del', name: 'Rain Basera Night Shelter', area: 'Kashmere Gate', latitude: 28.6670, longitude: 77.2280, capacity_kg: 150.0, reserved_kg: 45.0, accepts: ['cooked_hot', 'cooked_cold', 'packaged'], need_level: 5, open_hours: '06:00 - 23:30', approved: true, is_open: true, reliability: 0.98, is_synthetic: true },
]

// 4. VOLUNTEERS / DRIVERS (Two-wheelers, Autos, Electric Rescue Vans)
const DRIVERS = [
  // Bengaluru
  { id: 'driver-blr-01', city_id: 'blr', name: 'Rajesh Kumar', latitude: 12.9720, longitude: 77.5750, availability: true, vehicle: 'Bike (Hero Splendor)', capacity_kg: 30.0, telegram_id: '@rajesh_blr', reliability: 0.98, is_synthetic: true },
  { id: 'driver-blr-02', city_id: 'blr', name: 'Kiran Shetty', latitude: 12.9310, longitude: 77.6200, availability: true, vehicle: 'Auto-Rickshaw', capacity_kg: 60.0, telegram_id: '@kiran_shetty', reliability: 0.95, is_synthetic: true },
  { id: 'driver-blr-03', city_id: 'blr', name: 'Ankita Sharma', latitude: 12.9760, longitude: 77.6410, availability: true, vehicle: 'Electric Scooter (Ather 450X)', capacity_kg: 25.0, telegram_id: '@ankita_rescue', reliability: 0.96, is_synthetic: true },
  { id: 'driver-blr-04', city_id: 'blr', name: 'Meera Nair', latitude: 12.9680, longitude: 77.7460, availability: false, vehicle: 'Eco Van (Tata Ace EV)', capacity_kg: 100.0, telegram_id: '@meera_blr', reliability: 0.92, is_synthetic: true },
  { id: 'driver-blr-05', city_id: 'blr', name: 'Priya Das', latitude: 12.9150, longitude: 77.6400, availability: true, vehicle: 'Bike (Honda Activa)', capacity_kg: 25.0, telegram_id: '@priya_d', reliability: 0.94, is_synthetic: true },
  { id: 'driver-blr-06', city_id: 'blr', name: 'Karthik V.', latitude: 13.0020, longitude: 77.5680, availability: true, vehicle: 'Auto-Rickshaw (Bajaj RE)', capacity_kg: 55.0, telegram_id: '@karthik_v', reliability: 0.93, is_synthetic: true },
  { id: 'driver-blr-07', city_id: 'blr', name: 'Sunil Gowda', latitude: 12.8480, longitude: 77.6610, availability: true, vehicle: 'Delivery Van (Mahindra Bolero)', capacity_kg: 150.0, telegram_id: '@sunil_blr', reliability: 0.97, is_synthetic: true },
  { id: 'driver-blr-08', city_id: 'blr', name: 'Deepa Menon', latitude: 12.9230, longitude: 77.5910, availability: true, vehicle: 'Electric Bike', capacity_kg: 20.0, telegram_id: '@deepa_m', reliability: 0.99, is_synthetic: true },
  // Mumbai
  { id: 'driver-mum-01', city_id: 'mum', name: 'Sanjay More', latitude: 19.0600, longitude: 72.8310, availability: true, vehicle: 'Bike (TVS Apache)', capacity_kg: 25.0, telegram_id: '@sanjay_mum', reliability: 0.96, is_synthetic: true },
  { id: 'driver-mum-02', city_id: 'mum', name: 'Pooja Jadhav', latitude: 19.1150, longitude: 72.8710, availability: true, vehicle: 'Auto-Rickshaw', capacity_kg: 60.0, telegram_id: '@pooja_j', reliability: 0.94, is_synthetic: true },
  // Delhi
  { id: 'driver-del-01', city_id: 'del', name: 'Vikram Singh', latitude: 28.6310, longitude: 77.2190, availability: true, vehicle: 'Electric Scooter (Ola S1)', capacity_kg: 30.0, telegram_id: '@vikram_del', reliability: 0.97, is_synthetic: true },
  { id: 'driver-del-02', city_id: 'del', name: 'Harpreet Kaur', latitude: 28.5510, longitude: 77.2020, availability: true, vehicle: 'Auto-Rickshaw', capacity_kg: 55.0, telegram_id: '@harpreet_del', reliability: 0.95, is_synthetic: true },
]

// 5. LIVE COUNTDOWN & HISTORICAL DONATIONS
const now = new Date()
const minutesAgo = (mins: number) => new Date(now.getTime() - mins * 60000).toISOString()
const hoursAhead = (hrs: number) => new Date(now.getTime() + hrs * 3600000).toISOString()
const hoursAgo = (hrs: number) => new Date(now.getTime() - hrs * 3600000).toISOString()

const DONATIONS = [
  // Active Rescues (Bengaluru)
  {
    id: 'd-blr-101', city_id: 'blr', donor_id: 'donor-blr-01',
    item: 'Fresh Dal Makhani & Jeera Rice (40 servings)', category: 'cooked_hot',
    qty_kg: 18.0, prepared_at: minutesAgo(45), temp_c: 72.0, safe_until: hoursAhead(3.25),
    status: 'posted', recipient_id: null, driver_id: null,
    raw_text: '40 plates fresh dal makhani and jeera rice from evening banquet kitchen',
    is_synthetic: true, created_at: minutesAgo(40)
  },
  {
    id: 'd-blr-102', city_id: 'blr', donor_id: 'donor-blr-02',
    item: 'Assorted Pasta & Garlic Bread Trays', category: 'cooked_hot',
    qty_kg: 14.0, prepared_at: minutesAgo(60), temp_c: 65.0, safe_until: hoursAhead(2.75),
    status: 'posted', recipient_id: null, driver_id: null,
    raw_text: 'Surplus pasta marinara and 3 trays garlic bread Koramangala cafe',
    is_synthetic: true, created_at: minutesAgo(50)
  },
  {
    id: 'd-blr-103', city_id: 'blr', donor_id: 'donor-blr-04',
    item: 'Whole Wheat Loaves & Vegetable Puffs', category: 'bakery',
    qty_kg: 12.0, prepared_at: hoursAgo(3), temp_c: null, safe_until: hoursAhead(6.5),
    status: 'matched', recipient_id: 'recip-blr-05', driver_id: 'driver-blr-03',
    raw_text: 'Surplus morning bakery bake wheat bread and 30 veg puffs',
    is_synthetic: true, created_at: hoursAgo(2)
  },
  {
    id: 'd-blr-104', city_id: 'blr', donor_id: 'donor-blr-05',
    item: 'Fresh Bell Peppers, Carrots & Spinach Crates', category: 'produce',
    qty_kg: 30.0, prepared_at: hoursAgo(2), temp_c: null, safe_until: hoursAhead(14),
    status: 'accepted', recipient_id: 'recip-blr-04', driver_id: 'driver-blr-04',
    raw_text: '30 kg mixed fresh market produce crates Whitefield store',
    is_synthetic: true, created_at: hoursAgo(1.5)
  },
  {
    id: 'd-blr-105', city_id: 'blr', donor_id: 'donor-blr-06',
    item: 'Sambar, Rasam & Steamed Rice (60 servings)', category: 'cooked_hot',
    qty_kg: 28.0, prepared_at: minutesAgo(75), temp_c: 74.0, safe_until: hoursAhead(2.25),
    status: 'picked_up', recipient_id: 'recip-blr-02', driver_id: 'driver-blr-02',
    raw_text: 'Bulk south Indian lunch surplus 60 plates Electronic City tech cafeteria',
    is_synthetic: true, created_at: minutesAgo(60)
  },
  // Delivered Rescues (Bengaluru)
  {
    id: 'd-blr-106', city_id: 'blr', donor_id: 'donor-blr-03',
    item: 'Buffet Dinner Rice & Paneer Butter Masala (50 servings)', category: 'cooked_hot',
    qty_kg: 22.0, prepared_at: hoursAgo(6), temp_c: 63.0, safe_until: hoursAgo(2),
    status: 'delivered', recipient_id: 'recip-blr-01', driver_id: 'driver-blr-01',
    raw_text: 'Grand buffet surplus delivered safely to Majestic shelter',
    is_synthetic: true, created_at: hoursAgo(6)
  },
  {
    id: 'd-blr-107', city_id: 'blr', donor_id: 'donor-blr-07',
    item: 'Packaged Sweets & Instant Breakfast Mixes', category: 'packaged',
    qty_kg: 15.0, prepared_at: hoursAgo(5), temp_c: null, safe_until: hoursAhead(18),
    status: 'delivered', recipient_id: 'recip-blr-01', driver_id: 'driver-blr-01',
    raw_text: 'Packaged food packets delivered safely to shelter',
    is_synthetic: true, created_at: hoursAgo(5)
  },
  {
    id: 'd-blr-108', city_id: 'blr', donor_id: 'donor-blr-09',
    item: 'South Indian Meals & Curd Rice (35 servings)', category: 'cooked_cold',
    qty_kg: 16.0, prepared_at: hoursAgo(4), temp_c: 12.0, safe_until: hoursAhead(4),
    status: 'delivered', recipient_id: 'recip-blr-06', driver_id: 'driver-blr-05',
    raw_text: 'Chilled curd rice and vegetable meals delivered to elder care',
    is_synthetic: true, created_at: hoursAgo(4)
  },
  // Expired item for realistic reporting
  {
    id: 'd-blr-109', city_id: 'blr', donor_id: 'donor-blr-10',
    item: 'Idli & Chutney Morning Batch (20 servings)', category: 'cooked_hot',
    qty_kg: 10.0, prepared_at: hoursAgo(8), temp_c: 32.0, safe_until: hoursAgo(4),
    status: 'expired', recipient_id: null, driver_id: null,
    raw_text: 'Morning idli batch safe window expired without volunteer pickup',
    is_synthetic: true, created_at: hoursAgo(8)
  },
]

// 6. DISPATCH EVENTS & RECORDS
const DISPATCH_EVENTS = [
  { id: 'e-blr-01', city_id: 'blr', donation_id: 'd-blr-106', driver_id: 'driver-blr-01', event_type: 'delivered', message: 'Rajesh Kumar delivered 22 kg from Hotel Annapurna to Ashraya Night Shelter within temperature safety limit.', created_at: hoursAgo(2) },
  { id: 'e-blr-02', city_id: 'blr', donation_id: 'd-blr-107', driver_id: 'driver-blr-01', event_type: 'delivered', message: 'Rajesh Kumar delivered 15 kg from MTR Heritage Bhavan to Ashraya Night Shelter.', created_at: hoursAgo(1.5) },
  { id: 'e-blr-03', city_id: 'blr', donation_id: 'd-blr-108', driver_id: 'driver-blr-05', event_type: 'delivered', message: 'Priya Das delivered 16 kg from The Daily Palette to Amara Senior Care Kitchen.', created_at: hoursAgo(1) },
  { id: 'e-blr-04', city_id: 'blr', donation_id: 'd-blr-105', driver_id: 'driver-blr-02', event_type: 'picked_up', message: 'Kiran Shetty picked up 28 kg from City Tech Campus Cafeteria. En route to Devi Charitable Trust.', created_at: minutesAgo(25) },
  { id: 'e-blr-05', city_id: 'blr', donation_id: 'd-blr-103', driver_id: 'driver-blr-03', event_type: 'matched', message: 'The Baker\'s Dozen matched with Udaya Hope Shelter. Ankita Sharma assigned.', created_at: minutesAgo(15) },
  { id: 'e-blr-06', city_id: 'blr', donation_id: 'd-blr-101', driver_id: null, event_type: 'posted', message: 'Toit Brewpub & Kitchen posted 18 kg of Fresh Dal Makhani & Jeera Rice.', created_at: minutesAgo(40) },
]

const RECORDS = [
  { id: 'rec-blr-01', city_id: 'blr', donation_id: 'd-blr-106', quantity_kg: 22.0, temperature_c: 63.0, area: 'Majestic', delivered_at: hoursAgo(2), consume_by: hoursAhead(2), created_at: hoursAgo(2) },
  { id: 'rec-blr-02', city_id: 'blr', donation_id: 'd-blr-107', quantity_kg: 15.0, temperature_c: null, area: 'Majestic', delivered_at: hoursAgo(1.5), consume_by: hoursAhead(18), created_at: hoursAgo(1.5) },
  { id: 'rec-blr-03', city_id: 'blr', donation_id: 'd-blr-108', quantity_kg: 16.0, temperature_c: 12.0, area: 'Basavanagudi', delivered_at: hoursAgo(1), consume_by: hoursAhead(4), created_at: hoursAgo(1) },
]

async function seed() {
  try {
    // Filter data based on target city
    const filterByCity = <T extends { city_id?: string }>(items: T[]) =>
      targetCity === 'all' ? items : items.filter(item => item.city_id === targetCity)

    const donorsToSeed = filterByCity(DONORS)
    const recipientsToSeed = filterByCity(RECIPIENTS)
    const driversToSeed = filterByCity(DRIVERS)
    const donationsToSeed = filterByCity(DONATIONS)
    const dispatchEventsToSeed = filterByCity(DISPATCH_EVENTS)
    const recordsToSeed = filterByCity(RECORDS)

    // Optional Clean
    if (isClean) {
      console.log('🧹 Cleaning existing synthetic records...')
      const cityCondition = targetCity === 'all' ? 'blr' : targetCity
      await supabase.from('records').delete().eq('city_id', cityCondition)
      await supabase.from('dispatch_events').delete().eq('city_id', cityCondition)
      await supabase.from('donations').delete().eq('city_id', cityCondition)
      await supabase.from('drivers').delete().eq('city_id', cityCondition)
      await supabase.from('recipients').delete().eq('city_id', cityCondition)
      await supabase.from('donors').delete().eq('city_id', cityCondition)
      console.log('✔ Clean completed.\n')
    }

    const errors: string[] = []

    // Step 1: Cities
    console.log(`📍 Upserting ${CITIES.length} cities...`)
    const { error: cityErr } = await supabase.from('cities').upsert(CITIES, { onConflict: 'id' })
    if (cityErr) {
      errors.push(`Cities: ${cityErr.message}`)
      console.warn('Warning seeding cities:', cityErr.message)
    } else {
      console.log(`✔ Synced ${CITIES.length} municipal territories.`)
    }

    // Step 2: Donors
    console.log(`\n🏪 Upserting ${donorsToSeed.length} Food Donors...`)
    const { error: donorErr } = await supabase.from('donors').upsert(donorsToSeed, { onConflict: 'id' })
    if (donorErr) {
      errors.push(`Donors: ${donorErr.message}`)
      console.error('Error seeding donors:', donorErr.message)
    } else {
      console.log(`✔ Synced ${donorsToSeed.length} verified food donors (restaurants, caterers, bakeries).`)
    }

    // Step 3: Recipients
    console.log(`\n🏠 Upserting ${recipientsToSeed.length} Recipients & Shelters...`)
    const { error: recipErr } = await supabase.from('recipients').upsert(recipientsToSeed, { onConflict: 'id' })
    if (recipErr) {
      errors.push(`Recipients: ${recipErr.message}`)
      console.error('Error seeding recipients:', recipErr.message)
    } else {
      console.log(`✔ Synced ${recipientsToSeed.length} shelter & NGO destinations.`)
    }

    // Step 4: Volunteer Drivers
    console.log(`\n🛵 Upserting ${driversToSeed.length} Volunteer Rescue Drivers...`)
    const { error: driverErr } = await supabase.from('drivers').upsert(driversToSeed, { onConflict: 'id' })
    if (driverErr) {
      errors.push(`Drivers: ${driverErr.message}`)
      console.error('Error seeding drivers:', driverErr.message)
    } else {
      console.log(`✔ Synced ${driversToSeed.length} volunteer drivers (two-wheelers, autos, EV vans).`)
    }

    // Step 5: Donations
    console.log(`\n🍲 Upserting ${donationsToSeed.length} Food Rescue Donations (Active + Delivered)...`)
    const { error: donErr } = await supabase.from('donations').upsert(donationsToSeed, { onConflict: 'id' })
    if (donErr) {
      errors.push(`Donations: ${donErr.message}`)
      console.error('Error seeding donations:', donErr.message)
    } else {
      console.log(`✔ Synced ${donationsToSeed.length} food rescue donations with active temperature & safe window timers.`)
    }

    // Step 6: Dispatch Events
    console.log(`\n📋 Upserting ${dispatchEventsToSeed.length} Dispatch Telemetry Events...`)
    const { error: eventErr } = await supabase.from('dispatch_events').upsert(dispatchEventsToSeed, { onConflict: 'id' })
    if (eventErr) {
      errors.push(`Dispatch Events: ${eventErr.message}`)
      console.error('Error seeding dispatch events:', eventErr.message)
    } else {
      console.log(`✔ Synced ${dispatchEventsToSeed.length} real-time dispatch audit logs.`)
    }

    // Step 7: Delivery Records
    console.log(`\n📊 Upserting ${recordsToSeed.length} Verified Delivery Records...`)
    const { error: recErr } = await supabase.from('records').upsert(recordsToSeed, { onConflict: 'id' })
    if (recErr) {
      errors.push(`Records: ${recErr.message}`)
      console.error('Error seeding records:', recErr.message)
    } else {
      console.log(`✔ Synced ${recordsToSeed.length} verified delivery records for municipal impact charts.`)
    }

    if (errors.length > 0) {
      console.log('\n\x1b[33m%s\x1b[0m', '⚠️  Some tables could not be seeded via PostgREST due to Row Level Security (RLS) restrictions on public anon keys.')
      console.log('To seed all records bypassing RLS:')
      console.log('  1. \x1b[1mRecommended:\x1b[0m Open Supabase Dashboard -> SQL Editor and execute \x1b[36msupabase/seed_data.sql\x1b[0m')
      console.log('  2. \x1b[1mCLI Alternative:\x1b[0m Add \x1b[32mSUPABASE_SERVICE_ROLE_KEY\x1b[0m to your .env file and run \x1b[32mnpm run seed\x1b[0m')
    } else {
      console.log('\n\x1b[32m%s\x1b[0m', '✨ Database seeding completed successfully!')
      console.log('You can now open the live web app and see live food donors, volunteer drivers, shelters, and real-time rescues.')
    }
  } catch (err: any) {
    console.error('\x1b[31m%s\x1b[0m', 'Seeding failed:', err.message || err)
    process.exit(1)
  }
}

seed()
