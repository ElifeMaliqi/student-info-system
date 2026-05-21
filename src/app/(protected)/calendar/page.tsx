'use client';

import { useUser } from '../../../context/UserContext';
import AdminCalendar from '../../../views/AdminCalendar';
import TeacherCalendar from '../../../views/TeacherCalendar';
import StudentCalendar from '../../../views/StudentCalendar';

export default function CalendarPage() {
  const { user } = useUser();
  if (user?.role === 'admin') return <AdminCalendar />;
  if (user?.role === 'teacher') return <TeacherCalendar />;
  if (user?.role === 'student') return <StudentCalendar />;
  return null;
}
