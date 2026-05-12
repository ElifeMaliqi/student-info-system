-- Update all message templates with support footer lines (adapted per template type)
-- Uses ON CONFLICT DO UPDATE so existing rows are overwritten

INSERT INTO message_templates (type, label, sms_body, variables) VALUES

(
  'announcement',
  'Announcement',
  $template$Future Minds Academy

{{title}}

{{content}}

— {{senderName}}

If you have any questions, please contact us and our team will assist you.$template$,
  '["title","content","senderName"]'
),

(
  'attendance_alert',
  'Attendance Alert',
  $template$Future Minds Academy — Attendance Alert

Hi {{studentName}},

Your attendance in "{{className}}" is currently {{attendanceRate}}% ({{presentCount}} of {{totalCount}} sessions attended).

This is below the required minimum. Please contact us as soon as possible to discuss next steps.

Student Support Team

If you have any questions about this notice, please contact us and our team will assist you.$template$,
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

Teacher: {{teacherName}}

If you have any questions about this grade, please contact us and our team will assist you.$template$,
  '["studentName","examName","className","mode","resultLabel","totalPoints","noteSection","teacherName"]'
),

(
  'grade_changed',
  'Grade Changed',
  $template$Future Minds Academy — Grade Correction

Hi {{studentName}},

Your grade for "{{examName}}" in {{className}} has been revised.

Previous: {{oldPoints}}/100 ({{oldResult}})
New:      {{newPoints}}/100 ({{newResult}}){{noteSection}}

Teacher: {{teacherName}}

If you have any questions about this correction, please contact us and our team will assist you.$template$,
  '["studentName","examName","className","oldPoints","oldResult","newPoints","newResult","noteSection","teacherName"]'
),

(
  'invoice',
  'Invoice Notice',
  $template$Future Minds Academy — Invoice Notice

Hi {{studentName}},

A new invoice has been issued for your enrollment.

Class: {{className}}
Amount: €{{amount}}
Due: {{dueDate}}
Status: {{status}}

Log in to your portal to view and complete payment.

If you have any questions about this invoice or need support with payment, please contact us and our finance team will assist you.$template$,
  '["studentName","className","amount","dueDate","status"]'
),

(
  'invoice_changed',
  'Invoice Updated',
  $template$Future Minds Academy — Invoice Updated

Hi {{studentName}},

Your invoice for "{{className}}" has been updated.

Amount: €{{amount}}
Due:    {{dueDate}}
Status: {{status}}

Log in to your portal to view and complete payment.

If you have any questions about this invoice or need support with payment, please contact us and our finance team will assist you.$template$,
  '["studentName","className","amount","dueDate","status"]'
)

ON CONFLICT (type) DO UPDATE
  SET sms_body   = EXCLUDED.sms_body,
      label      = EXCLUDED.label,
      variables  = EXCLUDED.variables,
      updated_at = now();
