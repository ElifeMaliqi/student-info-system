-- ============================================================
-- Finance tables: invoices, payments, installment_plans
-- ============================================================

-- 1. Invoices
CREATE TABLE IF NOT EXISTS invoices (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text UNIQUE NOT NULL,
  student_id    uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  program_id    uuid REFERENCES programs(id) ON DELETE SET NULL,
  amount        numeric(10,2) NOT NULL CHECK (amount > 0),
  paid_amount   numeric(10,2) NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
  status        text NOT NULL DEFAULT 'pending' CHECK (status IN ('paid','partial','pending','overdue')),
  description   text,
  issue_date    date NOT NULL DEFAULT CURRENT_DATE,
  due_date      date NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Auto-update timestamp
CREATE TRIGGER invoices_updated_at
  BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 2. Payments (each row = one payment or partial payment)
CREATE TABLE IF NOT EXISTS payments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id    uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  student_id    uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  amount        numeric(10,2) NOT NULL CHECK (amount > 0),
  payment_date  date NOT NULL DEFAULT CURRENT_DATE,
  method        text CHECK (method IN ('cash','bank_transfer','online','other')),
  note          text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- 3. Installment plans
CREATE TABLE IF NOT EXISTS installment_plans (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id    uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  installment_number int NOT NULL,
  amount        numeric(10,2) NOT NULL CHECK (amount > 0),
  due_date      date NOT NULL,
  status        text NOT NULL DEFAULT 'pending' CHECK (status IN ('paid','pending','overdue')),
  paid_at       date,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_invoices_student   ON invoices(student_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status     ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_payments_invoice    ON payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_student    ON payments(student_id);
CREATE INDEX IF NOT EXISTS idx_installments_invoice ON installment_plans(invoice_id);

-- RLS
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE installment_plans ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
CREATE POLICY invoices_admin ON invoices FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY payments_admin ON payments FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY installments_admin ON installment_plans FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Students can read their own
CREATE POLICY invoices_student_read ON invoices FOR SELECT USING (
  EXISTS (SELECT 1 FROM students s WHERE s.id = invoices.student_id AND s.user_id = auth.uid())
);
CREATE POLICY payments_student_read ON payments FOR SELECT USING (
  EXISTS (SELECT 1 FROM students s WHERE s.id = payments.student_id AND s.user_id = auth.uid())
);
CREATE POLICY installments_student_read ON installment_plans FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM invoices i
    JOIN students s ON s.id = i.student_id
    WHERE i.id = installment_plans.invoice_id AND s.user_id = auth.uid()
  )
);

-- Teachers can read payment status (view-only) for their own students
CREATE POLICY invoices_teacher_read ON invoices FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'teacher')
  AND EXISTS (
    SELECT 1 FROM class_enrollments ce
    JOIN classes c ON c.id = ce.class_id
    WHERE ce.student_id = invoices.student_id
      AND c.teacher_id = auth.uid()
  )
);
CREATE POLICY payments_teacher_read ON payments FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'teacher')
  AND EXISTS (
    SELECT 1 FROM invoices i
    JOIN class_enrollments ce ON ce.student_id = i.student_id
    JOIN classes c ON c.id = ce.class_id
    WHERE i.id = payments.invoice_id
      AND c.teacher_id = auth.uid()
  )
);
