export type Role = 'admin' | 'teacher' | 'student';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  avatar?: string;
}

export interface Student {
  id: string;
  name: string;
  email: string;
  program: string;
  status: 'Active' | 'Pending' | 'Suspended' | 'Graduated';
  date: string; // Enrollment date
  avatar?: string;
  phone?: string;
  parentPhone?: string;
  gender?: string;
}

export interface Teacher {
  id: string;
  name: string;
  email: string;
  department: string;
  avatar?: string;
}

export interface Invoice {
  id: string;
  studentId: string;
  amount: string;
  status: 'Paid' | 'Pending' | 'Overdue';
  date: string;
  due: string;
}

export interface Quiz {
  id: string;
  title: string;
  program: string;
  submissions: string;
  date: string;
  status: 'Completed' | 'Grading' | 'Scheduled';
}

export interface DashboardStats {
  label: string;
  value: string;
  trend: string;
  icon: any; // Lucide icon component
  color: string;
}
