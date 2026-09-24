-- AaharSetu (आहारसेतु) Database Schema
-- Supabase Postgres + PostGIS Spatial Schema for Real-Time Food Rescue Routing

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. DONORS TABLE
CREATE TABLE IF NOT EXISTS donors (
    id TEXT PRIMARY KEY DEFAULT 'donor-' || substr(md5(random()::text), 1, 8),
    name TEXT NOT NULL,
    type TEXT DEFAULT 'restaurant',
    area TEXT NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    location GEOGRAPHY(Point, 4326) GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)) STORED,
    contact TEXT,
    license_no TEXT,
    license_verified BOOLEAN DEFAULT FALSE,
    is_synthetic BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS donors_location_idx ON donors USING GIST (location);

-- 2. RECIPIENT SHELTERS TABLE
CREATE TABLE IF NOT EXISTS recipients (
    id TEXT PRIMARY KEY DEFAULT 'recip-' || substr(md5(random()::text), 1, 8),
    name TEXT NOT NULL,
    area TEXT NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    location GEOGRAPHY(Point, 4326) GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)) STORED,
    capacity_kg DOUBLE PRECISION NOT NULL DEFAULT 50.0,
    reserved_kg DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    accepts JSONB NOT NULL DEFAULT '["cooked_hot", "cooked_cold", "packaged", "produce", "bakery"]'::jsonb,
    need_level INTEGER NOT NULL DEFAULT 3 CHECK (need_level BETWEEN 1 AND 5),
    open_hours TEXT DEFAULT '09:00 - 22:00',
    approved BOOLEAN DEFAULT TRUE,
    is_open BOOLEAN DEFAULT TRUE,
    reliability DOUBLE PRECISION DEFAULT 0.95,
    is_synthetic BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS recipients_location_idx ON recipients USING GIST (location);

-- 3. VOLUNTEER DRIVERS TABLE
CREATE TABLE IF NOT EXISTS drivers (
    id TEXT PRIMARY KEY DEFAULT 'driver-' || substr(md5(random()::text), 1, 8),
    name TEXT NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    location GEOGRAPHY(Point, 4326) GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)) STORED,
    availability BOOLEAN DEFAULT TRUE,
    vehicle TEXT DEFAULT 'Bike',
    capacity_kg DOUBLE PRECISION DEFAULT 25.0,
    telegram_id TEXT,
    reliability DOUBLE PRECISION DEFAULT 0.95,
    is_synthetic BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS drivers_location_idx ON drivers USING GIST (location);

-- 4. DONATIONS TABLE (COUNTDOWN-AWARE)
CREATE TABLE IF NOT EXISTS donations (
    id TEXT PRIMARY KEY DEFAULT 'd-' || substr(md5(random()::text), 1, 8),
    donor_id TEXT REFERENCES donors(id) ON DELETE CASCADE,
    item TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('cooked_hot', 'cooked_cold', 'packaged', 'produce', 'bakery')),
    qty_kg DOUBLE PRECISION NOT NULL CHECK (qty_kg > 0),
    prepared_at TIMESTAMPTZ NOT NULL,
    temp_c DOUBLE PRECISION,
    safe_until TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'posted' CHECK (status IN ('posted', 'matched', 'accepted', 'picked_up', 'delivered', 'expired', 'cancelled')),
    recipient_id TEXT REFERENCES recipients(id) ON DELETE SET NULL,
    driver_id TEXT REFERENCES drivers(id) ON DELETE SET NULL,
    raw_text TEXT,
    is_synthetic BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS donations_safe_until_idx ON donations (safe_until);
CREATE INDEX IF NOT EXISTS donations_status_idx ON donations (status);

-- 5. MATCHES TABLE
CREATE TABLE IF NOT EXISTS matches (
    id TEXT PRIMARY KEY DEFAULT 'm-' || substr(md5(random()::text), 1, 8),
    donation_id TEXT REFERENCES donations(id) ON DELETE CASCADE,
    recipient_id TEXT REFERENCES recipients(id) ON DELETE CASCADE,
    score DOUBLE PRECISION NOT NULL,
    reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
    state TEXT DEFAULT 'suggested' CHECK (state IN ('suggested', 'accepted', 'rejected')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. DISPATCH EVENTS TABLE
CREATE TABLE IF NOT EXISTS dispatch_events (
    id TEXT PRIMARY KEY DEFAULT 'e-' || substr(md5(random()::text), 1, 8),
    donation_id TEXT REFERENCES donations(id) ON DELETE CASCADE,
    driver_id TEXT REFERENCES drivers(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. HANDOVERS (TRUST & QR/OTP VERIFICATION)
CREATE TABLE IF NOT EXISTS handovers (
    id TEXT PRIMARY KEY DEFAULT 'h-' || substr(md5(random()::text), 1, 8),
    donation_id TEXT REFERENCES donations(id) ON DELETE CASCADE,
    stage TEXT NOT NULL CHECK (stage IN ('pickup', 'delivery')),
    code TEXT NOT NULL,
    confirmed_by TEXT,
    confirmed_at TIMESTAMPTZ
);

-- 8. FSSAI AUDIT RECORDS TABLE
CREATE TABLE IF NOT EXISTS records (
    id TEXT PRIMARY KEY DEFAULT 'rec-' || substr(md5(random()::text), 1, 8),
    donation_id TEXT REFERENCES donations(id) ON DELETE CASCADE,
    quantity_kg DOUBLE PRECISION NOT NULL,
    temperature_c DOUBLE PRECISION,
    area TEXT NOT NULL,
    delivered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    consume_by TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE donors ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE donations ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispatch_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE handovers ENABLE ROW LEVEL SECURITY;
ALTER TABLE records ENABLE ROW LEVEL SECURITY;

-- Allow public read for demonstration and pilot viewing
CREATE POLICY "Public Read Donors" ON donors FOR SELECT USING (true);
CREATE POLICY "Public Read Recipients" ON recipients FOR SELECT USING (true);
CREATE POLICY "Public Read Drivers" ON drivers FOR SELECT USING (true);
CREATE POLICY "Public Read Donations" ON donations FOR SELECT USING (true);
CREATE POLICY "Public Insert Donations" ON donations FOR INSERT WITH CHECK (true);
CREATE POLICY "Public Update Donations" ON donations FOR UPDATE USING (true);
CREATE POLICY "Public Read Matches" ON matches FOR SELECT USING (true);
CREATE POLICY "Public Read Dispatch Events" ON dispatch_events FOR SELECT USING (true);
CREATE POLICY "Public Read Records" ON records FOR SELECT USING (true);
