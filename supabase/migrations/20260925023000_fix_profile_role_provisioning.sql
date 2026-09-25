-- Migration: Fix profile role provisioning on signup
-- Ensures selected role (driver, recipient, shelter, donor) is correctly assigned to profiles.role
-- and auto-provisions driver records when a user signs up as a driver.

CREATE OR REPLACE FUNCTION public.provision_aaharsetu_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_role text;
    v_city text;
    v_area text;
    v_phone text;
    v_org text;
    v_fssai text;
    v_lat double precision;
    v_lng double precision;
BEGIN
    -- Determine role from metadata (checking role, requested_role, or fallback to 'donor')
    v_role := COALESCE(
        NULLIF(NEW.raw_user_meta_data ->>'role', ''),
        NULLIF(NEW.raw_user_meta_data ->>'requested_role', ''),
        'donor'
    );
    IF v_role NOT IN ('donor', 'driver', 'recipient', 'shelter', 'coordinator') THEN
        v_role := 'donor';
    END IF;

    -- Validate city
    v_city := COALESCE(NULLIF(NEW.raw_user_meta_data ->>'city_id', ''), 'blr');
    IF NOT EXISTS (SELECT 1 FROM public.cities c WHERE c.id = v_city AND c.active) THEN
        v_city := 'blr';
    END IF;

    -- Get coordinates for city
    SELECT latitude, longitude INTO v_lat, v_lng FROM public.cities WHERE id = v_city;
    IF v_lat IS NULL THEN
        v_lat := 12.9716;
        v_lng := 77.5946;
    END IF;

    v_area := NULLIF(NEW.raw_user_meta_data ->>'area', '');
    v_phone := NULLIF(NEW.raw_user_meta_data ->>'phone', '');
    v_org := NULLIF(NEW.raw_user_meta_data ->>'organization', '');
    v_fssai := NULLIF(NEW.raw_user_meta_data ->>'fssai_license', '');

    INSERT INTO public.profiles (
        user_id,
        email,
        display_name,
        role,
        requested_role,
        organization,
        phone,
        fssai_license,
        area,
        city_id,
        active_city_id
    )
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NULLIF(NEW.raw_user_meta_data ->>'display_name', ''), 'AaharSetu member'),
        v_role,
        v_role,
        v_org,
        v_phone,
        v_fssai,
        v_area,
        v_city,
        v_city
    )
    ON CONFLICT (user_id) DO UPDATE SET
        display_name = EXCLUDED.display_name,
        role = EXCLUDED.role,
        requested_role = EXCLUDED.requested_role,
        organization = COALESCE(EXCLUDED.organization, public.profiles.organization),
        phone = COALESCE(EXCLUDED.phone, public.profiles.phone),
        fssai_license = COALESCE(EXCLUDED.fssai_license, public.profiles.fssai_license),
        area = COALESCE(EXCLUDED.area, public.profiles.area),
        active_city_id = EXCLUDED.active_city_id;

    -- If registering as volunteer driver, automatically create a record in public.drivers!
    IF v_role = 'driver' AND NOT EXISTS (SELECT 1 FROM public.drivers d WHERE d.user_id = NEW.id) THEN
        INSERT INTO public.drivers (
            id,
            name,
            latitude,
            longitude,
            availability,
            vehicle,
            capacity_kg,
            reliability,
            is_synthetic,
            created_at,
            city_id,
            user_id
        ) VALUES (
            'drv_' || substr(md5(NEW.id::text || clock_timestamp()::text), 1, 8),
            COALESCE(NULLIF(NEW.raw_user_meta_data ->>'display_name', ''), 'Volunteer Driver'),
            v_lat,
            v_lng,
            true,
            'Bike',
            30.0,
            0.95,
            false,
            now(),
            v_city,
            NEW.id
        );
    END IF;

    RETURN NEW;
END;
$$;
