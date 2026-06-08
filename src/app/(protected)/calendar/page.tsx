'use client';

import { useEffect } from 'react';
import { useUser } from '../../../context/UserContext';
import AdminCalendar from '../../../views/AdminCalendar';
import TeacherCalendar from '../../../views/TeacherCalendar';
import StudentCalendar from '../../../views/StudentCalendar';
import { useRouter } from 'next/navigation';

export default function CalendarPage() {
  const { user } = useUser();
  const router = useRouter();

  const perm = user?.systemRole?.permissions?.find(p => p.module === 'calendar');
  const isDeactivated = perm?.actions?.includes('deactivate') ?? false;
  const hasGrant = !isDeactivated && (perm?.actions?.some(a => ['read','create','update','delete'].includes(a)) ?? false);
  const defaultAccess = user?.role === 'admin' || user?.role === 'superadmin' || user?.role === 'teacher' || user?.role === 'student';
  const canView = !isDeactivated && (defaultAccess || hasGrant);

  useEffect(() => {
    if (user && !canView) router.replace('/dashboard');
  }, [user, canView, router]);

  if (!user || !canView) return null;
  if (user.role === 'admin' || user.role === 'superadmin') return <AdminCalendar />;
  if (user.role === 'teacher') return <TeacherCalendar />;
  return <StudentCalendar />;
}
