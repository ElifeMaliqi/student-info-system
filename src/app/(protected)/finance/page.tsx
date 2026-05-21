'use client';

import { useUser } from '../../../context/UserContext';
import Finance from '../../../views/Finance';
import { useRouter } from 'next/navigation';

export default function FinancePage() {
  const { user } = useUser();
  const router = useRouter();
  if (user?.role === 'admin') return <Finance />;
  router.replace('/dashboard');
  return null;
}
