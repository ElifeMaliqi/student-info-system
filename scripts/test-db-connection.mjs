import pg from "pg";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, "..", ".env");

function loadEnv() {
  const vars = {};
  try {
    const text = readFileSync(envPath, "utf8");
    for (const line of text.split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const i = t.indexOf("=");
      if (i === -1) continue;
      vars[t.slice(0, i).trim()] = t.slice(i + 1).trim();
    }
  } catch {
    /* ignore */
  }
  return vars;
}

const env = loadEnv();
const config = {
  host: env.DB_HOST,
  port: Number(env.DB_PORT || 5432),
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
  connectionTimeoutMillis: 15000,
  ssl: { rejectUnauthorized: false },
};

async function testRds() {
  console.log("\n--- AWS RDS ---");
  console.log(`Host: ${config.host}:${config.port}`);
  const client = new pg.Client(config);
  try {
    await client.connect();
    const r = await client.query(
      "SELECT version(), current_database() AS db, current_user AS usr"
    );
    const row = r.rows[0];
    const tables = await client.query(
      "SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema = 'public'"
    );
    console.log("Status: CONNECTED");
    console.log(`Database: ${row.db}`);
    console.log(`User: ${row.usr}`);
    console.log(`Version: ${String(row.version).split(" ").slice(0, 2).join(" ")}`);
    console.log(`Public tables: ${tables.rows[0].n}`);
    return true;
  } catch (e) {
    console.log("Status: FAILED");
    console.log(`Error: ${e.message}`);
    return false;
  } finally {
    await client.end().catch(() => {});
  }
}

const rdsOk = await testRds();
process.exit(rdsOk ? 0 : 1);
