-- Migration: Allow 'coordinator' in profiles_requested_role_check
-- Fixes "Database error saving new user" (check constraint "profiles_requested_role_check" violation)
-- when registering a user with the Network Coordinator role.

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_requested_role_check;

ALTER TABLE public.profiles ADD CONSTRAINT profiles_requested_role_check 
    CHECK (requested_role IS NULL OR requested_role IN ('coordinator', 'donor', 'driver', 'recipient', 'shelter'));
