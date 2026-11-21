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
import { embeddedTablesOf, type EmbedPolicy } from './query-executor';

export interface AuthzUser {
  id: string;
  role: string;
}

export const PRIVILEGED_ROLES = new Set(['admin', 'superadmin']);

// Columns on `profiles` only admins/superadmins may write. Blocks privilege
// escalation (e.g. a student setting their own role to 'admin') and self-unarchive.
const PROFILE_PRIVILEGED_COLUMNS = ['role', 'system_role_id', 'is_archived', 'archived_at'];

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
  'email_templates', // admin-editable email content (incl. password reset)
]);

// Never reachable through the generic data API, for anyone: login records
// (password hashes) and reset tokens are only handled by server routes and
// fixed named queries.
const NO_GENERIC_ACCESS_TABLES = new Set(['auth_users', 'password_reset_tokens']);

// Role definitions: superadmin only (Superadmin > Roles).
const SUPERADMIN_ONLY_TABLES = new Set(['system_roles', 'role_permissions']);

// The only tables a `select` may embed (e.g. `teacher:profiles!fk(...)`). Embedded
// rows used to skip every rule above, so `auth_users!profiles_id_fkey(encrypted_password)`
// returned password hashes. These are the tables the app actually embeds.
const EMBED_ALLOWED_TABLES = new Set([
  'profiles',
  'classes',
  'class_sessions',
  'class_enrollments',
  'grade_tables',
  'grade_table_entries',
  'programs',
  'students',
  'calendar_event_participants',
]);

// Other people's profiles embedded in a student's query keep only these columns
// (names on classes, calendar events, announcements). Their own profile is whole.
const STUDENT_VISIBLE_PROFILE_COLUMNS = ['id', 'first_name', 'last_name', 'email', 'avatar_url', 'role'] as const;

// Tables a teacher may write to (grading, attendance, notes on students, calendar,
// announcements, their own profile). Everything else is admin work.
const TEACHER_WRITE_TABLES = new Set([
  'grade_tables',
  'grade_table_entries',
  'teacher_student_notes',
  'calendar_events',
  'calendar_event_participants',
  'class_attendance',
  'announcements',
  'profiles', // own row only (see below)
]);

// Tables a teacher has no reason to read: applicants' personal details and ID
// documents, and per-student pricing.
const TEACHER_READ_DENY = new Set([
  'registration_applications',
  'student_invoice_overrides',
]);

const bodyRows = (req: DbQueryRequest): Record<string, unknown>[] =>
  !req.body ? [] : (Array.isArray(req.body) ? req.body : [req.body]).filter((r): r is Record<string, unknown> => !!r && typeof r === 'object');

export interface AuthzDecision {
  allowed: boolean;
  status?: number;
  message?: string;
  /** Limits on embedded rows, passed to executeQuery. */
  embedPolicy?: EmbedPolicy;
  /**
   * Limit the rows to calendar events the user created or was invited to, by
   * this column (`id` on calendar_events, `event_id` on participants). The
   * caller looks the event ids up and adds the filter.
   */
  eventScope?: 'id' | 'event_id';
  /**
   * Event ids an insert into calendar_event_participants adds people to. The
   * caller checks the user created every one of them (otherwise anyone could
   * add themselves to a private event and then read it).
   */
  ownEventIds?: unknown[];
}

function participantInsertCheck(table: string, action: string, req: DbQueryRequest): unknown[] | undefined {
  if (table !== 'calendar_event_participants' || (action !== 'insert' && action !== 'upsert')) return undefined;
  return bodyRows(req).map((r) => r.event_id);
}

// Calendar events are private to their creator and participants (the rule the
// original database policies described; those policies are not enforced).
function calendarEventScope(table: string, action: string): AuthzDecision['eventScope'] {
  if (action !== 'select') return undefined;
  if (table === 'calendar_events') return 'id';
  if (table === 'calendar_event_participants') return 'event_id';
  return undefined;
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

  // Embedded tables: only the known ones, for every role.
  let embedded: string[];
  try {
    embedded = action === 'select' ? embeddedTablesOf(req.select, table) : [];
  } catch {
    return DENY;
  }
  if (embedded.some((t) => !EMBED_ALLOWED_TABLES.has(t))) return DENY;

  // Admin notes carry per-author private visibility, enforced only in /api/notes.
  if (table === 'admin_notes') return DENY;
  // The activity log is written and read only through /api/logs (superadmin read).
  if (table === 'activity_logs') return DENY;
  if (NO_GENERIC_ACCESS_TABLES.has(table)) return DENY;
  if (SUPERADMIN_ONLY_TABLES.has(table) && role !== 'superadmin') return DENY;

  // Nobody can make an account a superadmin from the app (also enforced by DB
  // triggers), and only superadmins may change roles at all.
  if (table === 'profiles' && isWrite(action)) {
    const rows = bodyRows(req);
    if (rows.some((r) => r.role === 'superadmin')) return DENY;
    if (role !== 'superadmin' && rows.some((r) => 'role' in r || 'system_role_id' in r)) return DENY;
  }
  // ID document links are opened by admins, so only documents this app stored.
  if ((table === 'registration_applications' || table === 'profiles') && isWrite(action)) {
    if (bodyRows(req).some((r) => r.id_document_url != null && r.id_document_url !== '' && !isStoredIdDocumentUrl(r.id_document_url))) return DENY;
  }
  // Approving a registration creates an account with its role.
  if (table === 'registration_applications' && isWrite(action)) {
    if (bodyRows(req).some((r) => 'role' in r && r.role !== 'student' && r.role !== 'teacher')) return DENY;
  }

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

  // An RSVP update can't move the row to another event or person.
  if (table === 'calendar_event_participants' && action === 'update') {
    if (bodyKeys(req).some((k) => k === 'event_id' || k === 'user_id')) return DENY;
  }

  if (role === 'teacher') {
    if (isWrite(action)) {
      if (!TEACHER_WRITE_TABLES.has(table)) return DENY;
      if (table === 'profiles') {
        // Inserting a profile is account creation (admin work); edits are own-row only.
        if (action !== 'update') return DENY;
        injectEqFilter(req, 'id', user.id);
      } else if (table === 'calendar_events' && (action === 'update' || action === 'delete')) {
        injectEqFilter(req, 'created_by', user.id);
      } else if (table === 'calendar_event_participants' && action === 'update') {
        // Their own RSVP only.
        injectEqFilter(req, 'user_id', user.id);
      } else if (table === 'announcements') {
        // Post in their own name; editing or removing announcements is admin work.
        if (action !== 'insert') return DENY;
        if (bodyRows(req).some((r) => r.author_id !== user.id)) return DENY;
      } else if (table === 'teacher_student_notes') {
        // Their own notes only.
        if (bodyRows(req).some((r) => 'teacher_id' in r && r.teacher_id !== user.id)) return DENY;
        if (action === 'update' || action === 'delete') injectEqFilter(req, 'teacher_id', user.id);
      }
      return { allowed: true, ownEventIds: participantInsertCheck(table, action, req) };
    }
    if (TEACHER_READ_DENY.has(table)) return DENY;
    return { allowed: true, eventScope: calendarEventScope(table, action) };
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
      return { allowed: true, ownEventIds: participantInsertCheck(table, action, req) };
    }

    // SELECT
    if (STUDENT_READ_DENY.has(table)) return DENY;
    if (embedded.some((t) => STUDENT_READ_DENY.has(t))) return DENY;
    const ownColumn = STUDENT_OWNED_TABLES[table];
    if (ownColumn) injectEqFilter(req, ownColumn, user.id);
    // Embedded rows follow the same ownership rules as top-level ones.
    const scope: NonNullable<EmbedPolicy['scope']> = {};
    for (const [t, column] of Object.entries(STUDENT_OWNED_TABLES)) {
      if (t !== 'profiles') scope[t] = { column, value: user.id };
    }
    return {
      allowed: true,
      embedPolicy: { scope, profileColumns: { selfId: user.id, allowed: STUDENT_VISIBLE_PROFILE_COLUMNS } },
      eventScope: calendarEventScope(table, action),
    };
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
    // Only a document this app stored. Admins open this URL, so anything else
    // (e.g. a javascript: link) would run in an admin's session.
    if (clean.id_document_url != null && !isStoredIdDocumentUrl(clean.id_document_url)) {
      clean.id_document_url = null;
    }
    return clean;
  });
}

/** An ID document URL as returned by POST /api/upload/id-document. */
export function isStoredIdDocumentUrl(url: unknown): boolean {
  return typeof url === 'string' && /^\/api\/upload\/id-document\?file=[0-9a-f-]{36}\.(jpg|png|pdf)$/.test(url);
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
