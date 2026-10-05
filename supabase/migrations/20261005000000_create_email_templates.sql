-- ─────────────────────────────────────────────────────────────────────────────
-- email_templates — stores admin-editable email subject + body templates
-- Each row = one email type. The notify API fetches the template, substitutes
-- {{variable}} placeholders and wraps the body in the branded email layout.
-- A placeholder alone on its own line that names a block (e.g. {{resetButton}},
-- {{gradeDetails}}) is replaced by a pre-styled HTML block.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS email_templates (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  type        text        UNIQUE NOT NULL,
  label       text        NOT NULL,
  subject     text        NOT NULL,
  body        text        NOT NULL,
  variables   jsonb       NOT NULL DEFAULT '[]',
  updated_at  timestamptz DEFAULT now()
);

ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins_manage_email_templates" ON email_templates;
CREATE POLICY "admins_manage_email_templates"
  ON email_templates FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'superadmin')
    )
  );

DROP POLICY IF EXISTS "public_read_email_templates" ON email_templates;
CREATE POLICY "public_read_email_templates"
  ON email_templates FOR SELECT
  USING (true);

-- ─── Default templates (match the defaults in src/app/api/notify/[name]/route.ts) ─

INSERT INTO email_templates (type, label, subject, body, variables) VALUES

(
  'password_reset',
  'Password Reset',
  'Reset Your Password — Future Minds Academy',
  $template$Hello {{firstName}},

We received a request to reset the password for your Future Minds Academy account. Click the secure button below to proceed.

{{resetButton}}

If you did not request this, you can safely ignore this email. Your password will not change.$template$,
  '["firstName","resetButton"]'
),

(
  'announcement',
  'Announcement',
  '{{title}} — {{senderName}}',
  $template${{content}}$template$,
  '["title","content","senderName"]'
),

(
  'attendance_alert',
  'Attendance Alert',
  'Attendance Alert from Future Minds Academy: {{studentName}}',
  $template$Hello {{studentName}},

Your attendance rate in {{className}} is currently **{{attendanceRate}}%**, which is at or below the 40% threshold.

Present: **{{presentCount}}** / **{{totalCount}}** sessions.

Please contact your instructor or the administration team as soon as possible.

Warm regards,
Future Minds Academy · Student Support Team$template$,
  '["studentName","className","attendanceRate","presentCount","totalCount"]'
),

(
  'invoice_new',
  'New Invoice',
  'New Invoice from Future Minds Academy: {{invoiceTitle}}',
  $template$Hello {{studentName}},

A new invoice "{{invoiceTitle}}" has been issued for you.

Invoice ID: **{{invoiceId}}** · Class: {{className}} · Amount: **${{amount}}** · Due: **{{dueDate}}** · Status: **{{status}}**

Warm regards,
Future Minds Academy · Finance Department$template$,
  '["studentName","className","invoiceTitle","invoiceId","amount","dueDate","status"]'
),

(
  'invoice_updated',
  'Invoice Updated',
  'Updated Invoice from Future Minds Academy: {{invoiceTitle}}',
  $template$Hello {{studentName}},

Your invoice "{{invoiceTitle}}" has been updated. Change: **{{changeSummary}}**.

Invoice ID: **{{invoiceId}}** · Class: {{className}} · Amount: **${{amount}}** · Due: **{{dueDate}}** · Status: **{{status}}**

Warm regards,
Future Minds Academy · Finance Department$template$,
  '["studentName","className","invoiceTitle","invoiceId","amount","dueDate","status","changeSummary"]'
),

(
  'invoice_receipt',
  'Payment Receipt',
  'Payment Receipt from Future Minds Academy: {{invoiceTitle}}',
  $template$Hello {{studentName}},

We have received your payment for invoice "{{invoiceTitle}}". Thank you.

{{receiptDetails}}

Please keep this email as your proof of payment.

Warm regards,
Future Minds Academy · Finance Department$template$,
  '["studentName","className","invoiceTitle","invoiceId","amount","paidOn","receiptDetails"]'
),

(
  'grade_new',
  'Grade Posted',
  'Your Grade is Ready – {{examName}} | Future Minds Academy',
  $template$Hello **{{studentName}}**,

Your exam **{{examName}}** has been graded.

{{gradeDetails}}

{{teacherNote}}

Warm regards,
**Future Minds Academy**$template$,
  '["studentName","examName","className","teacherName","totalPoints","result","gradeDetails","teacherNote"]'
),

(
  'grade_updated',
  'Grade Updated',
  'Grade Updated – {{examName}} | Future Minds Academy',
  $template$Hello **{{studentName}}**,

Your grade for **{{examName}}** has been **updated**.

{{gradeDetails}}

{{teacherNote}}

Warm regards,
**Future Minds Academy**$template$,
  '["studentName","examName","className","teacherName","totalPoints","result","gradeDetails","teacherNote"]'
),

(
  'class_cancelled',
  'Class Cancelled',
  'Class Cancelled: {{className}} | Future Minds Academy',
  $template$Hello {{studentName}},

Your class **{{className}}** scheduled for **{{originalDate}}** has been **cancelled**.

{{reasonBox}}

If you have any questions, please contact us.

Warm regards,
Future Minds Academy$template$,
  '["studentName","className","originalDate","reason","reasonBox"]'
),

(
  'class_rescheduled',
  'Class Rescheduled',
  'Class Rescheduled: {{className}} | Future Minds Academy',
  $template$Hello {{studentName}},

Your class **{{className}}** scheduled for **{{originalDate}}** has been **rescheduled**.

{{newSchedule}}

{{reasonBox}}

If you have any questions, please contact us.

Warm regards,
Future Minds Academy$template$,
  '["studentName","className","originalDate","newDate","newTime","reason","newSchedule","reasonBox"]'
)

ON CONFLICT (type) DO NOTHING;

-- ─── Keep updated_at current on every UPDATE ─────────────────────────────────

CREATE OR REPLACE FUNCTION update_email_templates_timestamp()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS email_templates_updated_at ON email_templates;
CREATE TRIGGER email_templates_updated_at
  BEFORE UPDATE ON email_templates
  FOR EACH ROW EXECUTE FUNCTION update_email_templates_timestamp();
