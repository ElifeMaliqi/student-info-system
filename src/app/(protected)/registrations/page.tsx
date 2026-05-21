'use client';

import { useUser } from '../../../context/UserContext';
import RegistrationApplications from '../../../views/RegistrationApplications';
import { useRouter } from 'next/navigation';

export default function RegistrationsPage() {
  const { user } = useUser();
  const router = useRouter();
  if (user?.role === 'admin') return <RegistrationApplications />;
  router.replace('/dashboard');
  return null;
}
