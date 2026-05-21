'use client';

import { useUser } from '../../../context/UserContext';
import StudentInvoices from '../../../views/StudentInvoices';
import { useRouter } from 'next/navigation';

export default function InvoicesPage() {
  const { user } = useUser();
  const router = useRouter();
  if (user?.role === 'student') return <StudentInvoices />;
  router.replace('/dashboard');
  return null;
}
