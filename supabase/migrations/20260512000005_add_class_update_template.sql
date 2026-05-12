-- Add class_update SMS template to message_templates
-- Two default templates: one for rescheduled, one for cancelled.
-- The edge function picks the right default based on updateType if no DB row exists.
-- We store both variants as a single row with {{updateType}} in the body;
-- the edge function will substitute appropriately.

INSERT INTO message_templates (type, label, sms_body, variables)
VALUES (
  'class_update',
  'Class Update (Reschedule / Cancel)',
  $template$Future Minds Academy — Class Update

Hi {{studentName}},

Your class "{{className}}" originally scheduled for {{originalDate}} has been {{updateType}}.{{newScheduleSection}}{{reasonSection}}

If you have any questions about this change, please contact us and our team will assist you.$template$,
  '["studentName","className","originalDate","updateType","newScheduleSection","reasonSection"]'
)
ON CONFLICT (type) DO UPDATE
  SET sms_body   = EXCLUDED.sms_body,
      label      = EXCLUDED.label,
      variables  = EXCLUDED.variables,
      updated_at = now();
