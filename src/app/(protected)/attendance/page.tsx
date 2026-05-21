'use client';

import { useUser } from '../../../context/UserContext';
import Attendance from '../../../views/Attendance';
import StudentAttendance from '../../../views/StudentAttendance';
import { useRouter } from 'next/navigation';

export default function AttendancePage() {
  const { user } = useUser();
  const router = useRouter();
  if (user?.role === 'admin') return <Attendance />;
  if (user?.role === 'student') return <StudentAttendance />;
  if (user?.role === 'teacher') { router.replace('/dashboard'); return null; }
  return null;
}
