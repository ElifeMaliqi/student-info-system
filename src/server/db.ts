import pg from 'pg';

const { Pool } = pg;

// Return DATE columns as plain 'YYYY-MM-DD' strings. By default node-pg turns them
// into a JS Date at local midnight, which serializes to the previous day on servers
// ahead of UTC and breaks every client formatter that expects 'YYYY-MM-DD'.
pg.types.setTypeParser(1082, (value: string) => value);

function getConnectionString(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const host = process.env.DB_HOST;
  const user = process.env.DB_USER;
  const password = process.env.DB_PASSWORD;
  const database = process.env.DB_NAME || 'postgres';
  const port = process.env.DB_PORT || '5432';
  if (!host || !user || !password) {
    throw new Error('Database not configured. Set DATABASE_URL or DB_HOST/DB_USER/DB_PASSWORD in .env');
  }
  return `postgresql://${user}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
}

let pool: pg.Pool | null = null;

export function getPool(): pg.Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: getConnectionString(),
      ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
      max: 10,
    });
  }
  return pool;
}

export async function withUserContext<T>(
  userId: string | null,
  fn: (client: pg.PoolClient) => Promise<T>
): Promise<T> {
  const client = await getPool().connect();
  // Session-level (is_local = false): set_app_user() uses a transaction-local
  // setting, which vanished as soon as its own autocommit statement ended, so
  // current_app_user_id() was always NULL in the queries that followed. The
  // value is cleared again before the connection returns to the pool so it
  // can't leak into a later query from another user or the background sync.
  try {
    await client.query(`SELECT set_config('app.user_id', $1, false)`, [userId ?? '']);
    return await fn(client);
  } finally {
    try {
      await client.query(`SELECT set_config('app.user_id', '', false)`);
      client.release();
    } catch (err) {
      // e.g. fn left an aborted transaction open: drop this connection instead
      // of returning it to the pool with the user id still set.
      client.release(err as Error);
    }
  }
}

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params?: unknown[],
  userId?: string | null
): Promise<pg.QueryResult<T>> {
  if (userId !== undefined) {
    return withUserContext(userId ?? null, (client) => client.query<T>(text, params));
  }
  return getPool().query<T>(text, params);
}

/**
 * The error text a browser may see. Our own messages (thrown in app code, or
 * RAISE EXCEPTION in our database functions) and duplicate-key errors (the app
 * matches on their constraint names) pass through; any other database or
 * connection error, which can name tables, columns or servers, is replaced by
 * a plain message and logged here instead.
 */
export function publicErrorMessage(e: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (!(e instanceof Error)) return fallback;
  const { code, detail } = e as Error & { code?: unknown; detail?: unknown };
  if (typeof code !== 'string') return e.message;
  if (code === 'P0001') return e.message;
  if (code === '23505') return typeof detail === 'string' && detail ? `${e.message} (${detail})` : e.message;
  console.error('[db error]', code, e.message, detail ?? '');
  if (code === '23503') return 'This item is still linked to other records.';
  if (code === '23502') return 'A required field is missing.';
  if (code === '23514' || code.startsWith('22')) return 'One of the values is not valid.';
  return fallback;
}
