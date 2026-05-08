-- Later manual hardening runbook: enforce leads.business_id not null.
-- Run this manually only after:
-- 1) Wicksburg business row exists,
-- 2) owner membership exists,
-- 3) existing leads are backfilled,
-- 4) YardOps app code is deployed safely,
-- 5) WicksburgLawnService public quote intake writes business_id,
-- 6) and monitoring confirms no new null business_id leads are being created.

DO $$
DECLARE
  missing_count bigint;
BEGIN
  select count(*)
  into missing_count
  from public.leads
  where business_id is null;

  if missing_count > 0 then
    raise exception 'Cannot set leads.business_id NOT NULL. % rows still have business_id IS NULL.', missing_count;
  end if;
END $$;

alter table public.leads
  alter column business_id set not null;
