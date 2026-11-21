import { query } from './db';
import type { AuthUser } from './auth';

type Activity = 'add' | 'edit' | 'delete';

/**
 * Activity log entry for something done while a superadmin is impersonating
 * `user`. Recorded under the superadmin's account, with the name shown as
 * "<superadmin> (as <user>)". Does nothing for normal sessions. A failed log
 * never blocks the action itself.
 */
export async function logImpersonatedAction(
  user: AuthUser,
  activity: Activity,
  description: string,
  area = 'impersonation'
): Promise<void> {
  const imp = user.impersonation;
  if (!imp) return;
  try {
    await query(
      `INSERT INTO activity_logs (user_id, user_name, user_role, activity, area, description)
       VALUES ($1, $2, 'superadmin', $3, $4, $5)`,
      [imp.byId, `${imp.byName} (as ${imp.asName})`, activity, area.slice(0, 50), description.slice(0, 2000)]
    );
  } catch (err) {
    console.error('[impersonation] Failed to log activity:', err);
  }
}

/** Add / Edit / Delete for a fixed SQL statement, or null when it only reads. */
export function sqlActivity(sql: string): Activity | null {
  if (/\bdelete\b/i.test(sql)) return 'delete';
  if (/\binsert\b/i.test(sql)) return 'add';
  if (/\bupdate\b/i.test(sql)) return 'edit';
  return null;
}
