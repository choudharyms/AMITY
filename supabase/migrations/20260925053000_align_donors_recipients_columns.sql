-- Migration: 20260925053000_align_donors_recipients_columns.sql
-- Add alias/fallback columns to donors and recipients to prevent 400 errors from REST queries
ALTER TABLE public.donors ADD COLUMN IF NOT EXISTS contact_person TEXT;
ALTER TABLE public.donors ADD COLUMN IF NOT EXISTS phone TEXT;

ALTER TABLE public.recipients ADD COLUMN IF NOT EXISTS demand_kg DOUBLE PRECISION;
ALTER TABLE public.recipients ADD COLUMN IF NOT EXISTS accepted_categories JSONB;
ALTER TABLE public.recipients ADD COLUMN IF NOT EXISTS contact_person TEXT;
ALTER TABLE public.recipients ADD COLUMN IF NOT EXISTS phone TEXT;

UPDATE public.donors SET phone = contact, contact_person = name WHERE phone IS NULL;
UPDATE public.recipients SET demand_kg = capacity_kg, accepted_categories = accepts WHERE demand_kg IS NULL;
