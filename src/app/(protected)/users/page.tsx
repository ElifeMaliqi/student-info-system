'use client';

import { useEffect } from 'react';
import { useUser } from '../../../context/UserContext';
import RegistrationApplications from '../../../views/RegistrationApplications';
import { useRouter } from 'next/navigation';

export default function UsersPage() {
  const { user } = useUser();
  const router = useRouter();

  const perm = user?.systemRole?.permissions?.find(p => p.module === 'registrations');
  const isDeactivated = perm?.actions?.includes('deactivate') ?? false;
  const hasGrant = !isDeactivated && (perm?.actions?.some(a => ['read','create','update','delete'].includes(a)) ?? false);
  // Admins never get this page (superadmin-only "Users"), even with a role grant.
  const canView = !isDeactivated && user?.role !== 'admin' && (user?.role === 'superadmin' || hasGrant);

  useEffect(() => {
    if (user && !canView) router.replace('/dashboard');
  }, [user, canView, router]);

  if (!user || !canView) return null;
  return <RegistrationApplications />;
}
