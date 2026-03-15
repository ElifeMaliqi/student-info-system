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
  date: string;
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
  studentName?: string;
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
  totalPoints?: number;
  duration?: number;
}

export interface DashboardStats {
  label: string;
  value: string;
  trend: string;
  icon: any;
  color: string;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  audience: 'all' | 'students' | 'teachers' | 'admins' | 'program_specific' | 'class_specific';
  program?: string;
  programId?: string;
  classId?: string;
  className?: string;
  author: string;
  authorRole?: string;
  date: string;
  startDate?: string;
  endDate?: string;
}

export interface AttendanceRecord {
  id: string;
  studentId: string;
  studentName?: string;
  date: string;
  status: 'present' | 'absent' | 'late' | 'excused';
  checkIn?: string;
  checkOut?: string;
  notes?: string;
}

export interface Grade {
  id: string;
  studentId: string;
  studentName?: string;
  subject: string;
  assignment: string;
  grade: number;
  maxGrade: number;
  letterGrade?: string;
  date: string;
  feedback?: string;
}

export interface Program {
  id: string;
  name: string;
  description?: string;
  duration: number;
  price: number;
  capacity: number;
  enrolled: number;
  color?: string;
}

export interface RegistrationApplication {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  passwordHash: string;
  role: 'teacher' | 'student';
  program?: string;
  parentFirstName?: string;
  phone?: string;
  dateOfBirth?: string;
  address?: string;
  city?: string;
  country?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  specialization?: string;
  qualifications?: string;
  experienceYears?: number;
  idDocumentUrl?: string;
  status: 'pending' | 'approved' | 'rejected';
  notes?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt?: string;
}

export interface CalendarParticipant {
  id: string;
  event_id: string;
  user_id: string;
  rsvp_status?: 'attending' | 'pending' | 'declined';
  profile?: {
    firstName: string;
    lastName: string;
    email: string;
    avatar?: string;
    role?: string;
  };
}

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  start_time: string;
  end_time: string;
  all_day: boolean;
  color: string;
  event_type: 'meeting' | 'class' | 'personal' | 'holiday';
  created_by: string;
  /** Populated for class events — the UUID of the class in the classes table */
  class_id?: string;
  creator_profile?: {
    firstName: string;
    lastName: string;
    email: string;
    avatar?: string;
  };
  participants?: CalendarParticipant[];
}

export interface ClassSession {
  id: string;
  class_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
}

export interface Class {
  id: string;
  program_id: string;
  title: string;
  teacher_id: string;
  teacher?: {
    firstName: string;
    lastName: string;
    email: string;
    avatar?: string;
  };
  sessions?: ClassSession[];
  enrollmentCount?: number;
  created_at?: string;
  updated_at?: string;
}

export interface ClassEnrollment {
  id: string;
  class_id: string;
  student_id: string;
  enrolled_at: string;
  status: 'active' | 'dropped' | 'completed';
  student?: {
    firstName: string;
    lastName: string;
    email: string;
    avatar?: string;
  };
}
