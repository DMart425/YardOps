-- Target project ref: lewzqavgvltzwfeypvam
-- Route + review features (2026-08-06):
--
-- 1. pricing_settings gains four nullable columns:
--    - home_base_address / home_base_latitude / home_base_longitude — the
--      operator's route starting point. Address is geocoded at settings save;
--      route ordering seeds nearest-neighbor from these coords instead of the
--      northernmost job.
--    - review_request_url — the Google review link used by the discretionary
--      post-payment review-request SMS button.
--
-- 2. message_logs.message_type check constraint gains 'review_request' so
--    review asks can be logged (the log is also how the button hides itself
--    after a customer has been asked once). All existing values preserved
--    verbatim from the live constraint definition.
--
-- Scope: 4 additive nullable columns + 1 check-constraint recreate.
--        No data, RLS, functions, triggers, views, or storage modified.
--        pricing_settings user-scoped RLS policies cover new columns as-is.
-- Rollback: drop the four columns; recreate the previous constraint without
--           'review_request' (reversible; no data depends on new columns).

ALTER TABLE public.pricing_settings
  ADD COLUMN IF NOT EXISTS home_base_address   text,
  ADD COLUMN IF NOT EXISTS home_base_latitude  double precision,
  ADD COLUMN IF NOT EXISTS home_base_longitude double precision,
  ADD COLUMN IF NOT EXISTS review_request_url  text;

ALTER TABLE public.message_logs
  DROP CONSTRAINT IF EXISTS message_logs_message_type_check;

ALTER TABLE public.message_logs
  ADD CONSTRAINT message_logs_message_type_check
  CHECK (message_type = ANY (ARRAY[
    'day_before_service_reminder'::text,
    'on_my_way'::text,
    'arriving_shortly'::text,
    'job_complete'::text,
    'receipt_paid'::text,
    'receipt_unpaid'::text,
    'payment_reminder'::text,
    'estimate_follow_up'::text,
    'review_request'::text
  ]));
