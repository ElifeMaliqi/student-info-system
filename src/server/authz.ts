/**
 * Server-side authorization for the generic data API (`/api/db`).
 *
 * Background: the browser builds queries (table + filters + body) and posts them
 * to `/api/db`, which historically only checked that the caller was authenticated.
 * Row scoping lived entirely in the React client, so a crafted request could read
 * or modify any row in any table. This module re-derives access rules on the
 * server, keyed off the caller's *database* role (from `verifyToken`, not the JWT
 * claim), and enforces them before the query runs.
 *
 * Design principle: the rules mirror how the legitimate client already queries
 * (students always filter their own id, etc.), so enforcement is invisible to
 * real usage while blocking the abusive variants. We therefore *inject* ownership
 * filters rather than reject requests that merely omit them.
 */

import type { DbQueryRequest } from '../types/db-query';

export interface AuthzUser {
  id: string;
  role: string;
}

export const PRIVILEGED_ROLES = new Set(['admin', 'superadmin']);

// Columns on `profiles` only admins/superadmins may write. Blocks privilege
// escalation (e.g. a student setting their own role to 'admin') and self-unarchive.
const PROFILE_PRIVILEGED_COLUMNS = ['role', 'system_role_id', 'is_archived'];

// Tables a student may write to at all. Everything else is denied for students.
const STUDENT_WRITE_TABLES = new Set([
  'profiles', // own row only (see ownership injection below)
  'calendar_events', // own personal events
  'calendar_event_participants', // own RSVP / event membership
]);

// For students, force an ownership filter on these tables so they can only see
// their own rows. The column is the student's own profile id. These match the
// filters the app already sends, so legitimate queries are unaffected.
const STUDENT_OWNED_TABLES: Record<string, string> = {
  invoices: 'student_id',
  grade_table_entries: 'student_id',
  class_attendance: 'student_id',
  class_enrollments: 'student_id',
  students: 'user_id',
  profiles: 'id',
};

// Tables a student must never read directly (other users' PII, financial config,
// or security material). Their legitimate views never query these at top level.
const STUDENT_READ_DENY = new Set([
  'auth_users',
  'system_roles',
  'role_permissions',
  'password_reset_tokens',
  'registration_applications',
  'student_invoice_overrides',
  'teacher_student_notes',
  'grades', // legacy table, keyed by students.id; current UI uses grade_table_entries
  'attendance', // legacy table; current UI uses class_attendance
]);

// Tables only admins/superadmins may touch under any action.
const PRIVILEGED_ONLY_TABLES = new Set([
  'auth_users',
  'system_roles',
  'role_permissions',
  'password_reset_tokens',
]);

export interface AuthzDecision {
  allowed: boolean;
  status?: number;
  message?: string;
}

const DENY: AuthzDecision = { allowed: false, status: 403, message: 'Forbidden' };

function isWrite(action: string | undefined): boolean {
  return action === 'insert' || action === 'update' || action === 'upsert' || action === 'delete';
}

function bodyKeys(req: DbQueryRequest): string[] {
  const b = req.body;
  if (!b) return [];
  const rows = Array.isArray(b) ? b : [b];
  const keys = new Set<string>();
  for (const row of rows) {
    if (row && typeof row === 'object') {
      for (const k of Object.keys(row)) keys.add(k);
    }
  }
  return [...keys];
}

function injectEqFilter(req: DbQueryRequest, column: string, value: unknown): void {
  req.filters = req.filters || [];
  const already = req.filters.some(
    (f) => f.column === column && f.op === 'eq' && f.value === value
  );
  if (!already) req.filters.push({ op: 'eq', column, value });
}

/**
 * Authorize (and, where needed, scope) a structured `/api/db` request for an
 * authenticated user. May mutate `req.filters` to inject ownership constraints.
 */
export function authorizeDbRequest(user: AuthzUser, req: DbQueryRequest): AuthzDecision {
  const role = user.role;
  const table = req.table;
  const action = req.action || 'select';

  if (!table || typeof table !== 'string') return DENY;

  // Admin-only tables are off-limits to everyone else, for any action.
  if (PRIVILEGED_ONLY_TABLES.has(table) && !PRIVILEGED_ROLES.has(role)) {
    return DENY;
  }

  // Escalation guard: non-privileged roles may never write the sensitive
  // profile columns, regardless of which row they target.
  if (table === 'profiles' && isWrite(action) && !PRIVILEGED_ROLES.has(role)) {
    if (bodyKeys(req).some((k) => PROFILE_PRIVILEGED_COLUMNS.includes(k))) {
      return DENY;
    }
  }

  if (PRIVILEGED_ROLES.has(role)) {
    return { allowed: true };
  }

  if (role === 'teacher') {
    // Teachers legitimately manage academic data across their classes. Only the
    // escalation columns and admin-only tables (handled above) are restricted.
    return { allowed: true };
  }

  if (role === 'student') {
    if (isWrite(action)) {
      if (!STUDENT_WRITE_TABLES.has(table)) return DENY;
      // Scope mutations to the student's own rows.
      if (table === 'profiles') {
        injectEqFilter(req, 'id', user.id);
      } else if (table === 'calendar_events' && (action === 'update' || action === 'delete')) {
        injectEqFilter(req, 'created_by', user.id);
      } else if (table === 'calendar_event_participants' && (action === 'update' || action === 'delete')) {
        injectEqFilter(req, 'user_id', user.id);
      }
      return { allowed: true };
    }

    // SELECT
    if (STUDENT_READ_DENY.has(table)) return DENY;
    const ownColumn = STUDENT_OWNED_TABLES[table];
    if (ownColumn) injectEqFilter(req, ownColumn, user.id);
    return { allowed: true };
  }

  // Unknown / unexpected role: deny by default.
  return DENY;
}

/**
 * Sanitize a public (unauthenticated) insert into `registration_applications`
 * so an attacker can't seed a privileged account or pre-set review state.
 * Returns a cleaned body; the caller substitutes it before executing.
 */
export function sanitizePublicRegistration(
  body: Record<string, unknown> | Record<string, unknown>[] | undefined
): Record<string, unknown>[] {
  const rows = Array.isArray(body) ? body : body ? [body] : [];
  const FORBIDDEN = new Set(['id', 'reviewed_by', 'reviewed_at', 'is_archived']);
  return rows.map((row) => {
    const clean: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(row || {})) {
      if (FORBIDDEN.has(k)) continue;
      clean[k] = v;
    }
    // Public applicants are always students with a pending application.
    clean.role = 'student';
    clean.status = 'pending';
    return clean;
  });
}

// Columns the unauthenticated email-existence lookup may return, per table.
// Prevents dumping full profile PII (phone, address, parent name, …) anonymously.
const PUBLIC_LOOKUP_COLUMNS: Record<string, string> = {
  profiles: 'id, email',
  registration_applications: 'id, email, status',
};

export function publicLookupColumns(table: string): string | null {
  return PUBLIC_LOOKUP_COLUMNS[table] ?? null;
}
