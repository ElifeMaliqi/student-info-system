'use client';

import { useUser } from '../../../context/UserContext';
import Dashboard from '../../../views/Dashboard';
import TeacherDashboard from '../../../views/TeacherDashboard';
import StudentDashboard from '../../../views/StudentDashboard';

export default function DashboardPage() {
  const { user } = useUser();
  if (user?.role === 'admin') return <Dashboard />;
  if (user?.role === 'teacher') return <TeacherDashboard />;
  if (user?.role === 'student') return <StudentDashboard />;
  return null;
}
