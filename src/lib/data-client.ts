/**
 * Browser client — replaces @supabase/supabase-js, talks to Next.js API + RDS.
 */
import type { DbQueryRequest } from '../types/db-query';

const TOKEN_KEY = 'fma_sis_token';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

function setToken(token: string | null) {
  if (typeof window === 'undefined') return;
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init?.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(path, { ...init, headers });
  const json = await res.json();
  return json as T;
}

type Filter = { op: string; column: string; value: unknown };

class QueryBuilder implements PromiseLike<{ data: unknown; error: { message: string } | null; count?: number | null }> {
  private req: DbQueryRequest;

  constructor(table: string) {
    this.req = { table, action: 'select', filters: [] };
  }

  select(columns = '*', options?: { count?: 'exact'; head?: boolean }) {
    this.req.select = columns;
    if (options?.count) this.req.count = options.count;
    if (options?.head) this.req.head = options.head;
    return this;
  }

  insert(values: Record<string, unknown> | Record<string, unknown>[]) {
    this.req.action = 'insert';
    this.req.body = values;
    return this;
  }

  upsert(values: Record<string, unknown> | Record<string, unknown>[], options?: { onConflict?: string }) {
    this.req.action = 'upsert';
    this.req.body = values;
    if (options?.onConflict) this.req.onConflict = options.onConflict;
    return this;
  }

  update(values: Record<string, unknown>) {
    this.req.action = 'update';
    this.req.body = values;
    return this;
  }

  delete() {
    this.req.action = 'delete';
    return this;
  }

  eq(column: string, value: unknown) {
    this.req.filters = this.req.filters || [];
    this.req.filters.push({ op: 'eq', column, value });
    return this;
  }

  neq(column: string, value: unknown) {
    this.req.filters = this.req.filters || [];
    this.req.filters.push({ op: 'neq', column, value });
    return this;
  }

  in(column: string, value: unknown[]) {
    this.req.filters = this.req.filters || [];
    this.req.filters.push({ op: 'in', column, value });
    return this;
  }

  ilike(column: string, value: string) {
    this.req.filters = this.req.filters || [];
    this.req.filters.push({ op: 'ilike', column, value });
    return this;
  }

  is(column: string, value: null) {
    this.req.filters = this.req.filters || [];
    this.req.filters.push({ op: 'is', column, value });
    return this;
  }

  gte(column: string, value: unknown) {
    this.req.filters = this.req.filters || [];
    this.req.filters.push({ op: 'gte', column, value });
    return this;
  }

  lte(column: string, value: unknown) {
    this.req.filters = this.req.filters || [];
    this.req.filters.push({ op: 'lte', column, value });
    return this;
  }

  lt(column: string, value: unknown) {
    this.req.filters = this.req.filters || [];
    this.req.filters.push({ op: 'lt', column, value });
    return this;
  }

  gt(column: string, value: unknown) {
    this.req.filters = this.req.filters || [];
    this.req.filters.push({ op: 'gt', column, value });
    return this;
  }

  not(column: string, operator: string, value: unknown) {
    if (operator === 'is' && value === null) {
      this.req.filters = this.req.filters || [];
      this.req.filters.push({ op: 'neq', column, value: null });
    }
    return this;
  }

  or(clause: string) {
    this.req.or = clause;
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.req.order = this.req.order || [];
    this.req.order.push({ column, ascending: options?.ascending });
    return this;
  }

  range(from: number, to: number) {
    this.req.range = [from, to];
    return this;
  }

  limit(n: number) {
    this.req.limit = n;
    return this;
  }

  single() {
    this.req.single = true;
    return this;
  }

  maybeSingle() {
    this.req.maybeSingle = true;
    return this;
  }

  then<TResult1 = { data: any; error: { message: string } | null; count?: number | null }, TResult2 = never>(
    onfulfilled?: ((value: { data: any; error: { message: string } | null; count?: number | null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return apiFetch<{ data: any; error: { message: string } | null; count?: number | null }>('/api/db', {
      method: 'POST',
      body: JSON.stringify(this.req),
    }).then(onfulfilled, onrejected);
  }
}

export const db = {
  from(table: string) {
    return new QueryBuilder(table);
  },

  rpc(fn: string, args?: Record<string, unknown>) {
    return apiFetch<{ data: unknown; error: { message: string } | null }>('/api/rpc', {
      method: 'POST',
      body: JSON.stringify({ fn, args: args ?? {} }),
    });
  },

  auth: {
    signInWithPassword: async ({ email, password }: { email: string; password: string }) => {
      const res = await apiFetch<{
        data: { user: { id: string; email: string }; session: { access_token: string; user: { id: string; email: string } } } | null;
        error: { message: string } | null;
      }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      if (res.data?.session?.access_token) setToken(res.data.session.access_token);
      return {
        data: res.data
          ? { user: res.data.user, session: res.data.session }
          : (null as { user: { id: string; email: string }; session: { access_token: string; user: { id: string; email: string } } } | null),
        error: res.error,
      };
    },

    getSession: async (): Promise<{
      data: { session: { access_token: string; user: { id: string; email: string } } | null };
      error: { message: string } | null;
    }> => {
      const token = getToken();
      if (!token) return { data: { session: null }, error: null };
      try {
        const res = await apiFetch<{
          data: { session: { access_token: string; user: { id: string; email: string } } | null };
          error: { message: string } | null;
        }>('/api/auth/session', { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
        if (res.error) return { data: { session: null }, error: res.error };
        return { data: { session: res.data?.session ?? null }, error: null };
      } catch (e) {
        return { data: { session: null }, error: { message: e instanceof Error ? e.message : 'Session error' } };
      }
    },

    getUser: async (): Promise<{
      data: { user: { id: string; email: string } | null };
      error: { message: string } | null;
    }> => {
      const token = getToken();
      if (!token) return { data: { user: null }, error: null };
      const res = await apiFetch<{
        data: { user: { id: string; email: string } | null };
        error: { message: string } | null;
      }>('/api/auth/user', { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      return { data: { user: res.data?.user ?? null }, error: res.error ?? null };
    },

    updateUser: async ({ password }: { password: string }): Promise<{
      data: unknown;
      error: { message: string } | null;
    }> => {
      const token = getToken();
      return apiFetch('/api/auth/update-password', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ password }),
      });
    },

    signOut: async (_options?: { scope?: string }): Promise<{ error: { message: string } | null }> => {
      setToken(null);
      return { error: null };
    },

    onAuthStateChange(
      callback: (event: string, session: { user: { id: string; email: string } } | null) => void
    ) {
      return {
        data: {
          subscription: {
            unsubscribe: () => {},
          },
        },
      };
    },
  },

  functions: {
    invoke: async (name: string, options?: { body?: unknown; headers?: Record<string, string> }) => {
      const res = await fetch(`/api/notify/${name}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
        body: JSON.stringify(options?.body ?? {}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { data: null, error: { message: (data as { error?: string }).error || res.statusText } };
      }
      return { data, error: null };
    },
  },

  storage: {
    from(bucket: string) {
      return {
        upload: async (path: string, file: File) => {
          const token = getToken();
          const form = new FormData();
          form.append('file', file);
          const res = await fetch('/api/upload/avatar', {
            method: 'POST',
            headers: token ? { Authorization: `Bearer ${token}` } : {},
            body: form,
          });
          const json = await res.json();
          if (!res.ok) return { data: null, error: { message: json.error || 'Upload failed' } };
          const publicUrl = json.publicUrl as string;
          return { data: { path: publicUrl, publicUrl }, error: null };
        },
        getPublicUrl: (path: string) => ({
          data: {
            publicUrl: path.startsWith('http') || path.startsWith('/')
              ? path
              : `/uploads/avatars/${path}`,
          },
        }),
      };
    },
  },
};

/** @deprecated Use `db` — alias for drop-in replacement */
export const supabase = db;
