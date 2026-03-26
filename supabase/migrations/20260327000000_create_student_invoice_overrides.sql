-- Per-student invoice overrides: when set, these values are used instead of global invoice_settings
CREATE TABLE IF NOT EXISTS student_invoice_overrides (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  custom_amount NUMERIC(10,2),
  custom_discount_percent NUMERIC(5,2),
  custom_due_day INTEGER CHECK (custom_due_day >= 1 AND custom_due_day <= 28),
  custom_title_template TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id)
);

ALTER TABLE student_invoice_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin full access on student_invoice_overrides" ON student_invoice_overrides;
CREATE POLICY "Admin full access on student_invoice_overrides"
  ON student_invoice_overrides
  FOR ALL
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin')
  WITH CHECK ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

DROP TRIGGER IF EXISTS set_timestamp_student_invoice_overrides ON student_invoice_overrides;
CREATE TRIGGER set_timestamp_student_invoice_overrides
  BEFORE UPDATE ON student_invoice_overrides
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
