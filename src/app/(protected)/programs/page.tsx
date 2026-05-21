'use client';

import { useUser } from '../../../context/UserContext';
import AdminPrograms from '../../../views/AdminPrograms';
import { useRouter } from 'next/navigation';

export default function ProgramsPage() {
  const { user } = useUser();
  const router = useRouter();
  if (user?.role === 'admin') return <AdminPrograms />;
  router.replace('/dashboard');
  return null;
}
