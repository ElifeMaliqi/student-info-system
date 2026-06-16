-- ============================================================
-- Allow class-less imported invoices
-- ============================================================
-- Invoices imported from external payment-confirmation documents are not tied
-- to a specific class/enrollment. Relax the NOT NULL constraints so such rows
-- can be stored; the app renders a null class as "Imported Doc".

ALTER TABLE invoices ALTER COLUMN enrollment_id DROP NOT NULL;
ALTER TABLE invoices ALTER COLUMN class_id      DROP NOT NULL;

NOTIFY pgrst, 'reload schema';
