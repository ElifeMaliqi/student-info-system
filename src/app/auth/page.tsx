'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '../../context/UserContext';
import Login from '../../views/Login';

export default function AuthPage() {
  const { user, ready } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (ready && user) {
      router.replace('/dashboard');
    }
  }, [user, ready, router]);

  if (!ready) {
    return (
      <div className="min-h-screen w-full bg-[#050505] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-white/10 border-t-[#fc0ce4] rounded-full animate-spin" />
      </div>
    );
  }

  if (user) return null;

  return <Login onLogin={() => router.replace('/dashboard')} />;
}
