'use client';

import { useEffect } from 'react';
import { useUser } from '../../../context/UserContext';
import Teachers from '../../../views/Teachers';
import { useRouter } from 'next/navigation';

export default function TeachersPage() {
  const { user } = useUser();
  const router = useRouter();

  // Admin dashboard only. Governed by the same 'users' permission as Students, so a
  // system role that switches off Students hides this page too.
  const perm = user?.systemRole?.permissions?.find(p => p.module === 'users');
  const isDeactivated = perm?.actions?.includes('deactivate') ?? false;
  const canView = !isDeactivated && (user?.role === 'admin' || user?.role === 'superadmin');

  useEffect(() => {
    if (user && !canView) router.replace('/dashboard');
  }, [user, canView, router]);

  if (!user || !canView) return null;
  return <Teachers />;
}
