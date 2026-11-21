/**
 * The only SQL the browser can trigger through `/api/db` besides the structured
 * query builder. The client sends `{ queryName, params }`; the SQL text lives here
 * on the server, is fixed, and every value goes in as a bind parameter ($1, $2...).
 * There is no way to send SQL from the browser any more (no more raw `query`).
 *
 * Each entry says which roles may run it, and can validate its params before it
 * runs. Superadmin accounts are protected in the SQL itself where a query writes
 * to another user's login (password / delete), so an admin can't take one over.
 */

type Role = 'admin' | 'superadmin';

export interface NamedQuery {
  sql: string;
  roles: readonly Role[];
  /** Returns an error message to reject the params, or null to allow them. */
  validate?: (params: unknown[]) => string | null;
}

const ADMINS: readonly Role[] = ['admin', 'superadmin'];
const SUPERADMIN: readonly Role[] = ['superadmin'];

const isUuid = (v: unknown) => typeof v === 'string' && /^[0-9a-f-]{36}$/i.test(v);

export const NAMED_QUERIES: Record<string, NamedQuery> = {
  // ── Finance ────────────────────────────────────────────────────────────────
  'finance.insertManualInvoice': {
    roles: ADMINS,
    sql: `
      INSERT INTO invoices
        (enrollment_id, student_id, class_id, invoice_id, title, month, year, due_date, amount, discount_percent, status, is_manual)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'not_paid', true)`,
  },
  'finance.snapshotArchivedClass': {
    roles: ADMINS,
    sql: `
      INSERT INTO student_archived_classes (student_id, class_id, class_title, program_id)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (student_id, class_id) DO UPDATE SET
        class_title = EXCLUDED.class_title,
        program_id  = EXCLUDED.program_id`,
  },

  // ── Registrations ──────────────────────────────────────────────────────────
  'registrations.findProfileByEmail': {
    roles: ADMINS,
    sql: `SELECT id, role FROM profiles WHERE lower(email) = lower($1) LIMIT 1`,
  },
  'registrations.deleteApplication': {
    roles: ADMINS,
    sql: `DELETE FROM registration_applications WHERE id = $1`,
  },
  'registrations.enrolledStudentEmails': {
    roles: ADMINS,
    sql: `
      SELECT DISTINCT lower(p.email) AS email
      FROM class_enrollments ce
      JOIN profiles p ON p.id = ce.student_id
      WHERE p.email IS NOT NULL`,
  },
  // After approving an application: copy its password onto the login record.
  // $1 = new profile id, $2 = application id. The hash is read here and never sent
  // to the browser (already bcrypt, or plain → hashed here), and only onto the
  // profile created from that same application (matching email).
  'registrations.syncLoginPassword': {
    roles: ADMINS,
    validate: (p) => (isUuid(p[0]) && isUuid(p[1]) ? null : 'Invalid ids'),
    sql: `
      INSERT INTO auth_users (id, email, encrypted_password)
      SELECT p.id, lower(trim(a.email)),
             CASE WHEN a.password_hash ~ '^\\$2[aby]\\$' THEN a.password_hash ELSE crypt(a.password_hash, gen_salt('bf')) END
      FROM registration_applications a
      JOIN profiles p ON p.id = $1::uuid AND lower(p.email) = lower(trim(a.email)) AND p.role <> 'superadmin'
      WHERE a.id = $2::uuid AND a.password_hash IS NOT NULL
      ON CONFLICT (id) DO UPDATE SET
        encrypted_password = EXCLUDED.encrypted_password,
        updated_at = NOW()`,
  },
  // After a manual enrollment: set the temporary password on the new login.
  'registrations.setLoginPassword': {
    roles: ADMINS,
    sql: `
      INSERT INTO auth_users (id, email, encrypted_password)
      SELECT $1, lower(trim($2)), crypt($3, gen_salt('bf'))
      WHERE NOT EXISTS (SELECT 1 FROM profiles WHERE id = $1 AND role = 'superadmin')
      ON CONFLICT (id) DO UPDATE SET
        encrypted_password = EXCLUDED.encrypted_password,
        updated_at = NOW()`,
  },

  // ── Roles (Superadmin > Roles) ─────────────────────────────────────────────
  'roles.create': {
    roles: SUPERADMIN,
    sql: `
      INSERT INTO system_roles (name, description, is_system_role)
      VALUES ($1, $2, false)
      RETURNING id, name, description, is_system_role, created_at, updated_at`,
  },
  'roles.getAll': {
    roles: SUPERADMIN,
    sql: `
      SELECT r.id, r.name, r.description, r.is_system_role, r.created_at, r.updated_at,
             COALESCE(
               json_agg(
                 json_build_object(
                   'id', rp.id,
                   'role_id', rp.role_id,
                   'module', rp.module,
                   'actions', rp.actions,
                   'created_at', rp.created_at,
                   'updated_at', rp.updated_at
                 )
               ) FILTER (WHERE rp.id IS NOT NULL),
               '[]'::json
             ) as permissions
      FROM system_roles r
      LEFT JOIN role_permissions rp ON r.id = rp.role_id
      GROUP BY r.id
      ORDER BY r.is_system_role DESC, r.name`,
  },
  'roles.update': {
    roles: SUPERADMIN,
    sql: `
      UPDATE system_roles
      SET name = $1, description = $2, updated_at = now()
      WHERE id = $3 AND is_system_role = false
      RETURNING id, name, description, is_system_role, created_at, updated_at`,
  },
  'roles.delete': {
    roles: SUPERADMIN,
    sql: `
      DELETE FROM system_roles
      WHERE id = $1 AND is_system_role = false
      RETURNING id`,
  },
  'roles.clearPermissions': {
    roles: SUPERADMIN,
    sql: `DELETE FROM role_permissions WHERE role_id = $1`,
  },
  // $2 = JSON array of { module, actions[] }.
  'roles.insertPermissions': {
    roles: SUPERADMIN,
    sql: `
      INSERT INTO role_permissions (role_id, module, actions)
      SELECT $1, x.module, x.actions
      FROM jsonb_to_recordset($2::jsonb) AS x(module text, actions jsonb)
      RETURNING id, module, actions`,
  },

  // ── Users ──────────────────────────────────────────────────────────────────
  'users.create': {
    roles: ADMINS,
    // Nobody creates superadmin accounts from the app.
    validate: (p) => (['student', 'teacher', 'admin'].includes(String(p[3])) ? null : 'Invalid role'),
    sql: `
      WITH new_profile AS (
        INSERT INTO profiles (id, email, first_name, last_name, role, must_change_password)
        VALUES (gen_random_uuid(), lower(trim($1)), $2, $3, $4, true)
        RETURNING id, email, first_name, last_name, role, is_archived, must_change_password, created_at, updated_at
      ),
      new_auth AS (
        INSERT INTO auth_users (id, email, encrypted_password)
        SELECT id, email, crypt($5, gen_salt('bf')) FROM new_profile
        RETURNING id, encrypted_password
      ),
      -- No ON CONFLICT clauses: the live schema lacks some unique constraints,
      -- and ON CONFLICT (col) fails outright without one.
      student_row AS (
        INSERT INTO students (user_id, status)
        SELECT id, 'active' FROM new_profile WHERE role = 'student'
        RETURNING user_id
      ),
      reg_app AS (
        INSERT INTO registration_applications
          (email, first_name, last_name, password_hash, role, status, reviewed_at)
        SELECT np.email, $2, $3, na.encrypted_password, np.role, 'approved', NOW()
        FROM new_profile np
        JOIN new_auth na ON na.id = np.id
        WHERE np.role IN ('student', 'teacher')
          AND NOT EXISTS (SELECT 1 FROM registration_applications r WHERE r.email = np.email)
      )
      SELECT * FROM new_profile`,
  },
  // $1 = role or null (all), $2 = archived flag or null (both).
  'users.getAll': {
    roles: SUPERADMIN,
    sql: `
      SELECT p.id, p.email, p.first_name, p.last_name, p.role, p.system_role_id, p.is_archived,
             p.must_change_password, p.created_at, p.updated_at, sr.name as role_name
      FROM profiles p
      LEFT JOIN system_roles sr ON p.system_role_id = sr.id
      WHERE ($1::text IS NULL OR p.role = $1::text)
        AND ($2::boolean IS NULL OR p.is_archived = $2::boolean)
      ORDER BY p.created_at DESC`,
  },
  'users.teacherOverview': {
    roles: ADMINS,
    sql: `
      WITH cls AS (
        SELECT teacher_id, COUNT(*)::int AS class_count
        FROM classes
        GROUP BY teacher_id
      ),
      stu AS (
        SELECT c.teacher_id, COUNT(DISTINCT e.student_id)::int AS student_count
        FROM classes c
        JOIN class_enrollments e ON e.class_id = c.id
        WHERE e.status = 'active'
        GROUP BY c.teacher_id
      ),
      hrs AS (
        SELECT c.teacher_id,
               SUM(EXTRACT(EPOCH FROM (s.end_time - s.start_time)) / 3600.0)::float AS weekly_hours
        FROM classes c
        JOIN class_sessions s ON s.class_id = c.id
        GROUP BY c.teacher_id
      ),
      per_class AS (
        SELECT c.id, c.teacher_id, c.title,
               COUNT(a.class_id)::int AS marks,
               COUNT(a.class_id) FILTER (WHERE a.status IN ('present', 'late'))::int AS attended
        FROM classes c
        LEFT JOIN class_attendance a ON a.class_id = c.id
        GROUP BY c.id, c.teacher_id, c.title
      ),
      att AS (
        SELECT teacher_id,
               SUM(marks)::int    AS marks,
               SUM(attended)::int AS attended,
               json_agg(json_build_object('id', id, 'title', title, 'marks', marks, 'attended', attended)
                        ORDER BY title) AS classes
        FROM per_class
        GROUP BY teacher_id
      )
      SELECT p.id, p.first_name, p.last_name, p.email, p.phone, p.avatar_url,
             COALESCE(cls.class_count, 0)   AS class_count,
             COALESCE(stu.student_count, 0) AS student_count,
             COALESCE(hrs.weekly_hours, 0)  AS weekly_hours,
             COALESCE(att.marks, 0)         AS marks,
             COALESCE(att.attended, 0)      AS attended,
             COALESCE(att.classes, '[]'::json) AS classes
      FROM profiles p
      LEFT JOIN cls ON cls.teacher_id = p.id
      LEFT JOIN stu ON stu.teacher_id = p.id
      LEFT JOIN hrs ON hrs.teacher_id = p.id
      LEFT JOIN att ON att.teacher_id = p.id
      WHERE p.role = 'teacher' AND COALESCE(p.is_archived, false) = false
      ORDER BY p.first_name, p.last_name`,
  },
  'users.teacherProfile': {
    roles: ADMINS,
    sql: `
      SELECT p.id, p.first_name, p.last_name, p.email, p.phone, p.avatar_url, p.created_at
      FROM profiles p
      WHERE p.id = $1 AND p.role = 'teacher'`,
  },
  'users.classesWithTeacher': {
    roles: ADMINS,
    sql: `
      SELECT c.id, c.title, c.teacher_id, p.first_name, p.last_name
      FROM classes c
      JOIN profiles p ON p.id = c.teacher_id
      ORDER BY c.title`,
  },
  'users.emailTakenByOther': {
    roles: ADMINS,
    sql: `
      SELECT 1 FROM profiles WHERE lower(email) = $1 AND id <> $2
      UNION ALL
      SELECT 1 FROM auth_users WHERE lower(email) = $1 AND id <> $2
      LIMIT 1`,
  },
  // Only ever touches a teacher account (every part is gated on role = 'teacher').
  'users.updateTeacher': {
    roles: ADMINS,
    sql: `
      WITH old AS (
        SELECT email FROM profiles WHERE id = $1 AND role = 'teacher'
      ),
      au AS (
        UPDATE auth_users SET email = $4 WHERE id = $1 AND EXISTS (SELECT 1 FROM old)
      ),
      ra AS (
        UPDATE registration_applications SET email = $4 WHERE email = (SELECT email FROM old)
      )
      UPDATE profiles
      SET first_name = $2, last_name = $3, email = $4, phone = $5, updated_at = now()
      WHERE id = $1 AND role = 'teacher'
      RETURNING id`,
  },
  'users.assignClassesToTeacher': {
    roles: ADMINS,
    validate: (p) => (isUuid(p[0]) && Array.isArray(p[1]) && p[1].every(isUuid) ? null : 'Invalid ids'),
    sql: `
      UPDATE classes SET teacher_id = $1, updated_at = now()
      WHERE id = ANY($2::uuid[])
        AND EXISTS (SELECT 1 FROM profiles WHERE id = $1 AND role = 'teacher')`,
  },
};
