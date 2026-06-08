'use client';

import { useEffect } from 'react';
import { useUser } from '../../../context/UserContext';
import AdminGrades from '../../../views/AdminGrades';
import StudentGrades from '../../../views/StudentGrades';
import { useRouter } from 'next/navigation';

export default function GradesPage() {
  const { user } = useUser();
  const router = useRouter();

  const perm = user?.systemRole?.permissions?.find(p => p.module === 'grades');
  const isDeactivated = perm?.actions?.includes('deactivate') ?? false;
  const hasGrant = !isDeactivated && (perm?.actions?.some(a => ['read','create','update','delete'].includes(a)) ?? false);
  const defaultAccess = user?.role === 'admin' || user?.role === 'superadmin' || user?.role === 'student';
  const canView = !isDeactivated && (defaultAccess || hasGrant);

  useEffect(() => {
    if (user && !canView) router.replace('/dashboard');
  }, [user, canView, router]);

  if (!user || !canView) return null;
  if (user.role === 'admin' || user.role === 'superadmin') return <AdminGrades />;
  if (user.role === 'student') return <StudentGrades />;
  return <AdminGrades />;
}
