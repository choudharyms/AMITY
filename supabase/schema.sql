-- AaharSetu multi-city schema for Supabase Postgres + PostGIS.
-- Apply from the Supabase SQL editor after backing up existing production data.

CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS cities (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    state TEXT NOT NULL,
    latitude DOUBLE PRECISION NOT NULL CHECK (latitude BETWEEN -90 AND 90),
    longitude DOUBLE PRECISION NOT NULL CHECK (longitude BETWEEN -180 AND 180),
    timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    active BOOLEAN NOT NULL DEFAULT TRUE
);

INSERT INTO cities (id, name, state, latitude, longitude, timezone) VALUES
('blr', 'Bengaluru', 'Karnataka', 12.9716, 77.5946, 'Asia/Kolkata'),
('mum', 'Mumbai', 'Maharashtra', 19.0760, 72.8777, 'Asia/Kolkata'),
('del', 'Delhi', 'Delhi', 28.6139, 77.2090, 'Asia/Kolkata'),
('maa', 'Chennai', 'Tamil Nadu', 13.0827, 80.2707, 'Asia/Kolkata'),
('hyd', 'Hyderabad', 'Telangana', 17.3850, 78.4867, 'Asia/Kolkata'),
('pun', 'Pune', 'Maharashtra', 18.5204, 73.8567, 'Asia/Kolkata'),
('kol', 'Kolkata', 'West Bengal', 22.5726, 88.3639, 'Asia/Kolkata'),
('amd', 'Ahmedabad', 'Gujarat', 23.0225, 72.5714, 'Asia/Kolkata'),
('jai', 'Jaipur', 'Rajasthan', 26.9124, 75.7873, 'Asia/Kolkata'),
('lko', 'Lucknow', 'Uttar Pradesh', 26.8467, 80.9462, 'Asia/Kolkata')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name, state = EXCLUDED.state,
    latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude,
    timezone = EXCLUDED.timezone, active = TRUE;

CREATE TABLE IF NOT EXISTS profiles (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    display_name TEXT NOT NULL DEFAULT 'AaharSetu member',
    role TEXT NOT NULL DEFAULT 'donor' CHECK (role IN ('coordinator', 'donor', 'driver', 'recipient', 'shelter')),
    requested_role TEXT CHECK (requested_role IN ('donor', 'driver', 'recipient', 'shelter')),
    organization TEXT,
    phone TEXT,
    fssai_license TEXT,
    area TEXT,
    city_id TEXT NOT NULL DEFAULT 'blr' REFERENCES cities(id),
    active_city_id TEXT NOT NULL DEFAULT 'blr' REFERENCES cities(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS donors (
    id TEXT PRIMARY KEY DEFAULT 'donor-' || substr(md5(random()::text), 1, 8),
    name TEXT NOT NULL,
    type TEXT DEFAULT 'restaurant',
    area TEXT NOT NULL,
    latitude DOUBLE PRECISION NOT NULL CHECK (latitude BETWEEN -90 AND 90),
    longitude DOUBLE PRECISION NOT NULL CHECK (longitude BETWEEN -180 AND 180),
    location GEOGRAPHY(Point, 4326) GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)) STORED,
    contact TEXT,
    license_no TEXT,
    license_verified BOOLEAN DEFAULT FALSE,
    is_synthetic BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS recipients (
    id TEXT PRIMARY KEY DEFAULT 'recip-' || substr(md5(random()::text), 1, 8),
    name TEXT NOT NULL,
    area TEXT NOT NULL,
    latitude DOUBLE PRECISION NOT NULL CHECK (latitude BETWEEN -90 AND 90),
    longitude DOUBLE PRECISION NOT NULL CHECK (longitude BETWEEN -180 AND 180),
    location GEOGRAPHY(Point, 4326) GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)) STORED,
    capacity_kg DOUBLE PRECISION NOT NULL DEFAULT 50.0 CHECK (capacity_kg > 0),
    reserved_kg DOUBLE PRECISION NOT NULL DEFAULT 0.0 CHECK (reserved_kg >= 0),
    accepts JSONB NOT NULL DEFAULT '["cooked_hot", "cooked_cold", "packaged", "produce", "bakery"]'::jsonb,
    need_level INTEGER NOT NULL DEFAULT 3 CHECK (need_level BETWEEN 1 AND 5),
    open_hours TEXT DEFAULT '09:00 - 22:00',
    approved BOOLEAN DEFAULT FALSE,
    is_open BOOLEAN DEFAULT TRUE,
    reliability DOUBLE PRECISION DEFAULT 0.95,
    is_synthetic BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS drivers (
    id TEXT PRIMARY KEY DEFAULT 'driver-' || substr(md5(random()::text), 1, 8),
    name TEXT NOT NULL,
    latitude DOUBLE PRECISION NOT NULL CHECK (latitude BETWEEN -90 AND 90),
    longitude DOUBLE PRECISION NOT NULL CHECK (longitude BETWEEN -180 AND 180),
    location GEOGRAPHY(Point, 4326) GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)) STORED,
    availability BOOLEAN DEFAULT TRUE,
    vehicle TEXT DEFAULT 'Bike',
    capacity_kg DOUBLE PRECISION DEFAULT 25.0 CHECK (capacity_kg > 0),
    telegram_id TEXT,
    reliability DOUBLE PRECISION DEFAULT 0.95,
    is_synthetic BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS donations (
    id TEXT PRIMARY KEY DEFAULT 'd-' || substr(md5(random()::text), 1, 8),
    donor_id TEXT NOT NULL REFERENCES donors(id) ON DELETE RESTRICT,
    item TEXT NOT NULL CHECK (length(trim(item)) BETWEEN 1 AND 120),
    category TEXT NOT NULL CHECK (category IN ('cooked_hot', 'cooked_cold', 'packaged', 'produce', 'bakery')),
    qty_kg DOUBLE PRECISION NOT NULL CHECK (qty_kg > 0 AND qty_kg <= 10000),
    prepared_at TIMESTAMPTZ NOT NULL,
    temp_c DOUBLE PRECISION CHECK (temp_c IS NULL OR temp_c BETWEEN -50 AND 150),
    safe_until TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'posted' CHECK (status IN ('posted', 'matched', 'accepted', 'picked_up', 'delivered', 'expired', 'cancelled')),
    recipient_id TEXT REFERENCES recipients(id) ON DELETE SET NULL,
    driver_id TEXT REFERENCES drivers(id) ON DELETE SET NULL,
    raw_text TEXT,
    is_synthetic BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS matches (
    id TEXT PRIMARY KEY DEFAULT 'm-' || substr(md5(random()::text), 1, 8),
    donation_id TEXT REFERENCES donations(id) ON DELETE CASCADE,
    recipient_id TEXT REFERENCES recipients(id) ON DELETE CASCADE,
    score DOUBLE PRECISION NOT NULL,
    reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
    state TEXT DEFAULT 'suggested' CHECK (state IN ('suggested', 'accepted', 'rejected')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dispatch_events (
    id TEXT PRIMARY KEY DEFAULT 'e-' || substr(md5(random()::text), 1, 8),
    donation_id TEXT REFERENCES donations(id) ON DELETE CASCADE,
    driver_id TEXT REFERENCES drivers(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS handovers (
    id TEXT PRIMARY KEY DEFAULT 'h-' || substr(md5(random()::text), 1, 8),
    donation_id TEXT REFERENCES donations(id) ON DELETE CASCADE,
    stage TEXT NOT NULL CHECK (stage IN ('pickup', 'delivery')),
    code TEXT NOT NULL,
    confirmed_by TEXT,
    confirmed_at TIMESTAMPTZ
);

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

-- Add city and account ownership to existing pilot tables without replacing records.
ALTER TABLE donors ADD COLUMN IF NOT EXISTS city_id TEXT NOT NULL DEFAULT 'blr' REFERENCES cities(id);
ALTER TABLE donors ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE recipients ADD COLUMN IF NOT EXISTS city_id TEXT NOT NULL DEFAULT 'blr' REFERENCES cities(id);
ALTER TABLE recipients ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS city_id TEXT NOT NULL DEFAULT 'blr' REFERENCES cities(id);
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE donations ADD COLUMN IF NOT EXISTS city_id TEXT NOT NULL DEFAULT 'blr' REFERENCES cities(id);
ALTER TABLE matches ADD COLUMN IF NOT EXISTS city_id TEXT NOT NULL DEFAULT 'blr' REFERENCES cities(id);
ALTER TABLE dispatch_events ADD COLUMN IF NOT EXISTS city_id TEXT NOT NULL DEFAULT 'blr' REFERENCES cities(id);
ALTER TABLE handovers ADD COLUMN IF NOT EXISTS city_id TEXT NOT NULL DEFAULT 'blr' REFERENCES cities(id);
ALTER TABLE records ADD COLUMN IF NOT EXISTS city_id TEXT NOT NULL DEFAULT 'blr' REFERENCES cities(id);
ALTER TABLE donors ALTER COLUMN license_verified SET DEFAULT FALSE;
ALTER TABLE recipients ALTER COLUMN approved SET DEFAULT FALSE;

UPDATE dispatch_events e SET city_id = d.city_id FROM donations d WHERE d.id = e.donation_id;
UPDATE records r SET city_id = d.city_id FROM donations d WHERE d.id = r.donation_id;
UPDATE matches m SET city_id = d.city_id FROM donations d WHERE d.id = m.donation_id;
UPDATE handovers h SET city_id = d.city_id FROM donations d WHERE d.id = h.donation_id;

CREATE INDEX IF NOT EXISTS donors_city_location_idx ON donors (city_id);
CREATE INDEX IF NOT EXISTS recipients_city_location_idx ON recipients (city_id);
CREATE INDEX IF NOT EXISTS drivers_city_location_idx ON drivers (city_id);
CREATE INDEX IF NOT EXISTS donations_city_created_idx ON donations (city_id, created_at DESC);
CREATE INDEX IF NOT EXISTS dispatch_events_city_created_idx ON dispatch_events (city_id, created_at DESC);
CREATE INDEX IF NOT EXISTS records_city_delivered_idx ON records (city_id, delivered_at DESC);

-- PostGIS GIST Spatial Indexes
CREATE INDEX IF NOT EXISTS donors_location_gist_idx ON donors USING GIST (location);
CREATE INDEX IF NOT EXISTS recipients_location_gist_idx ON recipients USING GIST (location);
CREATE INDEX IF NOT EXISTS drivers_location_gist_idx ON drivers USING GIST (location);

-- Partial index for active dispatch lookups
CREATE INDEX IF NOT EXISTS donations_active_rescuable_idx ON donations (city_id, status, safe_until)
WHERE status IN ('posted', 'matched', 'accepted', 'picked_up');

-- Composite indexes for dashboard and matching
CREATE INDEX IF NOT EXISTS donations_donor_created_idx ON donations (donor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS donations_driver_status_idx ON donations (driver_id, status);
CREATE INDEX IF NOT EXISTS matches_donation_state_idx ON matches (donation_id, state);

-- Every new account is a donor until a trusted administrator grants a different role.
CREATE OR REPLACE FUNCTION public.provision_aaharsetu_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    INSERT INTO public.profiles (user_id, email, display_name, requested_role, city_id, active_city_id)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NULLIF(NEW.raw_user_meta_data ->> 'display_name', ''), 'AaharSetu member'),
        CASE WHEN NEW.raw_user_meta_data ->> 'requested_role' IN ('donor', 'driver', 'recipient', 'shelter')
            THEN NEW.raw_user_meta_data ->> 'requested_role' ELSE 'donor' END,
        'blr',
        CASE WHEN EXISTS (SELECT 1 FROM public.cities c WHERE c.id = NEW.raw_user_meta_data ->> 'city_id' AND c.active)
            THEN NEW.raw_user_meta_data ->> 'city_id' ELSE 'blr' END
    ) ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.provision_aaharsetu_profile() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS on_auth_user_created_aaharsetu ON auth.users;
CREATE TRIGGER on_auth_user_created_aaharsetu AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.provision_aaharsetu_profile();

INSERT INTO public.profiles (user_id, email, display_name)
SELECT u.id, u.email,
       COALESCE(NULLIF(u.raw_user_meta_data ->> 'display_name', ''), 'AaharSetu member')
FROM auth.users u
ON CONFLICT (user_id) DO NOTHING;

-- ============================================================================
-- Rule-Based Row Level Security (RLS) Helper Functions & Policies
-- ============================================================================
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA private TO authenticated;

-- Cached Coordinator Verification (STABLE + search_path = '' for security and speed)
CREATE OR REPLACE FUNCTION private.is_coordinator(target_city TEXT DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.user_id = (SELECT auth.uid())
          AND p.role = 'coordinator'
          AND (target_city IS NULL OR p.city_id = target_city OR p.city_id = 'global')
    );
$$;

-- Global Coordinator Check
CREATE OR REPLACE FUNCTION private.is_global_coordinator()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.user_id = (SELECT auth.uid())
          AND p.role = 'coordinator'
    );
$$;

-- Authenticated User's Current Assigned Role
CREATE OR REPLACE FUNCTION private.get_auth_role()
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT p.role FROM public.profiles p
    WHERE p.user_id = (SELECT auth.uid())
    LIMIT 1;
$$;

-- Authenticated User's Current Assigned City
CREATE OR REPLACE FUNCTION private.get_auth_city()
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT p.city_id FROM public.profiles p
    WHERE p.user_id = (SELECT auth.uid())
    LIMIT 1;
$$;

REVOKE ALL ON FUNCTION private.is_coordinator(TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.is_global_coordinator() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.get_auth_role() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.get_auth_city() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION private.is_coordinator(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_global_coordinator() TO authenticated;
GRANT EXECUTE ON FUNCTION private.get_auth_role() TO authenticated;
GRANT EXECUTE ON FUNCTION private.get_auth_city() TO authenticated;

-- Ensure RLS Predicate Indexes for maximum query performance
CREATE INDEX IF NOT EXISTS profiles_user_id_idx ON profiles (user_id);
CREATE INDEX IF NOT EXISTS profiles_role_city_idx ON profiles (role, city_id);

CREATE INDEX IF NOT EXISTS donors_user_id_idx ON donors (user_id);
CREATE INDEX IF NOT EXISTS donors_city_id_idx ON donors (city_id);
CREATE INDEX IF NOT EXISTS donors_synthetic_idx ON donors (is_synthetic);

CREATE INDEX IF NOT EXISTS recipients_user_id_idx ON recipients (user_id);
CREATE INDEX IF NOT EXISTS recipients_city_id_idx ON recipients (city_id);
CREATE INDEX IF NOT EXISTS recipients_approved_idx ON recipients (approved);
CREATE INDEX IF NOT EXISTS recipients_synthetic_idx ON recipients (is_synthetic);

CREATE INDEX IF NOT EXISTS drivers_user_id_idx ON drivers (user_id);
CREATE INDEX IF NOT EXISTS drivers_city_id_idx ON drivers (city_id);
CREATE INDEX IF NOT EXISTS drivers_avail_city_idx ON drivers (city_id, availability);
CREATE INDEX IF NOT EXISTS drivers_synthetic_idx ON drivers (is_synthetic);

CREATE INDEX IF NOT EXISTS donations_donor_id_idx ON donations (donor_id);
CREATE INDEX IF NOT EXISTS donations_recipient_id_idx ON donations (recipient_id);
CREATE INDEX IF NOT EXISTS donations_driver_id_idx ON donations (driver_id);
CREATE INDEX IF NOT EXISTS donations_city_status_idx ON donations (city_id, status);
CREATE INDEX IF NOT EXISTS donations_synthetic_idx ON donations (is_synthetic);

CREATE INDEX IF NOT EXISTS matches_donation_id_idx ON matches (donation_id);
CREATE INDEX IF NOT EXISTS matches_recipient_id_idx ON matches (recipient_id);
CREATE INDEX IF NOT EXISTS matches_city_id_idx ON matches (city_id);

CREATE INDEX IF NOT EXISTS dispatch_events_donation_id_idx ON dispatch_events (donation_id);
CREATE INDEX IF NOT EXISTS dispatch_events_driver_id_idx ON dispatch_events (driver_id);
CREATE INDEX IF NOT EXISTS dispatch_events_city_id_idx ON dispatch_events (city_id);

CREATE INDEX IF NOT EXISTS handovers_donation_id_idx ON handovers (donation_id);
CREATE INDEX IF NOT EXISTS handovers_city_id_idx ON handovers (city_id);

CREATE INDEX IF NOT EXISTS records_donation_id_idx ON records (donation_id);
CREATE INDEX IF NOT EXISTS records_city_delivered_idx ON records (city_id, delivered_at DESC);

-- Enable RLS across all tables
ALTER TABLE cities ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE donors ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE donations ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispatch_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE handovers ENABLE ROW LEVEL SECURITY;
ALTER TABLE records ENABLE ROW LEVEL SECURITY;

-- Drop prior policies
DROP POLICY IF EXISTS "Authenticated city directory" ON cities;
DROP POLICY IF EXISTS "cities_select_active" ON cities;
DROP POLICY IF EXISTS "cities_coordinator_manage" ON cities;

DROP POLICY IF EXISTS "Read own profile" ON profiles;
DROP POLICY IF EXISTS "Update own preferences" ON profiles;
DROP POLICY IF EXISTS "profiles_select_own_or_coordinator" ON profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
DROP POLICY IF EXISTS "profiles_coordinator_update" ON profiles;

DROP POLICY IF EXISTS "Public Read Donors" ON donors;
DROP POLICY IF EXISTS "Read registered donors" ON donors;
DROP POLICY IF EXISTS "donors_select_anon" ON donors;
DROP POLICY IF EXISTS "donors_select_authenticated" ON donors;
DROP POLICY IF EXISTS "donors_insert_own" ON donors;
DROP POLICY IF EXISTS "donors_update_own_or_coordinator" ON donors;

DROP POLICY IF EXISTS "Public Read Recipients" ON recipients;
DROP POLICY IF EXISTS "Read registered recipients" ON recipients;
DROP POLICY IF EXISTS "recipients_select_anon" ON recipients;
DROP POLICY IF EXISTS "recipients_select_authenticated" ON recipients;
DROP POLICY IF EXISTS "recipients_insert_own" ON recipients;
DROP POLICY IF EXISTS "recipients_update_own_or_coordinator" ON recipients;

DROP POLICY IF EXISTS "Public Read Drivers" ON drivers;
DROP POLICY IF EXISTS "Read registered drivers" ON drivers;
DROP POLICY IF EXISTS "drivers_select_anon" ON drivers;
DROP POLICY IF EXISTS "drivers_select_authenticated" ON drivers;
DROP POLICY IF EXISTS "drivers_insert_own" ON drivers;
DROP POLICY IF EXISTS "drivers_update_own_or_coordinator" ON drivers;

DROP POLICY IF EXISTS "Public Read Donations" ON donations;
DROP POLICY IF EXISTS "Public Insert Donations" ON donations;
DROP POLICY IF EXISTS "Public Update Donations" ON donations;
DROP POLICY IF EXISTS "Read assigned donations" ON donations;
DROP POLICY IF EXISTS "Donor posts own donation" ON donations;
DROP POLICY IF EXISTS "Coordinator manages city donations" ON donations;
DROP POLICY IF EXISTS "Assigned driver confirms pickup" ON donations;
DROP POLICY IF EXISTS "Assigned recipient confirms delivery" ON donations;
DROP POLICY IF EXISTS "donations_select_anon" ON donations;
DROP POLICY IF EXISTS "donations_select_authenticated" ON donations;
DROP POLICY IF EXISTS "donations_insert_authenticated" ON donations;
DROP POLICY IF EXISTS "donations_update_coordinator" ON donations;
DROP POLICY IF EXISTS "donations_update_donor" ON donations;
DROP POLICY IF EXISTS "donations_update_driver" ON donations;
DROP POLICY IF EXISTS "donations_update_recipient" ON donations;

DROP POLICY IF EXISTS "Public Read Matches" ON matches;
DROP POLICY IF EXISTS "Read donation matches" ON matches;
DROP POLICY IF EXISTS "matches_select_anon" ON matches;
DROP POLICY IF EXISTS "matches_select_authenticated" ON matches;
DROP POLICY IF EXISTS "matches_coordinator_manage" ON matches;
DROP POLICY IF EXISTS "matches_recipient_update" ON matches;

DROP POLICY IF EXISTS "Public Read Dispatch Events" ON dispatch_events;
DROP POLICY IF EXISTS "Read donation events" ON dispatch_events;
DROP POLICY IF EXISTS "dispatch_events_select_anon" ON dispatch_events;
DROP POLICY IF EXISTS "dispatch_events_select_authenticated" ON dispatch_events;
DROP POLICY IF EXISTS "dispatch_events_insert" ON dispatch_events;

DROP POLICY IF EXISTS "handovers_select_authenticated" ON handovers;
DROP POLICY IF EXISTS "handovers_manage_authenticated" ON handovers;

DROP POLICY IF EXISTS "Public Read Records" ON records;
DROP POLICY IF EXISTS "Read donation records" ON records;
DROP POLICY IF EXISTS "records_select_all" ON records;
DROP POLICY IF EXISTS "records_insert_coordinator" ON records;

-- 1. Cities: Active cities readable by public; coordinators manage
CREATE POLICY "cities_select_active" ON cities
    FOR SELECT TO anon, authenticated
    USING (active = TRUE);

CREATE POLICY "cities_coordinator_manage" ON cities
    FOR ALL TO authenticated
    USING (private.is_global_coordinator())
    WITH CHECK (private.is_global_coordinator());

-- 2. Profiles: Users manage own profile; coordinators view city profiles
CREATE POLICY "profiles_select_own_or_coordinator" ON profiles
    FOR SELECT TO authenticated
    USING (
        user_id = (SELECT auth.uid())
        OR private.is_coordinator(city_id)
    );

CREATE POLICY "profiles_insert_own" ON profiles
    FOR INSERT TO authenticated
    WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "profiles_update_own" ON profiles
    FOR UPDATE TO authenticated
    USING (user_id = (SELECT auth.uid()))
    WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "profiles_coordinator_update" ON profiles
    FOR UPDATE TO authenticated
    USING (private.is_coordinator(city_id))
    WITH CHECK (private.is_coordinator(city_id));

-- 3. Donors: Own profile or city network visibility
CREATE POLICY "donors_select_anon" ON donors
    FOR SELECT TO anon
    USING (is_synthetic = TRUE);

CREATE POLICY "donors_select_authenticated" ON donors
    FOR SELECT TO authenticated
    USING (
        is_synthetic = TRUE
        OR user_id = (SELECT auth.uid())
        OR private.is_coordinator(city_id)
        OR EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.user_id = (SELECT auth.uid())
              AND p.city_id = donors.city_id
              AND p.role IN ('driver', 'recipient', 'shelter')
        )
    );

CREATE POLICY "donors_insert_own" ON donors
    FOR INSERT TO authenticated
    WITH CHECK (
        user_id = (SELECT auth.uid())
        OR private.is_coordinator(city_id)
    );

CREATE POLICY "donors_update_own_or_coordinator" ON donors
    FOR UPDATE TO authenticated
    USING (
        user_id = (SELECT auth.uid())
        OR private.is_coordinator(city_id)
    )
    WITH CHECK (
        user_id = (SELECT auth.uid())
        OR private.is_coordinator(city_id)
    );

-- 4. Recipients: Shelters manage own; approved shelters visible to city network
CREATE POLICY "recipients_select_anon" ON recipients
    FOR SELECT TO anon
    USING (is_synthetic = TRUE);

CREATE POLICY "recipients_select_authenticated" ON recipients
    FOR SELECT TO authenticated
    USING (
        is_synthetic = TRUE
        OR approved = TRUE
        OR user_id = (SELECT auth.uid())
        OR private.is_coordinator(city_id)
    );

CREATE POLICY "recipients_insert_own" ON recipients
    FOR INSERT TO authenticated
    WITH CHECK (
        user_id = (SELECT auth.uid())
        OR private.is_coordinator(city_id)
    );

CREATE POLICY "recipients_update_own_or_coordinator" ON recipients
    FOR UPDATE TO authenticated
    USING (
        user_id = (SELECT auth.uid())
        OR private.is_coordinator(city_id)
    )
    WITH CHECK (
        user_id = (SELECT auth.uid())
        OR private.is_coordinator(city_id)
    );

-- 5. Drivers: Volunteers manage own status; coordinators oversee active fleet
CREATE POLICY "drivers_select_anon" ON drivers
    FOR SELECT TO anon
    USING (is_synthetic = TRUE);

CREATE POLICY "drivers_select_authenticated" ON drivers
    FOR SELECT TO authenticated
    USING (
        is_synthetic = TRUE
        OR user_id = (SELECT auth.uid())
        OR private.is_coordinator(city_id)
        OR (
            availability = TRUE
            AND EXISTS (
                SELECT 1 FROM profiles p
                WHERE p.user_id = (SELECT auth.uid())
                  AND p.city_id = drivers.city_id
            )
        )
    );

CREATE POLICY "drivers_insert_own" ON drivers
    FOR INSERT TO authenticated
    WITH CHECK (
        user_id = (SELECT auth.uid())
        OR private.is_coordinator(city_id)
    );

CREATE POLICY "drivers_update_own_or_coordinator" ON drivers
    FOR UPDATE TO authenticated
    USING (
        user_id = (SELECT auth.uid())
        OR private.is_coordinator(city_id)
    )
    WITH CHECK (
        user_id = (SELECT auth.uid())
        OR private.is_coordinator(city_id)
    );

-- 6. Donations: Role-specific lifecycle
CREATE POLICY "donations_select_anon" ON donations
    FOR SELECT TO anon
    USING (is_synthetic = TRUE);

CREATE POLICY "donations_select_authenticated" ON donations
    FOR SELECT TO authenticated
    USING (
        is_synthetic = TRUE
        OR private.is_coordinator(city_id)
        OR donor_id IN (SELECT d.id FROM donors d WHERE d.user_id = (SELECT auth.uid()))
        OR recipient_id IN (SELECT r.id FROM recipients r WHERE r.user_id = (SELECT auth.uid()))
        OR driver_id IN (SELECT dr.id FROM drivers dr WHERE dr.user_id = (SELECT auth.uid()))
        OR (
            status = 'posted'
            AND EXISTS (
                SELECT 1 FROM profiles p
                WHERE p.user_id = (SELECT auth.uid())
                  AND p.city_id = donations.city_id
            )
        )
    );

CREATE POLICY "donations_insert_authenticated" ON donations
    FOR INSERT TO authenticated
    WITH CHECK (
        private.is_coordinator(city_id)
        OR (
            status = 'posted'
            AND (
                donor_id IN (SELECT d.id FROM donors d WHERE d.user_id = (SELECT auth.uid()))
                OR EXISTS (
                    SELECT 1 FROM profiles p
                    WHERE p.user_id = (SELECT auth.uid())
                      AND p.city_id = donations.city_id
                      AND p.role = 'donor'
                )
            )
        )
    );

CREATE POLICY "donations_update_coordinator" ON donations
    FOR UPDATE TO authenticated
    USING (private.is_coordinator(city_id))
    WITH CHECK (private.is_coordinator(city_id));

CREATE POLICY "donations_update_donor" ON donations
    FOR UPDATE TO authenticated
    USING (
        donor_id IN (SELECT d.id FROM donors d WHERE d.user_id = (SELECT auth.uid()))
        AND status IN ('posted', 'matched')
    )
    WITH CHECK (
        donor_id IN (SELECT d.id FROM donors d WHERE d.user_id = (SELECT auth.uid()))
        AND status IN ('posted', 'matched', 'cancelled')
    );

CREATE POLICY "donations_update_driver" ON donations
    FOR UPDATE TO authenticated
    USING (
        driver_id IN (SELECT dr.id FROM drivers dr WHERE dr.user_id = (SELECT auth.uid()))
    )
    WITH CHECK (
        driver_id IN (SELECT dr.id FROM drivers dr WHERE dr.user_id = (SELECT auth.uid()))
        AND status IN ('matched', 'accepted', 'picked_up')
    );

CREATE POLICY "donations_update_recipient" ON donations
    FOR UPDATE TO authenticated
    USING (
        recipient_id IN (SELECT r.id FROM recipients r WHERE r.user_id = (SELECT auth.uid()))
    )
    WITH CHECK (
        recipient_id IN (SELECT r.id FROM recipients r WHERE r.user_id = (SELECT auth.uid()))
        AND status IN ('picked_up', 'delivered')
    );

-- 7. Matches: Involved parties & coordinator
CREATE POLICY "matches_select_anon" ON matches
    FOR SELECT TO anon
    USING (
        EXISTS (
            SELECT 1 FROM donations d
            WHERE d.id = matches.donation_id AND d.is_synthetic = TRUE
        )
    );

CREATE POLICY "matches_select_authenticated" ON matches
    FOR SELECT TO authenticated
    USING (
        private.is_coordinator(city_id)
        OR recipient_id IN (SELECT r.id FROM recipients r WHERE r.user_id = (SELECT auth.uid()))
        OR EXISTS (
            SELECT 1 FROM donations d
            WHERE d.id = matches.donation_id
              AND (
                  d.is_synthetic = TRUE
                  OR d.donor_id IN (SELECT dn.id FROM donors dn WHERE dn.user_id = (SELECT auth.uid()))
                  OR d.driver_id IN (SELECT dr.id FROM drivers dr WHERE dr.user_id = (SELECT auth.uid()))
              )
        )
    );

CREATE POLICY "matches_coordinator_manage" ON matches
    FOR ALL TO authenticated
    USING (private.is_coordinator(city_id))
    WITH CHECK (private.is_coordinator(city_id));

CREATE POLICY "matches_recipient_update" ON matches
    FOR UPDATE TO authenticated
    USING (recipient_id IN (SELECT r.id FROM recipients r WHERE r.user_id = (SELECT auth.uid())))
    WITH CHECK (recipient_id IN (SELECT r.id FROM recipients r WHERE r.user_id = (SELECT auth.uid())));

-- 8. Dispatch Events: Involved parties & coordinator
CREATE POLICY "dispatch_events_select_anon" ON dispatch_events
    FOR SELECT TO anon
    USING (
        EXISTS (
            SELECT 1 FROM donations d
            WHERE d.id = dispatch_events.donation_id AND d.is_synthetic = TRUE
        )
    );

CREATE POLICY "dispatch_events_select_authenticated" ON dispatch_events
    FOR SELECT TO authenticated
    USING (
        private.is_coordinator(city_id)
        OR driver_id IN (SELECT dr.id FROM drivers dr WHERE dr.user_id = (SELECT auth.uid()))
        OR EXISTS (
            SELECT 1 FROM donations d
            WHERE d.id = dispatch_events.donation_id
              AND (
                  d.is_synthetic = TRUE
                  OR d.donor_id IN (SELECT dn.id FROM donors dn WHERE dn.user_id = (SELECT auth.uid()))
                  OR d.recipient_id IN (SELECT rc.id FROM recipients rc WHERE rc.user_id = (SELECT auth.uid()))
              )
        )
    );

CREATE POLICY "dispatch_events_insert" ON dispatch_events
    FOR INSERT TO authenticated
    WITH CHECK (
        private.is_coordinator(city_id)
        OR driver_id IN (SELECT dr.id FROM drivers dr WHERE dr.user_id = (SELECT auth.uid()))
    );

-- 9. Handovers: Secure OTP handoff between verified actors
CREATE POLICY "handovers_select_authenticated" ON handovers
    FOR SELECT TO authenticated
    USING (
        private.is_coordinator(city_id)
        OR EXISTS (
            SELECT 1 FROM donations d
            WHERE d.id = handovers.donation_id
              AND (
                  d.donor_id IN (SELECT dn.id FROM donors dn WHERE dn.user_id = (SELECT auth.uid()))
                  OR d.recipient_id IN (SELECT rc.id FROM recipients rc WHERE rc.user_id = (SELECT auth.uid()))
                  OR d.driver_id IN (SELECT dr.id FROM drivers dr WHERE dr.user_id = (SELECT auth.uid()))
              )
        )
    );

CREATE POLICY "handovers_manage_authenticated" ON handovers
    FOR ALL TO authenticated
    USING (
        private.is_coordinator(city_id)
        OR EXISTS (
            SELECT 1 FROM donations d
            WHERE d.id = handovers.donation_id
              AND (
                  d.donor_id IN (SELECT dn.id FROM donors dn WHERE dn.user_id = (SELECT auth.uid()))
                  OR d.recipient_id IN (SELECT rc.id FROM recipients rc WHERE rc.user_id = (SELECT auth.uid()))
                  OR d.driver_id IN (SELECT dr.id FROM drivers dr WHERE dr.user_id = (SELECT auth.uid()))
              )
        )
    )
    WITH CHECK (
        private.is_coordinator(city_id)
        OR EXISTS (
            SELECT 1 FROM donations d
            WHERE d.id = handovers.donation_id
              AND (
                  d.donor_id IN (SELECT dn.id FROM donors dn WHERE dn.user_id = (SELECT auth.uid()))
                  OR d.recipient_id IN (SELECT rc.id FROM recipients rc WHERE rc.user_id = (SELECT auth.uid()))
                  OR d.driver_id IN (SELECT dr.id FROM drivers dr WHERE dr.user_id = (SELECT auth.uid()))
              )
        )
    );

-- 10. Records: Public rescue proof-of-impact
CREATE POLICY "records_select_all" ON records
    FOR SELECT TO anon, authenticated
    USING (TRUE);

CREATE POLICY "records_insert_coordinator" ON records
    FOR INSERT TO authenticated
    WITH CHECK (private.is_coordinator(city_id));

-- Step 6: Grants for Role-Based Execution
GRANT USAGE ON SCHEMA public TO anon, authenticated;

GRANT SELECT ON TABLE cities, records TO anon, authenticated;
GRANT SELECT ON TABLE donors, recipients, drivers, donations, matches, dispatch_events TO anon;
GRANT SELECT ON TABLE profiles, donors, recipients, drivers, donations, matches, dispatch_events, handovers TO authenticated;

GRANT INSERT, UPDATE ON TABLE profiles, donors, recipients, drivers, donations, matches, dispatch_events, handovers TO authenticated;
GRANT DELETE ON TABLE donations, matches, dispatch_events, handovers TO authenticated;


CREATE OR REPLACE FUNCTION public.assign_donation_match(
    p_donation_id TEXT, p_city_id TEXT, p_recipient_id TEXT, p_driver_id TEXT
)
RETURNS SETOF public.donations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    target public.donations%ROWTYPE;
BEGIN
    IF NOT private.is_coordinator(p_city_id) THEN
        RAISE EXCEPTION 'Coordinator access required' USING ERRCODE = '42501';
    END IF;
    UPDATE public.donations d
       SET status = 'matched', recipient_id = p_recipient_id, driver_id = p_driver_id
     WHERE d.id = p_donation_id AND d.city_id = p_city_id AND d.status = 'posted'
       AND EXISTS (
           SELECT 1 FROM public.recipients r WHERE r.id = p_recipient_id AND r.city_id = p_city_id
             AND r.approved AND r.is_open AND r.capacity_kg - r.reserved_kg >= d.qty_kg
             AND d.category IN (SELECT jsonb_array_elements_text(r.accepts))
       )
       AND EXISTS (
           SELECT 1 FROM public.drivers v WHERE v.id = p_driver_id AND v.city_id = p_city_id
             AND v.availability AND v.capacity_kg >= d.qty_kg
       )
    RETURNING d.* INTO target;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Donation or available match not found' USING ERRCODE = 'P0002';
    END IF;
    UPDATE public.recipients r SET reserved_kg = r.reserved_kg + target.qty_kg
     WHERE r.id = target.recipient_id AND r.capacity_kg - r.reserved_kg >= target.qty_kg;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Recipient capacity was already reserved' USING ERRCODE = '40001';
    END IF;
    UPDATE public.drivers v SET availability = FALSE
     WHERE v.id = target.driver_id AND v.availability AND v.capacity_kg >= target.qty_kg;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Driver was already assigned' USING ERRCODE = '40001';
    END IF;
    RETURN NEXT target;
END;
$$;
REVOKE ALL ON FUNCTION public.assign_donation_match(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assign_donation_match(TEXT, TEXT, TEXT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.confirm_donation_stage(
    p_donation_id TEXT, p_city_id TEXT, p_stage TEXT
)
RETURNS SETOF public.donations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    target public.donations%ROWTYPE;
    actor_role TEXT;
BEGIN
    SELECT p.role INTO actor_role
    FROM public.profiles p
    WHERE p.user_id = (SELECT auth.uid()) AND p.city_id = p_city_id;
    IF actor_role IS NULL THEN
        RAISE EXCEPTION 'City membership required' USING ERRCODE = '42501';
    END IF;
    SELECT d.* INTO target FROM public.donations d
    WHERE d.id = p_donation_id AND d.city_id = p_city_id
    FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Donation not found' USING ERRCODE = 'P0002';
    END IF;
    IF p_stage = 'pickup' AND actor_role = 'driver'
       AND target.status IN ('matched', 'accepted')
       AND EXISTS (SELECT 1 FROM public.drivers v WHERE v.id = target.driver_id AND v.user_id = (SELECT auth.uid())) THEN
        UPDATE public.donations SET status = 'picked_up' WHERE id = target.id RETURNING * INTO target;
    ELSIF p_stage = 'delivery' AND actor_role IN ('recipient', 'shelter')
       AND target.status = 'picked_up'
       AND EXISTS (SELECT 1 FROM public.recipients r WHERE r.id = target.recipient_id AND r.user_id = (SELECT auth.uid())) THEN
        UPDATE public.donations SET status = 'delivered' WHERE id = target.id RETURNING * INTO target;
        UPDATE public.drivers SET availability = TRUE WHERE id = target.driver_id;
    ELSE
        RAISE EXCEPTION 'Assigned account or rescue stage is invalid' USING ERRCODE = '42501';
    END IF;
    RETURN NEXT target;
END;
$$;
REVOKE ALL ON FUNCTION public.confirm_donation_stage(TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_donation_stage(TEXT, TEXT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.audit_donation_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    event_name TEXT;
    event_message TEXT;
BEGIN
    IF TG_OP = 'INSERT' THEN
        event_name := 'posted';
        event_message := 'Donation posted to the city rescue network.';
    ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
        event_name := NEW.status;
        event_message := 'Donation status changed to ' || NEW.status || '.';
    ELSE
        RETURN NEW;
    END IF;
    INSERT INTO public.dispatch_events (donation_id, city_id, driver_id, event_type, message)
    VALUES (NEW.id, NEW.city_id, NEW.driver_id, event_name, event_message);
    IF NEW.status = 'delivered' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'delivered') THEN
        INSERT INTO public.records (donation_id, city_id, quantity_kg, temperature_c, area, delivered_at, consume_by)
        SELECT NEW.id, NEW.city_id, NEW.qty_kg, NEW.temp_c, COALESCE(r.area, 'Unknown'), NOW(), NEW.safe_until
        FROM (SELECT 1) seed LEFT JOIN public.recipients r ON r.id = NEW.recipient_id;
    END IF;
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.audit_donation_change() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS donations_audit_change ON donations;
CREATE TRIGGER donations_audit_change AFTER INSERT OR UPDATE OF status ON donations
FOR EACH ROW EXECUTE FUNCTION public.audit_donation_change();
