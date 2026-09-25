-- Migration: Security Advisor Fixes
-- 1. Fix mutable search_path and revoke public execution on auto_confirm_user
ALTER FUNCTION public.auto_confirm_user() SET search_path = public, auth;
REVOKE EXECUTE ON FUNCTION public.auto_confirm_user() FROM anon, authenticated;

-- 2. Lock search_path on donation functions
ALTER FUNCTION public.assign_donation_match(text, text, text, text) SET search_path = public;
ALTER FUNCTION public.confirm_donation_stage(text, text, text) SET search_path = public;

-- 3. Add RLS policies for handovers table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'handovers' AND policyname = 'Public read handovers'
    ) THEN
        CREATE POLICY "Public read handovers" ON public.handovers FOR SELECT USING (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'handovers' AND policyname = 'Authenticated manage handovers'
    ) THEN
        CREATE POLICY "Authenticated manage handovers" ON public.handovers FOR ALL TO authenticated USING (true) WITH CHECK (true);
    END IF;
END $$;
