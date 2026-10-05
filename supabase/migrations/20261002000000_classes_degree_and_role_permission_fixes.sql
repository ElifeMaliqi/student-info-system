/*
  # Classes under any degree + role permission display

  1. classes.valid_program hardcoded the 8 original degree names, so a class could
     never be created under a degree added from the Degrees page.
  2. "deactivate" in role_permissions.actions means "module switched off" across the
     app, but the seed gave Superadmin's Users module it alongside real actions, so
     the module showed as Deactivated. Drop it wherever other actions are present.
*/

ALTER TABLE classes DROP CONSTRAINT IF EXISTS valid_program;

UPDATE role_permissions
SET actions = actions - 'deactivate'
WHERE actions ? 'deactivate' AND jsonb_array_length(actions) > 1;
