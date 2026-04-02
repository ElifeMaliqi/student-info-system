-- Add public invoice identifier for display and email references.
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS invoice_id text;

-- Ensure new rows receive an invoice identifier if not supplied by app logic.
ALTER TABLE public.invoices
  ALTER COLUMN invoice_id SET DEFAULT ('INV-' || UPPER(SUBSTRING(REPLACE(gen_random_uuid()::text, '-', '') FROM 1 FOR 10)));

-- Backfill existing rows.
UPDATE public.invoices
SET invoice_id = 'INV-' || UPPER(SUBSTRING(REPLACE(gen_random_uuid()::text, '-', '') FROM 1 FOR 10))
WHERE invoice_id IS NULL OR BTRIM(invoice_id) = '';

ALTER TABLE public.invoices
  ALTER COLUMN invoice_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_invoice_id
  ON public.invoices(invoice_id);
