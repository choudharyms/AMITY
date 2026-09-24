-- AaharSetu multi-city and authenticated-access upgrade.\n-- This follows the initial pilot migration and removes its public access policies.\n\n-- AaharSetu multi-city schema for Supabase Postgres + PostGIS.
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

-- Narrow privilege helpers are private to RLS evaluation and cannot choose a caller identity.
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA private TO authenticated;

CREATE OR REPLACE FUNCTION private.is_coordinator(target_city TEXT)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.user_id = (SELECT auth.uid())
          AND p.role = 'coordinator'
          AND p.city_id = target_city
    );
$$;

CREATE OR REPLACE FUNCTION private.can_access_donation(target_donation_id TEXT)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.donations d
        LEFT JOIN public.donors dn ON dn.id = d.donor_id
        LEFT JOIN public.recipients rc ON rc.id = d.recipient_id
        LEFT JOIN public.drivers dr ON dr.id = d.driver_id
        WHERE d.id = target_donation_id
          AND ((SELECT auth.uid()) IN (dn.user_id, rc.user_id, dr.user_id)
               OR private.is_coordinator(d.city_id))
    );
$$;
REVOKE ALL ON FUNCTION private.is_coordinator(TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.can_access_donation(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.is_coordinator(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION private.can_access_donation(TEXT) TO authenticated;

-- RLS replaces the original public read/insert/update policies.
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

DROP POLICY IF EXISTS "Public Read Donors" ON donors;
DROP POLICY IF EXISTS "Public Read Recipients" ON recipients;
DROP POLICY IF EXISTS "Public Read Drivers" ON drivers;
DROP POLICY IF EXISTS "Public Read Donations" ON donations;
DROP POLICY IF EXISTS "Public Insert Donations" ON donations;
DROP POLICY IF EXISTS "Public Update Donations" ON donations;
DROP POLICY IF EXISTS "Public Read Matches" ON matches;
DROP POLICY IF EXISTS "Public Read Dispatch Events" ON dispatch_events;
DROP POLICY IF EXISTS "Public Read Records" ON records;
DROP POLICY IF EXISTS "Authenticated city directory" ON cities;
DROP POLICY IF EXISTS "Read own profile" ON profiles;
DROP POLICY IF EXISTS "Update own preferences" ON profiles;
DROP POLICY IF EXISTS "Read registered donors" ON donors;
DROP POLICY IF EXISTS "Read registered recipients" ON recipients;
DROP POLICY IF EXISTS "Read registered drivers" ON drivers;
DROP POLICY IF EXISTS "Read assigned donations" ON donations;
DROP POLICY IF EXISTS "Donor posts own donation" ON donations;
DROP POLICY IF EXISTS "Coordinator manages city donations" ON donations;
DROP POLICY IF EXISTS "Assigned driver confirms pickup" ON donations;
DROP POLICY IF EXISTS "Assigned recipient confirms delivery" ON donations;
DROP POLICY IF EXISTS "Read donation matches" ON matches;
DROP POLICY IF EXISTS "Read donation events" ON dispatch_events;
DROP POLICY IF EXISTS "Read donation records" ON records;

CREATE POLICY "Authenticated city directory" ON cities FOR SELECT TO authenticated USING (active);
CREATE POLICY "Read own profile" ON profiles FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE POLICY "Update own preferences" ON profiles FOR UPDATE TO authenticated
    USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "Read registered donors" ON donors FOR SELECT TO authenticated
    USING (user_id = (SELECT auth.uid()) OR private.is_coordinator(city_id));
CREATE POLICY "Read registered recipients" ON recipients FOR SELECT TO authenticated
    USING (user_id = (SELECT auth.uid()) OR private.is_coordinator(city_id));
CREATE POLICY "Read registered drivers" ON drivers FOR SELECT TO authenticated
    USING (user_id = (SELECT auth.uid()) OR private.is_coordinator(city_id));
CREATE POLICY "Read assigned donations" ON donations FOR SELECT TO authenticated
    USING (private.can_access_donation(id));
CREATE POLICY "Donor posts own donation" ON donations FOR INSERT TO authenticated
    WITH CHECK (
        status = 'posted' AND is_synthetic = FALSE
        AND EXISTS (
            SELECT 1 FROM donors d
            WHERE d.id = donations.donor_id
              AND d.user_id = (SELECT auth.uid())
              AND d.city_id = donations.city_id
              AND EXISTS (
                  SELECT 1 FROM profiles p
                  WHERE p.user_id = (SELECT auth.uid())
                    AND p.role = 'donor'
                    AND p.city_id = donations.city_id
              )
        )
    );
CREATE POLICY "Read donation matches" ON matches FOR SELECT TO authenticated
    USING (private.can_access_donation(donation_id));
CREATE POLICY "Read donation events" ON dispatch_events FOR SELECT TO authenticated
    USING (private.can_access_donation(donation_id));
CREATE POLICY "Read donation records" ON records FOR SELECT TO authenticated
    USING (private.can_access_donation(donation_id));

REVOKE ALL ON TABLE cities, profiles, donors, recipients, drivers, donations, matches,
    dispatch_events, handovers, records FROM anon, authenticated;
GRANT SELECT ON TABLE cities TO authenticated;
GRANT SELECT ON TABLE profiles TO authenticated;
GRANT UPDATE (display_name, organization, phone, fssai_license, area, active_city_id) ON profiles TO authenticated;
GRANT SELECT ON TABLE donors, recipients, drivers, donations, matches, dispatch_events, records TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE donations FROM authenticated;
GRANT INSERT (city_id, donor_id, item, category, qty_kg, prepared_at, temp_c, safe_until, status, raw_text, is_synthetic)
    ON donations TO authenticated;

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
