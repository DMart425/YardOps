-- Add nullable phone column to businesses table.
-- Provides a business-scoped contact number for customer-facing SMS and portal display.
-- No NOT NULL constraint. No backfill. No RLS changes.
-- Migration file only. Do not apply automatically.

alter table public.businesses
  add column if not exists phone text;
