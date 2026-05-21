'use client';

import { useUser } from '../../../context/UserContext';
import Announcements from '../../../views/Announcements';

export default function AnnouncementsPage() {
  const { user } = useUser();
  if (!user) return null;
  return <Announcements role={user.role} />;
}
