/*
  # Student age + age-based default invoice price

  1. `age` on registration_applications and profiles. Forms take either an age or a
     date of birth (existing date_of_birth column); a date of birth wins when both
     are set because it stays correct over time.
  2. `age_prices` on invoice_settings: the monthly price per age range used for
     auto-generated invoices. Students without an age fall back to default_amount;
     per-student overrides still win over both.
     Seeded: up to 14 → €30, 15 and over → €40.

  Idempotent.
*/

ALTER TABLE registration_applications ADD COLUMN IF NOT EXISTS age integer;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS age integer;

ALTER TABLE invoice_settings ADD COLUMN IF NOT EXISTS age_prices jsonb NOT NULL DEFAULT '[]'::jsonb;

UPDATE invoice_settings
SET age_prices = '[{"minAge":null,"maxAge":14,"amount":30},{"minAge":15,"maxAge":null,"amount":40}]'::jsonb
WHERE age_prices = '[]'::jsonb;
