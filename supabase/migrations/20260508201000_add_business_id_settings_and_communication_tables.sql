-- Add business_id columns to settings and communication tables
-- Phase 2A: Settings and communication tables (equipment, maintenance_items, message_logs, customer_portal_tokens, pricing_settings)

-- equipment
ALTER TABLE public.equipment
ADD COLUMN IF NOT EXISTS business_id uuid REFERENCES public.businesses(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_equipment_business_id ON public.equipment USING btree (business_id);

-- maintenance_items
ALTER TABLE public.maintenance_items
ADD COLUMN IF NOT EXISTS business_id uuid REFERENCES public.businesses(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_maintenance_items_business_id ON public.maintenance_items USING btree (business_id, equipment_id);

-- message_logs
ALTER TABLE public.message_logs
ADD COLUMN IF NOT EXISTS business_id uuid REFERENCES public.businesses(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_message_logs_business_created_at ON public.message_logs USING btree (business_id, created_at desc);

-- customer_portal_tokens
ALTER TABLE public.customer_portal_tokens
ADD COLUMN IF NOT EXISTS business_id uuid REFERENCES public.businesses(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_customer_portal_tokens_business_id ON public.customer_portal_tokens USING btree (business_id, customer_id);

-- pricing_settings
ALTER TABLE public.pricing_settings
ADD COLUMN IF NOT EXISTS business_id uuid REFERENCES public.businesses(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_pricing_settings_business_id ON public.pricing_settings USING btree (business_id);