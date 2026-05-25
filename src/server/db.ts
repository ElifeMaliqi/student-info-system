import pg from 'pg';

const { Pool } = pg;

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
  try {
    await client.query('SELECT set_app_user($1)', [userId]);
    return await fn(client);
  } finally {
    client.release();
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
