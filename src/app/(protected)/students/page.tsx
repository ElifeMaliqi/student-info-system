'use client';

import { useEffect } from 'react';
import { useUser } from '../../../context/UserContext';
import Students from '../../../views/Students';
import TeacherStudents from '../../../views/TeacherStudents';
import { useRouter } from 'next/navigation';

export default function StudentsPage() {
  const { user } = useUser();
  const router = useRouter();

  const perm = user?.systemRole?.permissions?.find(p => p.module === 'users');
  const isDeactivated = perm?.actions?.includes('deactivate') ?? false;
  const hasGrant = !isDeactivated && (perm?.actions?.some(a => ['read','create','update','delete'].includes(a)) ?? false);
  const defaultAccess = user?.role === 'admin' || user?.role === 'superadmin' || user?.role === 'teacher';
  const canView = !isDeactivated && (defaultAccess || hasGrant);

  useEffect(() => {
    if (user && !canView) router.replace('/dashboard');
  }, [user, canView, router]);

  if (!user || !canView) return null;
  if (user.role === 'admin' || user.role === 'superadmin') return <Students />;
  if (user.role === 'teacher') return <TeacherStudents />;
  return <Students />;
}
