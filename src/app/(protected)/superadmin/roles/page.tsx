'use client';

import { useEffect } from 'react';
import { useUser } from '@/context/UserContext';
import SuperAdminRoles from '@/views/SuperAdminRoles';
import { useRouter } from 'next/navigation';

export default function RolesPage() {
  const { user } = useUser();
  const router = useRouter();
  const canView = user?.role === 'superadmin';

  useEffect(() => {
    if (user && !canView) router.replace('/dashboard');
  }, [user, canView, router]);

  if (!user || !canView) return null;
  return <SuperAdminRoles />;
}
