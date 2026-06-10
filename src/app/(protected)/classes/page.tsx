'use client';

import { useEffect } from 'react';
import { useUser } from '../../../context/UserContext';
import { AdminClasses } from '../../../views/AdminClasses';
import TeacherClasses from '../../../views/TeacherClasses';
import { useRouter } from 'next/navigation';

export default function ClassesPage() {
  const { user } = useUser();
  const router = useRouter();

  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';
  const perm = user?.systemRole?.permissions?.find(p => p.module === 'classes');
  const isDeactivated = perm?.actions?.includes('deactivate') ?? false;
  const hasGrant = !isDeactivated && (perm?.actions?.some(a => ['read', 'create', 'update', 'delete'].includes(a)) ?? false);
  const canView = !isDeactivated && (isAdmin || user?.role === 'teacher' || hasGrant);

  useEffect(() => {
    if (user && !canView) router.replace('/dashboard');
  }, [user, canView, router]);

  if (!user || !canView) return null;
  if (isAdmin) return <AdminClasses />;
  return <TeacherClasses />;
}
