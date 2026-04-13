import { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react';
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
  const [user, setUserRaw] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const hydratedRef = useRef(false);

  // Wrap setUser so that external callers (e.g. Login.tsx) also mark the
  // user as hydrated, preventing onAuthStateChange from doing a redundant
  // profile fetch.
  const setUser = (u: User | null) => {
    if (u) hydratedRef.current = true;
    setUserRaw(u);
  };

  const isInvalidRefreshTokenError = (message?: string | null) =>
    !!message && /invalid refresh token|refresh token not found/i.test(message);

  useEffect(() => {
    let active = true;

    const toAppUser = (authUser: { id: string; email?: string | null }, profile: any): User => ({
      id: profile.id,
      email: authUser.email || '',
      firstName: profile.first_name,
      lastName: profile.last_name,
      role: profile.role,
      avatar: profile.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile.email || authUser.id}`,
      mustChangePassword: !!profile.must_change_password,
    });

    const hydrateUser = async () => {
      try {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();


        if (sessionError && isInvalidRefreshTokenError(sessionError.message)) {
          await supabase.auth.signOut({ scope: 'local' });
        }

        const sessionUser = sessionData?.session?.user;

        if (sessionError || !sessionUser) {
          if (active) {
            setUser(null);
            setReady(true);
          }
          return;
        }

        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, role, avatar_url, email, must_change_password')
          .eq('id', sessionUser.id)
          .maybeSingle();

        if (!active) return;

        if (profileError || !profile) {
          setUser(null);
        } else {
          setUser(toAppUser({ id: sessionUser.id, email: sessionUser.email }, profile));
          hydratedRef.current = true;
        }

        setReady(true);
      } catch {
        if (active) {
          setUser(null);
          setReady(true);
        }
      }
    };

    void hydrateUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!active) return;

      // Only react to explicit sign-in / sign-out.
      // Everything else (INITIAL_SESSION, TOKEN_REFRESHED, USER_UPDATED, etc.)
      // is either handled by hydrateUser() or irrelevant to app state.
      if (_event === 'SIGNED_OUT') {
        hydratedRef.current = false;
        setUserRaw(null);
        setReady(true);
        return;
      }

      if (_event === 'SIGNED_IN' && session?.user && !hydratedRef.current) {
        try {
          const { data: profile } = await supabase
            .from('profiles')
            .select('id, first_name, last_name, role, avatar_url, email, must_change_password')
            .eq('id', session.user.id)
            .maybeSingle();

          if (!active) return;

          if (profile) {
            setUser(toAppUser({ id: session.user.id, email: session.user.email }, profile));
            hydratedRef.current = true;
          }
        } catch {
          // profile load failed — user stays null, app redirects to auth
        } finally {
          if (active) setReady(true);
        }
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
