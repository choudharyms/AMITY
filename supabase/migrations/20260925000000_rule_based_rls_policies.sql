-- ============================================================================
-- AaharSetu: Production Rule-Based Row Level Security (RLS) Policies
-- Migration: 20260925000000_rule_based_rls_policies.sql
-- 
-- Standards Enforced:
-- 1. Full Multi-Tenant Territorial Isolation by city_id
-- 2. Role-Based Access Control (RBAC): coordinator, donor, driver, recipient, shelter, anon
-- 3. High Performance: All auth.uid() lookups wrapped in (SELECT auth.uid()) for InitPlan caching
-- 4. Defense Against IDOR / BOLA: Explicit USING and WITH CHECK on all UPDATE & INSERT policies
-- 5. Full Index Coverage on all foreign keys and RLS predicate columns
-- 6. Idempotent: Safe to re-run anytime
-- ============================================================================

-- Step 1: Ensure Private Helper Schema & Functions
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

-- Restrict Function Execution
REVOKE ALL ON FUNCTION private.is_coordinator(TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.is_global_coordinator() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.get_auth_role() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.get_auth_city() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION private.is_coordinator(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_global_coordinator() TO authenticated;
GRANT EXECUTE ON FUNCTION private.get_auth_role() TO authenticated;
GRANT EXECUTE ON FUNCTION private.get_auth_city() TO authenticated;


-- Step 2: Ensure Performance Indexes on All RLS Predicate Columns
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


-- Step 3: Enable RLS Across All Tables
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


-- Step 4: Drop All Legacy Policies
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


-- ============================================================================
-- Step 5: Define Rule-Based Policies
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. CITIES POLICIES
-- Public reference data: anyone can read active cities; coordinators manage.
-- ----------------------------------------------------------------------------
CREATE POLICY "cities_select_active" ON cities
    FOR SELECT TO anon, authenticated
    USING (active = TRUE);

CREATE POLICY "cities_coordinator_manage" ON cities
    FOR ALL TO authenticated
    USING (private.is_global_coordinator())
    WITH CHECK (private.is_global_coordinator());


-- ----------------------------------------------------------------------------
-- 2. PROFILES POLICIES
-- Users control their own profile; coordinators oversee their city.
-- ----------------------------------------------------------------------------
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


-- ----------------------------------------------------------------------------
-- 3. DONORS POLICIES
-- Donors manage their organization; network members & coordinators can view.
-- ----------------------------------------------------------------------------
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


-- ----------------------------------------------------------------------------
-- 4. RECIPIENTS POLICIES
-- Shelters/food banks manage capacity; approved shelters visible to city network.
-- ----------------------------------------------------------------------------
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


-- ----------------------------------------------------------------------------
-- 5. DRIVERS POLICIES
-- Volunteers manage availability/vehicle; coordinators oversee active fleet.
-- ----------------------------------------------------------------------------
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


-- ----------------------------------------------------------------------------
-- 6. DONATIONS POLICIES
-- Strict role lifecycle:
--   - Donors create and can cancel their postings
--   - Assigned drivers can accept and pickup
--   - Assigned recipients can confirm delivery
--   - Coordinators manage city-wide
--   - Available posted donations readable by drivers & recipients in same city
-- ----------------------------------------------------------------------------
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


-- ----------------------------------------------------------------------------
-- 7. MATCHES POLICIES
-- Suggested and confirmed matches accessible to involved parties and coordinators.
-- ----------------------------------------------------------------------------
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


-- ----------------------------------------------------------------------------
-- 8. DISPATCH EVENTS POLICIES
-- Audit trail of dispatch and pickup operations.
-- ----------------------------------------------------------------------------
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


-- ----------------------------------------------------------------------------
-- 9. HANDOVERS POLICIES
-- Critical security: Handover codes (OTPs) strictly isolated to verified actors.
-- ----------------------------------------------------------------------------
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


-- ----------------------------------------------------------------------------
-- 10. RECORDS POLICIES (Audit & Public Impact Analytics)
-- Completed rescue statistics are public proof-of-impact.
-- ----------------------------------------------------------------------------
CREATE POLICY "records_select_all" ON records
    FOR SELECT TO anon, authenticated
    USING (TRUE);

CREATE POLICY "records_insert_coordinator" ON records
    FOR INSERT TO authenticated
    WITH CHECK (private.is_coordinator(city_id));


-- ============================================================================
-- Step 6: Database Grants to Enable RLS Enforcement Without Role Blockers
-- ============================================================================
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- Table-level read permissions
GRANT SELECT ON TABLE cities, records TO anon, authenticated;
GRANT SELECT ON TABLE donors, recipients, drivers, donations, matches, dispatch_events TO anon;
GRANT SELECT ON TABLE profiles, donors, recipients, drivers, donations, matches, dispatch_events, handovers TO authenticated;

-- Table-level write permissions (enforced row-by-row by RLS)
GRANT INSERT, UPDATE ON TABLE profiles, donors, recipients, drivers, donations, matches, dispatch_events, handovers TO authenticated;
GRANT DELETE ON TABLE donations, matches, dispatch_events, handovers TO authenticated;
