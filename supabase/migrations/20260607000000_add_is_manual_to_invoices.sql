-- Add is_manual flag to invoices and replace the global unique constraint
-- with a partial unique index that only applies to auto-generated invoices.
-- This allows multiple manual invoices for the same enrollment+month+year.

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS is_manual BOOLEAN NOT NULL DEFAULT false;

-- Drop the old global unique constraint (may be named differently depending on Postgres version)
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_enrollment_id_month_year_key;
DROP INDEX IF EXISTS invoices_enrollment_id_month_year_key;

-- Partial unique index: only auto invoices (is_manual = false) must be unique per enrollment+month+year
CREATE UNIQUE INDEX IF NOT EXISTS invoices_auto_unique
  ON invoices (enrollment_id, month, year)
  WHERE NOT is_manual;
