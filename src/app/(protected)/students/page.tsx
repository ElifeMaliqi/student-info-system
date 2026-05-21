'use client';

import { useUser } from '../../../context/UserContext';
import Students from '../../../views/Students';
import TeacherStudents from '../../../views/TeacherStudents';
import { useRouter } from 'next/navigation';

export default function StudentsPage() {
  const { user } = useUser();
  const router = useRouter();
  if (user?.role === 'admin') return <Students />;
  if (user?.role === 'teacher') return <TeacherStudents />;
  // Students don't have a students list page — redirect to dashboard
  if (user?.role === 'student') { router.replace('/dashboard'); return null; }
  return null;
}
