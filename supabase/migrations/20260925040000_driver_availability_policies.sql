-- Migration: Ensure authenticated drivers and coordinators can update and insert driver availability records
-- Enables instant online/offline toggle functionality for drivers in their dashboard.

-- Grant standard table privileges to authenticated role so RLS policies can evaluate
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.drivers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.donations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.dispatch_events TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.donors TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.recipients TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.records TO authenticated;

DO $$
BEGIN
    -- 1. Ensure UPDATE policy exists on drivers table
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'drivers' AND policyname = 'drivers_update_own_or_coordinator'
    ) THEN
        CREATE POLICY "drivers_update_own_or_coordinator" ON public.drivers
        FOR UPDATE TO authenticated
        USING (
            user_id = auth.uid()
            OR
            EXISTS (
                SELECT 1 FROM public.profiles p
                WHERE p.user_id = auth.uid()
                AND p.role IN ('coordinator', 'driver')
            )
        )
        WITH CHECK (
            user_id = auth.uid()
            OR
            EXISTS (
                SELECT 1 FROM public.profiles p
                WHERE p.user_id = auth.uid()
                AND p.role IN ('coordinator', 'driver')
            )
        );
    END IF;

    -- 2. Ensure INSERT policy exists for self-provisioning / onboarding
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'drivers' AND policyname = 'drivers_insert_own_or_coordinator'
    ) THEN
        CREATE POLICY "drivers_insert_own_or_coordinator" ON public.drivers
        FOR INSERT TO authenticated
        WITH CHECK (
            user_id = auth.uid()
            OR
            EXISTS (
                SELECT 1 FROM public.profiles p
                WHERE p.user_id = auth.uid()
                AND p.role IN ('coordinator', 'driver')
            )
        );
    END IF;
END $$;
