-- Runbook template (manual execution only; not an auto migration).
--
-- Purpose:
--   1) create/update Wicksburg business row
--   2) attach owner user as active business member
--   3) backfill existing leads.business_id where null
--
-- REQUIRED REPLACEMENTS BEFORE RUNNING:
--   REPLACE_WITH_BUSINESS_NAME
--   REPLACE_WITH_BUSINESS_SLUG
--   REPLACE_WITH_OWNER_AUTH_USER_ID
--
-- This script intentionally raises an exception if placeholders are not replaced.

DO $$
DECLARE
  target_business_name text := 'REPLACE_WITH_BUSINESS_NAME';
  target_business_slug text := 'REPLACE_WITH_BUSINESS_SLUG';
  owner_user_id_text text := 'REPLACE_WITH_OWNER_AUTH_USER_ID';
  owner_user_id uuid;
  v_business_id uuid;
BEGIN
  IF target_business_name LIKE 'REPLACE_WITH_%'
    OR target_business_slug LIKE 'REPLACE_WITH_%'
    OR owner_user_id_text LIKE 'REPLACE_WITH_%'
  THEN
    RAISE EXCEPTION
      'Placeholder values must be replaced before running 20260508091000_backfill_wicksburg_business_template.sql';
  END IF;

  owner_user_id := owner_user_id_text::uuid;

  INSERT INTO public.businesses (name, slug, owner_user_id, status)
  VALUES (target_business_name, target_business_slug, owner_user_id, 'active')
  ON CONFLICT (slug)
  DO UPDATE
    SET name = EXCLUDED.name,
        owner_user_id = EXCLUDED.owner_user_id,
        status = 'active',
        updated_at = now()
  RETURNING id INTO v_business_id;

  INSERT INTO public.business_members (business_id, user_id, role, status)
  VALUES (v_business_id, owner_user_id, 'owner', 'active')
  ON CONFLICT (business_id, user_id)
  DO UPDATE
    SET role = 'owner',
        status = 'active';

  UPDATE public.leads
  SET business_id = v_business_id,
      created_by = coalesce(created_by, owner_user_id)
  WHERE business_id IS NULL;
END $$;
