'use client';

import { useUser } from '../../../context/UserContext';
import TeacherGrading from '../../../views/TeacherGrading';
import { useRouter } from 'next/navigation';

export default function GradingPage() {
  const { user } = useUser();
  const router = useRouter();
  if (user?.role === 'teacher') return <TeacherGrading />;
  router.replace('/dashboard');
  return null;
}
