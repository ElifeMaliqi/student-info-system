import { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search, Plus, Filter, FileText, CheckCircle, XCircle, Clock,
  ChevronLeft, ChevronRight, Download, Loader2, AlertCircle, UserPlus,
  GraduationCap, BarChart2, CheckCircle2, X, Upload, Pencil, Trash2,
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { useDebounce } from '../hooks/useDebounce';
import { SlideOver } from '../components/SlideOver';
import { playPopSound } from '../utils/sound';
import { PROGRAMS } from '../constants/programs';
import { api } from '../services/api';
import { AttendanceRecord, Grade } from '../types';

type AdminStudent = {
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
};

interface EditStudentForm {
  firstName: string;
  lastName: string;
  parentFirstName: string;
  email: string;
  phone: string;
  secondaryPhone: string;
  location: string;
}

type CsvStudentRow = {
  firstName: string;
  lastName: string;
  parentFirstName: string;
  email: string;
  phone: string;
  secondaryPhone?: string;
  location: string;
  program: string;
  classId: string;
};

interface EnrollForm {
  firstName: string;
  lastName: string;
  parentFirstName: string;
  email: string;
  password: string;
  phone: string;
  secondaryPhone: string;
  location: string;
  program: string;
  classId: string;
}

const BLANK_FORM: EnrollForm = {
  firstName: '', lastName: '', parentFirstName: '',
  email: '', password: 'FMA#2026', phone: '', secondaryPhone: '', location: '', program: '', classId: '',
};

const LOCATION_OPTIONS = ['FMA Kids (Dardani)', 'FMA (Rruga Qarkore)'];

export default function Students() {
  const [view, setView] = useState<'list' | 'add' | 'success'>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [selectedStudentForPanel, setSelectedStudentForPanel] = useState<AdminStudent | null>(null);
  const [students, setStudents] = useState<AdminStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const itemsPerPage = 10;
  const navigate = useNavigate();

  // Modals
  const [classesModal, setClassesModal] = useState<{ studentName: string; classes: AdminStudent['classes'] } | null>(null);
  const [programsModal, setProgramsModal] = useState<{ studentName: string; programs: AdminStudent['programs'] } | null>(null);
  const [attModal, setAttModal] = useState<{ studentName: string; stats: NonNullable<AdminStudent['attStats']> } | null>(null);

  // ── Admin-enroll form state ────────────────────────────────────────────────
  const [form, setForm] = useState<EnrollForm>(BLANK_FORM);
  const [enrolling, setEnrolling] = useState(false);
  const [enrollError, setEnrollError] = useState('');
  const [enrolledName, setEnrolledName] = useState('');
  const [degreeClasses, setDegreeClasses] = useState<{ id: string; title: string }[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(false);
  const [editingStudent, setEditingStudent] = useState<AdminStudent | null>(null);
  const [editForm, setEditForm] = useState<EditStudentForm>({
    firstName: '',
    lastName: '',
    parentFirstName: '',
    email: '',
    phone: '',
    secondaryPhone: '',
    location: '',
  });
  const [savingEdit, setSavingEdit] = useState(false);
  const [importingCsv, setImportingCsv] = useState(false);
  const csvInputRef = useRef<HTMLInputElement | null>(null);
  const [insightPanel, setInsightPanel] = useState<{
    type: 'grades' | 'attendance' | 'payments';
    student: AdminStudent;
  } | null>(null);
  const [insightLoading, setInsightLoading] = useState(false);
  const [insightError, setInsightError] = useState('');
  const [insightGrades, setInsightGrades] = useState<Grade[]>([]);
  const [insightAttendance, setInsightAttendance] = useState<AttendanceRecord[]>([]);
  const [insightPayments, setInsightPayments] = useState<any[]>([]);
  const [insightInvoices, setInsightInvoices] = useState<any[]>([]);

  const debouncedSearch = useDebounce(searchQuery, 300);
  const { t } = useLanguage();
  const location = useLocation();

  useEffect(() => { void loadStudents(); }, []);

  async function loadStudents() {
    setLoading(true);
    try { setStudents(await api.teacher.getStudentsWithDetails()); }
    catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  // Open the enroll form when navigated here with ?enroll=1
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('enroll') === '1') {
      setView('add');
      setEnrollError('');
      setForm(BLANK_FORM);
      // Clean the query param without pushing history
      navigate('/students', { replace: true });
    }
  }, [location.search]);

  const filteredStudents = useMemo(() => {
    if (!debouncedSearch.trim()) return students;
    const q = debouncedSearch.toLowerCase();
    return students.filter(s =>
      s.name.toLowerCase().includes(q) ||
      s.email.toLowerCase().includes(q) ||
      s.programs.some(p => p.programName.toLowerCase().includes(q)) ||
      s.classes.some(c => c.className.toLowerCase().includes(q))
    );
  }, [students, debouncedSearch]);

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedStudents(paginatedStudents.map(s => s.id));
    } else {
      setSelectedStudents([]);
    }
  };

  const handleSelectOne = (id: string) => {
    setSelectedStudents(prev => 
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  const handleExport = () => {
    playPopSound();
    alert(`Exporting ${selectedStudents.length > 0 ? selectedStudents.length : filteredStudents.length} students to CSV...`);
  };

  const parseCsvLine = (line: string): string[] => {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }

    values.push(current.trim());
    return values;
  };

  const getHeaderValue = (row: Record<string, string>, keys: string[]): string => {
    for (const key of keys) {
      const foundKey = Object.keys(row).find(k => k.toLowerCase() === key.toLowerCase());
      if (foundKey && row[foundKey]) return row[foundKey];
    }
    return '';
  };

  const handleCsvImport = async (file: File) => {
    setImportingCsv(true);
    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);

      if (lines.length < 2) {
        throw new Error('CSV file must include a header and at least one row.');
      }

      const headers = parseCsvLine(lines[0]).map(h => h.trim());
      const parsedRows: CsvStudentRow[] = [];
      const classCache = new Map<string, { id: string; title: string }[]>();

      for (let i = 1; i < lines.length; i++) {
        const cols = parseCsvLine(lines[i]);
        const row: Record<string, string> = {};
        headers.forEach((header, idx) => { row[header] = (cols[idx] || '').trim(); });

        const firstName = getHeaderValue(row, ['first_name', 'firstName']);
        const lastName = getHeaderValue(row, ['last_name', 'lastName']);
        const parentFirstName = getHeaderValue(row, ['parent_first_name', 'parentFirstName']);
        const email = getHeaderValue(row, ['email']);
        const phone = getHeaderValue(row, ['phone', 'phone_number']);
        const secondaryPhone = getHeaderValue(row, ['secondary_phone', 'secondaryPhone']);
        const location = getHeaderValue(row, ['location']);
        const program = getHeaderValue(row, ['degree', 'program']);
        let classId = getHeaderValue(row, ['class_id', 'classId']);
        const classTitle = getHeaderValue(row, ['class_title', 'class', 'className']);

        if (!firstName || !lastName || !parentFirstName || !email || !phone || !location || !program) {
          throw new Error(`Row ${i + 1} is missing required fields.`);
        }

        if (!classId) {
          if (!classCache.has(program)) {
            const classes = await api.classes.getByProgram(program);
            classCache.set(program, classes.map(c => ({ id: c.id, title: c.title })));
          }
          const cls = classCache.get(program)?.find(c => c.title.toLowerCase() === classTitle.toLowerCase());
          classId = cls?.id || '';
        }

        if (!classId) {
          throw new Error(`Row ${i + 1} needs class_id or a valid class_title under degree '${program}'.`);
        }

        parsedRows.push({ firstName, lastName, parentFirstName, email, phone, secondaryPhone, location, program, classId });
      }

      let successCount = 0;
      const errors: string[] = [];
      for (let i = 0; i < parsedRows.length; i++) {
        const row = parsedRows[i];
        try {
          await api.registrations.adminEnroll({
            email: row.email.toLowerCase(),
            firstName: row.firstName,
            lastName: row.lastName,
            parentFirstName: row.parentFirstName,
            phone: row.phone,
            secondaryPhone: row.secondaryPhone,
            location: row.location,
            program: row.program,
            classId: row.classId,
          });
          successCount++;
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Unknown error';
          errors.push(`Row ${i + 2}: ${msg}`);
        }
      }

      await loadStudents();
      const summary = [`Imported ${successCount}/${parsedRows.length} students.`];
      if (errors.length > 0) {
        summary.push('Errors:');
        summary.push(...errors.slice(0, 10));
      }
      alert(summary.join('\n'));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'CSV import failed.');
    } finally {
      if (csvInputRef.current) csvInputRef.current.value = '';
      setImportingCsv(false);
    }
  };

  const handleEditOpen = (student: AdminStudent) => {
    setEditingStudent(student);
    setEditForm({
      firstName: student.firstName,
      lastName: student.lastName,
      parentFirstName: student.parentFirstName || '',
      email: student.email,
      phone: student.phone || '',
      secondaryPhone: student.secondaryPhone || '',
      location: student.location || '',
    });
  };

  const handleEditSave = async () => {
    if (!editingStudent) return;
    if (!editForm.firstName.trim() || !editForm.lastName.trim() || !editForm.email.includes('@')) {
      alert('Please provide valid first name, last name, and email.');
      return;
    }

    setSavingEdit(true);
    try {
      await api.teacher.updateStudentProfile(editingStudent.id, {
        firstName: editForm.firstName.trim(),
        lastName: editForm.lastName.trim(),
        parentFirstName: editForm.parentFirstName.trim() || undefined,
        email: editForm.email.trim().toLowerCase(),
        phone: editForm.phone.trim() || undefined,
        secondaryPhone: editForm.secondaryPhone.trim() || undefined,
        location: editForm.location || undefined,
      });
      setEditingStudent(null);
      await loadStudents();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update student.');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleRemoveStudent = async (student: AdminStudent) => {
    if (!confirm(`Remove ${student.name}? This will permanently delete the full student account.`)) return;

    try {
      await api.teacher.removeStudentAccount(student.id);
      if (selectedStudentForPanel?.id === student.id) setSelectedStudentForPanel(null);
      await loadStudents();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to remove student.');
    }
  };

  const openInsightPanel = async (type: 'grades' | 'attendance' | 'payments') => {
    if (!selectedStudentForPanel) return;

    setInsightPanel({ type, student: selectedStudentForPanel });
    setInsightLoading(true);
    setInsightError('');
    setInsightGrades([]);
    setInsightAttendance([]);
    setInsightPayments([]);
    setInsightInvoices([]);

    try {
      if (type === 'grades') {
        const data = await api.grades.getAll(selectedStudentForPanel.id);
        setInsightGrades(data);
      } else if (type === 'attendance') {
        const data = await api.attendance.getAll(selectedStudentForPanel.id);
        setInsightAttendance(data);
      } else {
        const [payments, invoices] = await Promise.all([
          api.finance.getPayments(selectedStudentForPanel.id),
          api.finance.getInvoices(selectedStudentForPanel.id),
        ]);
        setInsightPayments(payments || []);
        setInsightInvoices(invoices || []);
      }
    } catch (err) {
      setInsightError(err instanceof Error ? err.message : 'Failed to load student details.');
    } finally {
      setInsightLoading(false);
    }
  };

  // Helper to get month status for payment calendar
  const getMonthPaymentStatus = (year: number, month: number) => {
    if (!selectedStudentForPanel?.classes?.[0]?.enrolledAt) return 'gray';
    
    const enrolledDate = new Date(selectedStudentForPanel.classes[0].enrolledAt);
    const enrollYear = enrolledDate.getFullYear();
    const enrollMonth = enrolledDate.getMonth();
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth();
    
    const targetDate = new Date(year, month);
    
    // Before enrollment or after current month
    if (year < enrollYear || (year === enrollYear && month < enrollMonth)) return 'gray';
    if (year > currentYear || (year === currentYear && month > currentMonth)) return 'gray';
    
    // Check if paid
    const isPaid = insightPayments.some((p: any) => {
      const payDate = new Date(p.payment_date || p.date);
      return payDate.getFullYear() === year && payDate.getMonth() === month;
    });
    
    return isPaid ? 'green' : 'red';
  };

  const totalPages = Math.ceil(filteredStudents.length / itemsPerPage);
  const paginatedStudents = filteredStudents.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  function setField(key: keyof EnrollForm, value: string) {
    setForm(f => ({ ...f, [key]: value }));
    setEnrollError('');
  }

  useEffect(() => {
    if (!form.program) {
      setDegreeClasses([]);
      setForm(f => ({ ...f, classId: '' }));
      return;
    }

    let cancelled = false;
    setLoadingClasses(true);
    api.classes.getByProgram(form.program)
      .then((rows) => {
        if (cancelled) return;
        setDegreeClasses(rows.map(c => ({ id: c.id, title: c.title })));
      })
      .catch(() => {
        if (cancelled) return;
        setDegreeClasses([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingClasses(false);
      });

    return () => { cancelled = true; };
  }, [form.program]);

  async function handleAdminEnroll(e: React.FormEvent) {
    e.preventDefault();
    setEnrollError('');

    if (!form.firstName.trim())  { setEnrollError('First name is required.'); return; }
    if (!form.lastName.trim())   { setEnrollError('Last name is required.'); return; }
    if (!form.parentFirstName.trim()) { setEnrollError("Parent's first name is required."); return; }
    if (!form.email.includes('@')) { setEnrollError('Please enter a valid email address.'); return; }
    if (!form.phone.trim()) { setEnrollError('Phone number is required.'); return; }
    if (!form.location) { setEnrollError('Please select a location.'); return; }
    if (!form.program) { setEnrollError('Please select a degree.'); return; }
    if (!form.classId) { setEnrollError('Please select a class for this degree.'); return; }

    setEnrolling(true);
    try {
      await api.registrations.adminEnroll({
        email:            form.email.trim().toLowerCase(),
        firstName:        form.firstName.trim(),
        lastName:         form.lastName.trim(),
        parentFirstName:  form.parentFirstName.trim(),
        phone:            form.phone.trim(),
        secondaryPhone:   form.secondaryPhone.trim() || undefined,
        location:         form.location,
        program:          form.program,
        classId:          form.classId,
      });
      setEnrolledName(`${form.firstName.trim()} ${form.lastName.trim()}`);
      setForm(BLANK_FORM);
      setView('success');
    } catch (err) {
      setEnrollError(err instanceof Error ? err.message : 'Enrollment failed. Please try again.');
    } finally {
      setEnrolling(false);
    }
  }

  if (view === 'success') {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        className="h-full flex items-center justify-center p-6"
      >
        <div className="glass-card rounded-3xl p-10 max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-400/10 border border-emerald-400/20 flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-8 h-8 text-emerald-400" />
          </div>
          <h2 className="font-display text-2xl font-medium mb-2">Enrollment Successful</h2>
          <p className="text-white/50 text-sm mb-1">
            <span className="text-white/80 font-medium">{enrolledName}</span> has been enrolled and their account is active.
          </p>
          <p className="text-white/35 text-xs mb-1">Temporary password: <span className="text-white/70 font-medium">FMA#2026</span></p>
          <p className="text-white/35 text-xs mb-8">The student will be required to change this password on first login.</p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => { setView('add'); }}
              className="px-5 py-2.5 rounded-xl border border-white/10 text-sm font-medium hover:bg-white/5 transition-colors"
            >
              Enroll Another
            </button>
            <button
              onClick={() => setView('list')}
              className="bg-gradient-to-r from-[#fc0ce4] to-[#949ce4] text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition-all"
            >
              Back to Students
            </button>
          </div>
        </div>
      </motion.div>
    );
  }

  if (view === 'add') {
    const inp = 'glass-input w-full px-4 py-3 rounded-xl text-sm text-white placeholder:text-white/20';
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-3xl font-medium tracking-tight mb-1">Manual Enrollment</h1>
            <p className="text-white/50 text-sm">Create and immediately activate a student account.</p>
          </div>
          <button
            onClick={() => { setView('list'); setEnrollError(''); setForm(BLANK_FORM); }}
            className="px-4 py-2 rounded-xl border border-white/10 text-sm font-medium hover:bg-white/5 transition-colors"
          >
            {t('students.cancel')}
          </button>
        </div>

        <div className="glass-card rounded-3xl p-6 lg:p-8">
          <form className="space-y-6" onSubmit={handleAdminEnroll}>

            {enrollError && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-start gap-2.5 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                {enrollError}
              </motion.div>
            )}

            {/* Name row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[11px] font-semibold text-white/60 uppercase tracking-widest ml-1">First Name *</label>
                <input
                  type="text" value={form.firstName}
                  onChange={e => setField('firstName', e.target.value)}
                  className={inp} placeholder="John"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-semibold text-white/60 uppercase tracking-widest ml-1">Last Name *</label>
                <input
                  type="text" value={form.lastName}
                  onChange={e => setField('lastName', e.target.value)}
                  className={inp} placeholder="Doe"
                />
              </div>
            </div>

            {/* Parent name */}
            <div className="space-y-2">
              <label className="text-[11px] font-semibold text-white/60 uppercase tracking-widest ml-1">Parent's First Name *</label>
              <input
                type="text" value={form.parentFirstName}
                onChange={e => setField('parentFirstName', e.target.value)}
                className={inp} placeholder="Parent's name"
              />
            </div>

            {/* Email + Phone */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-[11px] font-semibold text-white/60 uppercase tracking-widest ml-1">Email Address *</label>
                <input
                  type="email" value={form.email}
                  onChange={e => setField('email', e.target.value)}
                  className={inp} placeholder="john@example.com"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-semibold text-white/60 uppercase tracking-widest ml-1">Phone Number *</label>
                <input
                  type="tel" value={form.phone}
                  onChange={e => setField('phone', e.target.value)}
                  className={inp} placeholder="+1 (555) 000-0000"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-semibold text-white/60 uppercase tracking-widest ml-1">Secondary Phone (Optional)</label>
                <input
                  type="tel" value={form.secondaryPhone}
                  onChange={e => setField('secondaryPhone', e.target.value)}
                  className={inp} placeholder="+1 (555) 111-1111"
                />
              </div>
            </div>

            {/* Location + Password */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[11px] font-semibold text-white/60 uppercase tracking-widest ml-1">Location *</label>
                <select
                  value={form.location}
                  onChange={e => setField('location', e.target.value)}
                  className="glass-select w-full px-4 py-3 rounded-xl text-sm appearance-none"
                >
                  <option value="">Select Location</option>
                  {LOCATION_OPTIONS.map(loc => (
                    <option key={loc} value={loc}>{loc}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-semibold text-white/60 uppercase tracking-widest ml-1">Initial Password *</label>
                <input
                  type="text" value={form.password}
                  readOnly
                  className={`${inp} opacity-80 cursor-not-allowed`}
                />
                <p className="text-[11px] text-white/35 ml-1">Students must change this password on first login.</p>
              </div>
            </div>

            {/* Degree + Class */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[11px] font-semibold text-white/60 uppercase tracking-widest ml-1">Select Degree *</label>
                <select
                  value={form.program}
                  onChange={e => setField('program', e.target.value)}
                  className="glass-select w-full px-4 py-3 rounded-xl text-sm appearance-none"
                >
                  <option value="">Select Degree</option>
                  {PROGRAMS.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-semibold text-white/60 uppercase tracking-widest ml-1">Select Class *</label>
                <select
                  value={form.classId}
                  onChange={e => setField('classId', e.target.value)}
                  disabled={!form.program || loadingClasses}
                  className="glass-select w-full px-4 py-3 rounded-xl text-sm appearance-none disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="">{!form.program ? 'Select degree first' : loadingClasses ? 'Loading classes...' : 'Select Class'}</option>
                  {degreeClasses.map(cls => (
                    <option key={cls.id} value={cls.id}>{cls.title}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Document upload (optional) */}
            <div className="pt-2 border-t border-white/5">
              <h3 className="text-sm font-medium mb-3">{t('students.doc_upload')} <span className="text-white/30 font-normal text-xs">(optional)</span></h3>
              <div className="border-2 border-dashed border-white/10 rounded-2xl p-6 text-center hover:bg-white/5 hover:border-[#fc0ce4]/30 transition-colors cursor-pointer">
                <FileText className="w-7 h-7 text-white/30 mx-auto mb-2" />
                <p className="text-sm text-white/60">{t('students.drag_drop')}</p>
                <p className="text-[11px] text-white/35 mt-1">{t('students.doc_types')}</p>
              </div>
            </div>

            {/* Footer actions */}
            <div className="flex justify-end gap-3 pt-4 border-t border-white/5">
              <button
                type="button"
                onClick={() => { setView('list'); setEnrollError(''); setForm(BLANK_FORM); }}
                className="px-6 py-3 rounded-xl border border-white/10 text-sm font-medium hover:bg-white/5 transition-colors"
              >
                {t('students.cancel')}
              </button>
              <button
                type="submit"
                disabled={enrolling}
                className="flex items-center gap-2 bg-gradient-to-r from-[#fc0ce4] to-[#949ce4] text-white px-6 py-3 rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed transition-all shadow-[0_0_20px_rgba(252,12,228,0.2)]"
              >
                {enrolling ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                {enrolling ? 'Enrolling...' : 'Enroll Student'}
              </button>
            </div>
          </form>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-medium tracking-tight mb-1">{t('students.title')}</h1>
          <p className="text-white/50 text-sm">{t('students.desc')}</p>
        </div>
        <div className="flex gap-2 self-start sm:self-auto">
          <input
            ref={csvInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleCsvImport(file);
            }}
          />
          <button
            onClick={() => csvInputRef.current?.click()}
            disabled={importingCsv}
            className="px-4 py-2.5 rounded-xl border border-white/10 text-sm font-medium hover:bg-white/5 transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            {importingCsv ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {importingCsv ? 'Importing...' : 'Import CSV'}
          </button>
          <button
            onClick={() => setView('add')}
            className="bg-gradient-to-r from-[#fc0ce4] to-[#949ce4] text-white px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 hover:opacity-90 transition-all shadow-[0_0_20px_rgba(252,12,228,0.2)]"
          >
            <Plus className="w-4 h-4" />
            {t('students.add_new')}
          </button>
        </div>
      </div>

      <div className="glass-card rounded-3xl p-6 overflow-hidden flex flex-col">
        <div className="flex flex-col md:flex-row gap-4 justify-between mb-6 shrink-0">
          <div className="relative w-full md:w-96 group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 group-focus-within:text-[#fc0ce4] transition-colors" />
            <input 
              type="text" 
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1); // Reset to first page on search
              }}
              placeholder={t('students.search')} 
              className="w-full bg-white/5 border border-white/5 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#fc0ce4]/40 focus:bg-[#fc0ce4]/5 focus:shadow-[0_0_15px_rgba(252,12,228,0.1)] transition-all"
            />
          </div>
          <div className="flex gap-2">
            <button 
              onClick={handleExport}
              className="px-4 py-2.5 rounded-xl border border-white/10 text-sm font-medium hover:bg-white/5 transition-colors flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
            <button className="px-4 py-2.5 rounded-xl border border-white/10 text-sm font-medium hover:bg-white/5 transition-colors flex items-center gap-2">
              <Filter className="w-4 h-4" />
              {t('students.filter')}
            </button>
          </div>
        </div>

        <div className="overflow-x-auto pb-4 custom-scrollbar flex-1 -mx-6 px-6">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-white/30" />
            </div>
          ) : (
            <table className="w-full text-left border-collapse min-w-[960px]">
              <thead>
                <tr className="border-b border-white/5 text-[11px] uppercase tracking-widest text-white/30">
                  <th className="pb-3 pl-4 w-10">
                    <input
                      type="checkbox"
                      className="rounded border-white/20 bg-transparent text-[#fc0ce4] focus:ring-[#fc0ce4]/50"
                      checked={paginatedStudents.length > 0 && selectedStudents.length === paginatedStudents.length}
                      onChange={handleSelectAll}
                    />
                  </th>
                  <th className="pb-3 font-medium">{t('attendance.student_info')}</th>
                  <th className="pb-3 font-medium">Degree</th>
                  <th className="pb-3 font-medium">Class</th>
                  <th className="pb-3 font-medium">Enrollment Date</th>
                  <th className="pb-3 font-medium">Payment</th>
                  <th className="pb-3 font-medium">Attendance</th>
                  <th className="pb-3 font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {paginatedStudents.length > 0 ? (
                  paginatedStudents.map((student) => {
                    const attRate = student.attStats && student.attStats.total > 0
                      ? Math.round(((student.attStats.present + student.attStats.late) / student.attStats.total) * 100)
                      : null;
                    const firstProgram = student.programs[0];
                    const extraPrograms = student.programs.length - 1;
                    const firstClass = student.classes[0];
                    const extraClasses = student.classes.length - 1;
                    const enrollDate = firstClass?.enrolledAt
                      ? new Date(firstClass.enrolledAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                      : '–';
                    return (
                      <tr
                        key={student.id}
                        className={`border-b border-white/5 hover:bg-white/[0.02] transition-colors group cursor-pointer ${selectedStudents.includes(student.id) ? 'bg-white/5' : ''}`}
                        onClick={() => { playPopSound(); setSelectedStudentForPanel(student); }}
                      >
                        <td className="py-4 pl-4" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            className="rounded border-white/20 bg-transparent text-[#fc0ce4] focus:ring-[#fc0ce4]/50"
                            checked={selectedStudents.includes(student.id)}
                            onChange={() => handleSelectOne(student.id)}
                          />
                        </td>
                        <td className="py-4">
                          <div className="flex items-center gap-3">
                            <img src={student.avatar} alt={student.name} className="w-9 h-9 rounded-full border border-white/10 shrink-0" referrerPolicy="no-referrer" />
                            <div>
                              <div className="font-medium text-white/90 group-hover:text-white transition-colors">{student.name}</div>
                              <div className="text-[11px] text-white/40 font-mono mt-0.5">{student.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-4">
                          {firstProgram ? (
                            <div className="flex items-center gap-1.5">
                              <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium bg-purple-500/15 text-purple-300 border border-purple-500/20 truncate max-w-[110px]">
                                {firstProgram.programName}
                              </span>
                              {extraPrograms > 0 && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); setProgramsModal({ studentName: student.name, programs: student.programs }); }}
                                  className="text-[10px] text-white/40 hover:text-white bg-white/5 hover:bg-white/10 px-1.5 py-0.5 rounded-full border border-white/10 transition-colors"
                                >
                                  +{extraPrograms}
                                </button>
                              )}
                            </div>
                          ) : <span className="text-white/30">–</span>}
                        </td>
                        <td className="py-4">
                          {firstClass ? (
                            <div className="flex items-center gap-1.5">
                              <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-500/15 text-blue-300 border border-blue-500/20 truncate max-w-[110px]">
                                {firstClass.className}
                              </span>
                              {extraClasses > 0 && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); setClassesModal({ studentName: student.name, classes: student.classes }); }}
                                  className="text-[10px] text-white/40 hover:text-white bg-white/5 hover:bg-white/10 px-1.5 py-0.5 rounded-full border border-white/10 transition-colors"
                                >
                                  +{extraClasses}
                                </button>
                              )}
                            </div>
                          ) : <span className="text-white/30">–</span>}
                        </td>
                        <td className="py-4 text-white/40 text-xs">{enrollDate}</td>
                        <td className="py-4 text-white/30 text-sm">–</td>
                        <td className="py-4">
                          {attRate !== null ? (
                            <button
                              onClick={(e) => { e.stopPropagation(); setAttModal({ studentName: student.name, stats: student.attStats! }); }}
                              className={`text-xs font-semibold px-2 py-1 rounded-lg border transition-colors ${
                                attRate >= 75 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20' :
                                attRate >= 50 ? 'bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20' :
                                'bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20'
                              }`}
                            >
                              {attRate}%
                            </button>
                          ) : <span className="text-white/30">–</span>}
                        </td>
                        <td className="py-4 pr-2" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleEditOpen(student)}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs border border-white/10 hover:bg-white/5 transition-colors"
                              title="Edit student"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                              Edit
                            </button>
                            <button
                              onClick={() => handleRemoveStudent(student)}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs border border-red-500/25 text-red-300 hover:bg-red-500/10 transition-colors"
                              title="Remove student"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              Remove
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={8} className="py-16 text-center">
                      <GraduationCap className="w-10 h-10 text-white/10 mx-auto mb-3" />
                      <p className="text-white/40 text-sm">No students found.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination UI */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-4 border-t border-white/5 mt-auto">
            <div className="text-xs text-white/40">
              Showing <span className="text-white/80 font-medium">{(currentPage - 1) * itemsPerPage + 1}</span> to <span className="text-white/80 font-medium">{Math.min(currentPage * itemsPerPage, filteredStudents.length)}</span> of <span className="text-white/80 font-medium">{filteredStudents.length}</span> students
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg border border-white/10 text-white/60 hover:bg-white/5 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }).map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentPage(i + 1)}
                    className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${
                      currentPage === i + 1 
                        ? 'bg-[#fc0ce4]/20 text-[#fc0ce4] border border-[#fc0ce4]/30' 
                        : 'text-white/60 hover:bg-white/5 hover:text-white border border-transparent'
                    }`}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
              <button 
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg border border-white/10 text-white/60 hover:bg-white/5 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      <SlideOver
        isOpen={!!selectedStudentForPanel}
        onClose={() => setSelectedStudentForPanel(null)}
        title="Student Details"
      >
        {selectedStudentForPanel && (
          <div className="space-y-8">
            <div className="flex flex-col items-center text-center">
              <img
                src={selectedStudentForPanel.avatar}
                alt={selectedStudentForPanel.name}
                className="w-24 h-24 rounded-full border-4 border-white/10 mb-4"
                referrerPolicy="no-referrer"
              />
              <h3 className="text-xl font-display font-medium text-white">{selectedStudentForPanel.name}</h3>
              <p className="text-sm text-white/50 font-mono mt-1">{selectedStudentForPanel.email}</p>
            </div>

            <div className="space-y-3">
              <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                <div className="text-[10px] font-semibold text-white/40 uppercase tracking-widest mb-2">Programs</div>
                {selectedStudentForPanel.programs.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {selectedStudentForPanel.programs.map(p => (
                      <span key={p.programId} className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-purple-500/15 text-purple-300 border border-purple-500/20">{p.programName}</span>
                    ))}
                  </div>
                ) : <span className="text-sm text-white/40">Not enrolled in any program</span>}
              </div>
              <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                <div className="text-[10px] font-semibold text-white/40 uppercase tracking-widest mb-1">Phone</div>
                <div className="text-sm text-white/90">{selectedStudentForPanel.phone || '—'}</div>
              </div>
              <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                <div className="text-[10px] font-semibold text-white/40 uppercase tracking-widest mb-1">Secondary Phone</div>
                <div className="text-sm text-white/90">{selectedStudentForPanel.secondaryPhone || '—'}</div>
              </div>
              <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                <div className="text-[10px] font-semibold text-white/40 uppercase tracking-widest mb-2">Classes</div>
                {selectedStudentForPanel.classes.length > 0 ? (
                  <div className="flex flex-col gap-1.5">
                    {selectedStudentForPanel.classes.map(c => (
                      <div key={c.classId} className="flex items-center justify-between text-sm">
                        <span className="text-white/80">{c.className}</span>
                        <span className="text-[11px] text-white/30">{new Date(c.enrolledAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                      </div>
                    ))}
                  </div>
                ) : <span className="text-sm text-white/40">No classes</span>}
              </div>
              <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                <div className="text-[10px] font-semibold text-white/40 uppercase tracking-widest mb-1">{t('profile.email')}</div>
                <div className="text-sm text-white/90">{selectedStudentForPanel.email}</div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                onClick={() => { void openInsightPanel('grades'); }}
                className="py-2.5 rounded-xl border border-white/10 text-sm font-medium hover:bg-white/5 transition-colors"
              >
                Grades
              </button>
              <button
                onClick={() => { void openInsightPanel('attendance'); }}
                className="py-2.5 rounded-xl border border-white/10 text-sm font-medium hover:bg-white/5 transition-colors"
              >
                Attendance
              </button>
              <button
                onClick={() => { void openInsightPanel('payments'); }}
                className="py-2.5 rounded-xl border border-white/10 text-sm font-medium hover:bg-white/5 transition-colors"
              >
                Payments
              </button>
            </div>
          </div>
        )}
      </SlideOver>

      <AnimatePresence>
        {insightPanel && (
          <>
            {/* Backdrop overlay with blur */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setInsightPanel(null)}
              className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
            />
            
            {/* Floating modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', damping: 24, stiffness: 200 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
            >
              <div className="h-[80vh] w-full sm:max-w-2xl bg-[#0f0f0f]/98 backdrop-blur-xl border border-white/10 shadow-[0_0_50px_rgba(252,12,228,0.1)] rounded-2xl flex flex-col pointer-events-auto overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 shrink-0">
                <h2 className="font-display text-lg font-medium text-white">
                  {`${insightPanel.student.name} • ${insightPanel.type[0].toUpperCase()}${insightPanel.type.slice(1)}`}
                </h2>
                <button
                  onClick={() => setInsightPanel(null)}
                  className="p-2 rounded-full hover:bg-white/10 text-white/60 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                <div className="space-y-4">
                  {insightLoading && (
                    <div className="flex items-center justify-center py-12 text-white/40">
                      <Loader2 className="w-5 h-5 animate-spin" />
                    </div>
                  )}

                  {!insightLoading && insightError && (
                    <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">
                      {insightError}
                    </div>
                  )}

                  {!insightLoading && !insightError && insightPanel.type === 'grades' && (
                    <div className="space-y-2">
                      {insightGrades.length === 0 ? (
                        <p className="text-sm text-white/50">No grades found.</p>
                      ) : insightGrades.map((g) => (
                        <div key={g.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-medium text-white">{g.assignment}</p>
                            <span className="text-xs text-white/60">{g.date}</span>
                          </div>
                          <p className="text-xs text-white/50 mt-0.5">{g.subject}</p>
                          <p className="text-sm text-white/80 mt-1">{g.grade}/{g.maxGrade}{g.letterGrade ? ` (${g.letterGrade})` : ''}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {!insightLoading && !insightError && insightPanel.type === 'attendance' && (
                    <div className="space-y-2">
                      {insightAttendance.length === 0 ? (
                        <p className="text-sm text-white/50">No attendance records found.</p>
                      ) : insightAttendance.map((a) => (
                        <div key={a.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
                          <div className="flex items-center justify-between">
                            <p className="text-sm text-white">{a.date}</p>
                            <span className={`text-xs px-2 py-0.5 rounded-full border ${
                              a.status === 'present' ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' :
                              a.status === 'late' ? 'bg-amber-500/10 text-amber-300 border-amber-500/20' :
                              'bg-red-500/10 text-red-300 border-red-500/20'
                            }`}>{a.status}</span>
                          </div>
                          {a.notes && <p className="text-xs text-white/55 mt-1">{a.notes}</p>}
                        </div>
                      ))}
                    </div>
                  )}

                  {!insightLoading && !insightError && insightPanel.type === 'payments' && (
                    <div className="space-y-6">
                      <div>
                        <h4 className="text-sm font-semibold text-white mb-4">Payment Calendar</h4>
                        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                          {(() => {
                            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                            const currentYear = new Date().getFullYear();
                            return months.map((mName, i) => {
                              const status = getMonthPaymentStatus(currentYear, i);
                              const statusColors = {
                                green: 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/30',
                                red: 'bg-red-500/20 border-red-500/40 text-red-300 hover:bg-red-500/30',
                                gray: 'bg-white/5 border-white/10 text-white/30 cursor-not-allowed'
                              };
                              return (
                                <div
                                  key={mName}
                                  className={`flex flex-col items-center justify-center aspect-square rounded-lg border-2 transition-colors cursor-pointer ${statusColors[status as keyof typeof statusColors]}`}
                                >
                                  <span className="text-xs font-semibold">{mName}</span>
                                  {status === 'green' && <CheckCircle2 className="w-4 h-4 mt-1" />}
                                </div>
                              );
                            });
                          })()}
                        </div>
                        <div className="flex flex-wrap gap-3 mt-5 text-xs">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-emerald-500/40 border border-emerald-500/60" />
                            <span className="text-white/70">Paid</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-red-500/40 border border-red-500/60" />
                            <span className="text-white/70">Unpaid</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-white/10 border border-white/20" />
                            <span className="text-white/70">N/A</span>
                          </div>
                        </div>
                      </div>

                      <div className="border-t border-white/10 pt-4">
                        <h4 className="text-sm font-semibold text-white mb-3">Payment Records</h4>
                        <div className="space-y-2">
                          {insightPayments.length === 0 ? (
                            <p className="text-sm text-white/50">No payments found.</p>
                          ) : insightPayments.map((p: any) => (
                            <div key={p.id} className="rounded-lg border border-white/10 bg-white/5 p-2.5">
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-sm text-white font-medium">${Number(p.amount || 0).toFixed(2)}</p>
                                <span className="text-xs text-white/60">{p.payment_date ? new Date(p.payment_date).toLocaleDateString() : '—'}</span>
                              </div>
                              <p className="text-xs text-white/50 mt-1">Method: {p.payment_method || 'N/A'}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {editingStudent && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setEditingStudent(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="glass-card rounded-2xl p-6 w-full max-w-xl border border-white/10"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-display text-xl font-medium text-white">Edit Student</h3>
                <button
                  onClick={() => setEditingStudent(null)}
                  className="p-1.5 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input
                    type="text"
                    value={editForm.firstName}
                    onChange={(e) => setEditForm((f) => ({ ...f, firstName: e.target.value }))}
                    placeholder="First Name"
                    className="glass-input w-full px-3 py-2.5 rounded-xl text-sm"
                  />
                  <input
                    type="text"
                    value={editForm.lastName}
                    onChange={(e) => setEditForm((f) => ({ ...f, lastName: e.target.value }))}
                    placeholder="Last Name"
                    className="glass-input w-full px-3 py-2.5 rounded-xl text-sm"
                  />
                </div>

                <input
                  type="text"
                  value={editForm.parentFirstName}
                  onChange={(e) => setEditForm((f) => ({ ...f, parentFirstName: e.target.value }))}
                  placeholder="Parent First Name"
                  className="glass-input w-full px-3 py-2.5 rounded-xl text-sm"
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input
                    type="email"
                    value={editForm.email}
                    onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                    placeholder="Email"
                    className="glass-input w-full px-3 py-2.5 rounded-xl text-sm"
                  />
                  <input
                    type="tel"
                    value={editForm.phone}
                    onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
                    placeholder="Phone"
                    className="glass-input w-full px-3 py-2.5 rounded-xl text-sm"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input
                    type="tel"
                    value={editForm.secondaryPhone}
                    onChange={(e) => setEditForm((f) => ({ ...f, secondaryPhone: e.target.value }))}
                    placeholder="Secondary Phone"
                    className="glass-input w-full px-3 py-2.5 rounded-xl text-sm"
                  />
                  <select
                    value={editForm.location}
                    onChange={(e) => setEditForm((f) => ({ ...f, location: e.target.value }))}
                    className="glass-select w-full px-3 py-2.5 rounded-xl text-sm"
                  >
                    <option value="">Select location</option>
                    {LOCATION_OPTIONS.map(loc => (
                      <option key={loc} value={loc}>{loc}</option>
                    ))}
                  </select>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={() => setEditingStudent(null)}
                    className="px-4 py-2 rounded-xl border border-white/10 text-sm hover:bg-white/5 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => void handleEditSave()}
                    disabled={savingEdit}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#fc0ce4] to-[#949ce4] text-white text-sm font-semibold disabled:opacity-60"
                  >
                    {savingEdit ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Programs modal */}
      <AnimatePresence>
        {programsModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setProgramsModal(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="glass-card rounded-2xl p-6 w-full max-w-sm border border-white/10"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-display text-base font-medium text-white">{programsModal.studentName}'s Programs</h3>
                <button onClick={() => setProgramsModal(null)} className="p-1.5 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {programsModal.programs.map(p => (
                  <span key={p.programId} className="px-3 py-1 rounded-full text-xs font-medium bg-purple-500/15 text-purple-300 border border-purple-500/20">
                    {p.programName}
                  </span>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Classes modal */}
      <AnimatePresence>
        {classesModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setClassesModal(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="glass-card rounded-2xl p-6 w-full max-w-sm border border-white/10"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-display text-base font-medium text-white">{classesModal.studentName}'s Classes</h3>
                <button onClick={() => setClassesModal(null)} className="p-1.5 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex flex-col gap-2">
                {classesModal.classes.map(c => (
                  <div key={c.classId} className="flex items-center justify-between px-3 py-2 rounded-xl bg-white/5 border border-white/5">
                    <span className="text-sm text-white/80">{c.className}</span>
                    <span className="text-[10px] text-blue-300 ml-2 shrink-0">{c.programName}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Attendance modal */}
      <AnimatePresence>
        {attModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setAttModal(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="glass-card rounded-2xl p-6 w-full max-w-sm border border-white/10"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="font-display text-base font-medium text-white">Attendance</h3>
                  <p className="text-xs text-white/40 mt-0.5">{attModal.studentName}</p>
                </div>
                <button onClick={() => setAttModal(null)} className="p-1.5 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
              {(() => {
                const { total, present, late, absent } = attModal.stats;
                const rate = total > 0 ? Math.round(((present + late) / total) * 100) : 0;
                return (
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-xs mb-1.5">
                        <span className="text-white/50">Attendance Rate</span>
                        <span className={`font-semibold ${rate >= 75 ? 'text-emerald-400' : rate >= 50 ? 'text-amber-400' : 'text-red-400'}`}>{rate}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${rate >= 75 ? 'bg-emerald-400' : rate >= 50 ? 'bg-amber-400' : 'bg-red-400'}`}
                          style={{ width: `${rate}%` }}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      {[
                        { label: 'Total Classes', value: total, icon: <BarChart2 className="w-4 h-4 text-white/30" /> },
                        { label: 'Present', value: present, icon: <CheckCircle2 className="w-4 h-4 text-emerald-400" /> },
                        { label: 'Late', value: late, icon: <Clock className="w-4 h-4 text-amber-400" /> },
                        { label: 'Absent', value: absent, icon: <XCircle className="w-4 h-4 text-red-400" /> },
                      ].map(row => (
                        <div key={row.label} className="flex items-center justify-between px-3 py-2 rounded-xl bg-white/5">
                          <div className="flex items-center gap-2 text-sm text-white/60">{row.icon}{row.label}</div>
                          <span className="text-sm font-semibold text-white">{row.value}</span>
                        </div>
                      ))}
                    </div>
                    <p className="text-[10px] text-white/25 text-center">Late arrivals count as present when calculating the rate</p>
                  </div>
                );
              })()}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
