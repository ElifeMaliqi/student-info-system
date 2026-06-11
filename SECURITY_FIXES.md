# Security Hardening — Implementation Notes

Date: 2026-06-11

Goal: close the critical authentication/authorization holes **without changing any
user-facing functionality**. Every rule added here mirrors how the legitimate
client already queries, so normal student/teacher/admin/superadmin flows behave
exactly as before; only abusive requests are now rejected.

---

## Root cause

The browser builds queries and posts them to `/api/db`, which previously only
checked *authentication*. Row scoping lived entirely in the React client, the
Postgres RLS policies are disabled by the migration runner
(`scripts/migrate-rds.mjs` → `disableRls()`), and the app connects as the DB
owner (`postgres`) — so the database performed **no** row-level enforcement.
Authorization is therefore now enforced at the API layer.

---

## What changed (files)

| File | Change |
|------|--------|
| `.env.local` | Replaced the placeholder `JWT_SECRET` with a strong random value (**rotation — see below**). |
| `src/server/auth.ts` | `getSecret()` fails closed: refuses to sign/verify with a missing, short, or known-placeholder secret. Resolved lazily so `next build` still works. |
| `src/server/authz.ts` | **New.** Per-role access rules for `/api/db`: table/action allow rules, ownership-filter injection, profile escalation-column guard, public-path sanitizers. |
| `src/server/rate-limit.ts` | **New.** In-memory fixed-window limiter + client-IP helper. |
| `src/app/api/db/route.ts` | Raw-SQL path gated to admin/superadmin; authenticated requests run through `authorizeDbRequest`; unauthenticated registration insert is sanitized and the email lookup is column-clamped. |
| `src/server/query-executor.ts` | Added `assertSafeColumnList()` for embedded SELECT columns (SQL-injection fix) and a self-scoped `get_user_context` RPC. |
| `src/context/UserContext.tsx` | Now loads the signed-in user via `get_user_context` RPC instead of a raw client SQL query (so students no longer need the raw-SQL path). |
| `src/app/api/auth/[action]/route.ts` | Login brute-force throttling (per IP + per email). |
| `src/app/api/upload/avatar/route.ts` | Image content-type allow-list, 5 MB cap, server-derived extension (no attacker-controlled filename). |
| `src/app/api/notify/[name]/route.ts` | Per-user / per-IP abuse cap on the email/SMS endpoints. |

---

## Risk reduced

- **Privilege escalation** — students/teachers can no longer set `profiles.role`,
  `system_role_id`, or `is_archived`; raw SQL is admin/superadmin-only.
- **Arbitrary SQL execution** — the `/api/db` raw-query passthrough is no longer
  reachable by students or teachers.
- **IDOR / cross-student reads** — student reads of `invoices`,
  `grade_table_entries`, `class_attendance`, `class_enrollments`, `students`, and
  `profiles` are force-scoped to the signed-in user; sensitive tables
  (`auth_users`, `system_roles`, `role_permissions`, `registration_applications`,
  `teacher_student_notes`, …) are blocked for students.
- **Academic-record tampering** — students can only write their own profile, own
  calendar events, and own RSVP; all other writes are rejected.
- **Anonymous PII dump** — the unauthenticated email lookup now returns only
  `id/email/status`, never full profile PII.
- **Account seeding** — public registration is forced to `role=student`,
  `status=pending`, with review/identity fields stripped.
- **SQL injection** via embedded select columns — closed.
- **Token forgery** — strong, non-default JWT secret, enforced fail-closed.
- **Brute force / toll fraud** — login and notify endpoints are rate-limited.

---

## How to test manually (nothing should break)

**Student**
- Log in, view dashboard, grades, attendance, invoices, calendar — all load.
- Create a personal calendar event; RSVP to an event — works.
- Change password via the forced-change screen and via Settings — works.
- Negative: `POST /api/db {"table":"profiles","action":"update","body":{"role":"admin"},"filters":[{"op":"eq","column":"id","value":"<self>"}]}` → **403**.
- Negative: `POST /api/db {"table":"grade_table_entries","action":"select","filters":[{"op":"eq","column":"student_id","value":"<other student>"}]}` → returns **empty** (scoped to self).
- Negative: `POST /api/db {"query":"select 1"}` → **403**.

**Teacher**
- Classes, students, grading (create grade tables, grade students), attendance,
  notes, announcements, calendar — all work.

**Admin / Superadmin**
- Students, finance (manual + auto invoices, overrides, archive/unarchive),
  registrations (approve/reject/enroll), programs, classes, calendar,
  superadmin roles & users — all work (raw-SQL admin tooling still allowed).

**Anonymous**
- Public registration submits successfully; "email already registered" / pending
  checks still work.
- Negative: anonymous `select *` on `profiles` by email → returns only `id,email`.

---

## Environment / operational follow-ups

- **JWT_SECRET was rotated.** This invalidates all existing sessions — every user
  must log in again. Do it during a low-traffic window. The value lives only in
  `.env.local` (gitignored); set the same value in the production environment.
- **Rotate exposed third-party secrets if there's any chance they leaked.**
  `.env.local` currently holds live `DB_PASSWORD`, `RESEND_API_KEY`,
  `TWILIO_AUTH_TOKEN`. The file is gitignored, but it is open in the IDE — confirm
  it was never committed (`git log` / history) and rotate if in doubt.

---

## Residual risks (not addressed here — would need larger, riskier changes)

1. **Teacher-to-teacher data access** — a teacher can still read/write another
   teacher's class data through the generic API. Within-staff trust; lower
   priority. Needs relationship-based checks per table.
2. **Admin raw-SQL tooling** — admins/superadmins can still run arbitrary SQL via
   `/api/db`. Recommend converting the ~6 remaining raw-query call sites in
   `src/services/api.ts` to named server operations, then removing the raw path
   entirely.
3. **Calendar event visibility** — students can read all `calendar_events` in a
   date range (participant-aware filtering not enforced). Lower sensitivity.
4. **Defense in depth at the DB** — RLS is disabled and the app connects as the DB
   owner. Long-term, connect as a non-owner role with `FORCE ROW LEVEL SECURITY`.
5. **Structured query error messages** are still returned to the client (the
   registration/enroll fallback logic depends on them); the raw-SQL path is now
   generic. Revisit if the dependent client logic is refactored.
6. **`next.config.ts`** still sets `ignoreBuildErrors` / `ignoreDuringBuilds`.
