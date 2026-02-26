import { Student, User, Role, Invoice, Quiz } from '../types';

// ============================================================================
// BACKEND TEAM INSTRUCTIONS:
// 1. Replace the `delay` mock logic with actual `fetch` or `axios` calls.
// 2. Set up your base URL (e.g., const BASE_URL = import.meta.env.VITE_API_URL).
// 3. Add JWT token handling in an interceptor or headers.
// ============================================================================

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const api = {
  auth: {
    login: async (email: string, password: string, requestedRole: Role): Promise<{ user: User, token: string }> => {
      await delay(1000); // Simulate network latency
      
      // Mock successful login
      return {
        user: {
          id: 'USR-123',
          email,
          firstName: 'Admin',
          lastName: 'User',
          role: requestedRole,
          avatar: 'https://picsum.photos/seed/admin/100/100'
        },
        token: 'mock_jwt_token_12345'
      };
    },
    logout: async (): Promise<void> => {
      await delay(500);
      // Clear tokens here
    }
  },

  students: {
    getAll: async (page = 1, limit = 10, search = ''): Promise<{ data: Student[], total: number }> => {
      await delay(800);
      // Mock data
      const mockStudents: Student[] = [
        { id: 'STU-001', name: 'Elena Rodriguez', email: 'elena.r@example.com', program: 'UI/UX Creative Designer', status: 'Active', date: 'Feb 23, 2026', avatar: 'https://picsum.photos/seed/elena/100/100' },
        { id: 'STU-002', name: 'Marcus Chen', email: 'marcus.c@example.com', program: 'Web Development', status: 'Pending', date: 'Feb 23, 2026', avatar: 'https://picsum.photos/seed/marcus/100/100' },
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
