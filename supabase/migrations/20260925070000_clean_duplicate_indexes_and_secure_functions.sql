-- Migration: Clean duplicate indexes, add foreign key covering indexes, and secure internal trigger functions

-- Clean duplicate location indexes (keeping GIST spatial indexes)
DROP INDEX IF EXISTS public.donors_location_idx;
DROP INDEX IF EXISTS public.drivers_location_idx;
DROP INDEX IF EXISTS public.recipients_location_idx;

-- Revoke public execution of auto_confirm_user from anon and authenticated roles
REVOKE EXECUTE ON FUNCTION public.auto_confirm_user() FROM anon, authenticated;

-- Add covering indexes on common unindexed foreign keys
CREATE INDEX IF NOT EXISTS dispatch_events_donation_id_idx ON public.dispatch_events(donation_id);
CREATE INDEX IF NOT EXISTS dispatch_events_driver_id_idx ON public.dispatch_events(driver_id);
CREATE INDEX IF NOT EXISTS donations_recipient_id_idx ON public.donations(recipient_id);
CREATE INDEX IF NOT EXISTS handovers_donation_id_idx ON public.handovers(donation_id);
CREATE INDEX IF NOT EXISTS matches_recipient_id_idx ON public.matches(recipient_id);
