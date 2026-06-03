-- Create system roles table
CREATE TABLE IF NOT EXISTS system_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  description text,
  is_system_role boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create role permissions table (module-level permissions)
CREATE TABLE IF NOT EXISTS role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id uuid NOT NULL REFERENCES system_roles(id) ON DELETE CASCADE,
  module text NOT NULL,
  actions jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(role_id, module)
);

-- Add system_role_id to profiles (optional for backward compatibility)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS system_role_id uuid REFERENCES system_roles(id) ON DELETE SET NULL;

-- Create default system roles
INSERT INTO system_roles (name, description, is_system_role) VALUES
  ('superadmin', 'Super Administrator - Full system access', true),
  ('admin', 'Administrator - Administrative access', true),
  ('teacher', 'Teacher - Teaching and class management', true),
  ('student', 'Student - Student access', true)
ON CONFLICT (name) DO NOTHING;

-- Define permissions for each module
-- SuperAdmin: Full access to everything
INSERT INTO role_permissions (role_id, module, actions)
SELECT id, module, actions FROM (
  SELECT 
    (SELECT id FROM system_roles WHERE name = 'superadmin') as id,
    'roles' as module,
    '["create", "read", "update", "delete"]'::jsonb as actions
  UNION ALL
  SELECT 
    (SELECT id FROM system_roles WHERE name = 'superadmin'),
    'users',
    '["create", "read", "update", "delete", "deactivate"]'::jsonb
  UNION ALL
  SELECT 
    (SELECT id FROM system_roles WHERE name = 'superadmin'),
    'programs',
    '["create", "read", "update", "delete"]'::jsonb
  UNION ALL
  SELECT 
    (SELECT id FROM system_roles WHERE name = 'superadmin'),
    'classes',
    '["create", "read", "update", "delete"]'::jsonb
  UNION ALL
  SELECT 
    (SELECT id FROM system_roles WHERE name = 'superadmin'),
    'announcements',
    '["create", "read", "update", "delete"]'::jsonb
  UNION ALL
  SELECT 
    (SELECT id FROM system_roles WHERE name = 'superadmin'),
    'analytics',
    '["read"]'::jsonb
  UNION ALL
  SELECT 
    (SELECT id FROM system_roles WHERE name = 'superadmin'),
    'settings',
    '["read", "update"]'::jsonb
) AS default_permissions
ON CONFLICT (role_id, module) DO NOTHING;

-- Admin: Administrative access (no roles management)
INSERT INTO role_permissions (role_id, module, actions)
SELECT id, module, actions FROM (
  SELECT 
    (SELECT id FROM system_roles WHERE name = 'admin') as id,
    'users' as module,
    '["create", "read", "update", "delete"]'::jsonb as actions
  UNION ALL
  SELECT 
    (SELECT id FROM system_roles WHERE name = 'admin'),
    'programs',
    '["read", "update"]'::jsonb
  UNION ALL
  SELECT 
    (SELECT id FROM system_roles WHERE name = 'admin'),
    'classes',
    '["create", "read", "update"]'::jsonb
  UNION ALL
  SELECT 
    (SELECT id FROM system_roles WHERE name = 'admin'),
    'announcements',
    '["create", "read", "update"]'::jsonb
) AS admin_permissions
ON CONFLICT (role_id, module) DO NOTHING;

-- Teacher: Teaching-focused access
INSERT INTO role_permissions (role_id, module, actions)
SELECT id, module, actions FROM (
  SELECT 
    (SELECT id FROM system_roles WHERE name = 'teacher') as id,
    'classes' as module,
    '["read"]'::jsonb as actions
  UNION ALL
  SELECT 
    (SELECT id FROM system_roles WHERE name = 'teacher'),
    'announcements',
    '["create", "read"]'::jsonb
  UNION ALL
  SELECT 
    (SELECT id FROM system_roles WHERE name = 'teacher'),
    'grades',
    '["create", "read", "update"]'::jsonb
) AS teacher_permissions
ON CONFLICT (role_id, module) DO NOTHING;

-- Student: Read-only access
INSERT INTO role_permissions (role_id, module, actions)
SELECT id, module, actions FROM (
  SELECT 
    (SELECT id FROM system_roles WHERE name = 'student') as id,
    'announcements' as module,
    '["read"]'::jsonb as actions
  UNION ALL
  SELECT 
    (SELECT id FROM system_roles WHERE name = 'student'),
    'grades',
    '["read"]'::jsonb
) AS student_permissions
ON CONFLICT (role_id, module) DO NOTHING;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id ON role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_module ON role_permissions(module);
CREATE INDEX IF NOT EXISTS idx_profiles_system_role_id ON profiles(system_role_id);

-- Add comment for documentation
COMMENT ON TABLE system_roles IS 'Centralized role definitions with flexible module-based permissions';
COMMENT ON TABLE role_permissions IS 'Maps roles to modules and their allowed actions (CRUD operations)';
COMMENT ON COLUMN role_permissions.actions IS 'JSON array of allowed actions: create, read, update, delete, deactivate, etc.';
