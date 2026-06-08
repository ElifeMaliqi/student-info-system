'use client';

import { createContext, useContext, useEffect, useState, useRef, useCallback, ReactNode } from 'react';
import { User, Role, SystemRole } from '../types';

const TOKEN_KEY = 'fma_sis_token';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

function removeToken() {
  if (typeof window !== 'undefined') localStorage.removeItem(TOKEN_KEY);
}

function authHeaders(): Record<string, string> {
  const token = getToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function fetchUserData(userId: string): Promise<User | null> {
  const headers = authHeaders();

  // Single query: profile + system role + permissions in one round-trip
  const resp = await fetch('/api/db', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      query: `
        SELECT
          p.id, p.email, p.first_name, p.last_name, p.role,
          p.avatar_url, p.must_change_password, p.system_role_id,
          sr.id        AS sr_id,
          sr.name      AS sr_name,
          sr.description AS sr_description,
          sr.is_system_role AS sr_is_system_role,
          COALESCE(
            json_agg(
              json_build_object(
                'id',      rp.id,
                'module',  rp.module,
                'actions', rp.actions
              )
            ) FILTER (WHERE rp.id IS NOT NULL),
            '[]'::json
          ) AS sr_permissions
        FROM profiles p
        LEFT JOIN system_roles sr ON sr.id = p.system_role_id
        LEFT JOIN role_permissions rp ON rp.role_id = p.system_role_id
        WHERE p.id = $1
        GROUP BY p.id, sr.id
      `,
      params: [userId],
    }),
  });

  if (!resp.ok) return null;
  const result = await resp.json();
  const row = result.rows?.[0];
  if (!row) return null;

  const parseActions = (a: unknown): string[] => {
    if (Array.isArray(a)) return a as string[];
    if (typeof a === 'string') {
      try { const p = JSON.parse(a); return Array.isArray(p) ? p : []; } catch { return []; }
    }
    return [];
  };

  let systemRole: SystemRole | undefined;
  if (row.sr_id) {
    const rawPerms: Array<{ id: string; module: string; actions: unknown }> = row.sr_permissions || [];
    systemRole = {
      id: row.sr_id,
      name: row.sr_name,
      description: row.sr_description || '',
      isSystemRole: !!row.sr_is_system_role,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      permissions: rawPerms.map(p => ({
        id: p.id,
        roleId: row.sr_id,
        module: p.module,
        actions: parseActions(p.actions),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })),
    };
  }

  return {
    id: row.id,
    email: row.email || '',
    firstName: row.first_name,
    lastName: row.last_name,
    role: row.role as Role,
    avatar: row.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${row.email || userId}`,
    mustChangePassword: !!row.must_change_password,
    systemRole,
  };
}

async function validateSession(): Promise<{ id: string; email: string } | null> {
  const token = getToken();
  if (!token) return null;
  try {
    const resp = await fetch('/api/auth/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    });
    if (!resp.ok) return null;
    const json = await resp.json();
    return json?.data?.session?.user ?? null;
  } catch {
    return null;
  }
}

interface UserContextType {
  user: User | null;
  ready: boolean;
  setUser: (user: User | null) => void;
  reloadUser: () => Promise<void>;
}

const UserContext = createContext<UserContextType>({
  user: null,
  ready: false,
  setUser: () => {},
  reloadUser: async () => {},
});

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const userRef = useRef<User | null>(null);

  useEffect(() => { userRef.current = user; }, [user]);

  const reloadUser = useCallback(async () => {
    const sessionUser = await validateSession();
    if (!sessionUser) {
      removeToken();
      setUser(null);
      return;
    }
    const appUser = await fetchUserData(sessionUser.id);
    setUser(appUser);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      const sessionUser = await validateSession();
      if (cancelled) return;

      if (!sessionUser) {
        removeToken();
        setUser(null);
        setReady(true);
        return;
      }

      const appUser = await fetchUserData(sessionUser.id);
      if (cancelled) return;
      setUser(appUser);
      setReady(true);
    }

    void boot();

    const onVisible = () => {
      if (document.visibilityState === 'visible') void reloadUser();
    };
    document.addEventListener('visibilitychange', onVisible);

    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel('sis_permissions_update');
      bc.onmessage = () => void reloadUser();
    } catch {}

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      bc?.close();
    };
  }, [reloadUser]);

  return (
    <UserContext.Provider value={{ user, ready, setUser, reloadUser }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
}

export function useModulePermissions(module: string) {
  const { user } = useContext(UserContext);
  const perm = user?.systemRole?.permissions?.find(p => p.module === module);

  if (!perm || perm.actions.length === 0) {
    return { isDeactivated: false, isOverridden: false, canCreate: true, canUpdate: true, canDelete: true };
  }

  if (perm.actions.includes('deactivate')) {
    return { isDeactivated: true, isOverridden: true, canCreate: false, canUpdate: false, canDelete: false };
  }

  return {
    isDeactivated: false,
    isOverridden: true,
    canCreate: perm.actions.includes('create'),
    canUpdate: perm.actions.includes('update'),
    canDelete: perm.actions.includes('delete'),
  };
}
