/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import Login from './pages/Login';
import PublicRegistration from './pages/PublicRegistration';
import AdminLayout from './layouts/AdminLayout';
import Dashboard from './pages/Dashboard';
import Students from './pages/Students';
import Attendance from './pages/Attendance';
import Finance from './pages/Finance';
import Settings from './pages/Settings';
import StudentDashboard from './pages/StudentDashboard';
import TeacherDashboard from './pages/TeacherDashboard';
import StudentGrades from './pages/StudentGrades';
import StudentAttendance from './pages/StudentAttendance';
import StudentInvoices from './pages/StudentInvoices';
import TeacherGrading from './pages/TeacherGrading';
import TeacherStudents from './pages/TeacherStudents';
import TeacherClasses from './pages/TeacherClasses';
import TeacherCalendar from './pages/TeacherCalendar';
import StudentCalendar from './pages/StudentCalendar';
import Announcements from './pages/Announcements';
import AdminPrograms from './pages/AdminPrograms';
import AdminGrades from './pages/AdminGrades';
import StudentProfile from './pages/StudentProfile';
import RegistrationApplications from './pages/RegistrationApplications';
import ResetPassword from './pages/ResetPassword';
import AdminCalendar from './pages/AdminCalendar';
import ForcePasswordChange from './pages/ForcePasswordChange';
import { LanguageProvider } from './context/LanguageContext';
import { UserProvider, useUser } from './context/UserContext';
import { supabase } from './lib/supabase';

function AppContent() {
  const { user, ready, setUser } = useUser();
  const navigate = useNavigate();
  const location = useLocation();
  const role = user?.role;
  const canonicalPages = [
    'dashboard',
    'students',
    'programs',
    'attendance',
    'finance',
    'announcements',
    'registrations',
    'calendar',
    'settings',
    'classes',
    'grading',
    'grades',
    'invoices',
  ];

  if (!ready) {
    return (
      <div className="min-h-screen w-full bg-[#050505] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-white/10 border-t-[#fc0ce4] rounded-full animate-spin" />
      </div>
    );
  }

  if (!user || !role) {
    const path = location.pathname;

    if (path === '/resetpassword') {
      return <ResetPassword />;
    }

    if (path === '/register' || path === '/signup' || path === '/apply') {
      return <PublicRegistration onBack={() => navigate('/auth', { replace: true })} />;
    }

    if (path === '/' || path === '/auth' || path === '/login' || path === '/signin') {
      return (
        <Login onLogin={() => {
          navigate('/dashboard', { replace: true });
        }} />
      );
    }

    return <Navigate to="/auth" replace />;
  }

  if (
    location.pathname === '/auth' ||
    location.pathname === '/login' ||
    location.pathname === '/signin' ||
    location.pathname === '/register' ||
    location.pathname === '/signup' ||
    location.pathname === '/apply'
  ) {
    return <Navigate to="/dashboard" replace />;
  }

  if (user.mustChangePassword) {
    return <ForcePasswordChange />;
  }

  return (
    <AdminLayout 
      onLogout={async () => {
        await supabase.auth.signOut();
        setUser(null);
        navigate('/auth', { replace: true });
      }}
      role={role}
    >
      <Routes>
        <Route
          path="/admin/:page"
          element={canonicalPages.includes((location.pathname.split('/')[2] || '').toLowerCase()) ? <Navigate to={`/${location.pathname.split('/')[2]}`} replace /> : <Navigate to="/dashboard" replace />}
        />
        <Route
          path="/teacher/:page"
          element={canonicalPages.includes((location.pathname.split('/')[2] || '').toLowerCase()) ? <Navigate to={`/${location.pathname.split('/')[2]}`} replace /> : <Navigate to="/dashboard" replace />}
        />
        <Route
          path="/student/:page"
          element={canonicalPages.includes((location.pathname.split('/')[2] || '').toLowerCase()) ? <Navigate to={`/${location.pathname.split('/')[2]}`} replace /> : <Navigate to="/dashboard" replace />}
        />

        {role === 'admin' && (
          <>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/students" element={<Students />} />
            <Route path="/students/:id" element={<StudentProfile />} />
            <Route path="/programs" element={<AdminPrograms />} />
            <Route path="/attendance" element={<Attendance />} />
            <Route path="/grades" element={<AdminGrades />} />
            <Route path="/finance" element={<Finance />} />
            <Route path="/announcements" element={<Announcements role={role} />} />
            <Route path="/registrations" element={<RegistrationApplications />} />
            <Route path="/calendar" element={<AdminCalendar />} />
            <Route path="/settings" element={<Settings role={role} />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </>
        )}

        {role === 'teacher' && (
          <>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<TeacherDashboard />} />
            <Route path="/classes" element={<TeacherClasses />} />
            <Route path="/grading" element={<TeacherGrading />} />
            <Route path="/students" element={<TeacherStudents />} />
            <Route path="/students/:id" element={<StudentProfile />} />
            <Route path="/calendar" element={<TeacherCalendar />} />
            <Route path="/announcements" element={<Announcements role={role} />} />
            <Route path="/settings" element={<Settings role={role} />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </>
        )}

        {role === 'student' && (
          <>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<StudentDashboard />} />
            <Route path="/grades" element={<StudentGrades />} />
            <Route path="/attendance" element={<StudentAttendance />} />
            <Route path="/invoices" element={<StudentInvoices />} />
            <Route path="/calendar" element={<StudentCalendar />} />
            <Route path="/announcements" element={<Announcements role={role} />} />
            <Route path="/settings" element={<Settings role={role} />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </>
        )}
      </Routes>
    </AdminLayout>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <UserProvider>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
      </UserProvider>
    </LanguageProvider>
  );
}
