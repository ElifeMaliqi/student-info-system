import { Student, User, Role, Invoice, Quiz, Announcement, AttendanceRecord, Grade, Program, RegistrationApplication } from '../types';
import { supabase } from '../lib/supabase';

const formatDate = (date: string) => {
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const statusMap: Record<string, 'Active' | 'Pending' | 'Suspended' | 'Graduated'> = {
  'active': 'Active',
  'inactive': 'Suspended',
  'graduated': 'Graduated',
  'suspended': 'Suspended'
};

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
          avatar: profile.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile.email}`
        },
        token: data.session.access_token
      };
    },

    register: async (applicationData: Omit<RegistrationApplication, 'id' | 'status' | 'created_at' | 'updated_at'>): Promise<void> => {
      const { data: existingUser } = await supabase
        .from('profiles')
        .select('email')
        .eq('email', applicationData.email)
        .maybeSingle();

      if (existingUser) {
        throw new Error('This email is already registered');
      }

      const { data: existingApp } = await supabase
        .from('registration_applications')
        .select('email')
        .eq('email', applicationData.email)
        .maybeSingle();

      if (existingApp) {
        throw new Error('An application with this email is already pending');
      }

      const { error } = await supabase
        .from('registration_applications')
        .insert([applicationData]);

      if (error) {
        throw new Error(error.message);
      }
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
      let query = supabase
        .from('students')
        .select(`
          *,
          user:profiles!students_user_id_fkey(first_name, last_name, email, avatar_url),
          program:programs!students_program_id_fkey(name)
        `, { count: 'exact' });

      if (search) {
        query = query.or(`student_id.ilike.%${search}%,user.first_name.ilike.%${search}%,user.last_name.ilike.%${search}%,user.email.ilike.%${search}%`);
      }

      const { data, error, count } = await query
        .range((page - 1) * limit, page * limit - 1)
        .order('created_at', { ascending: false });

      if (error) throw new Error(error.message);

      const students: Student[] = (data || []).map(s => ({
        id: s.student_id || `STU-${s.id.slice(0, 8)}`,
        name: s.user ? `${s.user.first_name} ${s.user.last_name}` : 'Unknown',
        email: s.user?.email || '',
        program: s.program?.name || 'No Program',
        status: statusMap[s.status] || 'Pending',
        date: formatDate(s.enrollment_date || s.created_at),
        avatar: s.user?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${s.id}`,
        phone: s.user?.phone,
        gender: s.gender
      }));

      return { data: students, total: count || 0 };
    },

    create: async (studentData: Partial<Student>): Promise<Student> => {
      throw new Error('Direct student creation is disabled. Use registration application instead.');
    },

    getById: async (userId: string) => {
      const { data, error } = await supabase
        .from('students')
        .select(`
          *,
          user:profiles!students_user_id_fkey(*),
          program:programs!students_program_id_fkey(*)
        `)
        .eq('user_id', userId)
        .maybeSingle();

      if (error) throw new Error(error.message);
      return data;
    }
  },

  finance: {
    getInvoices: async (studentId?: string): Promise<Invoice[]> => {
      let query = supabase
        .from('invoices')
        .select(`
          *,
          student:students!invoices_student_id_fkey(
            student_id,
            user:profiles!students_user_id_fkey(first_name, last_name)
          )
        `)
        .order('created_at', { ascending: false });

      if (studentId) {
        const { data: student } = await supabase
          .from('students')
          .select('id')
          .eq('user_id', studentId)
          .maybeSingle();

        if (student) {
          query = query.eq('student_id', student.id);
        }
      }

      const { data, error } = await query;

      if (error) throw new Error(error.message);

      return (data || []).map(inv => ({
        id: inv.invoice_number || `INV-${inv.id.slice(0, 8)}`,
        studentId: inv.student?.student_id || '',
        studentName: inv.student?.user ? `${inv.student.user.first_name} ${inv.student.user.last_name}` : '',
        amount: `$${parseFloat(inv.amount).toFixed(2)}`,
        status: inv.status === 'paid' ? 'Paid' : inv.status === 'overdue' ? 'Overdue' : 'Pending',
        date: formatDate(inv.issue_date),
        due: formatDate(inv.due_date)
      }));
    },

    getPayments: async (studentId?: string) => {
      let query = supabase
        .from('payments')
        .select(`
          *,
          student:students!payments_student_id_fkey(
            student_id,
            user:profiles!students_user_id_fkey(first_name, last_name)
          ),
          invoice:invoices!payments_invoice_id_fkey(invoice_number)
        `)
        .order('payment_date', { ascending: false });

      if (studentId) {
        const { data: student } = await supabase
          .from('students')
          .select('id')
          .eq('user_id', studentId)
          .maybeSingle();

        if (student) {
          query = query.eq('student_id', student.id);
        }
      }

      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return data || [];
    }
  },

  attendance: {
    getAll: async (studentId?: string): Promise<AttendanceRecord[]> => {
      let query = supabase
        .from('attendance')
        .select(`
          *,
          student:students!attendance_student_id_fkey(
            student_id,
            user:profiles!students_user_id_fkey(first_name, last_name)
          )
        `)
        .order('date', { ascending: false });

      if (studentId) {
        const { data: student } = await supabase
          .from('students')
          .select('id')
          .eq('user_id', studentId)
          .maybeSingle();

        if (student) {
          query = query.eq('student_id', student.id);
        }
      }

      const { data, error } = await query;
      if (error) throw new Error(error.message);

      return (data || []).map(att => ({
        id: att.id,
        studentId: att.student?.student_id || '',
        studentName: att.student?.user ? `${att.student.user.first_name} ${att.student.user.last_name}` : '',
        date: formatDate(att.date),
        status: att.status,
        checkIn: att.check_in_time,
        checkOut: att.check_out_time,
        notes: att.notes
      }));
    },

    create: async (record: Omit<AttendanceRecord, 'id'>) => {
      const { data: student } = await supabase
        .from('students')
        .select('id')
        .eq('student_id', record.studentId)
        .maybeSingle();

      if (!student) throw new Error('Student not found');

      const { data: user } = await supabase.auth.getUser();

      const { error } = await supabase
        .from('attendance')
        .insert([{
          student_id: student.id,
          date: new Date().toISOString().split('T')[0],
          status: record.status,
          check_in_time: record.checkIn,
          check_out_time: record.checkOut,
          notes: record.notes,
          recorded_by: user.user?.id
        }]);

      if (error) throw new Error(error.message);
    }
  },

  grades: {
    getAll: async (studentId?: string): Promise<Grade[]> => {
      let query = supabase
        .from('grades')
        .select(`
          *,
          student:students!grades_student_id_fkey(
            student_id,
            user:profiles!students_user_id_fkey(first_name, last_name)
          )
        `)
        .order('graded_date', { ascending: false });

      if (studentId) {
        const { data: student } = await supabase
          .from('students')
          .select('id')
          .eq('user_id', studentId)
          .maybeSingle();

        if (student) {
          query = query.eq('student_id', student.id);
        }
      }

      const { data, error } = await query;
      if (error) throw new Error(error.message);

      return (data || []).map(g => ({
        id: g.id,
        studentId: g.student?.student_id || '',
        studentName: g.student?.user ? `${g.student.user.first_name} ${g.student.user.last_name}` : '',
        subject: g.subject,
        assignment: g.assignment_name,
        grade: parseFloat(g.grade),
        maxGrade: parseFloat(g.max_grade),
        letterGrade: g.letter_grade,
        date: formatDate(g.graded_date),
        feedback: g.feedback
      }));
    }
  },

  announcements: {
    getAll: async (role?: Role): Promise<Announcement[]> => {
      let query = supabase
        .from('announcements')
        .select(`
          *,
          author:profiles!announcements_author_id_fkey(first_name, last_name),
          program:programs!announcements_program_id_fkey(name)
        `)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (role) {
        query = query.or(`audience.eq.all,audience.eq.${role}s`);
      }

      const { data, error } = await query;
      if (error) throw new Error(error.message);

      return (data || []).map(ann => ({
        id: ann.id,
        title: ann.title,
        content: ann.content,
        priority: ann.priority,
        audience: ann.audience,
        program: ann.program?.name,
        author: ann.author ? `${ann.author.first_name} ${ann.author.last_name}` : 'System',
        date: formatDate(ann.created_at),
        startDate: ann.start_date,
        endDate: ann.end_date
      }));
    },

    create: async (announcement: Omit<Announcement, 'id' | 'date'>) => {
      const { data: user } = await supabase.auth.getUser();

      const { error } = await supabase
        .from('announcements')
        .insert([{
          title: announcement.title,
          content: announcement.content,
          priority: announcement.priority,
          audience: announcement.audience,
          program_id: announcement.programId,
          author_id: user.user?.id
        }]);

      if (error) throw new Error(error.message);
    }
  },

  teacher: {
    getQuizzes: async (teacherId?: string): Promise<Quiz[]> => {
      let query = supabase
        .from('quizzes')
        .select(`
          *,
          program:programs!quizzes_program_id_fkey(name),
          results:quiz_results(count)
        `)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (teacherId) {
        query = query.eq('created_by', teacherId);
      }

      const { data, error } = await query;
      if (error) throw new Error(error.message);

      return (data || []).map(q => ({
        id: q.id,
        title: q.title,
        program: q.program?.name || 'General',
        submissions: `${q.results?.length || 0}`,
        date: formatDate(q.created_at),
        status: new Date(q.end_date) < new Date() ? 'Completed' : 'Grading',
        totalPoints: q.total_points,
        duration: q.duration_minutes
      }));
    },

    getStudents: async (teacherId: string) => {
      const { data, error } = await supabase
        .from('teacher_programs')
        .select(`
          program:programs!teacher_programs_program_id_fkey(
            id,
            name,
            students:students(
              *,
              user:profiles!students_user_id_fkey(first_name, last_name, email, avatar_url)
            )
          )
        `)
        .eq('teacher_id', teacherId);

      if (error) throw new Error(error.message);

      const students: Student[] = [];
      (data || []).forEach(tp => {
        if (tp.program?.students) {
          tp.program.students.forEach((s: any) => {
            students.push({
              id: s.student_id || `STU-${s.id.slice(0, 8)}`,
              name: s.user ? `${s.user.first_name} ${s.user.last_name}` : 'Unknown',
              email: s.user?.email || '',
              program: tp.program?.name || 'No Program',
              status: statusMap[s.status] || 'Active',
              date: formatDate(s.enrollment_date || s.created_at),
              avatar: s.user?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${s.id}`
            });
          });
        }
      });

      return students;
    }
  },

  programs: {
    getAll: async (): Promise<Program[]> => {
      const { data, error } = await supabase
        .from('programs')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw new Error(error.message);

      return (data || []).map(p => ({
        id: p.id,
        name: p.name,
        description: p.description,
        duration: p.duration_months,
        price: parseFloat(p.price),
        capacity: p.capacity,
        enrolled: p.enrolled_count,
        color: p.color
      }));
    }
  },

  registrations: {
    getAll: async (): Promise<RegistrationApplication[]> => {
      const { data, error } = await supabase
        .from('registration_applications')
        .select(`
          *,
          program:programs!registration_applications_program_id_fkey(name),
          reviewer:profiles!registration_applications_reviewed_by_fkey(first_name, last_name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw new Error(error.message);

      return (data || []).map(app => ({
        id: app.id,
        email: app.email,
        firstName: app.first_name,
        lastName: app.last_name,
        role: app.role,
        program: app.program?.name,
        programId: app.program_id,
        phone: app.phone,
        status: app.status,
        createdAt: formatDate(app.created_at),
        reviewedBy: app.reviewer ? `${app.reviewer.first_name} ${app.reviewer.last_name}` : undefined,
        reviewedAt: app.reviewed_at ? formatDate(app.reviewed_at) : undefined,
        notes: app.notes,
        specialization: app.specialization,
        qualifications: app.qualifications,
        experienceYears: app.experience_years,
        dateOfBirth: app.date_of_birth,
        address: app.address,
        city: app.city,
        country: app.country,
        emergencyContactName: app.emergency_contact_name,
        emergencyContactPhone: app.emergency_contact_phone,
        passwordHash: app.password_hash
      }));
    },

    approve: async (applicationId: string) => {
      const { data: app } = await supabase
        .from('registration_applications')
        .select('*')
        .eq('id', applicationId)
        .maybeSingle();

      if (!app) throw new Error('Application not found');

      const { data: user } = await supabase.auth.getUser();

      const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
        email: app.email,
        password: app.password_hash,
        email_confirm: true
      });

      if (authError) throw new Error(authError.message);

      const { error: profileError } = await supabase
        .from('profiles')
        .insert([{
          id: authUser.user.id,
          email: app.email,
          first_name: app.first_name,
          last_name: app.last_name,
          role: app.role,
          phone: app.phone
        }]);

      if (profileError) throw new Error(profileError.message);

      if (app.role === 'student') {
        const { error: studentError } = await supabase
          .from('students')
          .insert([{
            user_id: authUser.user.id,
            program_id: app.program_id,
            date_of_birth: app.date_of_birth,
            address: app.address,
            city: app.city,
            country: app.country,
            emergency_contact_name: app.emergency_contact_name,
            emergency_contact_phone: app.emergency_contact_phone,
            status: 'active'
          }]);

        if (studentError) throw new Error(studentError.message);
      } else if (app.role === 'teacher') {
        const { error: teacherError } = await supabase
          .from('teachers')
          .insert([{
            user_id: authUser.user.id,
            specialization: app.specialization,
            qualifications: app.qualifications,
            experience_years: app.experience_years,
            status: 'active'
          }]);

        if (teacherError) throw new Error(teacherError.message);
      }

      const { error: updateError } = await supabase
        .from('registration_applications')
        .update({
          status: 'approved',
          reviewed_by: user.user?.id,
          reviewed_at: new Date().toISOString()
        })
        .eq('id', applicationId);

      if (updateError) throw new Error(updateError.message);
    },

    reject: async (applicationId: string, notes?: string) => {
      const { data: user } = await supabase.auth.getUser();

      const { error } = await supabase
        .from('registration_applications')
        .update({
          status: 'rejected',
          reviewed_by: user.user?.id,
          reviewed_at: new Date().toISOString(),
          notes
        })
        .eq('id', applicationId);

      if (error) throw new Error(error.message);
    }
  },

  dashboard: {
    getStats: async (role: Role, userId?: string) => {
      if (role === 'admin') {
        const [
          { count: totalStudents },
          { count: activeStudents },
          { count: pendingApps },
          { data: invoices }
        ] = await Promise.all([
          supabase.from('students').select('*', { count: 'exact', head: true }),
          supabase.from('students').select('*', { count: 'exact', head: true }).eq('status', 'active'),
          supabase.from('registration_applications').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
          supabase.from('invoices').select('amount, status')
        ]);

        const totalRevenue = (invoices || [])
          .filter((inv: any) => inv.status === 'paid')
          .reduce((sum: number, inv: any) => sum + parseFloat(inv.amount), 0);

        const pendingRevenue = (invoices || [])
          .filter((inv: any) => inv.status === 'pending')
          .reduce((sum: number, inv: any) => sum + parseFloat(inv.amount), 0);

        return {
          totalStudents: totalStudents || 0,
          activeStudents: activeStudents || 0,
          pendingApplications: pendingApps || 0,
          totalRevenue,
          pendingRevenue
        };
      } else if (role === 'student' && userId) {
        const { data: student } = await supabase
          .from('students')
          .select('id, gpa, attendance_rate')
          .eq('user_id', userId)
          .maybeSingle();

        if (!student) return null;

        const [
          { count: totalGrades },
          { data: attendance }
        ] = await Promise.all([
          supabase.from('grades').select('*', { count: 'exact', head: true }).eq('student_id', student.id),
          supabase.from('attendance').select('status').eq('student_id', student.id)
        ]);

        return {
          gpa: student.gpa || 0,
          attendanceRate: student.attendance_rate || 0,
          totalGrades: totalGrades || 0,
          presentDays: (attendance || []).filter((a: any) => a.status === 'present').length
        };
      }

      return null;
    }
  }
};
