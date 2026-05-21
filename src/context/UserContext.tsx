'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User } from '../types';
import { supabase } from '../lib/supabase';

interface UserContextType {
  user: User | null;
  ready: boolean;
  setUser: (user: User | null) => void;
}

const UserContext = createContext<UserContextType>({
  user: null,
  ready: false,
  setUser: () => {},
});

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;

    const loadProfile = async (authUser: { id: string; email?: string | null }): Promise<User | null> => {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, role, avatar_url, email, must_change_password')
        .eq('id', authUser.id)
        .maybeSingle();

      if (!profile) return null;

      return {
        id: profile.id,
        email: authUser.email || '',
        firstName: profile.first_name,
        lastName: profile.last_name,
        role: profile.role,
        avatar: profile.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile.email || authUser.id}`,
        mustChangePassword: !!profile.must_change_password,
      };
    };

    // Check for existing session on mount
    const hydrateUser = async () => {
      try {
        console.log('[UserContext] hydrateUser starting, calling getSession...');
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        console.log('[UserContext] getSession done, error:', sessionError?.message || 'none', 'hasSession:', !!sessionData?.session);

        if (sessionError) {
          if (/invalid refresh token|refresh token not found/i.test(sessionError.message || '')) {
            console.log('[UserContext] invalid refresh token, signing out locally');
            await supabase.auth.signOut({ scope: 'local' });
          }
          if (active) { setUser(null); setReady(true); }
          return;
        }

        const sessionUser = sessionData?.session?.user;
        if (!sessionUser) {
          console.log('[UserContext] no session user, setting ready=true (logged out)');
          if (active) { setUser(null); setReady(true); }
          return;
        }

        console.log('[UserContext] session user found:', sessionUser.id, ', loading profile...');
        const appUser = await loadProfile(sessionUser);
        console.log('[UserContext] profile loaded, role:', appUser?.role || 'null');
        if (active) {
          setUser(appUser);
          setReady(true);
          console.log('[UserContext] hydrateUser complete, ready=true, user:', appUser ? 'set' : 'null');
        }
      } catch (err) {
        console.error('[UserContext] hydrateUser error:', err);
        if (active) { setUser(null); setReady(true); }
      }
    };

    void hydrateUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log('[UserContext] onAuthStateChange event:', _event, 'hasSession:', !!session);
      if (!active) return;

      if (_event === 'SIGNED_OUT') {
        setUser(null);
        setReady(true);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <UserContext.Provider value={{ user, ready, setUser }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
}
