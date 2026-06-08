'use client';

import { useEffect } from 'react';
import { useUser } from '../../../context/UserContext';
import StudentInvoices from '../../../views/StudentInvoices';
import { useRouter } from 'next/navigation';

export default function InvoicesPage() {
  const { user } = useUser();
  const router = useRouter();

  const perm = user?.systemRole?.permissions?.find(p => p.module === 'invoices');
  const isDeactivated = perm?.actions?.includes('deactivate') ?? false;
  const hasGrant = !isDeactivated && (perm?.actions?.some(a => ['read','create','update','delete'].includes(a)) ?? false);
  const canView = !isDeactivated && (user?.role === 'student' || hasGrant);

  useEffect(() => {
    if (user && !canView) router.replace('/dashboard');
  }, [user, canView, router]);

  if (!user || !canView) return null;
  return <StudentInvoices />;
}
