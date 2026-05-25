#!/usr/bin/env node
/**
 * Apply base schema + supabase/migrations to AWS RDS.
 * Usage: node scripts/migrate-rds.mjs
 */
import pg from "pg";
import { readFileSync, readdirSync, existsSync } from "fs";
import { resolve, dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

function loadEnv() {
  const path = join(root, ".env");
  const vars = {};
  if (!existsSync(path)) return vars;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i === -1) continue;
    vars[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return vars;
}

function sanitizeSql(sql, filename) {
  let s = sql;
  s = s.replace(/NOTIFY\s+pgrst[^;]*;/gi, "");
  s = s.replace(/\bauth\.uid\(\)/g, "current_app_user_id()");
  s = s.replace(/\(\s*auth\.jwt\(\)\s*->>\s*'role'\s*\)/g, "(SELECT role FROM profiles WHERE id = current_app_user_id())");
  s = s.replace(/\bauth\.jwt\(\)\s*->>\s*'[^']+'/g, "NULL");
  s = s.replace(/\bauth\.jwt\(\)/g, "NULL::jsonb");
  // Skip blocks that insert into auth.users (handled by 001_rds_auth_functions)
  if (/INSERT\s+INTO\s+auth\.users/i.test(s) && !filename.includes("001_rds")) {
    return "-- skipped auth.users block in " + filename + "\n";
  }
  if (/DELETE\s+FROM\s+auth\.users/i.test(s)) {
    s = s.replace(/DELETE\s+FROM\s+auth\.users[^;]*;/gi, "DELETE FROM auth_users WHERE id = p_student_id;");
  }
  return s;
}

async function runFile(client, filePath, label) {
  const sql = readFileSync(filePath, "utf8");
  const body = sanitizeSql(sql, label);
  if (!body.trim()) return { label, ok: true, skipped: true };
  try {
    await client.query(body);
    return { label, ok: true };
  } catch (e) {
    return { label, ok: false, error: e.message };
  }
}

async function disableRls(client) {
  const { rows } = await client.query(`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename NOT LIKE 'pg_%'
  `);
  for (const { tablename } of rows) {
    try {
      await client.query(`ALTER TABLE public.${tablename} DISABLE ROW LEVEL SECURITY`);
    } catch {
      /* ignore */
    }
  }
}

async function resetSchema(client) {
  console.log("Resetting public schema...");
  await client.query("DROP SCHEMA public CASCADE");
  await client.query("CREATE SCHEMA public");
  await client.query("GRANT ALL ON SCHEMA public TO postgres");
  await client.query("GRANT ALL ON SCHEMA public TO public");
}

async function main() {
  const fresh = process.argv.includes("--fresh");
  const env = loadEnv();
  const connectionString =
    env.DATABASE_URL ||
    `postgresql://${env.DB_USER}:${encodeURIComponent(env.DB_PASSWORD)}@${env.DB_HOST}:${env.DB_PORT || 5432}/${env.DB_NAME}`;

  const client = new pg.Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  console.log("Connecting to RDS...");
  await client.connect();
  console.log("Connected.\n");

  if (fresh) await resetSchema(client);

  const results = [];

  const baseFiles = [
    join(root, "scripts/rds/000_base_schema.sql"),
    join(root, "scripts/rds/001_rds_auth_functions.sql"),
  ];
  for (const f of baseFiles) {
    results.push(await runFile(client, f, f));
  }

  const migDir = join(root, "supabase/migrations");
  const migrations = readdirSync(migDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const f of migrations) {
    results.push(await runFile(client, join(migDir, f), f));
  }

  const applyMigration = join(root, "APPLY_MIGRATION.sql");
  if (existsSync(applyMigration)) {
    results.push(await runFile(client, applyMigration, "APPLY_MIGRATION.sql"));
  }

  // Re-apply RDS auth functions after migrations (may have been overwritten)
  results.push(await runFile(client, baseFiles[1], "001_rds_auth_functions.sql (reapply)"));

  console.log("Disabling RLS on all public tables...");
  await disableRls(client);

  await client.end();

  const failed = results.filter((r) => !r.ok);
  const ok = results.filter((r) => r.ok && !r.skipped);
  console.log(`\nDone: ${ok.length} applied, ${failed.length} failed.\n`);
  for (const r of failed) {
    console.log(`FAIL ${r.label}: ${r.error}`);
  }
  if (failed.length) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
