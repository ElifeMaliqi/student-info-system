'use client';

import { useUser } from '../../../context/UserContext';
import TeacherClasses from '../../../views/TeacherClasses';
import { useRouter } from 'next/navigation';

export default function ClassesPage() {
  const { user } = useUser();
  const router = useRouter();
  if (user?.role === 'teacher') return <TeacherClasses />;
  router.replace('/dashboard');
  return null;
}
