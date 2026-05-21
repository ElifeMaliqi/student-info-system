'use client';

import { useUser } from '../../../context/UserContext';
import Settings from '../../../views/Settings';

export default function SettingsPage() {
  const { user } = useUser();
  if (!user) return null;
  return <Settings role={user.role} />;
}
