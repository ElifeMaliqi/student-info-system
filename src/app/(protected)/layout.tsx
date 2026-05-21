'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '../../context/UserContext';
import AdminLayout from '../../layouts/AdminLayout';
import ForcePasswordChange from '../../views/ForcePasswordChange';
import { supabase } from '../../lib/supabase';

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { user, ready, setUser } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (ready && !user) {
      router.replace('/auth');
    }
  }, [user, ready, router]);

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
