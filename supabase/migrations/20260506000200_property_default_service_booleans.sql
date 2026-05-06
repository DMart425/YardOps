-- B.7c-a: Add nullable boolean columns for property-level default service preferences.
-- These replace the opaque default_service_package string for UI purposes.
-- default_service_package is NOT dropped; it is preserved for legacy job references and fallback.
--
-- null means "not yet reviewed for this property"
-- true  means "this service is explicitly enabled by default"
-- false means "this service is explicitly disabled by default"
--
-- Migration is idempotent: backfill only updates rows where all four columns are still null.

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS default_mowing_enabled       boolean,
  ADD COLUMN IF NOT EXISTS default_weed_eating_enabled  boolean,
  ADD COLUMN IF NOT EXISTS default_edging_enabled       boolean,
  ADD COLUMN IF NOT EXISTS default_blow_off_enabled     boolean;

-- Backfill from existing default_service_package values.
-- Only touches rows where all four new columns are still null (idempotent).

-- mow_only: mowing=true, everything else=false
UPDATE public.properties
SET
  default_mowing_enabled      = true,
  default_weed_eating_enabled = false,
  default_edging_enabled      = false,
  default_blow_off_enabled    = false
WHERE
  default_service_package = 'mow_only'
  AND default_mowing_enabled      IS NULL
  AND default_weed_eating_enabled IS NULL
  AND default_edging_enabled      IS NULL
  AND default_blow_off_enabled    IS NULL;

-- mow_blow: mowing=true, blow_off=true, weed_eating=false, edging=false
UPDATE public.properties
SET
  default_mowing_enabled      = true,
  default_weed_eating_enabled = false,
  default_edging_enabled      = false,
  default_blow_off_enabled    = true
WHERE
  default_service_package = 'mow_blow'
  AND default_mowing_enabled      IS NULL
  AND default_weed_eating_enabled IS NULL
  AND default_edging_enabled      IS NULL
  AND default_blow_off_enabled    IS NULL;

-- full_service_mow_edge_trim_blow: all true
UPDATE public.properties
SET
  default_mowing_enabled      = true,
  default_weed_eating_enabled = true,
  default_edging_enabled      = true,
  default_blow_off_enabled    = true
WHERE
  default_service_package = 'full_service_mow_edge_trim_blow'
  AND default_mowing_enabled      IS NULL
  AND default_weed_eating_enabled IS NULL
  AND default_edging_enabled      IS NULL
  AND default_blow_off_enabled    IS NULL;

-- first_cut_overgrown: treat as full service for boolean purposes
UPDATE public.properties
SET
  default_mowing_enabled      = true,
  default_weed_eating_enabled = true,
  default_edging_enabled      = true,
  default_blow_off_enabled    = true
WHERE
  default_service_package = 'first_cut_overgrown'
  AND default_mowing_enabled      IS NULL
  AND default_weed_eating_enabled IS NULL
  AND default_edging_enabled      IS NULL
  AND default_blow_off_enabled    IS NULL;

-- leaf_cleanup, custom, null, unknown: leave all four columns null (not reviewed / ambiguous).
-- No UPDATE needed — columns default to null and the idempotent guard above already handles these.
