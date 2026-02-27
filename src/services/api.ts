import { Student, User, Role, Invoice, Quiz } from '../types';
import { supabase } from '../lib/supabase';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const api = {
  auth: {
    login: async (email: string, password: string, requestedRole: Role): Promise<{ user: User, token: string }> => {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw new Error(error.message);
      }

      if (!data.user || !data.session) {
        throw new Error('Authentication failed');
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .maybeSingle();

      if (profileError) {
        throw new Error(profileError.message);
      }

      if (!profile) {
        throw new Error('User profile not found');
      }

      if (profile.role !== requestedRole) {
        await supabase.auth.signOut();
        throw new Error(`Access denied. This login is for ${requestedRole}s only.`);
      }

      return {
        user: {
          id: profile.id,
          email: data.user.email!,
          firstName: profile.first_name,
          lastName: profile.last_name,
          role: profile.role as Role,
          avatar: profile.avatar_url || `https://picsum.photos/seed/${profile.id}/100/100`
        },
        token: data.session.access_token
      };
    },
    logout: async (): Promise<void> => {
      const { error } = await supabase.auth.signOut();
      if (error) {
        throw new Error(error.message);
      }
    }
  },

  students: {
    getAll: async (page = 1, limit = 10, search = ''): Promise<{ data: Student[], total: number }> => {
      await delay(800);
      // Mock data
      const mockStudents: Student[] = [
        { id: 'STU-001', name: 'Elena Rodriguez', email: 'elena.r@example.com', program: 'UI/UX Creative Designer', status: 'Active', date: 'Feb 23, 2026', avatar: 'https://picsum.photos/seed/elena/100/100' },
        { id: 'STU-002', name: 'Marcus Chen', email: 'marcus.c@example.com', program: 'Web Development', status: 'Pending', date: 'Feb 23, 2026', avatar: 'https://picsum.photos/seed/marcus/100/100' },
        { id: 'STU-003', name: 'Sarah Jenkins', email: 'sarah.j@example.com', program: 'Cybersecurity', status: 'Active', date: 'Feb 22, 2026', avatar: 'https://picsum.photos/seed/sarah/100/100' },
        { id: 'STU-004', name: 'David Kim', email: 'david.k@example.com', program: 'UAV Engineering Degree', status: 'Active', date: 'Feb 20, 2026', avatar: 'https://picsum.photos/seed/david/100/100' },
        { id: 'STU-005', name: 'James Wilson', email: 'james.w@example.com', program: 'Internet of Things (UAV/IoT)', status: 'Active', date: 'Feb 18, 2026', avatar: 'https://picsum.photos/seed/james/100/100' },
        { id: 'STU-006', name: 'Nina Costa', email: 'nina.c@example.com', program: '3D Creative Artist', status: 'Active', date: 'Feb 19, 2026', avatar: 'https://picsum.photos/seed/nina/100/100' },
      ];
      return { data: mockStudents, total: 142 };
    },
    
    create: async (studentData: Partial<Student>): Promise<Student> => {
      await delay(1200);
      return {
        id: `STU-00${Math.floor(Math.random() * 1000)}`,
        ...studentData,
        status: 'Pending',
        date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      } as Student;
    }
  },

  finance: {
    getInvoices: async (): Promise<Invoice[]> => {
      await delay(600);
      return [
        { id: 'INV-2026-001', studentId: 'STU-001', amount: '$1,200', status: 'Pending', date: 'Feb 01, 2026', due: 'Mar 01, 2026' },
        { id: 'INV-2025-012', studentId: 'STU-002', amount: '$1,200', status: 'Paid', date: 'Jan 01, 2026', due: 'Jan 15, 2026' },
      ];
    }
  },

  teacher: {
    getQuizzes: async (): Promise<Quiz[]> => {
      await delay(700);
      return [
        { id: 'QZ-101', title: 'UI/UX Fundamentals Midterm', program: 'UI/UX Creative Designer', submissions: '24/28', date: 'Feb 20, 2026', status: 'Grading' },
        { id: 'QZ-102', title: 'Component Architecture', program: 'Web Development', submissions: '18/18', date: 'Feb 15, 2026', status: 'Completed' },
      ];
    }
  }
};
