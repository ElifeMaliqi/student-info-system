'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '../context/UserContext';

export default function RootPage() {
  const { user, ready } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;
    if (user) {
      router.replace('/dashboard');
    } else {
      router.replace('/auth');
    }
  }, [user, ready, router]);

  return (
    <div className="min-h-screen w-full bg-[#050505] flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-white/10 border-t-[#fc0ce4] rounded-full animate-spin" />
    </div>
  );
}
