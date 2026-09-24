-- AaharSetu Auth Integration Migration
-- Creates profiles table, auth trigger, private schema helpers,
-- replaces open RLS policies with auth-scoped ones.

-- 1. Profiles table
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

-- 2. Add user_id columns to entity tables
ALTER TABLE donors ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE recipients ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- 3. Auth trigger: auto-provision profile on signup
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
        COALESCE(NULLIF(NEW.raw_user_meta_data ->>'display_name', ''), 'AaharSetu member'),
        CASE WHEN NEW.raw_user_meta_data ->>'requested_role' IN ('donor', 'driver', 'recipient', 'shelter')
            THEN NEW.raw_user_meta_data ->>'requested_role' ELSE 'donor' END,
        CASE WHEN EXISTS (SELECT 1 FROM public.cities c WHERE c.id = NEW.raw_user_meta_data ->>'city_id' AND c.active)
            THEN NEW.raw_user_meta_data ->>'city_id' ELSE 'blr' END,
        CASE WHEN EXISTS (SELECT 1 FROM public.cities c WHERE c.id = NEW.raw_user_meta_data ->>'city_id' AND c.active)
            THEN NEW.raw_user_meta_data ->>'city_id' ELSE 'blr' END
    ) ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.provision_aaharsetu_profile() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS on_auth_user_created_aaharsetu ON auth.users;
CREATE TRIGGER on_auth_user_created_aaharsetu AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.provision_aaharsetu_profile();

-- 4. Private schema with RLS helper functions
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

-- 5. Enable RLS on profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 6. Drop old open policies, create auth-scoped ones
DROP POLICY IF EXISTS "Public Read Cities" ON cities;
CREATE POLICY "Authenticated city directory" ON cities FOR SELECT TO authenticated USING (active);

CREATE POLICY "Read own profile" ON profiles FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE POLICY "Update own preferences" ON profiles FOR UPDATE TO authenticated
    USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Public Read Donors" ON donors;
DROP POLICY IF EXISTS "Public Write Donors" ON donors;
CREATE POLICY "Read registered donors" ON donors FOR SELECT TO authenticated
    USING (user_id = (SELECT auth.uid()) OR private.is_coordinator(city_id));

DROP POLICY IF EXISTS "Public Read Recipients" ON recipients;
DROP POLICY IF EXISTS "Public Write Recipients" ON recipients;
CREATE POLICY "Read registered recipients" ON recipients FOR SELECT TO authenticated
    USING (user_id = (SELECT auth.uid()) OR private.is_coordinator(city_id));

DROP POLICY IF EXISTS "Public Read Drivers" ON drivers;
DROP POLICY IF EXISTS "Public Write Drivers" ON drivers;
CREATE POLICY "Read registered drivers" ON drivers FOR SELECT TO authenticated
    USING (user_id = (SELECT auth.uid()) OR private.is_coordinator(city_id));

DROP POLICY IF EXISTS "Public Read Donations" ON donations;
DROP POLICY IF EXISTS "Public Insert Donations" ON donations;
DROP POLICY IF EXISTS "Public Update Donations" ON donations;
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

DROP POLICY IF EXISTS "Public Read Matches" ON matches;
DROP POLICY IF EXISTS "Public Write Matches" ON matches;
CREATE POLICY "Read donation matches" ON matches FOR SELECT TO authenticated
    USING (private.can_access_donation(donation_id));

DROP POLICY IF EXISTS "Public Read Dispatch Events" ON dispatch_events;
DROP POLICY IF EXISTS "Public Write Dispatch Events" ON dispatch_events;
CREATE POLICY "Read donation events" ON dispatch_events FOR SELECT TO authenticated
    USING (private.can_access_donation(donation_id));

DROP POLICY IF EXISTS "Public Read Records" ON records;
DROP POLICY IF EXISTS "Public Write Records" ON records;
CREATE POLICY "Read donation records" ON records FOR SELECT TO authenticated
    USING (private.can_access_donation(donation_id));

-- 7. Tighten grants
REVOKE ALL ON TABLE cities FROM anon;
GRANT SELECT ON TABLE cities TO authenticated;

REVOKE ALL ON TABLE profiles FROM anon, authenticated;
GRANT SELECT ON TABLE profiles TO authenticated;
GRANT UPDATE (display_name, organization, phone, fssai_license, area, active_city_id) ON profiles TO authenticated;

REVOKE ALL ON TABLE donors, recipients, drivers, donations, matches, dispatch_events, handovers, records FROM anon, authenticated;
GRANT SELECT ON TABLE donors, recipients, drivers, donations, matches, dispatch_events, records TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE donations FROM authenticated;
GRANT INSERT (city_id, donor_id, item, category, qty_kg, prepared_at, temp_c, safe_until, status, raw_text, is_synthetic)
    ON donations TO authenticated;

GRANT INSERT (city_id, user_id, name, latitude, longitude, availability, vehicle, capacity_kg, is_synthetic, reliability)
    ON drivers TO authenticated;
GRANT INSERT (city_id, user_id, name, area, latitude, longitude, capacity_kg, reserved_kg, accepts, need_level, open_hours, approved, is_open, reliability, is_synthetic)
    ON recipients TO authenticated;
GRANT INSERT (city_id, user_id, name, area, latitude, longitude, license_no, license_verified, is_synthetic)
    ON donors TO authenticated;

-- 8. Server-side functions for match assignment and donation stage confirmation
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

-- 9. Audit trigger for donation changes
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
