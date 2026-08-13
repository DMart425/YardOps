-- Target project ref: lewzqavgvltzwfeypvam
-- SMS handoff mode (2026-08-12): the operator's business number moved to
-- Google Voice, which the sms: deep links can't reach (Android offers no
-- app chooser and GV has no compose deep link). New setting selects how
-- outgoing texts are launched:
--   'device'       — sms: deep link to the phone's default messaging app
--                    (current behavior; NULL means this)
--   'google_voice' — copy the composed body to the clipboard and open the
--                    customer's Google Voice thread to paste into
--
-- Scope: 1 nullable column with a CHECK on pricing_settings.
--        No data, RLS, functions, triggers, views, or storage modified.
-- Rollback: ALTER TABLE public.pricing_settings DROP COLUMN sms_mode;

ALTER TABLE public.pricing_settings
  ADD COLUMN IF NOT EXISTS sms_mode text
  CHECK (sms_mode IS NULL OR sms_mode IN ('device', 'google_voice'));
