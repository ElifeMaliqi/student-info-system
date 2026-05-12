-- ─────────────────────────────────────────────────────────────────────────────
-- message_templates — stores admin-editable SMS body templates
-- Each row = one notification type.  Edge functions fetch the template, then
-- substitute {{variable}} placeholders before sending via Twilio.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS message_templates (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  type        text        UNIQUE NOT NULL,
  label       text        NOT NULL,
  sms_body    text        NOT NULL,
  variables   jsonb       NOT NULL DEFAULT '[]',
  updated_at  timestamptz DEFAULT now()
);

ALTER TABLE message_templates ENABLE ROW LEVEL SECURITY;

-- Admins can read + write
CREATE POLICY "admins_manage_templates"
  ON message_templates FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Anyone (including service-role edge functions) can read
CREATE POLICY "public_read_templates"
  ON message_templates FOR SELECT
  USING (true);

-- ─── Default professional templates ──────────────────────────────────────────

INSERT INTO message_templates (type, label, sms_body, variables) VALUES

(
  'announcement',
  'Announcement',
  $template$Future Minds Academy

{{title}}

{{content}}

— {{senderName}}$template$,
  '["title","content","senderName"]'
),

(
  'attendance_alert',
  'Attendance Alert',
  $template$Future Minds Academy — Attendance Alert

Hi {{studentName}},

Your attendance in "{{className}}" is currently {{attendanceRate}}% ({{presentCount}} of {{totalCount}} sessions attended).

This is below the required minimum. Please contact us as soon as possible to discuss next steps.

Student Support Team$template$,
  '["studentName","className","attendanceRate","presentCount","totalCount"]'
),

(
  'grade',
  'Grade Notification',
  $template$Future Minds Academy — Grade {{mode}}

Hi {{studentName}},

Exam: {{examName}}
Class: {{className}}
Result: {{resultLabel}} | {{totalPoints}}/100{{noteSection}}

Teacher: {{teacherName}}$template$,
  '["studentName","examName","className","mode","resultLabel","totalPoints","noteSection","teacherName"]'
),

(
  'invoice',
  'Invoice Notice',
  $template$Future Minds Academy — Invoice Notice

Hi {{studentName}},

A new invoice has been issued for your enrollment.

Class: {{className}}
Amount: ${{amount}}
Due: {{dueDate}}
Status: {{status}}

Log in to your portal to view and complete payment.$template$,
  '["studentName","className","amount","dueDate","status"]'
)

ON CONFLICT (type) DO NOTHING;

-- ─── Keep updated_at current on every UPDATE ─────────────────────────────────

CREATE OR REPLACE FUNCTION update_message_templates_timestamp()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER message_templates_updated_at
  BEFORE UPDATE ON message_templates
  FOR EACH ROW EXECUTE FUNCTION update_message_templates_timestamp();
