'use client';

import { useEffect } from 'react';
import { useUser } from '../../../context/UserContext';
import TeacherGrading from '../../../views/TeacherGrading';
import { useRouter } from 'next/navigation';

export default function GradingPage() {
  const { user } = useUser();
  const router = useRouter();

  const canView = user?.role === 'teacher';

  useEffect(() => {
    if (user && !canView) router.replace('/dashboard');
  }, [user, canView, router]);

  if (!user || !canView) return null;
  return <TeacherGrading />;
}
