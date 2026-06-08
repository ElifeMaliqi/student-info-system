import type pg from 'pg';
import type { DbQueryRequest } from '../types/db-query';

export type { DbQueryRequest };

type Row = Record<string, unknown>;

const TABLE_COLUMNS: Record<string, string[]> = {};

function localKeyFromConstraint(parentTable: string, constraint: string): string {
  const base = constraint.replace(/_fkey$/, '');
  const prefix = `${parentTable}_`;
  if (base.startsWith(prefix)) return base.slice(prefix.length);
  const parts = base.split('_');
  if (parts.length >= 2) return parts.slice(-2).join('_');
  return base;
}

interface EmbedSpec {
  alias: string;
  table: string;
  localKey: string;
  remoteKey: string;
  many: boolean;
  columns: string;
  nested?: EmbedSpec[];
}

const RELATION_OVERRIDES: Record<string, { localKey: string; remoteKey: string; many: boolean }> = {
  'calendar_event_participants.profiles': { localKey: 'user_id', remoteKey: 'id', many: false },
  'calendar_events.calendar_event_participants': { localKey: 'id', remoteKey: 'event_id', many: true },
  'class_enrollments.classes': { localKey: 'class_id', remoteKey: 'id', many: false },
  'classes.class_enrollments': { localKey: 'id', remoteKey: 'class_id', many: true },
  'classes.class_sessions': { localKey: 'id', remoteKey: 'class_id', many: true },
};

function singularTableName(table: string): string {
  if (table === 'classes') return 'class';
  if (table.endsWith('ies')) return `${table.slice(0, -3)}y`;
  if (table.endsWith('s')) return table.slice(0, -1);
  return table;
}

function inferRelation(parentTable: string, table: string): { localKey: string; remoteKey: string; many: boolean } {
  const override = RELATION_OVERRIDES[`${parentTable}.${table}`];
  if (override) return override;

  return {
    localKey: `${singularTableName(table)}_id`,
    remoteKey: 'id',
    many: false,
  };
}

function parseSelectSpec(select: string, parentTable: string): { columns: string[]; embeds: EmbedSpec[] } {
  const columns: string[] = [];
  const embeds: EmbedSpec[] = [];
  if (!select || select === '*') return { columns: ['*'], embeds: [] };

  let depth = 0;
  let buf = '';
  const parts: string[] = [];
  for (const ch of select) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      parts.push(buf.trim());
      buf = '';
    } else {
      buf += ch;
    }
  }
  if (buf.trim()) parts.push(buf.trim());

  for (const part of parts) {
    const embedMatch = part.match(/^(\w+):(\w+)!(\w+)\(([\s\S]*)\)$/);
    const embedMatch2 = part.match(/^(\w+)!(\w+)\(([\s\S]*)\)$/);
    const embedMatch3 = part.match(/^(\w+):(\w+)\(([\s\S]*)\)$/);
    const embedMatch4 = part.match(/^(\w+)\(([\s\S]*)\)$/);
    if (embedMatch) {
      const [, alias, table, constraint, inner] = embedMatch;
      const parsed = parseSelectSpec(inner, table);
      embeds.push({
        alias,
        table,
        localKey: localKeyFromConstraint(parentTable, constraint),
        remoteKey: 'id',
        many: false,
        columns: parsed.columns.join(', ') || '*',
        nested: parsed.embeds,
      });
    } else if (embedMatch2) {
      const [, table, constraint, inner] = embedMatch2;
      const parsed = parseSelectSpec(inner, table);
      embeds.push({
        alias: table,
        table,
        localKey: localKeyFromConstraint(parentTable, constraint),
        remoteKey: 'id',
        many: false,
        columns: parsed.columns.join(', ') || '*',
        nested: parsed.embeds,
      });
    } else if (embedMatch3) {
      const [, alias, table, inner] = embedMatch3;
      const parsed = parseSelectSpec(inner, table);
      const relation = inferRelation(parentTable, table);
      embeds.push({
        alias,
        table,
        ...relation,
        columns: parsed.columns.join(', ') || '*',
        nested: parsed.embeds,
      });
    } else if (embedMatch4) {
      const [, table, inner] = embedMatch4;
      const parsed = parseSelectSpec(inner, table);
      const relation = inferRelation(parentTable, table);
      embeds.push({
        alias: table,
        table,
        ...relation,
        columns: parsed.columns.join(', ') || '*',
        nested: parsed.embeds,
      });
    } else {
      columns.push(part);
    }
  }
  return { columns: columns.length ? columns : ['*'], embeds };
}

function quoteIdent(name: string): string {
  if (!/^[a-z_][a-z0-9_]*$/i.test(name)) throw new Error(`Invalid identifier: ${name}`);
  return `"${name}"`;
}

function buildWhere(filters: DbQueryRequest['filters'], orClause: string | undefined, params: unknown[], startIdx: number): { sql: string; nextIdx: number } {
  const clauses: string[] = [];
  let idx = startIdx;

  for (const f of filters || []) {
    const col = quoteIdent(f.column);
    if (f.op === 'eq') {
      params.push(f.value);
      clauses.push(`${col} = $${idx++}`);
    } else if (f.op === 'neq') {
      params.push(f.value);
      clauses.push(`${col} <> $${idx++}`);
    } else if (f.op === 'in') {
      const arr = Array.isArray(f.value) ? f.value : [f.value];
      if (!arr.length) clauses.push('false');
      else {
        params.push(arr);
        clauses.push(`${col} = ANY($${idx++})`);
      }
    } else if (f.op === 'ilike') {
      params.push(f.value);
      clauses.push(`${col} ILIKE $${idx++}`);
    } else if (f.op === 'is') {
      if (f.value === null) clauses.push(`${col} IS NULL`);
      else {
        params.push(f.value);
        clauses.push(`${col} IS $${idx++}`);
      }
    } else if (f.op === 'gte') {
      params.push(f.value);
      clauses.push(`${col} >= $${idx++}`);
    } else if (f.op === 'lte') {
      params.push(f.value);
      clauses.push(`${col} <= $${idx++}`);
    } else if (f.op === 'lt') {
      params.push(f.value);
      clauses.push(`${col} < $${idx++}`);
    } else if (f.op === 'gt') {
      params.push(f.value);
      clauses.push(`${col} > $${idx++}`);
    }
  }

  if (orClause) {
    const orParts = orClause.split(',').map((p) => p.trim());
    const orSql: string[] = [];
    for (const part of orParts) {
      const m = part.match(/^(\w+)\.ilike\.%(.+)%$/);
      if (m) {
        params.push(`%${m[2]}%`);
        orSql.push(`${quoteIdent(m[1])} ILIKE $${idx++}`);
      } else {
        const m2 = part.match(/^(\w+)\.ilike\.(.+)$/);
        if (m2) {
          params.push(m2[2].includes('%') ? m2[2] : `%${m2[2]}%`);
          orSql.push(`${quoteIdent(m2[1])} ILIKE $${idx++}`);
        }
      }
    }
    if (orSql.length) clauses.push(`(${orSql.join(' OR ')})`);
  }

  return { sql: clauses.length ? ` WHERE ${clauses.join(' AND ')}` : '', nextIdx: idx };
}

async function attachEmbeds(
  client: pg.PoolClient,
  rows: Row[],
  parentTable: string,
  embeds: EmbedSpec[]
): Promise<Row[]> {
  if (!rows.length || !embeds.length) return rows;

  return Promise.all(
    rows.map(async (row) => {
      const out = { ...row };
      for (const emb of embeds) {
        const fkVal = row[emb.localKey];
        if (fkVal == null) {
          out[emb.alias] = emb.many ? [] : null;
          continue;
        }
        if (emb.many) {
          if (emb.columns === 'count') {
            const { rows: countRows } = await client.query(
              `SELECT COUNT(*)::int AS count FROM ${quoteIdent(emb.table)} WHERE ${quoteIdent(emb.remoteKey)} = $1`,
              [fkVal]
            );
            out[emb.alias] = [{ count: countRows[0]?.count ?? 0 }];
            continue;
          }

          const cols = emb.columns === '*' ? '*' : emb.columns;
          const { rows: childRows } = await client.query(
            `SELECT ${cols} FROM ${quoteIdent(emb.table)} WHERE ${quoteIdent(emb.remoteKey)} = $1`,
            [fkVal]
          );
          out[emb.alias] = emb.nested?.length
            ? await attachEmbeds(client, childRows as Row[], emb.table, emb.nested)
            : childRows;
        } else {
          const cols = emb.columns === '*' ? '*' : emb.columns;
          const { rows: childRows } = await client.query(
            `SELECT ${cols} FROM ${quoteIdent(emb.table)} WHERE ${quoteIdent(emb.remoteKey)} = $1 LIMIT 1`,
            [fkVal]
          );
          let child = childRows[0] as Row | undefined;
          if (child && emb.nested?.length) {
            [child] = await attachEmbeds(client, [child], emb.table, emb.nested);
          }
          out[emb.alias] = child ?? null;
        }
      }
      return out;
    })
  );
}

export async function executeQuery(
  client: pg.PoolClient,
  req: DbQueryRequest
): Promise<{ data: unknown; error: { message: string } | null; count?: number | null }> {
  try {
    const table = quoteIdent(req.table);
    const params: unknown[] = [];

    if (req.action === 'select') {
      const { columns, embeds } = parseSelectSpec(req.select || '*', req.table);
      const colSql = columns.includes('*') ? '*' : columns.map(quoteIdent).join(', ');
      let idx = 1;
      const { sql: whereSql, nextIdx } = buildWhere(req.filters, req.or, params, idx);
      idx = nextIdx;

      let sql = `SELECT ${colSql} FROM ${table}${whereSql}`;
      if (req.order?.length) {
        sql += ' ORDER BY ' + req.order.map((o) => `${quoteIdent(o.column)} ${o.ascending === false ? 'DESC' : 'ASC'}`).join(', ');
      }
      if (req.range) {
        params.push(req.range[1] - req.range[0] + 1, req.range[0]);
        sql += ` LIMIT $${idx++} OFFSET $${idx++}`;
      } else if (req.limit) {
        params.push(req.limit);
        sql += ` LIMIT $${idx++}`;
      }

      if (req.head && req.count === 'exact') {
        const countSql = `SELECT COUNT(*)::int AS c FROM ${table}${whereSql}`;
        const { rows: cRows } = await client.query(countSql, params.slice(0, nextIdx - 1));
        return { data: null, error: null, count: cRows[0]?.c ?? 0 };
      }

      const { rows } = await client.query(sql, params);
      let data: unknown = await attachEmbeds(client, rows as Row[], req.table, embeds);

      if (req.count === 'exact') {
        const { sql: w, nextIdx: ni } = buildWhere(req.filters, req.or, [], 1);
        const { rows: cRows } = await client.query(`SELECT COUNT(*)::int AS c FROM ${table}${w}`, params.slice(0, nextIdx - 1));
        if (req.maybeSingle || req.single) {
          return { data: (data as Row[])[0] ?? null, error: null, count: cRows[0]?.c ?? 0 };
        }
        return { data, error: null, count: cRows[0]?.c ?? 0 };
      }

      if (req.single) {
        if ((data as Row[]).length !== 1) return { data: null, error: { message: 'JSON object requested, multiple (or no) rows returned' } };
        return { data: (data as Row[])[0], error: null };
      }
      if (req.maybeSingle) return { data: (data as Row[])[0] ?? null, error: null };
      return { data, error: null };
    }

    if (req.action === 'insert' || req.action === 'upsert') {
      const rows = Array.isArray(req.body) ? req.body : [req.body!];
      if (!rows.length) return { data: null, error: { message: 'No rows to insert' } };
      const keys = Object.keys(rows[0]);
      const cols = keys.map(quoteIdent).join(', ');
      const placeholders = rows
        .map((_, ri) => `(${keys.map((_, ci) => `$${ri * keys.length + ci + 1}`).join(', ')})`)
        .join(', ');
      const values = rows.flatMap((r) => keys.map((k) => r[k]));
      let sql = `INSERT INTO ${table} (${cols}) VALUES ${placeholders}`;
      if (req.action === 'upsert' && req.onConflict) {
        const conflictCols = req.onConflict.split(',').map((s) => quoteIdent(s.trim()));
        const conflictColNames = req.onConflict.split(',').map((s) => s.trim());
        const updates = keys
          .filter((k) => !conflictColNames.includes(k))
          .map((k) => `${quoteIdent(k)} = EXCLUDED.${quoteIdent(k)}`)
          .join(', ');
        sql += ` ON CONFLICT (${conflictCols.join(', ')}) DO UPDATE SET ${updates}`;
      }
      sql += ' RETURNING *';
      const { rows: inserted } = await client.query(sql, values);
      return { data: req.single || req.maybeSingle ? inserted[0] : inserted, error: null };
    }

    if (req.action === 'update') {
      const body = req.body as Record<string, unknown>;
      const keys = Object.keys(body);
      const sets = keys.map((k, i) => `${quoteIdent(k)} = $${i + 1}`).join(', ');
      const vals = keys.map((k) => body[k]);
      let idx = keys.length + 1;
      const { sql: whereSql, nextIdx } = buildWhere(req.filters, undefined, vals, idx);
      const { rows } = await client.query(`UPDATE ${table} SET ${sets}${whereSql} RETURNING *`, vals);
      return { data: req.single || req.maybeSingle ? rows[0] : rows, error: null };
    }

    if (req.action === 'delete') {
      let idx = 1;
      const { sql: whereSql } = buildWhere(req.filters, undefined, params, idx);
      await client.query(`DELETE FROM ${table}${whereSql}`, params);
      return { data: null, error: null };
    }

    return { data: null, error: { message: 'Unknown action' } };
  } catch (e) {
    return { data: null, error: { message: e instanceof Error ? e.message : String(e) } };
  }
}

export async function executeRpc(
  client: pg.PoolClient,
  fn: string,
  args: Record<string, unknown>,
  userId: string | null
): Promise<{ data: unknown; error: { message: string } | null }> {
  try {
    if (fn === 'approve_registration_application') {
      // Superadmin callers must proxy through an admin because the DB function
      // checks that the caller has role = 'admin'.
      let effectiveUserId = userId;
      if (userId) {
        const { rows: callerRows } = await client.query(
          `SELECT role FROM profiles WHERE id = $1`,
          [userId]
        );
        if (callerRows[0]?.role === 'superadmin') {
          const { rows: adminRows } = await client.query(
            `SELECT id FROM profiles WHERE role = 'admin' AND (is_archived = false OR is_archived IS NULL) LIMIT 1`
          );
          if (adminRows[0]) effectiveUserId = adminRows[0].id;
        }
      }
      const { rows } = await client.query(
        `SELECT approve_registration_application($1::uuid, $2::uuid) AS result`,
        [args.application_id, effectiveUserId]
      );
      return { data: rows[0]?.result, error: null };
    }
    if (fn === 'admin_delete_student_account') {
      const { rows } = await client.query(
        `SELECT admin_delete_student_account($1::uuid, $2::uuid) AS result`,
        [args.p_student_id, userId]
      );
      return { data: rows[0]?.result, error: null };
    }
    return { data: null, error: { message: `Unknown function: ${fn}` } };
  } catch (e) {
    return { data: null, error: { message: e instanceof Error ? e.message : String(e) } };
  }
}
