-- Migration: 20260925050000_dedicated_roles_donations_rls.sql
-- Allow dedicated roles (donor, coordinator) to insert new food donations.
-- Optimizes INSERT and UPDATE policies for donations using cached (SELECT auth.uid()).

-- 1. Drop existing restrictive / obsolete donation insert policies
DROP POLICY IF EXISTS "Donor posts own donation" ON public.donations;
DROP POLICY IF EXISTS "donations_insert_authenticated" ON public.donations;
DROP POLICY IF EXISTS "donations_insert_dedicated_roles" ON public.donations;

-- 2. Create the new INSERT policy for dedicated roles
CREATE POLICY "donations_insert_dedicated_roles" ON public.donations
FOR INSERT TO authenticated
WITH CHECK (
    -- Coordinators have full authority to log/intake donations
    EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.user_id = (SELECT auth.uid())
          AND (p.role = 'coordinator' OR p.requested_role = 'coordinator')
    )
    OR
    -- Dedicated donors can post new donations
    (
        status = 'posted'
        AND (
            EXISTS (
                SELECT 1 FROM public.profiles p
                WHERE p.user_id = (SELECT auth.uid())
                  AND (p.role = 'donor' OR p.requested_role = 'donor')
            )
            OR
            EXISTS (
                SELECT 1 FROM public.donors d
                WHERE d.id = donations.donor_id
                  AND d.user_id = (SELECT auth.uid())
            )
        )
    )
);

-- 3. Replace UPDATE policy to allow donors to manage/cancel their posted donations
-- and use (SELECT auth.uid()) to avoid re-evaluating auth function per-row
DROP POLICY IF EXISTS "Drivers and coordinators can update donations" ON public.donations;
DROP POLICY IF EXISTS "donations_update_dedicated_roles" ON public.donations;

CREATE POLICY "donations_update_dedicated_roles" ON public.donations
FOR UPDATE TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.user_id = (SELECT auth.uid())
          AND p.role = ANY (ARRAY['coordinator'::text, 'driver'::text, 'recipient'::text, 'shelter'::text, 'donor'::text])
    )
    OR
    EXISTS (
        SELECT 1 FROM public.donors d
        WHERE d.id = donations.donor_id
          AND d.user_id = (SELECT auth.uid())
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.user_id = (SELECT auth.uid())
          AND p.role = ANY (ARRAY['coordinator'::text, 'driver'::text, 'recipient'::text, 'shelter'::text, 'donor'::text])
    )
    OR
    EXISTS (
        SELECT 1 FROM public.donors d
        WHERE d.id = donations.donor_id
          AND d.user_id = (SELECT auth.uid())
    )
);

-- 4. Foreign key covering indexes for RLS and join optimization
CREATE INDEX IF NOT EXISTS donations_city_id_idx ON public.donations (city_id);
CREATE INDEX IF NOT EXISTS donations_donor_id_idx ON public.donations (donor_id);
