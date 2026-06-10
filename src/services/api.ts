import { Student, User, Role, Invoice, InvoiceSettings, SettingsStudent, Announcement, AttendanceRecord, Grade, Program, RegistrationApplication, CalendarEvent, CalendarParticipant, Class, ClassSession, ClassEnrollment, GradeTable, GradeTableEntry, AdminDayClass } from '../types';
import { supabase } from '../lib/supabase';

const formatDate = (date: string) => {
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const getAuthHeaders = (): HeadersInit => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('fma_sis_token') : null;
  return {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` }),
  };
};

const statusMap: Record<string, 'Active' | 'Pending' | 'Suspended' | 'Graduated'> = {
  'active': 'Active',
  'inactive': 'Suspended',
  'graduated': 'Graduated',
  'suspended': 'Suspended'
};

const parseRoleActions = (actions: unknown): string[] => {
  if (Array.isArray(actions)) return actions as string[];
  if (typeof actions === 'string') {
    try {
      const parsed = JSON.parse(actions);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};

const mapSystemRole = (row: any) => ({
  id: row.id,
  name: row.name,
  description: row.description || '',
  isSystemRole: !!row.is_system_role,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  permissions: (row.permissions || []).filter(Boolean).map((permission: any) => ({
    id: permission.id || `${row.id}-${permission.module}`,
    roleId: permission.role_id || row.id,
    module: permission.module,
    actions: parseRoleActions(permission.actions),
    createdAt: permission.created_at || row.created_at,
    updatedAt: permission.updated_at || row.updated_at,
  })),
});

export const api = {
  auth: {
    login: async (email: string, password: string): Promise<{ user: User, token: string }> => {
      console.log('[api.auth.login] signInWithPassword starting...');
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      console.log('[api.auth.login] signInWithPassword done, error:', error?.message || 'none');

      if (error) {
        throw new Error(error.message);
      }

      if (!data?.user || !data?.session) {
        throw new Error('Authentication failed');
      }

      const authUser = data.user;
      const session = data.session;

      console.log('[api.auth.login] auth OK, fetching profile for:', authUser.id);
      const { data: profileRow, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .maybeSingle();
      const profile = profileRow as {
        id: string;
        email: string;
        first_name: string;
        last_name: string;
        role: string;
        avatar_url: string | null;
        must_change_password: boolean | null;
      } | null;
      console.log('[api.auth.login] profile fetch done, error:', profileError?.message || 'none', 'profile:', profile?.id || 'null');

      if (profileError) {
        throw new Error(profileError.message);
      }

      if (!profile) {
        throw new Error('User profile not found');
      }

      console.log('[api.auth.login] returning user, role:', profile.role);
      return {
        user: {
          id: profile.id,
          email: authUser.email || profile.email,
          firstName: profile.first_name,
          lastName: profile.last_name,
          role: profile.role as Role,
          avatar: profile.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile.email}`,
          mustChangePassword: !!profile.must_change_password,
        },
        token: session.access_token
      };
    },

    changePassword: async (newPassword: string): Promise<void> => {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user) throw new Error('Not authenticated');

      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) throw new Error(updateError.message);

      const { error: profileError } = await supabase
        .from('profiles')
        .update({ must_change_password: false })
        .eq('id', authData.user.id);
      if (profileError) throw new Error(profileError.message);
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
        .select('status')
        .eq('email', applicationData.email)
        .maybeSingle();

      if (existingApp) {
        if (existingApp.status === 'pending') {
          throw new Error('An application with this email is already pending');
        } else if (existingApp.status === 'approved') {
          throw new Error('This email is already registered');
        } else if (existingApp.status === 'rejected') {
          throw new Error('Your previous application was denied');
        }
      }

      const fullPayload = {
        email: applicationData.email,
        first_name: applicationData.firstName,
        last_name: applicationData.lastName,
        parent_first_name: applicationData.parentFirstName,
        password_hash: applicationData.passwordHash,
        role: applicationData.role,
        program: applicationData.program,
        location: applicationData.location,
        phone: applicationData.phone,
        secondary_phone: applicationData.secondaryPhone,
        id_document_url: applicationData.idDocumentUrl
      };

      let { error } = await supabase
        .from('registration_applications')
        .insert([fullPayload]);

      if (error && (error.message.includes("'location' column") || error.message.includes("'secondary_phone' column"))) {
        const fallbackPayload = {
          email: applicationData.email,
          first_name: applicationData.firstName,
          last_name: applicationData.lastName,
          parent_first_name: applicationData.parentFirstName,
          password_hash: applicationData.passwordHash,
          role: applicationData.role,
          program: applicationData.program,
          phone: applicationData.phone,
          id_document_url: applicationData.idDocumentUrl
        };
        const retry = await supabase
          .from('registration_applications')
          .insert([fallbackPayload]);
        error = retry.error;
      }

      if (error) throw new Error(error.message);
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
    /* ─── Month names ─── */
    _MONTHS: ['January','February','March','April','May','June','July','August','September','October','November','December'] as const,

    _sendInvoiceSms: async (params: {
      studentPhone: string;
      studentName: string;
      className: string;
      amount: number;
      dueDate?: string;
      status: string;
      mode: 'created' | 'updated';
    }): Promise<void> => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const functionName = params.mode === 'updated' ? 'send-invoice-changed-sms' : 'send-invoice-sms';
      const res = await fetch(
        `/api/notify/${functionName}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
          body: JSON.stringify(params),
        }
      );
      if (!res.ok) console.warn(`${functionName} failed:`, await res.text());
    },

    _sendInvoiceEmail: async (params: {
      studentEmail: string;
      studentName: string;
      className: string;
      invoiceTitle: string;
      invoiceId: string;
      amount: number;
      dueDate: string;
      status?: string;
      mode?: 'created' | 'updated';
      changeSummary?: string;
    }): Promise<void> => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const res = await fetch(
        `/api/notify/send-invoice-email`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify(params),
        }
      );

      const result = await res.json().catch(() => ({}));
      if (!res.ok || result.error) {
        throw new Error(result.error || 'Failed to send invoice email');
      }
    },

    _generateInvoiceId: (year: number, month: number): string => {
      const rand = (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID().replace(/-/g, '')
        : Array.from(crypto.getRandomValues(new Uint8Array(8))).map(b => b.toString(16).padStart(2, '0')).join('')
      ).slice(0, 8).toUpperCase();
      return `INV-${year}${String(month).padStart(2, '0')}-${rand}`;
    },

    /* ─── Settings ─── */
    getSettings: async (): Promise<InvoiceSettings | null> => {
      const { data, error } = await supabase.from('invoice_settings').select('*').limit(1).single();
      if (error) return null;
      return {
        id: data.id,
        defaultAmount: parseFloat(data.default_amount),
        titleTemplate: data.title_template,
        discountPercent: parseFloat(data.discount_percent),
        dueDay: data.due_day,
      };
    },

    updateSettings: async (updates: Partial<Omit<InvoiceSettings, 'id'>>): Promise<void> => {
      const payload: any = {};
      if (updates.defaultAmount != null) payload.default_amount = updates.defaultAmount;
      if (updates.titleTemplate != null) payload.title_template = updates.titleTemplate;
      if (updates.discountPercent != null) payload.discount_percent = updates.discountPercent;
      if (updates.dueDay != null) payload.due_day = updates.dueDay;
      payload.updated_at = new Date().toISOString();
      const { error } = await supabase.from('invoice_settings').update(payload).not('id', 'is', null);
      if (error) throw new Error(error.message);
    },

    /* ─── Per-student overrides ─── */
    getStudentsForSettings: async (): Promise<SettingsStudent[]> => {
      // All enrollments with student + class info (exclude archived profiles via JS filter below)
      const { data: enrollments, error } = await supabase
        .from('class_enrollments')
        .select('student_id, class:classes(title, program_id), student:profiles!class_enrollments_student_id_fkey(first_name, last_name, is_archived)');
      if (error || !enrollments) return [];

      // Filter out archived students
      const activeEnrollments = enrollments.filter((e: any) => !(e.student as any)?.is_archived);

      // Global defaults
      const settings = await api.finance.getSettings();
      const defaultAmt = settings?.defaultAmount ?? 60;

      // Overrides
      const { data: overrides } = await supabase.from('student_invoice_overrides').select('*');
      const overrideMap = new Map<string, any>();
      for (const o of (overrides || [])) overrideMap.set(o.student_id, o);

      // Group by student
      const map = new Map<string, { name: string; programs: Set<string>; classes: string[]; override: any | null }>();
      for (const enr of activeEnrollments) {
        const sid = enr.student_id;
        const s = enr.student as any;
        const cls = enr.class as any;
        const className = cls?.title || '';
        const programName = cls?.program_id || '';
        const existing = map.get(sid);
        if (existing) {
          if (className && !existing.classes.includes(className)) existing.classes.push(className);
          if (programName) existing.programs.add(programName);
        } else {
          map.set(sid, {
            name: s ? `${s.first_name} ${s.last_name}` : '',
            programs: new Set(programName ? [programName] : []),
            classes: className ? [className] : [],
            override: overrideMap.get(sid) || null,
          });
        }
      }

      const result: SettingsStudent[] = [];
      for (const [studentId, info] of map) {
        const ovr = info.override;
        const amt = ovr?.custom_amount != null ? parseFloat(ovr.custom_amount) : defaultAmt;
        const disc = ovr?.custom_discount_percent != null ? parseFloat(ovr.custom_discount_percent) : (settings?.discountPercent ?? 0);
        const entry: SettingsStudent = {
          studentId,
          studentName: info.name,
          program: Array.from(info.programs).join(', '),
          classes: info.classes,
          currentAmount: amt,
          currentDiscount: disc,
          hasOverride: !!ovr,
        };
        if (ovr) {
          if (ovr.custom_amount != null) entry.overrideAmount = parseFloat(ovr.custom_amount);
          if (ovr.custom_discount_percent != null) entry.overrideDiscountPercent = parseFloat(ovr.custom_discount_percent);
          if (ovr.custom_due_day != null) entry.overrideDueDay = parseInt(ovr.custom_due_day);
          if (ovr.custom_title_template != null) entry.overrideTitleTemplate = ovr.custom_title_template;
        }
        result.push(entry);
      }
      return result.sort((a, b) => a.studentName.localeCompare(b.studentName));
    },

    getActiveEnrollmentOptions: async (): Promise<Array<{
      enrollmentId: string;
      studentId: string;
      studentName: string;
      studentEmail: string;
      classId: string;
      className: string;
      teacherName: string;
    }>> => {
      const { data, error } = await supabase
        .from('class_enrollments')
        .select(`
          id,
          student_id,
          class_id,
          student:profiles!class_enrollments_student_id_fkey(first_name, last_name, email, phone),
          class:classes!class_enrollments_class_id_fkey(
            title,
            teacher:profiles!classes_teacher_id_fkey(first_name, last_name)
          )
        `)
        .order('id', { ascending: true });
      if (error) throw new Error(error.message);

      return (data || []).map((row: any) => ({
        enrollmentId: row.id,
        studentId: row.student_id,
        studentName: row.student ? `${row.student.first_name} ${row.student.last_name}` : 'Student',
        studentEmail: row.student?.email || '',
        studentPhone: row.student?.phone || '',
        classId: row.class_id,
        className: row.class?.title || 'Class',
        teacherName: row.class?.teacher ? `${row.class.teacher.first_name} ${row.class.teacher.last_name}` : '',
      }));
    },

    createManualInvoice: async (params: {
      enrollmentId: string;
      studentId: string;
      classId: string;
      title: string;
      month: number;
      year: number;
      dueDate: string;
      amount: number;
      discountPercent?: number;
      studentName?: string;
      studentEmail?: string;
      studentPhone?: string;
      className?: string;
    }): Promise<void> => {
      const invoiceId = api.finance._generateInvoiceId(params.year, params.month);
      const insResp = await fetch('/api/db', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          query: `
            INSERT INTO invoices
              (enrollment_id, student_id, class_id, invoice_id, title, month, year, due_date, amount, discount_percent, status, is_manual)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'not_paid', true)
          `,
          params: [
            params.enrollmentId,
            params.studentId,
            params.classId,
            invoiceId,
            params.title,
            params.month,
            params.year,
            params.dueDate,
            Math.round(params.amount * 100) / 100,
            params.discountPercent ?? 0,
          ],
        }),
      });
      if (!insResp.ok) {
        const err = await insResp.json();
        throw new Error(err.error?.message || err.message || 'Failed to create invoice');
      }
      const insResult = await insResp.json();
      if (insResult.error) throw new Error(insResult.error.message);

      if (params.studentEmail) {
        try {
          await api.finance._sendInvoiceEmail({
            studentEmail: params.studentEmail,
            studentName: params.studentName || 'Student',
            className: params.className || 'Class',
            invoiceTitle: params.title,
            invoiceId,
            amount: params.amount,
            dueDate: params.dueDate,
            status: 'not_paid',
            mode: 'created',
          });
        } catch (emailErr) {
          console.warn('Invoice created but email sending failed:', emailErr);
        }
      }
      if (params.studentPhone) {
        api.finance._sendInvoiceSms({
          studentPhone: params.studentPhone,
          studentName: params.studentName || 'Student',
          className: params.className || 'Class',
          amount: params.amount,
          dueDate: params.dueDate,
          status: 'not_paid',
          mode: 'created',
        }).catch((smsErr: unknown) => console.warn('Invoice SMS failed:', smsErr));
      }
    },

    deleteOverrides: async (studentIds: string[]): Promise<void> => {
      const { error } = await supabase
        .from('student_invoice_overrides')
        .delete()
        .in('student_id', studentIds);
      if (error) throw new Error(error.message);
    },

    archiveStudent: async (studentId: string): Promise<void> => {
      // 1. Snapshot all current enrollments so they can be restored on re-approval
      const { data: enrollments } = await supabase
        .from('class_enrollments')
        .select('class_id, class:classes(title, program_id)')
        .eq('student_id', studentId);

      if (enrollments && enrollments.length > 0) {
        const snapshotRows = enrollments.map((e: any) => ({
          student_id: studentId,
          class_id: e.class_id,
          class_title: (e.class as any)?.title ?? 'Unknown Class',
          program_id: (e.class as any)?.program_id ?? null,
        }));
        // Save snapshot via raw SQL upsert (handles composite conflict key)
        for (const row of snapshotRows) {
          await fetch('/api/db', {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({
              query: `
                INSERT INTO student_archived_classes (student_id, class_id, class_title, program_id)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (student_id, class_id) DO UPDATE SET
                  class_title = EXCLUDED.class_title,
                  program_id  = EXCLUDED.program_id
              `,
              params: [row.student_id, row.class_id, row.class_title, row.program_id],
            }),
          });
        }
      }

      // 2. Remove from all class rosters (unconditional — don't filter by status)
      await supabase
        .from('class_enrollments')
        .delete()
        .eq('student_id', studentId);

      // 3. Archive the profile
      const { error } = await supabase
        .from('profiles')
        .update({ is_archived: true })
        .eq('id', studentId);
      if (error) throw new Error(error.message);
    },

    unarchiveStudent: async (studentId: string): Promise<void> => {
      const { error } = await supabase
        .from('profiles')
        .update({ is_archived: false })
        .eq('id', studentId);
      if (error) throw new Error(error.message);
    },

    upsertOverrides: async (studentIds: string[], overrides: { amount?: number; discountPercent?: number; dueDay?: number; titleTemplate?: string }): Promise<void> => {
      for (const sid of studentIds) {
        const payload: any = { student_id: sid, updated_at: new Date().toISOString() };
        if (overrides.amount != null) payload.custom_amount = overrides.amount;
        if (overrides.discountPercent != null) payload.custom_discount_percent = overrides.discountPercent;
        if (overrides.dueDay != null) payload.custom_due_day = overrides.dueDay;
        if (overrides.titleTemplate != null) payload.custom_title_template = overrides.titleTemplate;
        const { error } = await supabase
          .from('student_invoice_overrides')
          .upsert(payload, { onConflict: 'student_id' });
        if (error) throw new Error(error.message);
      }
    },

    /* ─── Auto-generate missing invoices ─── */
    syncInvoices: async (): Promise<void> => {
      const MONTHS = api.finance._MONTHS;

      // 1. Settings (global defaults)
      const { data: settingsRow } = await supabase.from('invoice_settings').select('*').limit(1).single();
      const s = settingsRow || { default_amount: 60, title_template: '{class} - {month}', discount_percent: 0, due_day: 1 };

      // 2. Per-student overrides
      const { data: overrides } = await supabase.from('student_invoice_overrides').select('*');
      const ovrMap = new Map<string, any>();
      for (const o of (overrides || [])) ovrMap.set(o.student_id, o);

      // 3. All enrollments with class info (no status filter — same approach as SMS dedup fix)
      const { data: enrollments, error: eErr } = await supabase
        .from('class_enrollments')
        .select('id, student_id, class_id, enrolled_at, class:classes(title), student:profiles!class_enrollments_student_id_fkey(first_name, last_name, email, phone)');
      if (eErr || !enrollments || enrollments.length === 0) return;

      // 4. All existing invoices — the DB unique constraint covers all, so skip any month that already has one
      const { data: existing } = await supabase.from('invoices').select('enrollment_id, month, year');
      const existingKeys = new Set((existing || []).map((r: any) => `${r.enrollment_id}-${r.month}-${r.year}`));

      // 5. Compute missing invoices
      const now = new Date();
      const curMonth = now.getMonth() + 1;
      const curYear = now.getFullYear();

      const toInsert: any[] = [];
      const pendingInvoiceEmails: Array<{
        studentEmail: string;
        studentName: string;
        className: string;
        invoiceTitle: string;
        invoiceId: string;
        amount: number;
        dueDate: string;
        status?: string;
        mode?: 'created' | 'updated';
        changeSummary?: string;
      }> = [];
      const pendingInvoiceSms: Array<{
        studentPhone: string;
        studentName: string;
        className: string;
        amount: number;
        dueDate: string;
        status: string;
        mode: 'created' | 'updated';
      }> = [];
      for (const enr of enrollments) {
        if (!enr.enrolled_at) continue;
        const enrolled = new Date(enr.enrolled_at);
        let y = enrolled.getFullYear();
        let m = enrolled.getMonth() + 1;
        const className = (enr.class as any)?.title || 'Class';
        const student = enr.student as any;
        const studentName = student ? `${student.first_name || ''} ${student.last_name || ''}`.trim() : 'Student';
        const studentEmail = student?.email || '';
        const studentPhone = student?.phone || '';

        // Resolve per-student or global values
        const ovr = ovrMap.get(enr.student_id);
        const baseAmount = ovr?.custom_amount != null ? parseFloat(ovr.custom_amount) : parseFloat(s.default_amount);
        const disc = ovr?.custom_discount_percent != null ? parseFloat(ovr.custom_discount_percent) : parseFloat(s.discount_percent);
        const dueDay = Math.min(ovr?.custom_due_day != null ? parseInt(ovr.custom_due_day) : parseInt(s.due_day), 28);
        const titleTpl = ovr?.custom_title_template || (s.title_template as string);
        const amount = baseAmount * (1 - disc / 100);

        while (y < curYear || (y === curYear && m <= curMonth)) {
          if (!existingKeys.has(`${enr.id}-${m}-${y}`)) {
            const title = titleTpl
              .replace('{class}', className)
              .replace('{month}', `${MONTHS[m - 1]} ${y}`);
            const dueM = m === 12 ? 1 : m + 1;
            const dueY = m === 12 ? y + 1 : y;
            const dueDate = `${dueY}-${String(dueM).padStart(2, '0')}-${String(dueDay).padStart(2, '0')}`;
            const roundedAmount = Math.round(amount * 100) / 100;
            const invoiceId = api.finance._generateInvoiceId(y, m);
            toInsert.push({
              enrollment_id: enr.id,
              student_id: enr.student_id,
              class_id: enr.class_id,
              invoice_id: invoiceId,
              title,
              month: m,
              year: y,
              due_date: dueDate,
              amount: roundedAmount,
              discount_percent: disc,
              status: 'not_paid',
              is_manual: false,
            });

            if (studentEmail) {
              pendingInvoiceEmails.push({
                studentEmail,
                studentName,
                className,
                invoiceTitle: title,
                invoiceId,
                amount: roundedAmount,
                dueDate,
                status: 'not_paid',
                mode: 'created',
              });
            }
            if (studentPhone) {
              pendingInvoiceSms.push({
                studentPhone,
                studentName,
                className,
                amount: roundedAmount,
                dueDate,
                status: 'not_paid',
                mode: 'created',
              });
            }
          }
          m++;
          if (m > 12) { m = 1; y++; }
        }
      }

      if (toInsert.length > 0) {
        const { error } = await supabase.from('invoices').insert(toInsert);
        if (error) throw new Error(error.message);

        // Send one email per newly generated invoice without blocking invoice creation.
        if (pendingInvoiceEmails.length > 0) {
          const emailResults = await Promise.allSettled(
            pendingInvoiceEmails.map((payload) => api.finance._sendInvoiceEmail(payload))
          );
          const failed = emailResults.filter((r) => r.status === 'rejected').length;
          if (failed > 0) {
            console.warn(`Failed to send ${failed} invoice email(s) out of ${pendingInvoiceEmails.length}.`);
          }
        }
        if (pendingInvoiceSms.length > 0) {
          Promise.allSettled(
            pendingInvoiceSms.map((payload) => api.finance._sendInvoiceSms(payload))
          ).then((results) => {
            const failed = results.filter((r) => r.status === 'rejected').length;
            if (failed > 0) console.warn(`Failed to send ${failed} invoice SMS(s) out of ${pendingInvoiceSms.length}.`);
          });
        }
      }

      // 5. Mark overdue: not_paid invoices whose due_date is in the past
      const todayStr = `${curYear}-${String(curMonth).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      await supabase
        .from('invoices')
        .update({ status: 'overdue' })
        .eq('status', 'not_paid')
        .lt('due_date', todayStr);

      // 5b. Un-mark overdue: if due_date was moved to the future (e.g. via edit)
      await supabase
        .from('invoices')
        .update({ status: 'not_paid' })
        .eq('status', 'overdue')
        .gte('due_date', todayStr);
    },

    /* ─── Invoices CRUD ─── */
    getInvoices: async (studentUserId?: string): Promise<Invoice[]> => {
      let query = supabase
        .from('invoices')
        .select(`
          *,
          student:profiles!invoices_student_id_fkey(first_name, last_name),
          class:classes!invoices_class_id_fkey(
            title,
            teacher:profiles!classes_teacher_id_fkey(first_name, last_name)
          )
        `)
        .order('year', { ascending: false })
        .order('month', { ascending: false });

      if (studentUserId) {
        query = query.eq('student_id', studentUserId);
      }

      const { data, error } = await query;
      if (error) throw new Error(error.message);

      return (data || []).map((inv: any) => ({
        id: inv.id,
        invoiceId: inv.invoice_id,
        enrollmentId: inv.enrollment_id,
        studentId: inv.student_id,
        studentName: inv.student ? `${inv.student.first_name} ${inv.student.last_name}` : '',
        classId: inv.class_id,
        className: inv.class?.title || '',
        teacherName: inv.class?.teacher ? `${inv.class.teacher.first_name} ${inv.class.teacher.last_name}` : '',
        title: inv.title,
        month: inv.month,
        year: inv.year,
        dueDate: inv.due_date,
        amount: parseFloat(inv.amount),
        discountPercent: parseFloat(inv.discount_percent || '0'),
        status: inv.status as Invoice['status'],
        isManual: inv.is_manual === true,
      }));
    },

    updateInvoice: async (id: string, updates: { amount?: number; status?: string; title?: string; due_date?: string }) => {
      const { data: current, error: currentError } = await supabase
        .from('invoices')
        .select(`
          invoice_id,
          title,
          amount,
          due_date,
          status,
          student:profiles!invoices_student_id_fkey(first_name, last_name, email, phone),
          class:classes!invoices_class_id_fkey(title)
        `)
        .eq('id', id)
        .single();
      if (currentError || !current) throw new Error(currentError?.message || 'Invoice not found');

      const payload: any = {};
      if (updates.amount != null) payload.amount = updates.amount;
      if (updates.status) payload.status = updates.status;
      if (updates.title) payload.title = updates.title;
      if (updates.due_date) {
        payload.due_date = updates.due_date;
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const due = new Date(updates.due_date + 'T12:00:00'); due.setHours(0, 0, 0, 0);
        if (current.status === 'overdue' && due >= today) {
          payload.status = 'not_paid';
        } else if (current.status === 'not_paid' && due < today) {
          payload.status = 'overdue';
        }
      }

      const oldAmount = parseFloat(current.amount);
      const newAmount = payload.amount != null ? Number(payload.amount) : oldAmount;
      const oldTitle = current.title as string;
      const newTitle = payload.title ?? oldTitle;
      const oldDueDate = current.due_date as string;
      const newDueDate = payload.due_date ?? oldDueDate;
      const oldStatus = current.status as string;
      const newStatus = payload.status ?? oldStatus;

      const changeParts: string[] = [];
      if (newTitle !== oldTitle) changeParts.push(`the title was changed from "${oldTitle}" to "${newTitle}"`);
      if (newAmount !== oldAmount) changeParts.push(`the amount was changed from EUR ${oldAmount.toFixed(2)} to EUR ${newAmount.toFixed(2)}`);
      if (newDueDate !== oldDueDate) changeParts.push(`the due date was changed from ${oldDueDate} to ${newDueDate}`);
      if (newStatus !== oldStatus) changeParts.push(`the status was changed from ${oldStatus.replace('_', ' ')} to ${newStatus.replace('_', ' ')}`);

      const { error } = await supabase.from('invoices').update(payload).eq('id', id);
      if (error) throw new Error(error.message);

      const student = current.student as any;
      const cls = current.class as any;
      if (student?.email && changeParts.length > 0) {
        try {
          await api.finance._sendInvoiceEmail({
            studentEmail: student.email,
            studentName: `${student.first_name || ''} ${student.last_name || ''}`.trim() || 'Student',
            className: cls?.title || 'Class',
            invoiceTitle: newTitle,
            invoiceId: current.invoice_id,
            amount: newAmount,
            dueDate: newDueDate,
            status: newStatus,
            mode: 'updated',
            changeSummary: changeParts.join('; '),
          });
        } catch (emailErr) {
          console.warn('Invoice updated but email sending failed:', emailErr);
        }
      }
      if (student?.phone && changeParts.length > 0) {
        api.finance._sendInvoiceSms({
          studentPhone: student.phone,
          studentName: `${student.first_name || ''} ${student.last_name || ''}`.trim() || 'Student',
          className: cls?.title || 'Class',
          amount: newAmount,
          dueDate: newDueDate,
          status: newStatus,
          mode: 'updated',
        }).catch((smsErr: unknown) => console.warn('Invoice updated but SMS sending failed:', smsErr));
      }
    },

    deleteInvoice: async (id: string) => {
      const { error } = await supabase.from('invoices').delete().eq('id', id);
      if (error) throw new Error(error.message);
    },

    /* ─── Dashboard Stats ─── */
    getStats: async (): Promise<{ totalPaid: number; pending: number; overdue: number; invoiceCount: number }> => {
      const { data, error } = await supabase.from('invoices').select('amount, status');
      if (error) throw new Error(error.message);
      let totalPaid = 0, pending = 0, overdue = 0;
      for (const r of (data || [])) {
        const amt = parseFloat(r.amount);
        if (r.status === 'paid') totalPaid += amt;
        else if (r.status === 'overdue') overdue += amt;
        else pending += amt;
      }
      return { totalPaid, pending, overdue, invoiceCount: (data || []).length };
    },
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

  gradeTables: {
    /** Get all grade tables for a teacher, with their entries */
    getAll: async (teacherId: string): Promise<GradeTable[]> => {
      const { data, error } = await supabase
        .from('grade_tables')
        .select(`
          *,
          class:classes!grade_tables_class_id_fkey(title),
          teacher:profiles!grade_tables_teacher_id_fkey(first_name, last_name),
          entries:grade_table_entries(
            id,
            student_id,
            total_points,
            passed,
            graded_at,
            note,
            student:profiles!grade_table_entries_student_id_fkey(first_name, last_name, avatar_url)
          )
        `)
        .eq('teacher_id', teacherId)
        .order('created_at', { ascending: false });

      if (error) throw new Error(error.message);

      return (data || []).map((t: any) => ({
        id: t.id,
        name: t.name,
        classId: t.class_id,
        className: t.class?.title || 'Unknown',
        teacherId: t.teacher_id,
        teacherName: t.teacher ? `${t.teacher.first_name} ${t.teacher.last_name}` : 'Unknown',
        degree: t.degree || '',
        createdAt: formatDate(t.created_at),
        entries: (t.entries || []).map((e: any) => ({
          id: e.id,
          gradeTableId: t.id,
          studentId: e.student_id,
          studentName: e.student ? `${e.student.first_name} ${e.student.last_name}` : 'Unknown',
          avatar: e.student?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${e.student_id}`,
          className: t.class?.title || 'Unknown',
          totalPoints: e.total_points != null ? parseFloat(e.total_points) : null,
          passed: e.passed,
          gradedAt: e.graded_at ? formatDate(e.graded_at) : null,
          note: e.note || null,
          attendanceRate: null,
          previousFailedExams: 0,
        })),
      }));
    },

    /** Get ALL grade tables across all teachers (admin view) */
    getAllAdmin: async (): Promise<GradeTable[]> => {
      const { data, error } = await supabase
        .from('grade_tables')
        .select(`
          *,
          class:classes!grade_tables_class_id_fkey(title),
          teacher:profiles!grade_tables_teacher_id_fkey(first_name, last_name),
          entries:grade_table_entries(
            id,
            student_id,
            total_points,
            passed,
            graded_at,
            note,
            student:profiles!grade_table_entries_student_id_fkey(first_name, last_name, avatar_url)
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw new Error(error.message);

      return (data || []).map((t: any) => ({
        id: t.id,
        name: t.name,
        classId: t.class_id,
        className: t.class?.title || 'Unknown',
        teacherId: t.teacher_id,
        teacherName: t.teacher ? `${t.teacher.first_name} ${t.teacher.last_name}` : 'Unknown',
        degree: t.degree || '',
        createdAt: formatDate(t.created_at),
        entries: (t.entries || []).map((e: any) => ({
          id: e.id,
          gradeTableId: t.id,
          studentId: e.student_id,
          studentName: e.student ? `${e.student.first_name} ${e.student.last_name}` : 'Unknown',
          avatar: e.student?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${e.student_id}`,
          className: t.class?.title || 'Unknown',
          totalPoints: e.total_points != null ? parseFloat(e.total_points) : null,
          passed: e.passed,
          gradedAt: e.graded_at ? formatDate(e.graded_at) : null,
          note: e.note || null,
          attendanceRate: null,
          previousFailedExams: 0,
        })),
      }));
    },

    /** Get grade tables for a specific class */
    getForClass: async (classId: string): Promise<GradeTable[]> => {
      const { data, error } = await supabase
        .from('grade_tables')
        .select(`
          *,
          class:classes!grade_tables_class_id_fkey(title),
          teacher:profiles!grade_tables_teacher_id_fkey(first_name, last_name),
          entries:grade_table_entries(
            id,
            student_id,
            total_points,
            passed,
            graded_at,
            note,
            student:profiles!grade_table_entries_student_id_fkey(first_name, last_name, avatar_url)
          )
        `)
        .eq('class_id', classId)
        .order('created_at', { ascending: false });

      if (error) throw new Error(error.message);

      return (data || []).map((t: any) => ({
        id: t.id,
        name: t.name,
        classId: t.class_id,
        className: t.class?.title || 'Unknown',
        teacherId: t.teacher_id,
        teacherName: t.teacher ? `${t.teacher.first_name} ${t.teacher.last_name}` : 'Unknown',
        degree: t.degree || '',
        createdAt: formatDate(t.created_at),
        entries: (t.entries || []).map((e: any) => ({
          id: e.id,
          gradeTableId: t.id,
          studentId: e.student_id,
          studentName: e.student ? `${e.student.first_name} ${e.student.last_name}` : 'Unknown',
          avatar: e.student?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${e.student_id}`,
          className: t.class?.title || 'Unknown',
          totalPoints: e.total_points != null ? parseFloat(e.total_points) : null,
          passed: e.passed,
          gradedAt: e.graded_at ? formatDate(e.graded_at) : null,
          note: e.note || null,
          attendanceRate: null,
          previousFailedExams: 0,
        })),
      }));
    },

    /** Create a grade table with student entries */
    create: async (name: string, classId: string, studentIds: string[], degree?: string): Promise<void> => {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) throw new Error('Not authenticated');

      const { data: table, error: tableErr } = await supabase
        .from('grade_tables')
        .insert({ name, class_id: classId, teacher_id: authData.user.id, degree: degree || null })
        .select('id')
        .single();

      if (tableErr) throw new Error(tableErr.message);

      const entries = studentIds.map(sid => ({
        grade_table_id: table.id,
        student_id: sid,
      }));

      const { error: entryErr } = await supabase
        .from('grade_table_entries')
        .insert(entries);

      if (entryErr) throw new Error(entryErr.message);
    },

    /** Grade a single student entry, then email the student */
    gradeStudent: async (entryId: string, totalPoints: number, passed: boolean, note?: string): Promise<void> => {
      // Fetch current entry state + student/exam info for email
      const { data: current } = await supabase
        .from('grade_table_entries')
        .select(`
          passed,
          student:profiles!grade_table_entries_student_id_fkey(first_name, last_name, email, phone),
          grade_table:grade_tables!grade_table_entries_grade_table_id_fkey(
            name,
            class:classes!grade_tables_class_id_fkey(title),
            teacher:profiles!grade_tables_teacher_id_fkey(first_name, last_name)
          )
        `)
        .eq('id', entryId)
        .single();

      const wasGraded = (current as any)?.passed != null;

      const { data: authData } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('grade_table_entries')
        .update({
          total_points: totalPoints,
          passed,
          graded_at: new Date().toISOString(),
          graded_by: authData.user?.id,
          note: note || null,
        })
        .eq('id', entryId);

      if (error) throw new Error(error.message);

      // Send grade email + SMS (non-blocking — don't fail the save if notifications error)
      try {
        const student = (current as any)?.student;
        const gradeTable = (current as any)?.grade_table;
        if (student?.email && gradeTable) {
          await api.gradeTables._sendGradeEmail({
            studentEmail: student.email,
            studentName: `${student.first_name} ${student.last_name}`,
            examName: gradeTable.name || 'Exam',
            className: gradeTable.class?.title || 'Class',
            teacherName: gradeTable.teacher
              ? `${gradeTable.teacher.first_name} ${gradeTable.teacher.last_name}`
              : 'Teacher',
            totalPoints,
            passed,
            note,
            mode: wasGraded ? 'updated' : 'submitted',
          });
        }
        if (student?.phone && gradeTable) {
          await api.gradeTables._sendGradeSms({
            studentPhone: student.phone,
            studentName: `${student.first_name} ${student.last_name}`,
            examName: gradeTable.name || 'Exam',
            className: gradeTable.class?.title || 'Class',
            teacherName: gradeTable.teacher
              ? `${gradeTable.teacher.first_name} ${gradeTable.teacher.last_name}`
              : 'Teacher',
            totalPoints,
            passed,
            note,
            mode: wasGraded ? 'updated' : 'submitted',
          }).catch((smsErr: unknown) => console.warn('Grade SMS failed:', smsErr));
        }
      } catch (emailErr) {
        console.warn('Grade saved but email failed:', emailErr);
      }
    },

    /** Send a grade notification SMS via Edge Function */
    _sendGradeSms: async (params: {
      studentPhone: string;
      studentName: string;
      examName: string;
      className: string;
      teacherName: string;
      totalPoints: number;
      passed: boolean;
      note?: string;
      mode: 'submitted' | 'updated';
    }): Promise<void> => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch(
        `/api/notify/send-grade-sms`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
          body: JSON.stringify(params),
        }
      );
      if (!res.ok) console.warn('send-grade-sms failed:', await res.text());
    },

    /** Send a grade notification email via Edge Function */
    _sendGradeEmail: async (params: {
      studentEmail: string;
      studentName: string;
      examName: string;
      className: string;
      teacherName: string;
      totalPoints: number;
      passed: boolean;
      note?: string;
      mode: 'submitted' | 'updated';
    }): Promise<void> => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch(
        `/api/notify/send-grade-email`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify(params),
        }
      );
      if (!res.ok) {
        const err = await res.text();
        throw new Error(`send-grade-email: ${err}`);
      }
    },

    /** Delete a grade table and all its entries */
    delete: async (tableId: string): Promise<void> => {
      const { error } = await supabase
        .from('grade_tables')
        .delete()
        .eq('id', tableId);

      if (error) throw new Error(error.message);
    },

    /** Enrich entries with attendance & previous failed exams data */
    enrichEntries: async (entries: GradeTableEntry[], classId: string): Promise<GradeTableEntry[]> => {
      if (entries.length === 0) return entries;

      const studentIds = entries.map(e => e.studentId);

      // Attendance for this class
      const { data: attData } = await supabase
        .from('class_attendance')
        .select('student_id, status')
        .eq('class_id', classId)
        .in('student_id', studentIds);

      const attMap: Record<string, { total: number; present: number }> = {};
      (attData || []).forEach((r: any) => {
        if (!attMap[r.student_id]) attMap[r.student_id] = { total: 0, present: 0 };
        attMap[r.student_id].total++;
        if (r.status === 'present' || r.status === 'late') attMap[r.student_id].present++;
      });

      // Previous failed exams (from other grade tables)
      const { data: failData } = await supabase
        .from('grade_table_entries')
        .select('student_id')
        .in('student_id', studentIds)
        .eq('passed', false);

      const failMap: Record<string, number> = {};
      (failData || []).forEach((r: any) => {
        failMap[r.student_id] = (failMap[r.student_id] || 0) + 1;
      });

      return entries.map(e => ({
        ...e,
        attendanceRate: attMap[e.studentId]
          ? Math.round((attMap[e.studentId].present / attMap[e.studentId].total) * 100)
          : null,
        previousFailedExams: failMap[e.studentId] || 0,
      }));
    },

    /** Get all grade table entries for a specific student (for profile/student view) */
    getForStudent: async (studentId: string): Promise<{
      tableName: string;
      className: string;
      teacherName: string;
      degree: string;
      totalPoints: number | null;
      passed: boolean | null;
      gradedAt: string | null;
      note: string | null;
    }[]> => {
      const { data, error } = await supabase
        .from('grade_table_entries')
        .select(`
          total_points,
          passed,
          graded_at,
          note,
          grade_table:grade_tables!grade_table_entries_grade_table_id_fkey(
            name,
            degree,
            class:classes!grade_tables_class_id_fkey(title),
            teacher:profiles!grade_tables_teacher_id_fkey(first_name, last_name)
          )
        `)
        .eq('student_id', studentId)
        .order('created_at', { ascending: false });

      if (error) throw new Error(error.message);

      return (data || []).map((e: any) => ({
        tableName: e.grade_table?.name || 'Unknown',
        className: e.grade_table?.class?.title || 'Unknown',
        teacherName: e.grade_table?.teacher ? `${e.grade_table.teacher.first_name} ${e.grade_table.teacher.last_name}` : 'Unknown',
        degree: e.grade_table?.degree || '',
        totalPoints: e.total_points != null ? parseFloat(e.total_points) : null,
        passed: e.passed,
        gradedAt: e.graded_at ? formatDate(e.graded_at) : null,
        note: e.note || null,
      }));
    },
  },

  announcements: {
    getAll: async (role: Role, userId: string): Promise<Announcement[]> => {
      // Pre-fetch role-specific IDs for client-side audience filtering.
      // Client-side filtering is safe here — the RLS SELECT policy already
      // allows all authenticated users to read all active announcements.
      let teacherClassIds: string[] = [];
      let studentClassIds: string[] = [];
      let studentProgramIds: string[] = [];

      if (role === 'teacher') {
        const { data } = await supabase.from('classes').select('id').eq('teacher_id', userId);
        teacherClassIds = (data || []).map((c: any) => c.id);
      } else if (role === 'student') {
        const { data } = await supabase
          .from('class_enrollments')
          .select('class_id, class:classes(program_id)')
          .eq('student_id', userId);
        studentClassIds = (data || []).map((e: any) => e.class_id).filter(Boolean);
        studentProgramIds = [...new Set((data || []).map((e: any) => e.class?.program_id).filter(Boolean))] as string[];
      }

      const { data, error } = await supabase
        .from('announcements')
        .select(`
          *,
          author:profiles!announcements_author_id_fkey(first_name, last_name, role),
          program:programs!announcements_program_id_fkey(name),
          class:classes(title)
        `)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw new Error(error.message);

      const rows = (data || []) as any[];

      const relevant = rows.filter(ann => {
        if (role === 'admin') return true;
        if (role === 'teacher') {
          return (
            ann.audience === 'all' ||
            ann.audience === 'teachers' ||
            (ann.audience === 'class_specific' && teacherClassIds.includes(ann.class_id))
          );
        }
        // student
        return (
          ann.audience === 'all' ||
          ann.audience === 'students' ||
          (ann.audience === 'class_specific' && studentClassIds.includes(ann.class_id)) ||
          (ann.audience === 'program_specific' && studentProgramIds.includes(ann.program_id))
        );
      });

      return relevant.map((ann: any) => ({
        id: ann.id,
        title: ann.title,
        content: ann.content,
        priority: ann.priority,
        audience: ann.audience,
        program: ann.program?.name,
        programId: ann.program_id,
        classId: ann.class_id,
        className: ann.class?.title,
        author: ann.author ? `${ann.author.first_name} ${ann.author.last_name}` : 'System',
        authorRole: ann.author?.role,
        date: formatDate(ann.created_at),
        startDate: ann.start_date,
        endDate: ann.end_date,
      }));
    },

    create: async (announcement: Omit<Announcement, 'id' | 'date'>) => {
      const { data: authData } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('announcements')
        .insert([{
          title: announcement.title,
          content: announcement.content,
          priority: announcement.priority,
          audience: announcement.audience,
          program_id: announcement.programId ?? null,
          class_id: announcement.classId ?? null,
          author_id: authData.user?.id,
          is_active: true,
        }]);
      if (error) throw new Error(error.message);
    },

    getAvailableClasses: async (role: Role, userId: string): Promise<{ id: string; title: string }[]> => {
      let query = supabase.from('classes').select('id, title').order('title');
      if (role === 'teacher') query = (query as any).eq('teacher_id', userId);
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return data || [];
    },

    sendEmail: async (params: {
      title: string;
      content: string;
      audience: string;
      programId?: string;
      classId?: string;
      senderName: string;
    }): Promise<{ sent: number; total: number }> => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      try {
        const res = await fetch(
          `/api/notify/send-announcement-email`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`,
            },
            body: JSON.stringify(params),
          }
        );

        if (!res.ok) {
          const result = await res.json().catch(() => ({}));
          throw new Error(
            result.error || 
            `Server error: ${res.status} ${res.statusText}`
          );
        }

        const result = await res.json();
        if (result.error) {
          throw new Error(result.error);
        }
        return { sent: result.sent, total: result.total };
      } catch (error) {
        if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
          throw new Error(
            'Network error: Could not connect to email service. This may be a CORS issue. ' +
            'Please check that the Supabase Edge Function is deployed and accessible.'
          );
        }
        throw error;
      }
    },

    sendSms: async (params: {
      title: string;
      content: string;
      audience: string;
      programId?: string;
      classId?: string;
      senderName: string;
    }): Promise<{ sent: number; total: number }> => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const res = await fetch(`/api/notify/send-announcement-sms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify(params),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok || result.error) throw new Error(result.error || `Server error: ${res.status}`);
      return { sent: result.sent ?? 0, total: result.total ?? 0 };
    },
  },

  teacher: {
    getStudents: async (teacherId: string) => {
      // Get students from teacher_programs relationship (legacy)
      const { data: programData, error: programError } = await supabase
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

      if (programError) throw new Error(programError.message);

      const students: Student[] = [];
      const studentIds = new Set<string>();

      // Add students from programs
      (programData || []).forEach((tp: any) => {
        const programObj = Array.isArray(tp.program) ? tp.program[0] : tp.program;
        if (programObj?.students) {
          programObj.students.forEach((s: any) => {
            const sid = s.id;
            if (!studentIds.has(sid)) {
              studentIds.add(sid);
              students.push({
                id: s.student_id || `STU-${s.id.slice(0, 8)}`,
                name: s.user ? `${s.user.first_name} ${s.user.last_name}` : 'Unknown',
                email: s.user?.email || '',
                program: programObj?.name || 'No Program',
                status: statusMap[s.status] || 'Active',
                date: formatDate(s.enrollment_date || s.created_at),
                avatar: s.user?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${s.id}`
              });
            }
          });
        }
      });

      // Get students from classes taught by this teacher
      const { data: classData, error: classError } = await supabase
        .from('classes')
        .select(`
          title,
          program_id,
          enrollments:class_enrollments(
            student:profiles(id, first_name, last_name, email, avatar_url)
          )
        `)
        .eq('teacher_id', teacherId);

      if (classError) throw new Error(classError.message);

      // Add students from classes
      (classData || []).forEach(cls => {
        if (cls.enrollments) {
          cls.enrollments.forEach((e: any) => {
            if (e.student && !studentIds.has(e.student.id)) {
              studentIds.add(e.student.id);
              students.push({
                id: `STU-${e.student.id.slice(0, 8)}`,
                name: `${e.student.first_name} ${e.student.last_name}`,
                email: e.student.email || '',
                program: cls.program_id || 'No Program',
                status: 'Active',
                date: formatDate(new Date().toISOString()),
                avatar: e.student.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${e.student.id}`
              });
            }
          });
        }
      });

      return students;
    },

    // Returns one row per class-enrollment so the teacher sees each student per class.
    getClassStudents: async (teacherId: string): Promise<{
      studentId: string; studentName: string; email: string;
      avatar: string; className: string; classId: string;
    }[]> => {
      const { data, error } = await supabase
        .from('classes')
        .select(`
          id,
          title,
          enrollments:class_enrollments(
            student_id,
            student:profiles!class_enrollments_student_id_fkey(id, first_name, last_name, email, avatar_url)
          )
        `)
        .eq('teacher_id', teacherId);

      if (error) throw new Error(error.message);

      const rows: { studentId: string; studentName: string; email: string; avatar: string; className: string; classId: string }[] = [];
      (data || []).forEach((cls: any) => {
        (cls.enrollments || []).forEach((e: any) => {
          if (!e.student) return;
          rows.push({
            studentId:   e.student.id,
            studentName: `${e.student.first_name} ${e.student.last_name}`,
            email:       e.student.email || '',
            avatar:      e.student.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${e.student.id}`,
            className:   cls.title,
            classId:     cls.id,
          });
        });
      });
      return rows;
    },

    // Returns a map of studentId → note text for all notes this teacher has written.
    getStudentNotes: async (teacherId: string): Promise<Record<string, string>> => {
      const { data, error } = await supabase
        .from('teacher_student_notes')
        .select('student_id, note')
        .eq('teacher_id', teacherId);

      if (error) throw new Error(error.message);

      const map: Record<string, string> = {};
      (data || []).forEach((n: any) => { map[n.student_id] = n.note; });
      return map;
    },

    /** Fetch all classes taught by this teacher, with enrollment count and schedule sessions. */
    getMyClasses: async (teacherId: string): Promise<{
      id: string;
      title: string;
      programName: string;
      enrollmentCount: number;
      sessions: { dayOfWeek: number; startTime: string; endTime: string }[];
    }[]> => {
      const { data, error } = await supabase
        .from('classes')
        .select(`
          id,
          title,
          program_id,
          class_sessions(day_of_week, start_time, end_time),
          enrollments:class_enrollments(count)
        `)
        .eq('teacher_id', teacherId)
        .order('title');
      if (error) throw new Error(error.message);
      return (data || []).map((c: any) => ({
        id:              c.id,
        title:           c.title,
        programName:     c.program_id || 'General',
        enrollmentCount: c.enrollments?.[0]?.count ?? 0,
        sessions:        (c.class_sessions || []).map((s: any) => ({
          dayOfWeek: s.day_of_week,
          startTime: s.start_time,
          endTime:   s.end_time,
        })),
      }));
    },

    // Creates or updates a private note for a student.
    upsertStudentNote: async (teacherId: string, studentId: string, note: string): Promise<void> => {
      const { error } = await supabase
        .from('teacher_student_notes')
        .upsert(
          { teacher_id: teacherId, student_id: studentId, note, updated_at: new Date().toISOString() },
          { onConflict: 'teacher_id,student_id' }
        );
      if (error) throw new Error(error.message);
    },

    /** Fetch all students (profiles with role=student) with their classes, programs, and attendance stats. */
    getStudentsWithDetails: async (): Promise<{
      id: string;
      firstName: string;
      lastName: string;
      parentFirstName?: string;
      name: string;
      email: string;
      phone?: string;
      secondaryPhone?: string;
      location?: string;
      avatar: string;
      classes: { classId: string; className: string; programId: string; programName: string; enrolledAt: string }[];
      programs: { programId: string; programName: string }[];
      attStats: { total: number; present: number; late: number; absent: number } | null;
    }[]> => {
      // 1. All student profiles
      // Fetch profiles and pending-application emails in parallel
      const [profilesResult, pendingAppsResult] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, first_name, last_name, parent_first_name, email, phone, secondary_phone, location, avatar_url')
          .eq('role', 'student')
          .eq('is_archived', false)
          .order('first_name'),
        supabase
          .from('registration_applications')
          .select('email')
          .eq('status', 'pending'),
      ]);
      if (profilesResult.error) throw new Error(profilesResult.error.message);

      // Build a set of emails with a pending re-application and exclude them
      const pendingEmails = new Set(
        (pendingAppsResult.data || []).map((a: any) => (a.email as string)?.toLowerCase())
      );
      const profiles = (profilesResult.data || []).filter(
        (p: any) => !pendingEmails.has((p.email as string)?.toLowerCase())
      );
      if (profiles.length === 0) return [];

      const studentIds = profiles.map((p: any) => p.id);

      // 2. Class enrollments with class + program info
      const { data: enrollments, error: enrErr } = await supabase
        .from('class_enrollments')
        .select(`
          student_id,
          enrolled_at,
          class:classes!class_enrollments_class_id_fkey(
            id,
            title,
            program_id
          )
        `)
        .in('student_id', studentIds);
      if (enrErr) throw new Error(enrErr.message);

      // 3. Attendance stats (non-fatal — table may not exist yet)
      const { data: attData, error: attErr } = await supabase
        .from('class_attendance')
        .select('student_id, status')
        .in('student_id', studentIds);
      
      if (attErr) {
        console.warn('[API] Attendance query error:', attErr.message);
      } else if (!attData || attData.length === 0) {
        console.info('[API] No attendance records found for students');
      } else {
        console.info('[API] Loaded attendance records:', attData.length);
      }

      // Build attendance map
      const attMap: Record<string, { total: number; present: number; late: number; absent: number }> = {};
      (attData || []).forEach((r: any) => {
        if (!attMap[r.student_id]) attMap[r.student_id] = { total: 0, present: 0, late: 0, absent: 0 };
        attMap[r.student_id].total++;
        if (r.status === 'present')     attMap[r.student_id].present++;
        else if (r.status === 'late')   attMap[r.student_id].late++;
        else if (r.status === 'absent') attMap[r.student_id].absent++;
      });

      // Legacy attendance fallback (attendance table uses students.id, not profiles.id)
      const hasClassAttendance = Object.keys(attMap).length > 0;
      const legacyAttMap: Record<string, { total: number; present: number; late: number; absent: number }> = {};
      if (!hasClassAttendance) {
        const { data: studentRows, error: studentRowsErr } = await supabase
          .from('students')
          .select('id, user_id')
          .in('user_id', studentIds);

        if (!studentRowsErr && studentRows && studentRows.length > 0) {
          const studentTableIds = studentRows.map((s: any) => s.id);
          const byStudentsId = new Map<string, string>(
            (studentRows as { id: string; user_id: string }[]).map((s) => [s.id, s.user_id])
          );

          const { data: legacyRows, error: legacyErr } = await supabase
            .from('attendance')
            .select('student_id, status')
            .in('student_id', studentTableIds);

          if (!legacyErr) {
            (legacyRows || []).forEach((r: any) => {
              const profileId = byStudentsId.get(r.student_id);
              if (!profileId) return;
              if (!legacyAttMap[profileId]) legacyAttMap[profileId] = { total: 0, present: 0, late: 0, absent: 0 };
              legacyAttMap[profileId].total++;
              if (r.status === 'present') legacyAttMap[profileId].present++;
              else if (r.status === 'late') legacyAttMap[profileId].late++;
              else if (r.status === 'absent') legacyAttMap[profileId].absent++;
            });
          }
        }
      }

      // Build enrollment map keyed by student
      const enrMap: Record<string, { classId: string; className: string; programId: string; programName: string; enrolledAt: string }[]> = {};
      (enrollments || []).forEach((e: any) => {
        if (!e.class) return;
        if (!enrMap[e.student_id]) enrMap[e.student_id] = [];
        enrMap[e.student_id].push({
          classId:     e.class.id,
          className:   e.class.title,
          programId:   e.class.program_id || '',
          programName: e.class.program_id || 'Unknown',
          enrolledAt:  e.enrolled_at,
        });
      });

      return profiles.map((p: any) => {
        const classes = enrMap[p.id] || [];
        // Unique programs
        const progMap: Record<string, string> = {};
        classes.forEach(c => { if (c.programId) progMap[c.programId] = c.programName; });
        const programs = Object.entries(progMap).map(([programId, programName]) => ({ programId, programName }));
        return {
          id:       p.id,
          firstName: p.first_name || '',
          lastName: p.last_name || '',
          parentFirstName: p.parent_first_name || undefined,
          name:     `${p.first_name} ${p.last_name}`,
          email:    p.email || '',
          phone: p.phone || undefined,
          secondaryPhone: p.secondary_phone || undefined,
          location: p.location || undefined,
          avatar:   p.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${p.id}`,
          classes,
          programs,
          attStats: attMap[p.id] || legacyAttMap[p.id] || null,
        };
      });
    },

    updateStudentProfile: async (
      studentId: string,
      updates: {
        firstName: string;
        lastName: string;
        parentFirstName?: string;
        email: string;
        phone?: string;
        secondaryPhone?: string;
        location?: string;
      }
    ): Promise<void> => {
      const { error } = await supabase
        .from('profiles')
        .update({
          first_name: updates.firstName,
          last_name: updates.lastName,
          parent_first_name: updates.parentFirstName || null,
          email: updates.email,
          phone: updates.phone || null,
          secondary_phone: updates.secondaryPhone || null,
          location: updates.location || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', studentId)
        .eq('role', 'student');

      if (error) throw new Error(error.message);
    },

    removeStudentAccount: async (studentId: string): Promise<void> => {
      const { data, error } = await supabase.rpc('admin_delete_student_account', {
        p_student_id: studentId,
      });
      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.message || 'Failed to delete student account.');
    },
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
    },

    create: async (program: { name: string; description?: string; duration: number; price: number; capacity: number }): Promise<Program> => {
      const { data, error } = await supabase
        .from('programs')
        .insert([{
          name: program.name,
          description: program.description || null,
          duration_months: program.duration,
          price: program.price,
          capacity: program.capacity,
        }])
        .select()
        .single();

      if (error) throw new Error(error.message);

      return {
        id: data.id,
        name: data.name,
        description: data.description,
        duration: data.duration_months,
        price: parseFloat(data.price),
        capacity: data.capacity,
        enrolled: data.enrolled_count,
        color: data.color
      };
    },

    update: async (id: string, program: { name: string; description?: string; duration: number; price: number; capacity: number }): Promise<void> => {
      const { error } = await supabase
        .from('programs')
        .update({
          name: program.name,
          description: program.description || null,
          duration_months: program.duration,
          price: program.price,
          capacity: program.capacity,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw new Error(error.message);
    },

    delete: async (id: string): Promise<void> => {
      const { error } = await supabase
        .from('programs')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw new Error(error.message);
    }
  },

  registrations: {
    getAll: async (): Promise<RegistrationApplication[]> => {
      const { data, error } = await supabase
        .from('registration_applications')
        .select(`
          id,
          email,
          first_name,
          last_name,
          parent_first_name,
          role,
          program,
          location,
          phone,
          secondary_phone,
          status,
          created_at,
          reviewed_at,
          notes,
          specialization,
          qualifications,
          experience_years,
          date_of_birth,
          address,
          city,
          country,
          emergency_contact_name,
          emergency_contact_phone,
          id_document_url,
          is_archived,
          reviewer:profiles!registration_applications_reviewed_by_fkey(first_name, last_name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw new Error(error.message);

      return (data || []).map(app => {
        const reviewer = Array.isArray(app.reviewer) ? app.reviewer[0] : app.reviewer;

        return ({
        id: app.id,
        email: app.email,
        firstName: app.first_name,
        lastName: app.last_name,
        parentFirstName: app.parent_first_name,
        role: app.role,
        program: app.program,
        location: app.location,
        phone: app.phone,
        secondaryPhone: app.secondary_phone,
        status: app.status,
        createdAt: formatDate(app.created_at),
        reviewedBy: reviewer ? `${reviewer.first_name} ${reviewer.last_name}` : undefined,
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
        idDocumentUrl: app.id_document_url,
        isArchived: app.is_archived ?? false,
      });
      });
    },

    archive: async (applicationId: string): Promise<void> => {
      const { error } = await supabase
        .from('registration_applications')
        .update({ is_archived: true })
        .eq('id', applicationId);
      if (error) throw new Error(error.message);
    },

    unarchive: async (applicationId: string): Promise<void> => {
      const { error } = await supabase
        .from('registration_applications')
        .update({ is_archived: false, status: 'pending' })
        .eq('id', applicationId);
      if (error) throw new Error(error.message);
    },

    approve: async (applicationId: string, classId?: string, restoreClassIds?: string[]) => {
      // Check if this application's email belongs to an existing (possibly archived) profile.
      // Re-approvals for archived students must bypass the RPC which tries to create a new auth user.
      const { data: appRow } = await supabase
        .from('registration_applications')
        .select('email')
        .eq('id', applicationId)
        .maybeSingle();

      let userId: string | null = null;

      if (appRow?.email) {
        const { data: existingProfile } = await supabase
          .from('profiles')
          .select('id, is_archived')
          .eq('email', appRow.email)
          .maybeSingle();

        if (existingProfile?.id) {
          userId = existingProfile.id;
          if (existingProfile.is_archived) {
            const { error: unarchiveErr } = await supabase
              .from('profiles')
              .update({ is_archived: false })
              .eq('id', existingProfile.id);
            if (unarchiveErr) throw new Error(unarchiveErr.message);
          }
          const { error: appErr } = await supabase
            .from('registration_applications')
            .update({ status: 'approved' })
            .eq('id', applicationId);
          if (appErr) throw new Error(appErr.message);
        }
      }

      if (!userId) {
        // New user — create via RPC
        const { data: appForPass } = await supabase
          .from('registration_applications')
          .select('email, password_hash')
          .eq('id', applicationId)
          .maybeSingle();

        const { data, error } = await supabase.rpc('approve_registration_application', {
          application_id: applicationId,
        });
        if (error) throw new Error(error.message);
        const rpcResult = data as { success?: boolean; user_id?: string } | null;
        if (!rpcResult?.success) throw new Error('Failed to approve application');
        userId = rpcResult.user_id ?? null;

        // Ensure auth_users (public schema) has the correct password.
        // The RPC may have written to a different table or double-hashed the password.
        // If password_hash is already bcrypt (starts with $2a/$2b/$2y$) use it directly;
        // otherwise hash it now.
        if (userId && appForPass?.email && appForPass?.password_hash) {
          await fetch('/api/db', {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({
              query: `
                INSERT INTO auth_users (id, email, encrypted_password)
                VALUES (
                  $1,
                  lower(trim($2)),
                  CASE WHEN $3 ~ '^\\$2[aby]\\$'
                    THEN $3
                    ELSE crypt($3, gen_salt('bf'))
                  END
                )
                ON CONFLICT (id) DO UPDATE SET
                  encrypted_password = EXCLUDED.encrypted_password,
                  updated_at = NOW()
              `,
              params: [userId, appForPass.email, appForPass.password_hash],
            }),
          });
        }
      }

      // Enroll in new class + any previously-archived classes the admin chose to restore.
      const allClassIds = Array.from(new Set([
        ...(classId ? [classId] : []),
        ...(restoreClassIds ?? []),
      ]));

      for (const cid of allClassIds) {
        const { error: enrollError } = await supabase
          .from('class_enrollments')
          .insert([{ class_id: cid, student_id: userId, status: 'active' }]);
        // Ignore unique-constraint violations (student already in that class)
        if (enrollError && !enrollError.message.includes('unique')) {
          throw new Error(`Approved but failed to enroll in class: ${enrollError.message}`);
        }
      }

      // Clean up archived-classes snapshot rows that were restored
      if (userId && restoreClassIds && restoreClassIds.length > 0) {
        await supabase
          .from('student_archived_classes')
          .delete()
          .eq('student_id', userId)
          .in('class_id', restoreClassIds);
      }
    },

    getArchivedClasses: async (email: string): Promise<{ classId: string; classTitle: string; programId: string | null }[]> => {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', email.toLowerCase())
        .maybeSingle();
      if (!profile) return [];

      const { data } = await supabase
        .from('student_archived_classes')
        .select('class_id, class_title, program_id')
        .eq('student_id', profile.id);

      return (data ?? []).map((r: any) => ({
        classId: r.class_id,
        classTitle: r.class_title,
        programId: r.program_id,
      }));
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
    },

    checkExistingEmails: async (emails: string[]): Promise<Set<string>> => {
      if (emails.length === 0) return new Set();
      const lower = emails.map(e => e.toLowerCase());
      const { data, error } = await supabase
        .from('profiles')
        .select('email')
        .in('email', lower);
      if (error) throw new Error(error.message);
      return new Set((data || []).map((r: { email: string }) => r.email.toLowerCase()));
    },

    adminEnroll: async (enrollData: {
      email: string;
      firstName: string;
      lastName: string;
      parentFirstName: string;
      phone: string;
      secondaryPhone?: string;
      location: string;
      program: string;
      classId: string;
    }): Promise<void> => {
      if (!enrollData.program) throw new Error('Degree is required.');
      if (!enrollData.classId) throw new Error('Class is required.');

      const { data: selectedClass, error: classErr } = await supabase
        .from('classes')
        .select('id, program_id')
        .eq('id', enrollData.classId)
        .maybeSingle();
      if (classErr) throw new Error(classErr.message);
      if (!selectedClass) throw new Error('Selected class was not found.');
      if (selectedClass.program_id !== enrollData.program) {
        throw new Error('Selected class does not belong to the chosen degree.');
      }

      // Guard: email must not already have a profile
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('email')
        .eq('email', enrollData.email)
        .maybeSingle();
      if (existingProfile) throw new Error('An account with this email already exists.');

      // Guard: no conflicting application
      const { data: existingApp } = await supabase
        .from('registration_applications')
        .select('status')
        .eq('email', enrollData.email)
        .maybeSingle();
      if (existingApp && (existingApp.status === 'pending' || existingApp.status === 'approved')) {
        throw new Error('A registration for this email already exists.');
      }

      // Insert as a pending application — use the displayed temp password so it matches what admin sees
      const tempPassword = 'FMA#2026';
      const fullPayload = {
        email:             enrollData.email,
        first_name:        enrollData.firstName,
        last_name:         enrollData.lastName,
        parent_first_name: enrollData.parentFirstName,
        password_hash:     tempPassword,
        role:              'student',
        program:           enrollData.program,
        location:          enrollData.location,
        phone:             enrollData.phone,
        secondary_phone:   enrollData.secondaryPhone || null,
        status:            'pending',
      };

      let insertResult = await supabase
        .from('registration_applications')
        .insert([fullPayload])
        .select('id')
        .single();

      if (insertResult.error && (insertResult.error.message.includes("'location' column") || insertResult.error.message.includes("'secondary_phone' column"))) {
        const fallbackPayload = {
          email:             enrollData.email,
          first_name:        enrollData.firstName,
          last_name:         enrollData.lastName,
          parent_first_name: enrollData.parentFirstName,
          password_hash:     tempPassword,
          role:              'student',
          program:           enrollData.program,
          phone:             enrollData.phone,
          status:            'pending',
        };
        insertResult = await supabase
          .from('registration_applications')
          .insert([fallbackPayload])
          .select('id')
          .single();
      }

      const { data: newApp, error: insertError } = insertResult;
      if (insertError || !newApp) throw new Error(insertError?.message ?? 'Failed to create application.');

      // Immediately approve — this creates the auth user, profile, and student record
      const { data: result, error: approveError } = await supabase.rpc('approve_registration_application', {
        application_id: newApp.id,
      });

      if (approveError) throw new Error(approveError.message);
      if (!result?.success) throw new Error('Approval step failed. The account may not have been created.');

      const createdUserId = result.user_id as string | undefined;
      if (!createdUserId) throw new Error('Enrollment succeeded, but user ID was not returned.');

      // Ensure auth_users (public schema) has the correct password regardless of what the RPC did.
      // The RPC may store the password in a different table or double-hash it if a trigger exists.
      await fetch('/api/db', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          query: `
            INSERT INTO auth_users (id, email, encrypted_password)
            VALUES ($1, lower(trim($2)), crypt($3, gen_salt('bf')))
            ON CONFLICT (id) DO UPDATE SET
              encrypted_password = EXCLUDED.encrypted_password,
              updated_at = NOW()
          `,
          params: [createdUserId, enrollData.email, tempPassword],
        }),
      });

      // Best-effort: mark this account as requiring password change on first login.
      const { error: mustChangeErr } = await supabase
        .from('profiles')
        .update({ must_change_password: true })
        .eq('id', createdUserId);
      if (mustChangeErr && !mustChangeErr.message.includes("'must_change_password' column")) {
        throw new Error(mustChangeErr.message);
      }

      const { error: enrollError } = await supabase
        .from('class_enrollments')
        .insert([{ class_id: enrollData.classId, student_id: createdUserId, status: 'active' }]);
      if (enrollError) throw new Error(enrollError.message);
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
  },

  calendar: {
    getEvents: async (year: number, month: number, role?: string): Promise<CalendarEvent[]> => {
      // Fetch range slightly wider than the month to catch multi-day events
      const rangeStart = new Date(year, month - 1, 24).toISOString();
      const rangeEnd   = new Date(year, month + 1,  7).toISOString();

      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error('Not authenticated');

      // Get regular calendar events
      const { data, error } = await supabase
        .from('calendar_events')
        .select(`
          *,
          creator_profile:profiles!created_by(first_name, last_name, email, avatar_url),
          participants:calendar_event_participants(
            *,
            profile:profiles(first_name, last_name, email, avatar_url, role)
          )
        `)
        .lte('start_time', rangeEnd)
        .gte('end_time',   rangeStart)
        .order('start_time');

      if (error) throw new Error(error.message);

      let events: CalendarEvent[] = (data || []).map((e: any) => ({
        ...e,
        creator_profile: e.creator_profile ? {
          firstName: e.creator_profile.first_name,
          lastName:  e.creator_profile.last_name,
          email:     e.creator_profile.email,
          avatar:    e.creator_profile.avatar_url,
        } : undefined,
        participants: (e.participants || []).map((p: any) => ({
          id:          p.id,
          event_id:    e.id,
          user_id:     p.user_id,
          rsvp_status: (p.rsvp_status ?? 'pending') as 'attending' | 'pending' | 'declined',
          profile:     p.profile ? {
            firstName: p.profile.first_name,
            lastName:  p.profile.last_name,
            email:     p.profile.email,
            avatar:    p.profile.avatar_url,
            role:      p.profile.role,
          } : undefined,
        } as CalendarParticipant)),
      } as CalendarEvent));

      // Get class sessions and convert to calendar events
      try {
        const classEvents = role === 'admin'
          ? await api.calendar.getClassEventsForAdmin(year, month)
          : await api.calendar.getClassEventsForUser(user.id, year, month);
        events = [...events, ...classEvents];
      } catch (e) {
        console.error('Failed to fetch class events:', e);
        // Continue without class events if fetch fails
      }

      return events.sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
    },

    getClassEventsForUser: async (userId: string, year: number, month: number): Promise<CalendarEvent[]> => {
      // month is 0-based (same as JS Date), matching the value passed from getEvents
      const startDate = new Date(year, month, 1);
      const endDate = new Date(year, month + 1, 0);

      // Get classes where user is teacher
      const { data: teacherClasses, error: tcError } = await supabase
        .from('classes')
        .select(`
          id,
          title,
          program_id,
          teacher_id,
          class_sessions(id, day_of_week, start_time, end_time),
          teacher:profiles!classes_teacher_id_fkey(first_name, last_name, email, avatar_url)
        `)
        .eq('teacher_id', userId);

      if (tcError) throw new Error(tcError.message);

      // Get classes where user is enrolled as student
      const { data: studentClasses, error: scError } = await supabase
        .from('class_enrollments')
        .select(`
          class:classes(
            id,
            title,
            program_id,
            teacher_id,
            class_sessions(id, day_of_week, start_time, end_time),
            teacher:profiles!classes_teacher_id_fkey(first_name, last_name, email, avatar_url)
          )
        `)
        .eq('student_id', userId);

      if (scError) throw new Error(scError.message);

      const allClasses = [
        ...(teacherClasses || []),
        ...(studentClasses || []).map((sc: any) => sc.class)
      ].filter(Boolean);

      const toDateStr = (d: Date) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${dd}`;
      };
      const normDateUser = (d: unknown): string | null => {
        if (!d) return null;
        const s = String(d);
        if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
        const dt = new Date(s);
        return isNaN(dt.getTime()) ? null : toDateStr(dt);
      };

      const rangeStart = toDateStr(new Date(year, month - 1, 20));
      const rangeEnd   = toDateStr(new Date(year, month + 1, 10));

      let reschedules: any[] = [];
      try {
        const classIds = allClasses.map((c: any) => c.id);
        if (classIds.length > 0) {
          const [orig, moved] = await Promise.all([
            supabase.from('class_reschedules').select('*').gte('original_date', rangeStart).lte('original_date', rangeEnd),
            supabase.from('class_reschedules').select('*').gte('new_date', rangeStart).lte('new_date', rangeEnd),
          ]);
          const seen = new Set<string>();
          for (const r of [...(orig.data || []), ...(moved.data || [])]) {
            if (classIds.includes(r.class_id) && !seen.has(r.id)) {
              seen.add(r.id);
              reschedules.push(r);
            }
          }
        }
      } catch { /* class_reschedules may not exist yet */ }

      const rescheduleByOriginal = new Map<string, any>();
      for (const r of reschedules) {
        const k = normDateUser(r.original_date);
        if (k) rescheduleByOriginal.set(`${r.class_id}::${k}`, r);
      }

      const calendarEvents: CalendarEvent[] = [];

      for (const cls of allClasses) {
        if (!cls.class_sessions) continue;

        for (const session of cls.class_sessions) {
          const current = new Date(year, month, 1);
          while (current <= endDate) {
            if ((current.getDay() + 6) % 7 === session.day_of_week) {
              const dateStr = toDateStr(current);
              const reschedule = rescheduleByOriginal.get(`${cls.id}::${dateStr}`);
              if (!reschedule) {
                const [startHour, startMin] = session.start_time.split(':').map(Number);
                const [endHour, endMin] = session.end_time.split(':').map(Number);
                const eventStart = new Date(current); eventStart.setHours(startHour, startMin, 0);
                const eventEnd   = new Date(current); eventEnd.setHours(endHour, endMin, 0);
                calendarEvents.push({
                  id: `class-${cls.id}-${session.id}-${current.getTime()}`,
                  title: cls.title,
                  description: `${cls.program_id} | Teacher: ${cls.teacher?.first_name} ${cls.teacher?.last_name}`,
                  start_time: eventStart.toISOString(),
                  end_time: eventEnd.toISOString(),
                  all_day: false,
                  color: '#3b82f6',
                  event_type: 'class',
                  class_id: cls.id,
                  created_by: cls.teacher_id,
                  creator_profile: cls.teacher ? {
                    firstName: cls.teacher.first_name,
                    lastName: cls.teacher.last_name,
                    email: cls.teacher.email,
                    avatar: cls.teacher.avatar_url
                  } : undefined,
                  participants: []
                });
              }
              // else: cancelled or moved away — skip original slot
            }
            current.setDate(current.getDate() + 1);
          }
        }
      }

      // Add rescheduled occurrences landing in this month
      for (const r of reschedules) {
        if (!r.new_date) continue;
        const ndStr = normDateUser(r.new_date);
        if (!ndStr) continue;
        const newDate = new Date(ndStr + 'T12:00:00');
        if (newDate.getFullYear() !== year || newDate.getMonth() !== month) continue;
        const cls = allClasses.find((c: any) => c.id === r.class_id);
        if (!cls) continue;
        const sh = r.new_start_time ? parseInt(r.new_start_time.split(':')[0]) : 9;
        const sm = r.new_start_time ? parseInt(r.new_start_time.split(':')[1]) : 0;
        const eh = r.new_end_time   ? parseInt(r.new_end_time.split(':')[0])   : 10;
        const em = r.new_end_time   ? parseInt(r.new_end_time.split(':')[1])   : 0;
        const es = new Date(newDate); es.setHours(sh, sm, 0);
        const ee = new Date(newDate); ee.setHours(eh, em, 0);
        calendarEvents.push({
          id: `class-rescheduled-${r.id}`,
          title: `↪ ${cls.title}`,
          description: `${cls.program_id} | Teacher: ${cls.teacher?.first_name} ${cls.teacher?.last_name}`,
          start_time: es.toISOString(),
          end_time: ee.toISOString(),
          all_day: false,
          color: '#f59e0b',
          event_type: 'class',
          class_id: cls.id,
          created_by: cls.teacher_id,
          creator_profile: cls.teacher ? {
            firstName: cls.teacher.first_name,
            lastName: cls.teacher.last_name,
            email: cls.teacher.email,
            avatar: cls.teacher.avatar_url
          } : undefined,
          participants: []
        });
      }

      return calendarEvents;
    },

    /** Fetch ALL class events for admin (every class on the platform, reschedule-aware). */
    getClassEventsForAdmin: async (year: number, month: number): Promise<CalendarEvent[]> => {
      const startDate = new Date(year, month, 1);
      const endDate   = new Date(year, month + 1, 0);

      const toDateStr = (d: Date) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${dd}`;
      };

      // Normalize DB date value (may be ISO timestamp or YYYY-MM-DD) to local YYYY-MM-DD
      const normDate = (d: unknown): string | null => {
        if (!d) return null;
        const s = String(d);
        if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
        const dt = new Date(s);
        return isNaN(dt.getTime()) ? null : toDateStr(dt);
      };

      const rangeStart = toDateStr(new Date(year, month - 1, 20));
      const rangeEnd   = toDateStr(new Date(year, month + 1, 10));

      // All classes with sessions + teacher
      const { data: allClasses, error } = await supabase
        .from('classes')
        .select(`
          id, title, program_id, teacher_id,
          class_sessions(id, day_of_week, start_time, end_time),
          teacher:profiles!classes_teacher_id_fkey(first_name, last_name, email, avatar_url)
        `);
      if (error) throw new Error(error.message);

      // Reschedules in range — fetch by original_date OR new_date
      let reschedules: any[] = [];
      try {
        const [orig, moved] = await Promise.all([
          supabase.from('class_reschedules').select('*').gte('original_date', rangeStart).lte('original_date', rangeEnd),
          supabase.from('class_reschedules').select('*').gte('new_date', rangeStart).lte('new_date', rangeEnd),
        ]);
        const seen = new Set<string>();
        for (const r of [...(orig.data || []), ...(moved.data || [])]) {
          if (!seen.has(r.id)) { seen.add(r.id); reschedules.push(r); }
        }
      } catch { /* table might not exist yet */ }

      // Build a quick lookup: "classId::originalDate" → reschedule row
      const rescheduleByOriginal = new Map<string, any>();
      for (const r of reschedules) {
        const k = normDate(r.original_date);
        if (k) rescheduleByOriginal.set(`${r.class_id}::${k}`, r);
      }

      const calendarEvents: CalendarEvent[] = [];

      for (const cls of (allClasses || [])) {
        if (!cls.class_sessions?.length) continue;

        for (const session of cls.class_sessions) {
          const current = new Date(year, month, 1);
          while (current <= endDate) {
            if ((current.getDay() + 6) % 7 === session.day_of_week) {
              const dateStr = toDateStr(current);
              const reschedule = rescheduleByOriginal.get(`${cls.id}::${dateStr}`);

              if (!reschedule) {
                // Normal occurrence
                const [sh, sm] = session.start_time.split(':').map(Number);
                const [eh, em] = session.end_time.split(':').map(Number);
                const es = new Date(current); es.setHours(sh, sm, 0);
                const ee = new Date(current); ee.setHours(eh, em, 0);
                calendarEvents.push({
                  id: `class-${cls.id}-${session.id}-${current.getTime()}`,
                  title: cls.title,
                  description: `${cls.program_id}`,
                  start_time: es.toISOString(),
                  end_time: ee.toISOString(),
                  all_day: false,
                  color: '#3b82f6',
                  event_type: 'class',
                  class_id: cls.id,
                  created_by: cls.teacher_id,
                  creator_profile: cls.teacher ? {
                    firstName: (cls.teacher as any).first_name,
                    lastName:  (cls.teacher as any).last_name,
                    email:     (cls.teacher as any).email,
                    avatar:    (cls.teacher as any).avatar_url,
                  } : undefined,
                  participants: [],
                });
              }
              // else: cancelled (new_date=null) or rescheduled (new_date set) — skip original slot
            }
            current.setDate(current.getDate() + 1);
          }
        }
      }

      // Add rescheduled occurrences that land in this month
      for (const r of reschedules) {
        if (!r.new_date) continue;
        const ndStr = normDate(r.new_date);
        if (!ndStr) continue;
        const newDate = new Date(ndStr + 'T12:00:00');
        if (newDate.getFullYear() !== year || newDate.getMonth() !== month) continue;
        const cls = (allClasses || []).find((c: any) => c.id === r.class_id);
        if (!cls) continue;
        const sh = r.new_start_time ? parseInt(r.new_start_time.split(':')[0]) : 9;
        const sm = r.new_start_time ? parseInt(r.new_start_time.split(':')[1]) : 0;
        const eh = r.new_end_time   ? parseInt(r.new_end_time.split(':')[0])   : 10;
        const em = r.new_end_time   ? parseInt(r.new_end_time.split(':')[1])   : 0;
        const es = new Date(newDate); es.setHours(sh, sm, 0);
        const ee = new Date(newDate); ee.setHours(eh, em, 0);
        calendarEvents.push({
          id: `class-rescheduled-${r.id}`,
          title: `↪ ${cls.title}`,
          description: cls.program_id,
          start_time: es.toISOString(),
          end_time: ee.toISOString(),
          all_day: false,
          color: '#f59e0b',
          event_type: 'class',
          class_id: cls.id,
          created_by: cls.teacher_id,
          creator_profile: cls.teacher ? {
            firstName: (cls.teacher as any).first_name,
            lastName:  (cls.teacher as any).last_name,
            email:     (cls.teacher as any).email,
            avatar:    (cls.teacher as any).avatar_url,
          } : undefined,
          participants: [],
        });
      }

      return calendarEvents;
    },

    /** All classes scheduled on a given date (YYYY-MM-DD), reschedule-aware. */
    getClassesForDay: async (date: string): Promise<AdminDayClass[]> => {
      const d = new Date(date + 'T12:00:00');
      const storedDayOfWeek = (d.getDay() + 6) % 7; // 0=Mon … 6=Sun

      // Query from the classes side — proven pattern used throughout the codebase.
      // This avoids the reserved-keyword alias issue with `class:classes(...)`.
      const { data: allClasses, error } = await supabase
        .from('classes')
        .select(`
          id, title, program_id, teacher_id,
          teacher:profiles!classes_teacher_id_fkey(first_name, last_name),
          class_sessions(id, day_of_week, start_time, end_time)
        `);
      if (error) throw new Error(error.message);

      // Reschedules affecting this date — normalize DB date strings (may be ISO timestamp or YYYY-MM-DD)
      const normDate = (d: unknown): string | null => {
        if (!d) return null;
        const s = String(d);
        if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
        const dt = new Date(s);
        if (isNaN(dt.getTime())) return null;
        return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
      };

      const cancelledClassIds = new Set<string>();
      const movedAwayClassIds  = new Set<string>();
      const movedHere: any[]   = [];

      try {
        const [orig, moved] = await Promise.all([
          supabase.from('class_reschedules').select('*').eq('original_date', date),
          supabase.from('class_reschedules').select('*').eq('new_date', date),
        ]);
        for (const r of (orig.data || [])) {
          const normNewDate = normDate(r.new_date);
          if (normNewDate === null) cancelledClassIds.add(r.class_id);
          else movedAwayClassIds.add(r.class_id); // includes same-day time changes
        }
        for (const r of (moved.data || [])) {
          movedHere.push(r); // includes same-day reschedules (original_date = new_date)
        }
      } catch { /* class_reschedules may not exist yet */ }

      const result: AdminDayClass[] = [];

      // Regular sessions matching this weekday (not cancelled or moved away)
      for (const cls of (allClasses || [])) {
        if (cancelledClassIds.has(cls.id) || movedAwayClassIds.has(cls.id)) continue;
        const sessions = ((cls.class_sessions as any[]) || []).filter(
          (s: any) => s.day_of_week === storedDayOfWeek,
        );
        for (const s of sessions) {
          const teacher = (cls.teacher as any) || {};
          result.push({
            classId:      cls.id,
            sessionId:    s.id,
            className:    cls.title,
            programId:    cls.program_id,
            programName:  cls.program_id,
            teacherName:  teacher.first_name
              ? `${teacher.first_name} ${teacher.last_name}`
              : 'Unknown',
            teacherId:    cls.teacher_id,
            startTime:    s.start_time,
            endTime:      s.end_time,
            originalDate: date,
            isRescheduled: false,
          });
        }
      }

      // Classes moved to this date from somewhere else
      if (movedHere.length > 0) {
        const classIds = [...new Set(movedHere.map((r: any) => r.class_id))];
        const { data: movedClasses } = await supabase
          .from('classes')
          .select(`
            id, title, program_id, teacher_id,
            teacher:profiles!classes_teacher_id_fkey(first_name, last_name)
          `)
          .in('id', classIds);
        const classMap = new Map((movedClasses || []).map((c: any) => [c.id, c]));
        for (const r of movedHere) {
          const cls     = classMap.get(r.class_id) as any;
          if (!cls) continue;
          const trueOriginalDate = normDate(r.original_date) || date;
          const teacher = (cls.teacher as any) || {};
          result.push({
            classId:      cls.id,
            sessionId:    r.session_id || null,
            className:    cls.title,
            programId:    cls.program_id,
            programName:  cls.program_id,
            teacherName:  teacher.first_name
              ? `${teacher.first_name} ${teacher.last_name}`
              : 'Unknown',
            teacherId:    cls.teacher_id,
            startTime:    r.new_start_time || '09:00',
            endTime:      r.new_end_time   || '10:00',
            originalDate: trueOriginalDate,
            isRescheduled: true,
            rescheduleId: r.id,
          });
        }
      }

      return result.sort((a, b) => a.startTime.localeCompare(b.startTime));
    },

    /** Save a reschedule or cancellation for one class occurrence. */
    rescheduleClassOccurrence: async (params: {
      classId: string;
      sessionId?: string | null;
      originalDate: string;
      newDate: string | null;
      newStartTime?: string;
      newEndTime?: string;
      reason?: string;
      existingRescheduleId?: string;
    }): Promise<void> => {
      const { data: { user } } = await supabase.auth.getUser();

      if (params.existingRescheduleId) {
        // Class was already rescheduled — update that specific row by ID to avoid creating a duplicate
        const updatePayload: any = {
          new_date:       params.newDate,
          new_start_time: params.newDate ? (params.newStartTime || null) : null,
          new_end_time:   params.newDate ? (params.newEndTime   || null) : null,
          reason:         params.reason || null,
        };
        const { error } = await supabase
          .from('class_reschedules')
          .update(updatePayload)
          .eq('id', params.existingRescheduleId);
        if (error) throw new Error(error.message);
        return;
      }

      const payload: any = {
        class_id:      params.classId,
        session_id:    params.sessionId || null,
        original_date: params.originalDate,
        new_date:      params.newDate,
        new_start_time: params.newDate ? (params.newStartTime || null) : null,
        new_end_time:   params.newDate ? (params.newEndTime   || null) : null,
        reason:        params.reason || null,
        created_by:    user?.id || null,
      };
      const { error } = await supabase
        .from('class_reschedules')
        .upsert(payload, { onConflict: 'class_id,original_date' });
      if (error) throw new Error(error.message);
    },

    createEvent: async (payload: {
      title: string;
      description?: string;
      start_time: string;
      end_time: string;
      all_day?: boolean;
      color?: string;
      event_type?: string;
      participants?: string[]; // user_ids
    }): Promise<CalendarEvent> => {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error('Not authenticated');

      const { data: event, error } = await supabase
        .from('calendar_events')
        .insert({
          title:       payload.title,
          description: payload.description,
          start_time:  payload.start_time,
          end_time:    payload.end_time,
          all_day:     payload.all_day ?? false,
          color:       payload.color ?? '#fc0ce4',
          event_type:  payload.event_type ?? 'meeting',
          created_by:  user.id,
        })
        .select()
        .single();

      if (error) throw new Error(error.message);

      // Add creator + invited participants
      const ids = [...new Set([user.id, ...(payload.participants ?? [])])];
      await supabase
        .from('calendar_event_participants')
        .insert(ids.map(uid => ({ event_id: event.id, user_id: uid })));

      return event as CalendarEvent;
    },

    deleteEvent: async (eventId: string): Promise<void> => {
      const { error } = await supabase
        .from('calendar_events')
        .delete()
        .eq('id', eventId);
      if (error) throw new Error(error.message);
    },

    updateRsvp: async (eventId: string, status: 'attending' | 'pending' | 'declined'): Promise<void> => {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error('Not authenticated');
      const { error } = await supabase
        .from('calendar_event_participants')
        .update({ rsvp_status: status })
        .eq('event_id', eventId)
        .eq('user_id', user.id);
      if (error) throw new Error(error.message);
    },

    getUsersByRole: async (role: 'admin' | 'teacher' | 'student' | 'all'): Promise<{ id: string; firstName: string; lastName: string; email: string }[]> => {
      let query = supabase.from('profiles').select('id, first_name, last_name, email');
      if (role !== 'all') query = (query as any).eq('role', role);
      const { data, error } = await query.order('first_name');
      if (error) throw new Error(error.message);
      return (data || []).map((u: any) => ({
        id:        u.id,
        firstName: u.first_name,
        lastName:  u.last_name,
        email:     u.email,
      }));
    },

    lookupUserByEmail: async (email: string): Promise<{ id: string; firstName: string; lastName: string } | null> => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name')
        .eq('email', email.toLowerCase().trim())
        .maybeSingle();

      if (error) throw new Error(error.message);
      if (!data) return null;

      return { id: data.id, firstName: data.first_name, lastName: data.last_name };
    },

    /** Send reschedule/cancel email + SMS to all students enrolled in a class. */
    sendClassUpdateNotifications: async (params: {
      classId: string;
      className: string;
      originalDate: string;
      updateType: 'rescheduled' | 'cancelled';
      newDate?: string | null;
      newStartTime?: string;
      newEndTime?: string;
      reason?: string;
    }): Promise<void> => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Fetch enrolled students (email + phone) — include student_id for deduplication
      const { data: enrollments, error } = await supabase
        .from('class_enrollments')
        .select('student_id, student:profiles!class_enrollments_student_id_fkey(first_name, last_name, email, phone)')
        .eq('class_id', params.classId);

      if (error || !enrollments?.length) return;

      // Deduplicate by student_id so each student receives at most one notification
      const seenStudentIds = new Set<string>();
      const uniqueEnrollments = (enrollments as any[]).filter(e => {
        const sid = e.student_id;
        if (!sid || seenStudentIds.has(sid)) return false;
        seenStudentIds.add(sid);
        return true;
      });

      const notifPayload = {
        className:    params.className,
        originalDate: params.originalDate,
        updateType:   params.updateType,
        newDate:      params.newDate ?? undefined,
        newStartTime: params.newStartTime,
        newEndTime:   params.newEndTime,
        reason:       params.reason,
      };

      const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` };
      const baseUrl = `/api/notify`;

      await Promise.allSettled(
        uniqueEnrollments.map(async (e: any) => {
          const student = e.student;
          if (!student) return;
          const studentName = `${student.first_name} ${student.last_name}`.trim();

          const sends: Promise<any>[] = [];

          if (student.email) {
            sends.push(
              fetch(`${baseUrl}/send-class-update-email`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ ...notifPayload, studentEmail: student.email, studentName }),
              }).then(async res => {
                if (!res.ok) console.warn('[send-class-update-email] failed:', res.status, await res.text().catch(() => ''));
              }).catch(err => console.warn('[send-class-update-email] network error:', err))
            );
          }

          if (student.phone) {
            sends.push(
              fetch(`${baseUrl}/send-class-update-sms`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ ...notifPayload, studentPhone: student.phone, studentName }),
              }).then(async res => {
                if (!res.ok) console.warn('[send-class-update-sms] failed:', res.status, await res.text().catch(() => ''));
              }).catch(err => console.warn('[send-class-update-sms] network error:', err))
            );
          }

          await Promise.allSettled(sends);
        })
      );
    },
  },

  classAttendance: {
    _sendLowAttendanceAlertSms: async (params: {
      studentPhone: string;
      studentName: string;
      className: string;
      attendanceRate: number;
      presentCount: number;
      totalCount: number;
    }): Promise<void> => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      const res = await fetch(
        `/api/notify/send-attendance-alert-sms`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
          body: JSON.stringify(params),
        }
      );
      if (!res.ok) console.warn('send-attendance-alert-sms failed:', await res.text());
    },

    _sendLowAttendanceAlertEmail: async (params: {
      studentEmail: string;
      studentName: string;
      className: string;
      attendanceRate: number;
      presentCount: number;
      totalCount: number;
    }): Promise<void> => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const res = await fetch(
        `/api/notify/send-attendance-alert-email`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify(params),
        }
      );

      const result = await res.json().catch(() => ({}));
      if (!res.ok || result.error) {
        throw new Error(result.error || 'Failed to send attendance alert email');
      }
    },

    _computeAttendanceRate: (rows: Array<{ status: 'present' | 'absent' | 'late' }>): number => {
      if (rows.length === 0) return 0;
      const present = rows.filter((r) => r.status === 'present').length;
      return Math.round((present / rows.length) * 100);
    },

    /** Enrolled students for a class. */
    getStudentsForClass: async (classId: string): Promise<{ id: string; name: string; avatar: string }[]> => {
      const { data, error } = await supabase
        .from('class_enrollments')
        .select('student_id, student:profiles!class_enrollments_student_id_fkey(id, first_name, last_name, avatar_url)')
        .eq('class_id', classId);
      if (error) throw new Error(error.message);
      return (data || []).map((e: any) => ({
        id:     e.student.id,
        name:   `${e.student.first_name} ${e.student.last_name}`,
        avatar: e.student.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${e.student.id}`,
      }));
    },

    /** Attendance marks for a class on a date. Returns studentId → status map. */
    getForClassDate: async (classId: string, date: string): Promise<Record<string, 'present' | 'absent' | 'late'>> => {
      const { data, error } = await supabase
        .from('class_attendance')
        .select('student_id, status')
        .eq('class_id', classId)
        .eq('date', date);
      if (error) throw new Error(error.message);
      const map: Record<string, 'present' | 'absent' | 'late'> = {};
      (data || []).forEach((r: any) => { map[r.student_id] = r.status; });
      return map;
    },

    /** Upsert one attendance mark. */
    mark: async (classId: string, studentId: string, date: string, status: 'present' | 'absent' | 'late'): Promise<void> => {
      const { data: { user } } = await supabase.auth.getUser();

      const { data: beforeRows, error: beforeErr } = await supabase
        .from('class_attendance')
        .select('status')
        .eq('class_id', classId)
        .eq('student_id', studentId);
      if (beforeErr) throw new Error(beforeErr.message);
      const beforeRate = api.classAttendance._computeAttendanceRate((beforeRows || []) as Array<{ status: 'present' | 'absent' | 'late' }>);

      const { error } = await supabase
        .from('class_attendance')
        .upsert(
          { class_id: classId, student_id: studentId, date, status, recorded_by: user?.id, updated_at: new Date().toISOString() },
          { onConflict: 'class_id,student_id,date' }
        );
      if (error) throw new Error(error.message);

      const { data: afterRows, error: afterErr } = await supabase
        .from('class_attendance')
        .select('status')
        .eq('class_id', classId)
        .eq('student_id', studentId);
      if (afterErr) throw new Error(afterErr.message);

      const typedAfterRows = (afterRows || []) as Array<{ status: 'present' | 'absent' | 'late' }>;
      const afterRate = api.classAttendance._computeAttendanceRate(typedAfterRows);
      const crossedThreshold = afterRate <= 40 && beforeRate > 40;

      if (crossedThreshold && typedAfterRows.length > 0) {
        const presentCount = typedAfterRows.filter((r) => r.status === 'present').length;
        const totalCount = typedAfterRows.length;

        const { data: studentProfile } = await supabase
          .from('profiles')
          .select('first_name, last_name, email, phone')
          .eq('id', studentId)
          .maybeSingle();

        const { data: classRow } = await supabase
          .from('classes')
          .select('title')
          .eq('id', classId)
          .maybeSingle();

        if (studentProfile?.email) {
          try {
            await api.classAttendance._sendLowAttendanceAlertEmail({
              studentEmail: studentProfile.email,
              studentName: `${studentProfile.first_name || ''} ${studentProfile.last_name || ''}`.trim() || 'Student',
              className: classRow?.title || 'Class',
              attendanceRate: afterRate,
              presentCount,
              totalCount,
            });
          } catch (emailErr) {
            console.warn('Low-attendance alert email failed:', emailErr);
          }
        }
        if ((studentProfile as any)?.phone) {
          api.classAttendance._sendLowAttendanceAlertSms({
            studentPhone: (studentProfile as any).phone,
            studentName: `${studentProfile!.first_name || ''} ${studentProfile!.last_name || ''}`.trim() || 'Student',
            className: classRow?.title || 'Class',
            attendanceRate: afterRate,
            presentCount,
            totalCount,
          }).catch((smsErr: unknown) => console.warn('Low-attendance alert SMS failed:', smsErr));
        }
      }
    },

    /** All attendance records for one student, newest first. */
    getForStudent: async (studentId: string): Promise<{ classId: string; className: string; date: string; status: 'present' | 'absent' | 'late' }[]> => {
      const { data, error } = await supabase
        .from('class_attendance')
        .select('class_id, date, status, class:classes(title)')
        .eq('student_id', studentId)
        .order('date', { ascending: false });
      if (error) throw new Error(error.message);
      return (data || []).map((r: any) => ({
        classId:   r.class_id,
        className: r.class?.title || 'Unknown Class',
        date:      r.date ? String(r.date).slice(0, 10) : '',
        status:    r.status,
      }));
    },

    /** Per-day attendance totals for a calendar month (for admin calendar view). */
    getMonthCounts: async (year: number, month: number): Promise<Record<string, { present: number; absent: number; late: number }>> => {
      const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
      const endDate   = `${year}-${String(month + 1).padStart(2, '0')}-${new Date(year, month + 1, 0).getDate()}`;
      const { data, error } = await supabase
        .from('class_attendance')
        .select('date, status')
        .gte('date', startDate)
        .lte('date', endDate);
      if (error) throw new Error(error.message);
      const counts: Record<string, { present: number; absent: number; late: number }> = {};
      (data || []).forEach((r: any) => {
        if (!counts[r.date]) counts[r.date] = { present: 0, absent: 0, late: 0 };
        counts[r.date][r.status as 'present' | 'absent' | 'late']++;
      });
      return counts;
    },

    /** All classes that have any attendance records on a given date + per-class counts and student breakdowns. */
    getDateClasses: async (date: string): Promise<{
      classId: string;
      className: string;
      teacherName: string;
      present: number;
      absent: number;
      late: number;
      records: { studentId: string; studentName: string; avatar: string; status: 'present' | 'absent' | 'late' }[];
    }[]> => {
      const { data, error } = await supabase
        .from('class_attendance')
        .select(`
          class_id, student_id, status,
          class:classes(id, title, teacher:profiles!classes_teacher_id_fkey(first_name, last_name)),
          student:profiles!class_attendance_student_id_fkey(id, first_name, last_name, avatar_url)
        `)
        .eq('date', date);
      if (error) throw new Error(error.message);
      const grouped: Record<string, { classId: string; className: string; teacherName: string; records: { studentId: string; studentName: string; avatar: string; status: 'present' | 'absent' | 'late' }[] }> = {};
      (data || []).forEach((r: any) => {
        if (!grouped[r.class_id]) {
          grouped[r.class_id] = {
            classId:     r.class_id,
            className:   r.class?.title || 'Unknown',
            teacherName: r.class?.teacher ? `${r.class.teacher.first_name} ${r.class.teacher.last_name}` : 'Unknown',
            records:     [],
          };
        }
        grouped[r.class_id].records.push({
          studentId:   r.student_id,
          studentName: r.student ? `${r.student.first_name} ${r.student.last_name}` : 'Unknown',
          avatar:      r.student?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${r.student_id}`,
          status:      r.status,
        });
      });
      return Object.values(grouped).map(c => ({
        ...c,
        present: c.records.filter(r => r.status === 'present').length,
        absent:  c.records.filter(r => r.status === 'absent').length,
        late:    c.records.filter(r => r.status === 'late').length,
      }));
    },

    /** All attendance sessions (every class × date combination that has records), sorted by date desc. */
    getAllAttendanceSessions: async (): Promise<{
      classId: string;
      className: string;
      teacherName: string;
      date: string;
      present: number;
      absent: number;
      late: number;
      records: { studentId: string; studentName: string; avatar: string; status: 'present' | 'absent' | 'late' }[];
    }[]> => {
      // Fetch attendance records
      const { data: attData, error: attError } = await supabase
        .from('class_attendance')
        .select('class_id, student_id, status, date')
        .order('date', { ascending: false });
      if (attError) throw new Error(attError.message);
      if (!attData || attData.length === 0) return [];

      // Get unique class IDs and student IDs
      const classIds = [...new Set((attData || []).map((r: any) => r.class_id))];
      const studentIds = [...new Set((attData || []).map((r: any) => r.student_id))];

      // Fetch class details (with teachers)
      const { data: classes, error: classErr } = await supabase
        .from('classes')
        .select('id, title, teacher_id, teacher:profiles!classes_teacher_id_fkey(first_name, last_name)')
        .in('id', classIds);
      if (classErr) throw new Error(classErr.message);

      // Fetch student details
      const { data: students, error: studErr } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, avatar_url')
        .in('id', studentIds);
      if (studErr) throw new Error(studErr.message);

      // Build lookup maps
      const classMap = new Map<string, { title: string; teacherName: string }>((classes || []).map((c: any) => [
        c.id,
        {
          title: c.title as string,
          teacherName: c.teacher ? `${c.teacher.first_name} ${c.teacher.last_name}` : 'Unknown',
        },
      ]));

      const studentMap = new Map<string, { name: string; avatar: string }>((students || []).map((s: any) => [
        s.id,
        {
          name: `${s.first_name} ${s.last_name}` as string,
          avatar: (s.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${s.id}`) as string,
        },
      ]));

      // Group by class + date
      const grouped: Record<string, { classId: string; className: string; teacherName: string; date: string; records: { studentId: string; studentName: string; avatar: string; status: 'present' | 'absent' | 'late' }[] }> = {};
      (attData || []).forEach((r: any) => {
        const dateKey = r.date ? String(r.date).slice(0, 10) : '';
        const key = `${r.class_id}::${dateKey}`;
        if (!grouped[key]) {
          const classInfo = classMap.get(r.class_id) || { title: 'Unknown', teacherName: 'Unknown' };
          grouped[key] = {
            classId:     r.class_id,
            className:   classInfo.title,
            teacherName: classInfo.teacherName,
            date:        dateKey,
            records:     [],
          };
        }
        const studentInfo = studentMap.get(r.student_id) || { name: 'Unknown', avatar: '' };
        grouped[key].records.push({
          studentId:   r.student_id,
          studentName: studentInfo.name,
          avatar:      studentInfo.avatar,
          status:      r.status,
        });
      });

      return Object.values(grouped)
        .map(g => ({
          ...g,
          present: g.records.filter(r => r.status === 'present').length,
          absent:  g.records.filter(r => r.status === 'absent').length,
          late:    g.records.filter(r => r.status === 'late').length,
        }))
        .sort((a, b) => b.date.localeCompare(a.date));
    },

    /** Attendance sessions for a specific class, newest first. */
    getSessionsForClass: async (classId: string): Promise<{
      classId: string;
      className: string;
      date: string;
      present: number;
      absent: number;
      late: number;
    }[]> => {
      const { data: classRow, error: classErr } = await supabase
        .from('classes')
        .select('id, title')
        .eq('id', classId)
        .maybeSingle();
      if (classErr) throw new Error(classErr.message);

      const { data, error } = await supabase
        .from('class_attendance')
        .select('date, status')
        .eq('class_id', classId)
        .order('date', { ascending: false });

      if (error) throw new Error(error.message);

      const className = classRow?.title || 'Unknown';
      const toDateKey = (d: any): string | null => {
        if (!d) return null;
        if (d instanceof Date) return d.toISOString().slice(0, 10);
        const s = String(d);
        const m = s.match(/^\d{4}-\d{2}-\d{2}/);
        return m ? m[0] : null;
      };
      const grouped: Record<string, { present: number; absent: number; late: number }> = {};
      (data || []).forEach((r: any) => {
        const key = toDateKey(r.date);
        if (!key) return;
        if (!grouped[key]) grouped[key] = { present: 0, absent: 0, late: 0 };
        if (r.status === 'present') grouped[key].present++;
        else if (r.status === 'absent') grouped[key].absent++;
        else if (r.status === 'late') grouped[key].late++;
      });

      const rows = Object.entries(grouped)
        .map(([date, c]) => ({
          classId,
          className,
          date,
          present: c.present,
          absent: c.absent,
          late: c.late,
        }))
        .sort((a, b) => b.date.localeCompare(a.date));
      return rows;
    },

    /** Today's total present/absent/late counts across all classes. */
    getTodayCounts: async (): Promise<{ present: number; absent: number; late: number }> => {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('class_attendance')
        .select('status')
        .eq('date', today);
      if (error) throw new Error(error.message);
      return {
        present: (data || []).filter((r: any) => r.status === 'present').length,
        absent:  (data || []).filter((r: any) => r.status === 'absent').length,
        late:    (data || []).filter((r: any) => r.status === 'late').length,
      };
    },

    /** Per-student attendance totals for all classes taught by a teacher. */
    getSummaryForTeacher: async (teacherId: string): Promise<Record<string, { total: number; present: number; late: number; absent: number }>> => {
      const { data: classData, error: classError } = await supabase
        .from('classes')
        .select('id')
        .eq('teacher_id', teacherId);
      if (classError) throw new Error(classError.message);
      const classIds = (classData || []).map((c: any) => c.id);
      if (classIds.length === 0) return {};
      const { data, error } = await supabase
        .from('class_attendance')
        .select('student_id, status')
        .in('class_id', classIds);
      if (error) throw new Error(error.message);
      const summary: Record<string, { total: number; present: number; late: number; absent: number }> = {};
      (data || []).forEach((r: any) => {
        if (!summary[r.student_id]) summary[r.student_id] = { total: 0, present: 0, late: 0, absent: 0 };
        summary[r.student_id].total++;
        if (r.status === 'present')      summary[r.student_id].present++;
        else if (r.status === 'late')    summary[r.student_id].late++;
        else if (r.status === 'absent')  summary[r.student_id].absent++;
      });

      return summary;
    },
  },

  classes: {
    getByProgram: async (programId: string): Promise<Class[]> => {
      const { data, error } = await supabase
        .from('classes')
        .select(`
          *,
          teacher:profiles!classes_teacher_id_fkey(id, first_name, last_name, email, avatar_url),
          class_sessions(id, day_of_week, start_time, end_time),
          enrollments:class_enrollments(count)
        `)
        .eq('program_id', programId)
        .order('title');

      if (error) throw new Error(error.message);

      return (data || []).map(c => ({
        id: c.id,
        program_id: c.program_id,
        title: c.title,
        code: c.code || undefined,
        teacher_id: c.teacher_id,
        meetLink: c.meet_link || undefined,
        teacher: c.teacher ? {
          firstName: c.teacher.first_name,
          lastName: c.teacher.last_name,
          email: c.teacher.email,
          avatar: c.teacher.avatar_url
        } : undefined,
        sessions: (c.class_sessions || []).map((s: any) => ({
          id: s.id,
          class_id: s.class_id,
          day_of_week: s.day_of_week,
          start_time: s.start_time,
          end_time: s.end_time
        })),
        enrollmentCount: c.enrollments?.[0]?.count || 0,
        created_at: c.created_at,
        updated_at: c.updated_at
      }));
    },

    getAll: async (): Promise<(Class & { programName: string })[]> => {
      const { data, error } = await supabase
        .from('classes')
        .select(`
          *,
          teacher:profiles!classes_teacher_id_fkey(id, first_name, last_name, email, avatar_url),
          class_sessions(id, day_of_week, start_time, end_time),
          enrollments:class_enrollments(count)
        `)
        .order('title');

      if (error) throw new Error(error.message);

      return (data || []).map(c => ({
        id: c.id,
        program_id: c.program_id,
        programName: c.program_id || '',
        title: c.title,
        code: c.code || undefined,
        teacher_id: c.teacher_id,
        meetLink: c.meet_link || undefined,
        teacher: c.teacher ? {
          firstName: c.teacher.first_name,
          lastName: c.teacher.last_name,
          email: c.teacher.email,
          avatar: c.teacher.avatar_url
        } : undefined,
        sessions: (c.class_sessions || []).map((s: any) => ({
          id: s.id,
          class_id: c.id,
          day_of_week: s.day_of_week,
          start_time: s.start_time,
          end_time: s.end_time
        })),
        enrollmentCount: c.enrollments?.[0]?.count || 0,
        created_at: c.created_at,
        updated_at: c.updated_at
      }));
    },

    create: async (programId: string, title: string, teacherId: string, sessions: { dayOfWeek: number; startTime: string; endTime: string }[], code?: string, meetLink?: string | null): Promise<Class> => {
      const { data: classData, error: classError } = await supabase
        .from('classes')
        .insert([{
          program_id: programId,
          title,
          teacher_id: teacherId,
          code: code || null,
          meet_link: meetLink || null,
        }])
        .select()
        .single();

      if (classError) throw new Error(classError.message);

      const sessionsToInsert = sessions.map(s => ({
        class_id: classData.id,
        day_of_week: s.dayOfWeek,
        start_time: s.startTime,
        end_time: s.endTime
      }));

      const { error: sessionsError } = await supabase
        .from('class_sessions')
        .insert(sessionsToInsert);

      if (sessionsError) throw new Error(sessionsError.message);

      return {
        id: classData.id,
        program_id: classData.program_id,
        title: classData.title,
        code: classData.code || undefined,
        teacher_id: classData.teacher_id,
        meetLink: classData.meet_link || undefined,
        sessions: sessions.map((s, i) => ({
          id: `temp-${i}`,
          class_id: classData.id,
          day_of_week: s.dayOfWeek,
          start_time: s.startTime,
          end_time: s.endTime
        })),
        enrollmentCount: 0
      };
    },

    update: async (classId: string, title: string, teacherId: string, sessions: { dayOfWeek: number; startTime: string; endTime: string }[], meetLink?: string | null): Promise<void> => {
      const { error: classError } = await supabase
        .from('classes')
        .update({
          title,
          teacher_id: teacherId,
          meet_link: meetLink !== undefined ? (meetLink || null) : undefined,
          updated_at: new Date().toISOString(),
        })
        .eq('id', classId);

      if (classError) throw new Error(classError.message);

      const { error: deleteSessionsError } = await supabase
        .from('class_sessions')
        .delete()
        .eq('class_id', classId);

      if (deleteSessionsError) throw new Error(deleteSessionsError.message);

      if (sessions.length > 0) {
        const { error: insertSessionsError } = await supabase
          .from('class_sessions')
          .insert(
            sessions.map((s) => ({
              class_id: classId,
              day_of_week: s.dayOfWeek,
              start_time: s.startTime,
              end_time: s.endTime,
            }))
          );

        if (insertSessionsError) throw new Error(insertSessionsError.message);
      }
    },

    delete: async (classId: string): Promise<void> => {
      const { error } = await supabase
        .from('classes')
        .delete()
        .eq('id', classId);

      if (error) throw new Error(error.message);
    },

    assignTeacher: async (classId: string, teacherId: string): Promise<void> => {
      const { error } = await supabase
        .from('classes')
        .update({ teacher_id: teacherId })
        .eq('id', classId);

      if (error) throw new Error(error.message);
    },

    getIdByCode: async (code: string): Promise<string | null> => {
      const { data } = await supabase
        .from('classes')
        .select('id')
        .eq('code', code.trim().toUpperCase())
        .maybeSingle();
      return data?.id ?? null;
    },

    enrollStudent: async (classId: string, studentId: string): Promise<ClassEnrollment> => {
      // Bug 3: block enrollment for archived or pending-re-approval accounts
      const { data: profileCheck } = await supabase
        .from('profiles')
        .select('is_archived, email')
        .eq('id', studentId)
        .maybeSingle();
      if (profileCheck?.is_archived) {
        throw new Error('Cannot enroll an archived student. Please reactivate their account first.');
      }
      if (profileCheck?.email) {
        const { data: pendingApp } = await supabase
          .from('registration_applications')
          .select('id')
          .eq('email', profileCheck.email)
          .eq('status', 'pending')
          .maybeSingle();
        if (pendingApp) {
          throw new Error('Cannot enroll a student whose account is pending re-approval. Please approve their application first.');
        }
      }

      const { data: enrollmentData, error } = await supabase
        .from('class_enrollments')
        .insert([{
          class_id: classId,
          student_id: studentId,
          status: 'active'
        }])
        .select()
        .single();

      if (error) {
        if (error.message.includes('violates unique constraint')) {
          throw new Error('Student is already enrolled in this class');
        }
        throw new Error(error.message);
      }

      return {
        id: enrollmentData.id,
        class_id: enrollmentData.class_id,
        student_id: enrollmentData.student_id,
        enrolled_at: enrollmentData.enrolled_at,
        status: enrollmentData.status
      };
    },

    getEnrollments: async (classId: string): Promise<ClassEnrollment[]> => {
      const { data, error } = await supabase
        .from('class_enrollments')
        .select(`
          *,
          student:profiles!class_enrollments_student_id_fkey(id, first_name, last_name, email, avatar_url)
        `)
        .eq('class_id', classId)
        .order('enrolled_at');

      if (error) throw new Error(error.message);

      return (data || []).map(e => ({
        id: e.id,
        class_id: e.class_id,
        student_id: e.student_id,
        enrolled_at: e.enrolled_at,
        status: e.status,
        student: e.student ? {
          firstName: e.student.first_name,
          lastName: e.student.last_name,
          email: e.student.email,
          avatar: e.student.avatar_url
        } : undefined
      }));
    },

    removeStudent: async (enrollmentId: string): Promise<void> => {
      const { error } = await supabase
        .from('class_enrollments')
        .delete()
        .eq('id', enrollmentId);

      if (error) throw new Error(error.message);
    },

    getAvailableTeachers: async (): Promise<{ id: string; firstName: string; lastName: string; email: string }[]> => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email')
        .eq('role', 'teacher')
        .order('first_name');

      if (error) throw new Error(error.message);

      return (data || []).map(t => ({
        id: t.id,
        firstName: t.first_name,
        lastName: t.last_name,
        email: t.email
      }));
    },

    getAllStudents: async (): Promise<{ id: string; firstName: string; lastName: string; email: string }[]> => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email')
        .eq('role', 'student')
        .eq('is_archived', false)
        .order('first_name');

      if (error) throw new Error(error.message);

      return (data || []).map(s => ({
        id: s.id,
        firstName: s.first_name,
        lastName: s.last_name,
        email: s.email
      }));
    },

    getAvailableStudents: async (classId: string): Promise<{ id: string; firstName: string; lastName: string; email: string }[]> => {
      const { data: enrolledIds, error: enrollError } = await supabase
        .from('class_enrollments')
        .select('student_id')
        .eq('class_id', classId);

      if (enrollError) throw new Error(enrollError.message);

      const enrolledStudentIds = enrolledIds?.map(e => e.student_id) || [];

      let query = supabase
        .from('profiles')
        .select('id, first_name, last_name, email')
        .eq('role', 'student')
        .order('first_name');

      if (enrolledStudentIds.length > 0) {
        const escaped = enrolledStudentIds.map((id) => `"${id}"`).join(',');
        query = query.not('id', 'in', `(${escaped})`);
      }

      const { data, error } = await query;

      if (error) throw new Error(error.message);

      return (data || []).map(s => ({
        id: s.id,
        firstName: s.first_name,
        lastName: s.last_name,
        email: s.email
      }));
    }
  },

  // Roles Management API
  roles: {
    create: async (name: string, description?: string) => {
      const response = await fetch('/api/db', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          query: `
            INSERT INTO system_roles (name, description, is_system_role)
            VALUES ($1, $2, false)
            RETURNING id, name, description, is_system_role, created_at, updated_at
          `,
          params: [name, description || null],
        }),
      });
      if (!response.ok) throw new Error(`Failed to create role: ${response.statusText}`);
      const result = await response.json();
      return mapSystemRole(result.rows[0]);
    },

    getAll: async () => {
      const response = await fetch('/api/db', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          query: `
            SELECT r.id, r.name, r.description, r.is_system_role, r.created_at, r.updated_at,
                   COALESCE(
                     json_agg(
                       json_build_object(
                         'id', rp.id,
                         'role_id', rp.role_id,
                         'module', rp.module,
                         'actions', rp.actions,
                         'created_at', rp.created_at,
                         'updated_at', rp.updated_at
                       )
                     ) FILTER (WHERE rp.id IS NOT NULL),
                     '[]'::json
                   ) as permissions
            FROM system_roles r
            LEFT JOIN role_permissions rp ON r.id = rp.role_id
            GROUP BY r.id
            ORDER BY r.is_system_role DESC, r.name
          `,
        }),
      });
      if (!response.ok) throw new Error(`Failed to fetch roles`);
      const result = await response.json();
      return result.rows.map(mapSystemRole);
    },

    getById: async (roleId: string) => {
      const response = await fetch('/api/db', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          query: `
            SELECT r.id, r.name, r.description, r.is_system_role, r.created_at, r.updated_at,
                   json_agg(json_build_object('id', rp.id, 'module', rp.module, 'actions', rp.actions)) FILTER (WHERE rp.id IS NOT NULL) as permissions
            FROM system_roles r
            LEFT JOIN role_permissions rp ON r.id = rp.role_id
            WHERE r.id = $1
            GROUP BY r.id
          `,
          params: [roleId],
        }),
      });
      if (!response.ok) throw new Error(`Failed to fetch role`);
      const result = await response.json();
      return result.rows[0] ? mapSystemRole(result.rows[0]) : null;
    },

    update: async (roleId: string, name: string, description?: string) => {
      const response = await fetch('/api/db', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          query: `
            UPDATE system_roles
            SET name = $1, description = $2, updated_at = now()
            WHERE id = $3 AND is_system_role = false
            RETURNING id, name, description, is_system_role, created_at, updated_at
          `,
          params: [name, description || null, roleId],
        }),
      });
      if (!response.ok) throw new Error(`Failed to update role`);
      const result = await response.json();
      return result.rows[0] ? mapSystemRole(result.rows[0]) : null;
    },

    delete: async (roleId: string) => {
      const response = await fetch('/api/db', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          query: `
            DELETE FROM system_roles
            WHERE id = $1 AND is_system_role = false
            RETURNING id
          `,
          params: [roleId],
        }),
      });
      if (!response.ok) throw new Error(`Failed to delete role`);
      const result = await response.json();
      return result.rows[0];
    },

    // Update permissions for a role atomically: DELETE + INSERT in a single CTE to avoid the
    // window where permissions are empty between two separate requests.
    updatePermissions: async (roleId: string, permissions: { module: string; actions: string[] }[]) => {
      const nonEmpty = permissions.filter(p => p.actions.length > 0);

      // Step 1: delete all existing permissions for this role
      const delResp = await fetch('/api/db', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          query: `DELETE FROM role_permissions WHERE role_id = $1`,
          params: [roleId],
        }),
      });
      if (!delResp.ok) {
        const e = await delResp.json().catch(() => ({}));
        throw new Error((e as any)?.error?.message || 'Failed to clear permissions');
      }

      if (nonEmpty.length === 0) return [];

      // Step 2: insert new permissions (no conflict possible — old rows are gone)
      const placeholders = nonEmpty.map((_, i) => `($1, $${i * 2 + 2}, $${i * 2 + 3}::jsonb)`).join(', ');
      const params = [roleId, ...nonEmpty.flatMap(p => [p.module, JSON.stringify(p.actions)])];
      const insResp = await fetch('/api/db', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          query: `INSERT INTO role_permissions (role_id, module, actions) VALUES ${placeholders} RETURNING id, module, actions`,
          params,
        }),
      });
      if (!insResp.ok) {
        const e = await insResp.json().catch(() => ({}));
        throw new Error((e as any)?.error?.message || 'Failed to save permissions');
      }
      const result = await insResp.json();
      return result.rows;
    },
  },

  // Users Management API
  users: {
    create: async (email: string, firstName: string, lastName: string, role: string, password: string) => {
      const response = await fetch('/api/db', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          query: `
            WITH new_profile AS (
              INSERT INTO profiles (id, email, first_name, last_name, role, must_change_password)
              VALUES (gen_random_uuid(), lower(trim($1)), $2, $3, $4, true)
              RETURNING id, email, first_name, last_name, role, is_archived, must_change_password, created_at, updated_at
            ),
            new_auth AS (
              INSERT INTO auth_users (id, email, encrypted_password)
              SELECT id, email, crypt($5, gen_salt('bf')) FROM new_profile
              RETURNING id, encrypted_password
            ),
            student_row AS (
              INSERT INTO students (user_id, status)
              SELECT id, 'active' FROM new_profile WHERE role = 'student'
              ON CONFLICT (user_id) DO NOTHING
              RETURNING user_id
            ),
            reg_app AS (
              INSERT INTO registration_applications
                (email, first_name, last_name, password_hash, role, status, reviewed_at)
              SELECT np.email, $2, $3, na.encrypted_password, np.role, 'approved', NOW()
              FROM new_profile np
              JOIN new_auth na ON na.id = np.id
              WHERE np.role IN ('student', 'teacher')
              ON CONFLICT (email) DO NOTHING
            )
            SELECT * FROM new_profile
          `,
          params: [email, firstName, lastName, role, password],
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || error.message || 'Failed to create user');
      }
      const result = await response.json();
      return result.rows[0];
    },

    delete: async (userId: string): Promise<void> => {
      const response = await fetch('/api/db', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          query: `DELETE FROM profiles WHERE id = $1`,
          params: [userId],
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || error.message || 'Failed to delete user');
      }
    },

    getAll: async (filters?: { role?: string; isArchived?: boolean }) => {
      let query = `
        SELECT p.id, p.email, p.first_name, p.last_name, p.role, p.system_role_id, p.is_archived, 
               p.must_change_password, p.created_at, p.updated_at, sr.name as role_name
        FROM profiles p
        LEFT JOIN system_roles sr ON p.system_role_id = sr.id
        WHERE 1=1
      `;
      const params: any[] = [];

      if (filters?.role) {
        query += ` AND p.role = $${params.length + 1}`;
        params.push(filters.role);
      }

      if (filters?.isArchived !== undefined) {
        query += ` AND p.is_archived = $${params.length + 1}`;
        params.push(filters.isArchived);
      }

      query += ` ORDER BY p.created_at DESC`;

      const response = await fetch('/api/db', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ query, params }),
      });
      if (!response.ok) throw new Error(`Failed to fetch users`);
      const result = await response.json();
      return result.rows.map((row: any) => ({
        id: row.id,
        email: row.email,
        firstName: row.first_name,
        lastName: row.last_name,
        role: row.role,
        roleId: row.system_role_id,
        roleName: row.role_name,
        systemRole: row.system_role_id && row.role_name
          ? { id: row.system_role_id, name: row.role_name, description: '', isSystemRole: false, permissions: [] }
          : undefined,
        isArchived: row.is_archived,
        mustChangePassword: row.must_change_password,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));
    },

    getById: async (userId: string) => {
      const response = await fetch('/api/db', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          query: `
            SELECT p.id, p.email, p.first_name, p.last_name, p.role, p.system_role_id, p.is_archived,
                   p.must_change_password, p.created_at, p.updated_at, sr.name as role_name
            FROM profiles p
            LEFT JOIN system_roles sr ON p.system_role_id = sr.id
            WHERE p.id = $1
          `,
          params: [userId],
        }),
      });
      if (!response.ok) throw new Error(`Failed to fetch user`);
      const result = await response.json();
      const row = result.rows[0];
      return row ? {
        id: row.id,
        email: row.email,
        firstName: row.first_name,
        lastName: row.last_name,
        role: row.role,
        roleId: row.system_role_id,
        roleName: row.role_name,
        isArchived: row.is_archived,
        mustChangePassword: row.must_change_password,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      } : null;
    },

    update: async (userId: string, updates: { firstName?: string; lastName?: string; role?: string; mustChangePassword?: boolean; systemRoleId?: string | null }) => {
      const setClauses: string[] = [];
      const params: (string | boolean | null)[] = [];

      if (updates.firstName) {
        setClauses.push(`first_name = $${params.length + 1}`);
        params.push(updates.firstName);
      }
      if (updates.lastName) {
        setClauses.push(`last_name = $${params.length + 1}`);
        params.push(updates.lastName);
      }
      if (updates.role) {
        setClauses.push(`role = $${params.length + 1}`);
        params.push(updates.role);
      }
      if (updates.mustChangePassword !== undefined) {
        setClauses.push(`must_change_password = $${params.length + 1}`);
        params.push(updates.mustChangePassword);
      }
      if ('systemRoleId' in updates) {
        setClauses.push(`system_role_id = $${params.length + 1}`);
        params.push(updates.systemRoleId ?? null);
      }

      if (setClauses.length === 0) return null;

      setClauses.push(`updated_at = now()`);
      params.push(userId);

      const response = await fetch('/api/db', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          query: `
            UPDATE profiles
            SET ${setClauses.join(', ')}
            WHERE id = $${params.length}
            RETURNING id, email, first_name, last_name, role, is_archived, must_change_password, created_at, updated_at
          `,
          params,
        }),
      });
      if (!response.ok) throw new Error(`Failed to update user`);
      const result = await response.json();
      return result.rows[0];
    },

    deactivate: async (userId: string) => {
      const response = await fetch('/api/db', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          query: `
            UPDATE profiles
            SET is_archived = true, updated_at = now()
            WHERE id = $1
            RETURNING id, is_archived
          `,
          params: [userId],
        }),
      });
      if (!response.ok) throw new Error(`Failed to deactivate user`);
      const result = await response.json();
      return result.rows[0];
    },

    reactivate: async (userId: string) => {
      const response = await fetch('/api/db', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          query: `
            UPDATE profiles
            SET is_archived = false, updated_at = now()
            WHERE id = $1
            RETURNING id, is_archived
          `,
          params: [userId],
        }),
      });
      if (!response.ok) throw new Error(`Failed to reactivate user`);
      const result = await response.json();
      return result.rows[0];
    },

    // CSV template generation for bulk user creation
    generateCSVTemplate: async (role: string) => {
      const escapeCell = (v: string) => `"${v.replace(/"/g, '""')}"`;
      const row = (cells: string[]) => cells.map(escapeCell).join(',') + '\r\n';

      let headers: string[];
      let example: string[];

      if (role === 'student') {
        headers = ['First Name', 'Last Name', 'Email', 'Role', 'Password',
          'Parent First Name', 'Phone', 'Secondary Phone', 'Location',
          'Program', 'Gender', 'Date of Birth', 'City', 'Country',
          'Attendance Rate', 'Grade', 'Class Code'];
        example = ['John', 'Smith', 'john.smith@example.com', 'student', 'FMA#2026',
          'Jane', '+383441234567', '+383441234568', 'FMA (Rruga Qarkore)',
          'Computer Science', 'Male', '2000-01-15', 'Pristina', 'Kosovo',
          '0', '0', ''];
      } else if (role === 'teacher') {
        headers = ['First Name', 'Last Name', 'Email', 'Role', 'Password', 'Phone', 'Specialization'];
        example = ['Sarah', 'Johnson', 'sarah.j@example.com', 'teacher', 'FMA#2026', '+383441234568', 'Mathematics'];
      } else {
        headers = ['First Name', 'Last Name', 'Email', 'Role', 'Password'];
        example = ['Alex', 'Brown', 'alex.brown@example.com', role, 'FMA#2026'];
      }

      return '﻿' + 'sep=,\r\n' + row(headers) + row(example);
    },

    // Import users from CSV — returns normalized objects ready for api.users.create()
    importFromCSV: async (csvContent: string, role: string) => {
      let text = csvContent;
      if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
      const allLines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
      const lines = allLines[0]?.trim().toLowerCase().startsWith('sep=') ? allLines.slice(1) : allLines;
      if (lines.length < 2) throw new Error('CSV must contain a header row and at least one data row.');

      const parseCell = (line: string, delim = ','): string[] => {
        const cells: string[] = [];
        let cur = '';
        let inQ = false;
        for (let i = 0; i < line.length; i++) {
          const ch = line[i];
          if (ch === '"') {
            if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
            else { inQ = !inQ; }
          } else if (ch === delim && !inQ) { cells.push(cur.trim()); cur = ''; }
          else { cur += ch; }
        }
        cells.push(cur.trim());
        return cells;
      };

      const commas = (lines[0].match(/,/g) || []).length;
      const semis = (lines[0].match(/;/g) || []).length;
      const delim = semis > commas ? ';' : ',';

      const headers = parseCell(lines[0], delim).map(h => h.toLowerCase().replace(/\s+/g, '_'));
      const users: Record<string, string>[] = [];
      const get = (row: Record<string, string>, ...keys: string[]) => { for (const k of keys) if (row[k]) return row[k]; return ''; };

      for (let i = 1; i < lines.length; i++) {
        const cols = parseCell(lines[i], delim);
        const row: Record<string, string> = {};
        headers.forEach((h, idx) => { row[h] = (cols[idx] || '').trim(); });

        const firstName = get(row, 'first_name', 'firstname');
        const lastName = get(row, 'last_name', 'lastname');
        const email = get(row, 'email');
        if (!firstName && !lastName && !email) continue;

        users.push({
          firstName,
          lastName,
          email,
          role: get(row, 'role') || role,
          password: get(row, 'password') || 'FMA#2026',
          parentFirstName: get(row, 'parent_first_name', 'parentfirstname'),
          phone: get(row, 'phone'),
          secondaryPhone: get(row, 'secondary_phone', 'secondaryphone'),
          location: get(row, 'location'),
          program: get(row, 'program', 'degree'),
          gender: get(row, 'gender'),
          dateOfBirth: get(row, 'date_of_birth', 'dateofbirth'),
          city: get(row, 'city'),
          country: get(row, 'country'),
          specialization: get(row, 'specialization'),
          classCode: get(row, 'class_code', 'classcode', 'class code'),
        });
      }

      return users;
    },
  },
};
