'use client';

import { useUser } from '../../../context/UserContext';
import AdminGrades from '../../../views/AdminGrades';
import StudentGrades from '../../../views/StudentGrades';
import { useRouter } from 'next/navigation';

export default function GradesPage() {
  const { user } = useUser();
  const router = useRouter();
  if (user?.role === 'admin') return <AdminGrades />;
  if (user?.role === 'student') return <StudentGrades />;
  if (user?.role === 'teacher') { router.replace('/dashboard'); return null; }
  return null;
}
