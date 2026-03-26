-- ============================================================
-- Finance v2: Auto-generated class-based monthly invoices
-- ============================================================

-- Drop old finance tables
DROP TABLE IF EXISTS installment_plans CASCADE;
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS invoices CASCADE;

-- Invoice settings (singleton row — admin configurable)
CREATE TABLE IF NOT EXISTS invoice_settings (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  default_amount  numeric(10,2) NOT NULL DEFAULT 60.00 CHECK (default_amount >= 0),
  title_template  text NOT NULL DEFAULT '{class} - {month}',
  discount_percent numeric(5,2) NOT NULL DEFAULT 0 CHECK (discount_percent >= 0 AND discount_percent <= 100),
  due_day         int NOT NULL DEFAULT 1 CHECK (due_day >= 1 AND due_day <= 28),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Seed default row
INSERT INTO invoice_settings (default_amount, title_template, discount_percent, due_day)
VALUES (60.00, '{class} - {month}', 0, 1);

-- Invoices (one per enrollment per month)
CREATE TABLE IF NOT EXISTS invoices (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id   uuid NOT NULL REFERENCES class_enrollments(id) ON DELETE CASCADE,
  student_id      uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  class_id        uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  title           text NOT NULL,
  month           int NOT NULL CHECK (month >= 1 AND month <= 12),
  year            int NOT NULL CHECK (year >= 2020),
  due_date        date NOT NULL,
  amount          numeric(10,2) NOT NULL DEFAULT 60.00 CHECK (amount >= 0),
  discount_percent numeric(5,2) NOT NULL DEFAULT 0,
  status          text NOT NULL DEFAULT 'not_paid' CHECK (status IN ('paid','partial','not_paid','overdue')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(enrollment_id, month, year)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_invoices_student    ON invoices(student_id);
CREATE INDEX IF NOT EXISTS idx_invoices_class      ON invoices(class_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status     ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_month_year ON invoices(year, month);

-- Auto-update timestamp
CREATE TRIGGER invoices_updated_at
  BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_settings ENABLE ROW LEVEL SECURITY;

-- Invoices: admin full access
CREATE POLICY invoices_admin ON invoices FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
-- Students read their own
CREATE POLICY invoices_student_read ON invoices FOR SELECT USING (
  student_id = auth.uid()
);
-- Teachers read all (for payment-status display)
CREATE POLICY invoices_teacher_read ON invoices FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'teacher')
);

-- Settings: admin full access, everyone can read
CREATE POLICY settings_admin ON invoice_settings FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY settings_read ON invoice_settings FOR SELECT USING (true);

NOTIFY pgrst, 'reload schema';
