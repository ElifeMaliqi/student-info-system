'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useUser } from '../../context/UserContext';
import AdminLayout from '../../layouts/AdminLayout';
import ForcePasswordChange from '../../views/ForcePasswordChange';
import { supabase } from '../../lib/supabase';

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { user, ready, setUser, reloadUser } = useUser();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (ready && !user) {
      router.replace('/auth');
    }
  }, [user, ready, router]);

  // Refresh permissions on every navigation so role changes take effect without a manual refresh
  useEffect(() => {
    if (user) void reloadUser();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  if (!ready) {
    return (
      <div className="min-h-screen w-full bg-[#050505] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-white/10 border-t-[#fc0ce4] rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return null;

  if (user.mustChangePassword) {
    return <ForcePasswordChange />;
  }

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    router.replace('/auth');
  };

  return (
    <AdminLayout onLogout={handleLogout} role={user.role}>
      {children}
    </AdminLayout>
  );
}
