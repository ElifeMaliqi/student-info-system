'use client';

import { useRouter } from 'next/navigation';
import PublicRegistration from '../../views/PublicRegistration';

export default function RegisterPage() {
  const router = useRouter();
  return <PublicRegistration onBack={() => router.push('/auth')} />;
}
