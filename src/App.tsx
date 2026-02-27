/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
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
import RegistrationApplications from './pages/RegistrationApplications';
import { LanguageProvider } from './context/LanguageContext';
import { supabase } from './lib/supabase';
import { User } from './types';

function AppContent() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [role, setRole] = useState<'admin' | 'teacher' | 'student'>('admin');
  const navigate = useNavigate();

  useEffect(() => {
    checkAuth();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        await loadUserProfile(session.user.id);
      } else if (event === 'SIGNED_OUT') {
        setIsAuthenticated(false);
        setCurrentUser(null);
        setRole('admin');
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const checkAuth = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await loadUserProfile(session.user.id);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadUserProfile = async (userId: string) => {
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) throw error;

      if (profile) {
        const user: User = {
          id: profile.id,
          email: profile.email,
          firstName: profile.first_name,
          lastName: profile.last_name,
          role: profile.role,
          avatar: profile.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile.email}`
        };

        setCurrentUser(user);
        setRole(profile.role);
        setIsAuthenticated(true);
      }
    } catch (error) {
      console.error('Failed to load profile:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="text-white/50">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Login onLogin={async (selectedRole) => {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          await loadUserProfile(session.user.id);
          navigate('/dashboard', { replace: true });
        }
      }} />
    );
  }

  return (
    <AdminLayout
      onLogout={async () => {
        await supabase.auth.signOut();
        setIsAuthenticated(false);
        setCurrentUser(null);
        navigate('/', { replace: true });
      }}
      role={role}
      setRole={setRole}
      currentUser={currentUser}
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
            <Route path="/registrations" element={<RegistrationApplications />} />
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
