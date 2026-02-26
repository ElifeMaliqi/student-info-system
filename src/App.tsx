/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import Login from './pages/Login';
import AdminLayout from './layouts/AdminLayout';
import Dashboard from './pages/Dashboard';
import Students from './pages/Students';
import Attendance from './pages/Attendance';
import Finance from './pages/Finance';
import Settings from './pages/Settings';
import StudentDashboard from './pages/StudentDashboard';
import TeacherDashboard from './pages/TeacherDashboard';
import StudentGrades from './pages/StudentGrades';
import StudentInvoices from './pages/StudentInvoices';
import TeacherQuizzes from './pages/TeacherQuizzes';
import TeacherStudents from './pages/TeacherStudents';
import Announcements from './pages/Announcements';
import AdminPrograms from './pages/AdminPrograms';
import StudentProfile from './pages/StudentProfile';
import { LanguageProvider } from './context/LanguageContext';

function AppContent() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [role, setRole] = useState<'admin' | 'teacher' | 'student'>('admin');
  const navigate = useNavigate();

  if (!isAuthenticated) {
    return (
      <Login onLogin={(selectedRole) => {
        setRole(selectedRole as 'admin' | 'teacher' | 'student');
        setIsAuthenticated(true);
        navigate('/dashboard', { replace: true });
      }} />
    );
  }

  return (
    <AdminLayout 
      onLogout={() => {
        setIsAuthenticated(false);
        navigate('/', { replace: true });
      }}
      role={role}
      setRole={setRole}
    >
      <Routes>
        {role === 'admin' && (
          <>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/students" element={<Students />} />
            <Route path="/students/:id" element={<StudentProfile />} />
            <Route path="/programs" element={<AdminPrograms />} />
            <Route path="/attendance" element={<Attendance />} />
            <Route path="/finance" element={<Finance />} />
            <Route path="/announcements" element={<Announcements role={role} />} />
            <Route path="/settings" element={<Settings role={role} />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </>
        )}

        {role === 'teacher' && (
          <>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<TeacherDashboard />} />
            <Route path="/quizzes" element={<TeacherQuizzes />} />
            <Route path="/students" element={<TeacherStudents />} />
            <Route path="/students/:id" element={<StudentProfile />} />
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
            <Route path="/invoices" element={<StudentInvoices />} />
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
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </LanguageProvider>
  );
}
