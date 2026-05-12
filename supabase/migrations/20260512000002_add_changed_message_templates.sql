-- Add grade_changed and invoice_changed SMS templates

INSERT INTO message_templates (type, label, sms_body, variables) VALUES

(
  'grade_changed',
  'Grade Changed',
  $template$Future Minds Academy — Grade Correction

Hi {{studentName}},

Your grade for "{{examName}}" in {{className}} has been revised.

Previous: {{oldPoints}}/100 ({{oldResult}})
New:      {{newPoints}}/100 ({{newResult}}){{noteSection}}

Teacher: {{teacherName}}$template$,
  '["studentName","examName","className","oldPoints","oldResult","newPoints","newResult","noteSection","teacherName"]'
),

(
  'invoice_changed',
  'Invoice Updated',
  $template$Future Minds Academy — Invoice Updated

Hi {{studentName}},

Your invoice for "{{className}}" has been updated.

Amount: ${{amount}}
Due:    {{dueDate}}
Status: {{status}}

Log in to your portal to review the changes.$template$,
  '["studentName","className","amount","dueDate","status"]'
)

ON CONFLICT (type) DO NOTHING;
