-- Runbook FILLED REVIEW ONLY (manual execution only; not an auto migration).
--
-- Purpose:
--   1) create/update Wicksburg business row
--   2) attach owner user as active business member
--   3) backfill existing leads.business_id where null
--
-- This script is review-only and must be run manually when approved.
-- Do not place in supabase/migrations and do not auto-apply.

DO $$
DECLARE
  target_business_name text := 'Wicksburg Lawn Service';
  target_business_slug text := 'wicksburg-lawn-service';
  owner_user_id_text text := '32d6ac03-3aa0-4f29-82ce-a9355f9ddc12';
  owner_user_id uuid;
  v_business_id uuid;
BEGIN
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
