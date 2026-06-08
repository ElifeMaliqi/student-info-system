'use client';

import { useEffect } from 'react';
import { useUser } from '../../../context/UserContext';
import Attendance from '../../../views/Attendance';
import StudentAttendance from '../../../views/StudentAttendance';
import { useRouter } from 'next/navigation';

export default function AttendancePage() {
  const { user } = useUser();
  const router = useRouter();

  const perm = user?.systemRole?.permissions?.find(p => p.module === 'attendance');
  const isDeactivated = perm?.actions?.includes('deactivate') ?? false;
  const hasGrant = !isDeactivated && (perm?.actions?.some(a => ['read','create','update','delete'].includes(a)) ?? false);
  const defaultAccess = user?.role === 'admin' || user?.role === 'superadmin' || user?.role === 'student';
  const canView = !isDeactivated && (defaultAccess || hasGrant);

  useEffect(() => {
    if (user && !canView) router.replace('/dashboard');
  }, [user, canView, router]);

  if (!user || !canView) return null;
  if (user.role === 'admin' || user.role === 'superadmin') return <Attendance />;
  if (user.role === 'student') return <StudentAttendance />;
  return <Attendance />;
}
