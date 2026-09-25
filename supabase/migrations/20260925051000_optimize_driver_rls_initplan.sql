-- Migration: 20260925051000_optimize_driver_rls_initplan.sql
-- Optimize drivers RLS to wrap auth.uid() in (SELECT auth.uid()) for query-level caching

DROP POLICY IF EXISTS "drivers_update_own_or_coordinator" ON public.drivers;
CREATE POLICY "drivers_update_own_or_coordinator" ON public.drivers
FOR UPDATE TO authenticated
USING (
    user_id = (SELECT auth.uid())
    OR
    EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.user_id = (SELECT auth.uid())
        AND p.role IN ('coordinator', 'driver')
    )
)
WITH CHECK (
    user_id = (SELECT auth.uid())
    OR
    EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.user_id = (SELECT auth.uid())
        AND p.role IN ('coordinator', 'driver')
    )
);

DROP POLICY IF EXISTS "drivers_insert_own_or_coordinator" ON public.drivers;
CREATE POLICY "drivers_insert_own_or_coordinator" ON public.drivers
FOR INSERT TO authenticated
WITH CHECK (
    user_id = (SELECT auth.uid())
    OR
    EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.user_id = (SELECT auth.uid())
        AND p.role IN ('coordinator', 'driver')
    )
);
