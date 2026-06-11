'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search, Plus, Filter, FileText, CheckCircle, XCircle, Clock,
  ChevronLeft, ChevronRight, Download, Loader2, AlertCircle, UserPlus,
  GraduationCap, BarChart2, CheckCircle2, X, Upload, Pencil, Trash2,
  Check, RefreshCw,
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLanguage } from '../context/LanguageContext';
import { useDebounce } from '../hooks/useDebounce';
import { SlideOver } from '../components/SlideOver';
import { playPopSound } from '../utils/sound';
import { exportCsv } from '../utils/csv';
import { PROGRAMS } from '../constants/programs';
import { api } from '../services/api';
import { useModulePermissions } from '../context/UserContext';

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
  email: string;
  phone?: string;
  parentFirstName?: string;
  secondaryPhone?: string;
  location?: string;
  program?: string;
  classCode?: string;
  status?: string;
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

type ImportedStudent = { id: string; firstName: string; lastName: string; email: string };
type NeedsInfoRow = CsvStudentRow & { _missingFields: string[] };

function getMissingFields(row: CsvStudentRow): string[] {
  const m: string[] = [];
  if (!row.firstName?.trim()) m.push('First Name');
  if (!row.lastName?.trim())  m.push('Last Name');
  if (!row.email?.trim())     m.push('Email');
  return m;
}

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function generateCode(): string {
  return Array.from({ length: 7 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
}

const BLANK_FORM: EnrollForm = {
  firstName: '', lastName: '', parentFirstName: '',
  email: '', password: 'FMA#2026', phone: '', secondaryPhone: '', location: '', program: '', classId: '',
};

const LOCATION_OPTIONS = ['FMA Kids (Dardani)', 'FMA (Rruga Qarkore)'];

export default function Students() {
  const { isOverridden: permOverridden, canCreate: canEnroll, canUpdate: canEdit, canDelete: canRemove } = useModulePermissions('users');
  const [view, setView] = useState<'list' | 'add' | 'success'>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [selectedStudentForPanel, setSelectedStudentForPanel] = useState<AdminStudent | null>(null);
  const [students, setStudents] = useState<AdminStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterProgram, setFilterProgram] = useState('');
  const [filterClass, setFilterClass] = useState('');
  const [filterLocation, setFilterLocation] = useState('');
  const itemsPerPage = 10;
  const router = useRouter();

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
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [csvTemplateDownloading, setCsvTemplateDownloading] = useState(false);
  const csvInputRef = useRef<HTMLInputElement | null>(null);
  const docFileRef = useRef<HTMLInputElement | null>(null);
  const [docFile, setDocFile] = useState<File | null>(null);
  const [docDragOver, setDocDragOver] = useState(false);

  // ── CSV import results ────────────────────────────────────────────────────
  const [importedStudents, setImportedStudents] = useState<ImportedStudent[]>([]);
  const [remainingIds, setRemainingIds] = useState<Set<string>>(new Set());
  const [csvSelectedIds, setCsvSelectedIds] = useState<Set<string>>(new Set());
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [csvNeedsInfo, setCsvNeedsInfo] = useState<NeedsInfoRow[]>([]);
  const [csvView, setCsvView] = useState<'list' | 'needs-info'>('list');
  const [csvIgnoreMode, setCsvIgnoreMode] = useState(false);
  const [csvIgnoreSelected, setCsvIgnoreSelected] = useState<Set<number>>(new Set());
  const [csvEditingIdx, setCsvEditingIdx] = useState<number | null>(null);
  const [csvEditRow, setCsvEditRow] = useState<CsvStudentRow | null>(null);
  const [csvEditSaving, setCsvEditSaving] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignMode, setAssignMode] = useState<'existing' | 'create'>('existing');
  const [assignClassId, setAssignClassId] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [assignClasses, setAssignClasses] = useState<{ id: string; title: string }[]>([]);
  const [assignTeachers, setAssignTeachers] = useState<{ id: string; firstName: string; lastName: string }[]>([]);
  const [assignPrograms, setAssignPrograms] = useState<{ id: string; name: string }[]>([]);
  const [newClassName, setNewClassName] = useState('');
  const [newClassTeacherId, setNewClassTeacherId] = useState('');
  const [newClassProgram, setNewClassProgram] = useState('');
  const [newClassCode, setNewClassCode] = useState('');
  const [insightPanel, setInsightPanel] = useState<{
    type: 'grades' | 'attendance' | 'payments';
    student: AdminStudent;
  } | null>(null);
  const [insightLoading, setInsightLoading] = useState(false);
  const [insightError, setInsightError] = useState('');
  const [insightGrades, setInsightGrades] = useState<{
    tableName: string;
    className: string;
    teacherName: string;
    degree: string;
    totalPoints: number | null;
    passed: boolean | null;
    gradedAt: string | null;
    note: string | null;
  }[]>([]);
  const [insightAttendance, setInsightAttendance] = useState<{ classId: string; className: string; date: string; status: 'present' | 'absent' | 'late' }[]>([]);
  const [insightPayments, setInsightPayments] = useState<any[]>([]);
  const [insightInvoices, setInsightInvoices] = useState<any[]>([]);

  // Grade filters
  const [gradeFilterClass, setGradeFilterClass] = useState('');
  const [gradeFilterDegree, setGradeFilterDegree] = useState('');
  const [gradeFilterStatus, setGradeFilterStatus] = useState('');
  const [gradeFilterMonth, setGradeFilterMonth] = useState('');
  const [gradeFilterYear, setGradeFilterYear] = useState('');

  const debouncedSearch = useDebounce(searchQuery, 300);
  const { t } = useLanguage();
  const searchParams = useSearchParams();

  useEffect(() => { void loadStudents(); }, []);

  async function loadStudents() {
    setLoading(true);
    try { setStudents(await api.teacher.getStudentsWithDetails()); }
    catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  // Open the enroll form when navigated here with ?enroll=1
  useEffect(() => {
    const params = searchParams;
    if (params?.get('enroll') === '1' && (!permOverridden || canEnroll)) {
      setView('add');
      setEnrollError('');
      setForm(BLANK_FORM);
      // Clean the query param without pushing history
      router.replace('/students');
    } else if (params?.get('enroll') === '1') {
      router.replace('/students');
    }
  }, [searchParams]);

  const studentFilterOptions = useMemo(() => {
    const programs = [...new Set(students.flatMap(s => s.programs.map(p => p.programName)))].sort();
    const classes = [...new Set(students.flatMap(s => s.classes.map(c => c.className)))].sort();
    const locations = [...new Set(students.map(s => s.location).filter(Boolean))].sort();
    return { programs, classes, locations };
  }, [students]);

  const filteredStudents = useMemo(() => {
    let result = students;
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase();
      result = result.filter(s =>
        s.name.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        s.programs.some(p => p.programName.toLowerCase().includes(q)) ||
        s.classes.some(c => c.className.toLowerCase().includes(q))
      );
    }
    if (filterProgram) result = result.filter(s => s.programs.some(p => p.programName === filterProgram));
    if (filterClass) result = result.filter(s => s.classes.some(c => c.className === filterClass));
    if (filterLocation) result = result.filter(s => s.location === filterLocation);
    return result;
  }, [students, debouncedSearch, filterProgram, filterClass, filterLocation]);

  const hasStudentFilters = !!debouncedSearch.trim() || !!filterProgram || !!filterClass || !!filterLocation;

  function clearStudentFilters() {
    setSearchQuery('');
    setFilterProgram('');
    setFilterClass('');
    setFilterLocation('');
    setCurrentPage(1);
  }

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
    const dataToExport = selectedStudents.length > 0
      ? filteredStudents.filter(s => selectedStudents.includes(s.id))
      : filteredStudents;
    if (dataToExport.length === 0) return;
    exportCsv({
      filename: 'students',
      headers: ['first_name', 'last_name', 'parent_first_name', 'email', 'phone', 'secondary_phone', 'location', 'degree'],
      rows: dataToExport.map(s => [
        s.firstName,
        s.lastName,
        s.parentFirstName || '',
        s.email,
        s.phone || '',
        s.secondaryPhone || '',
        s.location || '',
        s.programs.map(p => p.programName).join('; '),
      ]),
    });
  };

  const parseCsvLine = (line: string, delim = ','): string[] => {
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
      } else if (ch === delim && !inQuotes) {
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

  const handleDownloadStudentTemplate = async () => {
    setCsvTemplateDownloading(true);
    try {
      const csv = await api.users.generateCSVTemplate('student');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'student_import_template.csv';
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setCsvTemplateDownloading(false);
    }
  };

  const handleCsvImport = async (file: File) => {
    setImportingCsv(true);
    try {
      let text = await file.text();
      if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
      let lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
      if (lines[0]?.trim().toLowerCase().startsWith('sep=')) lines = lines.slice(1);
      if (lines.length < 2) throw new Error('CSV file must include a header and at least one row.');

      const commaCount = (lines[0].match(/,/g) || []).length;
      const semiCount = (lines[0].match(/;/g) || []).length;
      const delimiter = semiCount > commaCount ? ';' : ',';

      const headers = parseCsvLine(lines[0], delimiter).map(h => h.trim().replace(/^["']+|["']+$/g, '').replace(/\s*\*\s*$/, ''));
      const parsedRows: CsvStudentRow[] = [];

      for (let i = 1; i < lines.length; i++) {
        const cols = parseCsvLine(lines[i], delimiter);
        const row: Record<string, string> = {};
        headers.forEach((header, idx) => { row[header] = (cols[idx] || '').trim(); });

        const firstName = getHeaderValue(row, ['first_name', 'firstName', 'first name', 'firstname', 'name']);
        const lastName = getHeaderValue(row, ['last_name', 'lastName', 'last name', 'lastname', 'surname']);
        const email = getHeaderValue(row, ['email']);
        const phone = getHeaderValue(row, ['phone', 'phone_number', 'phone number', 'phone number']);
        const parentFirstName = getHeaderValue(row, ['parent_first_name', 'parentFirstName', 'parent first name', 'parent name', 'parent_name']);
        const secondaryPhone = getHeaderValue(row, ['secondary_phone', 'secondaryPhone', 'secondary phone', 'secondary_phone_number']);
        const location = getHeaderValue(row, ['location']);
        const program = getHeaderValue(row, ['degree', 'program']);
        const classCode = getHeaderValue(row, ['class_code', 'classcode', 'class code', 'code']);
        const status = getHeaderValue(row, ['status']);

        if (!firstName && !lastName && !email) continue;
        parsedRows.push({ firstName, lastName, email, phone: phone || undefined, parentFirstName: parentFirstName || undefined, secondaryPhone: secondaryPhone || undefined, location: location || undefined, program: program || undefined, classCode: classCode || undefined, status: status || undefined });
      }

      if (parsedRows.length === 0) throw new Error('No valid student rows found in the CSV file.');

      // Split: complete rows vs rows missing required fields
      const completeRows: CsvStudentRow[] = [];
      const needsInfoRows: NeedsInfoRow[] = [];
      for (const row of parsedRows) {
        const missing = getMissingFields(row);
        if (missing.length > 0) needsInfoRows.push({ ...row, _missingFields: missing });
        else completeRows.push(row);
      }

      const created: ImportedStudent[] = [];
      const autoEnrolledIds = new Set<string>();
      const errors: string[] = [];

      for (const row of completeRows) {
        try {
          const result = await api.users.create(row.email.trim().toLowerCase(), row.firstName.trim(), row.lastName.trim(), 'student', 'FMA#2026');
          if (result?.id) {
            try {
              await api.teacher.updateStudentProfile(result.id, {
                firstName: row.firstName.trim(),
                lastName: row.lastName.trim(),
                email: row.email.trim().toLowerCase(),
                parentFirstName: row.parentFirstName?.trim() || undefined,
                phone: row.phone?.trim() || undefined,
                secondaryPhone: row.secondaryPhone?.trim() || undefined,
                location: row.location?.trim() || undefined,
              });
            } catch { /* non-critical */ }

            const isInactive = /not.?active|inactive|jo.?aktiv/i.test(row.status || '');
            if (isInactive) {
              try { await api.finance.archiveStudent(result.id); } catch { /* non-critical */ }
            }

            if (row.classCode) {
              try {
                const classId = await api.classes.getIdByCode(row.classCode);
                if (classId) { await api.classes.enrollStudent(classId, result.id); autoEnrolledIds.add(result.id); }
              } catch { /* non-critical */ }
            }

            created.push({ id: result.id, firstName: row.firstName.trim(), lastName: row.lastName.trim(), email: row.email.trim().toLowerCase() });
          }
        } catch (e: any) {
          errors.push(`${row.email || `${row.firstName} ${row.lastName}`}: ${e.message}`);
        }
      }

      const needsAssignment = new Set(created.map(u => u.id).filter(id => !autoEnrolledIds.has(id)));
      setImportedStudents(created);
      setRemainingIds(needsAssignment);
      setCsvSelectedIds(new Set(needsAssignment));
      setImportErrors(errors);
      setCsvNeedsInfo(needsInfoRows);
      setCsvView('list');
      setCsvIgnoreMode(false);
      setCsvIgnoreSelected(new Set());
      setCsvEditingIdx(null);
      setCsvEditRow(null);
      if (created.length > 0) await loadStudents();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'CSV import failed.');
    } finally {
      if (csvInputRef.current) csvInputRef.current.value = '';
      setImportingCsv(false);
    }
  };

  const handleOpenAssignModal = async () => {
    setAssigning(false);
    setAssignMode('existing');
    setAssignClassId('');
    setNewClassName('');
    setNewClassTeacherId('');
    setNewClassProgram('');
    setNewClassCode(generateCode());
    try {
      const [classes, teachers, programs] = await Promise.all([
        api.classes.getAll(),
        api.classes.getAvailableTeachers(),
        api.programs.getAll(),
      ]);
      setAssignClasses((classes as any[]).map(c => ({ id: c.id, title: c.title })));
      setAssignTeachers(teachers as any[]);
      setAssignPrograms((programs as any[]).map(p => ({ id: p.id, name: p.name })));
    } catch { /* proceed with empty lists */ }
    setShowAssignModal(true);
  };

  const handleAssign = async () => {
    setAssigning(true);
    try {
      let classId: string;
      if (assignMode === 'create') {
        const created = await api.classes.create(newClassProgram, newClassName.trim(), newClassTeacherId, [], newClassCode);
        classId = (created as any).id;
      } else {
        classId = assignClassId;
      }
      const toEnroll = [...csvSelectedIds].filter(id => remainingIds.has(id));
      await Promise.allSettled(toEnroll.map(id => api.classes.enrollStudent(classId, id)));
      setRemainingIds(prev => { const next = new Set(prev); toEnroll.forEach(id => next.delete(id)); return next; });
      setCsvSelectedIds(new Set());
      setShowAssignModal(false);
    } catch (e: any) {
      alert(e.message || 'Failed to assign students');
    } finally {
      setAssigning(false);
    }
  };

  const handleIgnoreAll = () => {
    if (!window.confirm(`${csvNeedsInfo.length} student${csvNeedsInfo.length !== 1 ? 's' : ''} will not be created and will not appear in the system. Are you sure?`)) return;
    setCsvNeedsInfo([]);
    setCsvIgnoreMode(false);
    setCsvIgnoreSelected(new Set());
    setCsvView('list');
  };

  const handleIgnoreSelected = () => {
    const count = csvIgnoreSelected.size;
    if (count === 0) return;
    if (!window.confirm(`${count} student${count !== 1 ? 's' : ''} will not be created and will not appear in the system. Are you sure?`)) return;
    const next = csvNeedsInfo.filter((_, i) => !csvIgnoreSelected.has(i));
    setCsvNeedsInfo(next);
    setCsvIgnoreSelected(new Set());
    if (next.length === 0) { setCsvView('list'); setCsvIgnoreMode(false); }
  };

  const handleSaveNeedsInfo = async () => {
    if (csvEditingIdx === null || !csvEditRow) return;
    setCsvEditSaving(true);
    try {
      const result = await api.users.create(csvEditRow.email.trim().toLowerCase(), csvEditRow.firstName.trim(), csvEditRow.lastName.trim(), 'student', 'FMA#2026');
      if (result?.id) {
        try {
          await api.teacher.updateStudentProfile(result.id, {
            firstName: csvEditRow.firstName.trim(),
            lastName: csvEditRow.lastName.trim(),
            email: csvEditRow.email.trim().toLowerCase(),
            parentFirstName: csvEditRow.parentFirstName?.trim() || undefined,
            phone: csvEditRow.phone?.trim() || undefined,
            secondaryPhone: csvEditRow.secondaryPhone?.trim() || undefined,
            location: csvEditRow.location?.trim() || undefined,
          });
        } catch { /* non-critical */ }
        const isInactive = /not.?active|inactive|jo.?aktiv/i.test(csvEditRow.status || '');
        if (isInactive) {
          try { await api.finance.archiveStudent(result.id); } catch { /* non-critical */ }
        }
        setImportedStudents(prev => [...prev, { id: result.id, firstName: csvEditRow.firstName.trim(), lastName: csvEditRow.lastName.trim(), email: csvEditRow.email.trim().toLowerCase() }]);
        setRemainingIds(prev => new Set([...prev, result.id]));
        setCsvSelectedIds(prev => new Set([...prev, result.id]));
        setCsvNeedsInfo(prev => {
          const next = prev.filter((_, i) => i !== csvEditingIdx);
          if (next.length === 0) setCsvView('list');
          return next;
        });
        setCsvEditingIdx(null);
        setCsvEditRow(null);
      }
    } catch (e: any) {
      alert(e.message || 'Failed to create student');
    } finally {
      setCsvEditSaving(false);
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
        const data = await api.gradeTables.getForStudent(selectedStudentForPanel.id);
        setInsightGrades(data);
        setGradeFilterClass('');
        setGradeFilterDegree('');
        setGradeFilterStatus('');
        setGradeFilterMonth('');
        setGradeFilterYear('');
      } else if (type === 'attendance') {
        const data = await api.classAttendance.getForStudent(selectedStudentForPanel.id);
        setInsightAttendance(data);
      } else {
        const invoices = await api.finance.getInvoices(selectedStudentForPanel.id);
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
    
    // Before enrollment or after current month
    if (year < enrollYear || (year === enrollYear && month < enrollMonth)) return 'gray';
    if (year > currentYear || (year === currentYear && month > currentMonth)) return 'gray';
    
    // Check if all invoices for this month are paid (month is 0-based here, invoices use 1-based)
    const monthInvoices = insightInvoices.filter((inv: any) => inv.year === year && inv.month === month + 1);
    if (monthInvoices.length === 0) return 'gray';
    const allPaid = monthInvoices.every((inv: any) => inv.status === 'paid');
    
    return allPaid ? 'green' : 'red';
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

    if (!form.firstName.trim())  { setEnrollError(t('students.err_first_name')); return; }
    if (!form.lastName.trim())   { setEnrollError(t('students.err_last_name')); return; }
    if (!form.parentFirstName.trim()) { setEnrollError(t('students.err_parent')); return; }
    if (!form.email.includes('@')) { setEnrollError(t('students.err_email')); return; }
    if (!form.phone.trim()) { setEnrollError(t('students.err_phone')); return; }
    if (!form.location) { setEnrollError(t('students.err_location')); return; }
    if (!form.program) { setEnrollError(t('students.err_program')); return; }
    if (!form.classId) { setEnrollError(t('students.err_class')); return; }

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
      setDocFile(null);
      setView('success');
    } catch (err) {
      setEnrollError(err instanceof Error ? err.message : t('students.enrollment_failed'));
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
          <h2 className="font-display text-2xl font-medium mb-2">{t('students.enrollment_success')}</h2>
          <p className="text-white/50 text-sm mb-1">
            <span className="text-white/80 font-medium">{enrolledName}</span> {t('students.enrollment_success_msg')}
          </p>
          <p className="text-white/35 text-xs mb-1">{t('students.temp_password')} <span className="text-white/70 font-medium">FMA#2026</span></p>
          <p className="text-white/35 text-xs mb-8">{t('students.password_change_hint')}</p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => { setView('add'); }}
              className="px-5 py-2.5 rounded-xl border border-white/10 text-sm font-medium hover:bg-white/5 transition-colors"
            >
              {t('students.enroll_another')}
            </button>
            <button
              onClick={() => setView('list')}
              className="bg-gradient-to-r from-[#fc0ce4] to-[#949ce4] text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition-all"
            >
              {t('students.back_to_list')}
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
            <h1 className="font-display text-3xl font-medium tracking-tight mb-1">{t('students.manual_enrollment')}</h1>
            <p className="text-white/50 text-sm">{t('students.manual_enrollment_desc')}</p>
          </div>
          <button
            onClick={() => { setView('list'); setEnrollError(''); setForm(BLANK_FORM); setDocFile(null); }}
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
                <label className="text-[11px] font-semibold text-white/60 uppercase tracking-widest ml-1">{t('students.email_req')}</label>
                <input
                  type="email" value={form.email}
                  onChange={e => setField('email', e.target.value)}
                  className={inp} placeholder="john@example.com"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-semibold text-white/60 uppercase tracking-widest ml-1">{t('students.phone_req')}</label>
                <input
                  type="tel" value={form.phone}
                  onChange={e => setField('phone', e.target.value)}
                  className={inp} placeholder="+1 (555) 000-0000"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-semibold text-white/60 uppercase tracking-widest ml-1">{t('students.secondary_phone_opt')}</label>
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
                <label className="text-[11px] font-semibold text-white/60 uppercase tracking-widest ml-1">{t('students.location_req')}</label>
                <select
                  value={form.location}
                  onChange={e => setField('location', e.target.value)}
                  className="glass-select w-full px-4 py-3 rounded-xl text-sm appearance-none"
                >
                  <option value="">{t('students.select_location')}</option>
                  {LOCATION_OPTIONS.map(loc => (
                    <option key={loc} value={loc}>{loc}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-semibold text-white/60 uppercase tracking-widest ml-1">{t('students.initial_password')}</label>
                <input
                  type="text" value={form.password}
                  readOnly
                  className={`${inp} opacity-80 cursor-not-allowed`}
                />
                <p className="text-[11px] text-white/35 ml-1">{t('students.password_hint')}</p>
              </div>
            </div>

            {/* Degree + Class */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[11px] font-semibold text-white/60 uppercase tracking-widest ml-1">{t('students.select_degree_req')}</label>
                <select
                  value={form.program}
                  onChange={e => setField('program', e.target.value)}
                  className="glass-select w-full px-4 py-3 rounded-xl text-sm appearance-none"
                >
                  <option value="">{t('students.select_degree_ph')}</option>
                  {PROGRAMS.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-semibold text-white/60 uppercase tracking-widest ml-1">{t('students.select_class_req')}</label>
                <select
                  value={form.classId}
                  onChange={e => setField('classId', e.target.value)}
                  disabled={!form.program || loadingClasses}
                  className="glass-select w-full px-4 py-3 rounded-xl text-sm appearance-none disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="">{!form.program ? t('students.select_degree_first') : loadingClasses ? t('students.loading_classes') : t('students.select_class_ph')}</option>
                  {degreeClasses.map(cls => (
                    <option key={cls.id} value={cls.id}>{cls.title}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Document upload (optional) */}
            <div className="pt-2 border-t border-white/5">
              <h3 className="text-sm font-medium mb-3">{t('students.doc_upload')} <span className="text-white/30 font-normal text-xs">(optional)</span></h3>
              <input
                ref={docFileRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                className="hidden"
                onChange={e => setDocFile(e.target.files?.[0] ?? null)}
              />
              <div
                onClick={() => docFileRef.current?.click()}
                onDragOver={e => { e.preventDefault(); setDocDragOver(true); }}
                onDragLeave={() => setDocDragOver(false)}
                onDrop={e => {
                  e.preventDefault();
                  setDocDragOver(false);
                  const file = e.dataTransfer.files[0];
                  if (file) setDocFile(file);
                }}
                className={`border-2 border-dashed rounded-2xl p-6 text-center transition-colors cursor-pointer ${
                  docDragOver
                    ? 'border-[#fc0ce4]/60 bg-[#fc0ce4]/5'
                    : 'border-white/10 hover:bg-white/5 hover:border-[#fc0ce4]/30'
                }`}
              >
                <FileText className="w-7 h-7 text-white/30 mx-auto mb-2" />
                {docFile ? (
                  <p className="text-sm text-white/80 font-medium truncate px-4">{docFile.name}</p>
                ) : (
                  <>
                    <p className="text-sm text-white/60">{t('students.drag_drop')}</p>
                    <p className="text-[11px] text-white/35 mt-1">{t('students.doc_types')}</p>
                  </>
                )}
              </div>
            </div>

            {/* Footer actions */}
            <div className="flex justify-end gap-3 pt-4 border-t border-white/5">
              <button
                type="button"
                onClick={() => { setView('list'); setEnrollError(''); setForm(BLANK_FORM); setDocFile(null); }}
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
                {enrolling ? t('students.enrolling') : t('students.enroll_student')}
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
          {(!permOverridden || canEnroll) && (
            <button
              onClick={() => setShowCsvModal(true)}
              disabled={importingCsv}
              className="px-4 py-2.5 rounded-xl border border-white/10 text-sm font-medium hover:bg-white/5 transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              {importingCsv ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {importingCsv ? t('students.importing') : t('students.import_csv')}
            </button>
          )}
          {(!permOverridden || canEnroll) && (
            <button
              onClick={() => setView('add')}
              className="bg-gradient-to-r from-[#fc0ce4] to-[#949ce4] text-white px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 hover:opacity-90 transition-all shadow-[0_0_20px_rgba(252,12,228,0.2)]"
            >
              <Plus className="w-4 h-4" />
              {t('students.add_new')}
            </button>
          )}
        </div>
      </div>

      <div className="glass-card rounded-3xl p-6 overflow-hidden flex flex-col">
        <div className="flex flex-col gap-4 justify-between mb-6 shrink-0">
          <div className="flex flex-col md:flex-row gap-4 justify-between">
            <div className="relative w-full md:w-96 group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 group-focus-within:text-[#fc0ce4] transition-colors" />
              <input 
                type="text" 
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder={t('students.search')} 
                className="w-full bg-white/5 border border-white/5 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#fc0ce4]/40 focus:bg-[#fc0ce4]/5 focus:shadow-[0_0_15px_rgba(252,12,228,0.1)] transition-all"
              />
            </div>
            <button 
              onClick={handleExport}
              disabled={filteredStudents.length === 0}
              className="px-4 py-2.5 rounded-xl border border-white/10 text-sm font-medium hover:bg-white/5 transition-colors flex items-center gap-2 disabled:opacity-30 self-start"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            <select value={filterProgram} onChange={e => { setFilterProgram(e.target.value); setCurrentPage(1); }} className="glass-select px-3 py-1.5 rounded-lg text-xs">
              <option value="">All Degrees</option>
              {studentFilterOptions.programs.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <select value={filterClass} onChange={e => { setFilterClass(e.target.value); setCurrentPage(1); }} className="glass-select px-3 py-1.5 rounded-lg text-xs">
              <option value="">All Classes</option>
              {studentFilterOptions.classes.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={filterLocation} onChange={e => { setFilterLocation(e.target.value); setCurrentPage(1); }} className="glass-select px-3 py-1.5 rounded-lg text-xs">
              <option value="">{t('students.all_locations')}</option>
              {studentFilterOptions.locations.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
            {hasStudentFilters && (
              <button onClick={clearStudentFilters} className="text-xs text-white/30 hover:text-white transition-colors ml-1">
                Clear all
              </button>
            )}
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
                            {(!permOverridden || canEdit) && (
                              <button
                                onClick={() => handleEditOpen(student)}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs border border-white/10 hover:bg-white/5 transition-colors"
                                title="Edit student"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                                Edit
                              </button>
                            )}
                            {(!permOverridden || canRemove) && (
                              <button
                                onClick={() => handleRemoveStudent(student)}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs border border-red-500/25 text-red-300 hover:bg-red-500/10 transition-colors"
                                title="Remove student"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                Remove
                              </button>
                            )}
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

            <button
              onClick={() => router.push(`/students/${selectedStudentForPanel.id}`)}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#fc0ce4] to-[#949ce4] text-white text-sm font-semibold hover:opacity-90 transition-all"
            >
              View Full Profile
            </button>
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
                    <div className="space-y-4">
                      {/* Filters */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        <select
                          value={gradeFilterClass}
                          onChange={e => setGradeFilterClass(e.target.value)}
                          className="glass-select text-xs"
                        >
                          <option value="">All Classes</option>
                          {[...new Set(insightGrades.map(g => g.className))].map(c => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                        <select
                          value={gradeFilterDegree}
                          onChange={e => setGradeFilterDegree(e.target.value)}
                          className="glass-select text-xs"
                        >
                          <option value="">All Degrees</option>
                          {[...new Set(insightGrades.map(g => g.degree).filter(Boolean))].map(d => (
                            <option key={d} value={d}>{d}</option>
                          ))}
                        </select>
                        <select
                          value={gradeFilterStatus}
                          onChange={e => setGradeFilterStatus(e.target.value)}
                          className="glass-select text-xs"
                        >
                          <option value="">All Status</option>
                          <option value="passed">Passed</option>
                          <option value="failed">Failed</option>
                          <option value="ungraded">Not Graded</option>
                        </select>
                        <select
                          value={gradeFilterMonth}
                          onChange={e => setGradeFilterMonth(e.target.value)}
                          className="glass-select text-xs"
                        >
                          <option value="">All Months</option>
                          {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map((m, i) => (
                            <option key={m} value={String(i)}>{m}</option>
                          ))}
                        </select>
                        <select
                          value={gradeFilterYear}
                          onChange={e => setGradeFilterYear(e.target.value)}
                          className="glass-select text-xs"
                        >
                          <option value="">All Years</option>
                          {[...new Set(insightGrades.map(g => g.gradedAt ? new Date(g.gradedAt).getFullYear() : null).filter(Boolean))].sort((a, b) => (b as number) - (a as number)).map(y => (
                            <option key={y} value={String(y)}>{y}</option>
                          ))}
                        </select>
                      </div>

                      {/* Results */}
                      {(() => {
                        const filtered = insightGrades.filter(g => {
                          if (gradeFilterClass && g.className !== gradeFilterClass) return false;
                          if (gradeFilterDegree && g.degree !== gradeFilterDegree) return false;
                          if (gradeFilterStatus === 'passed' && g.passed !== true) return false;
                          if (gradeFilterStatus === 'failed' && g.passed !== false) return false;
                          if (gradeFilterStatus === 'ungraded' && g.passed !== null) return false;
                          if (gradeFilterMonth && g.gradedAt) {
                            if (new Date(g.gradedAt).getMonth() !== parseInt(gradeFilterMonth)) return false;
                          } else if (gradeFilterMonth && !g.gradedAt) return false;
                          if (gradeFilterYear && g.gradedAt) {
                            if (new Date(g.gradedAt).getFullYear() !== parseInt(gradeFilterYear)) return false;
                          } else if (gradeFilterYear && !g.gradedAt) return false;
                          return true;
                        });

                        if (filtered.length === 0) {
                          return <p className="text-sm text-white/50 py-4 text-center">No grades found.</p>;
                        }

                        return (
                          <div className="space-y-2">
                            <p className="text-xs text-white/40">{filtered.length} result{filtered.length !== 1 ? 's' : ''}</p>
                            {filtered.map((g, i) => (
                              <div key={i} className="rounded-xl border border-white/10 bg-white/5 p-3">
                                <div className="flex items-center justify-between gap-2 mb-1">
                                  <p className="text-sm font-medium text-white">{g.tableName}</p>
                                  {g.passed === true && (
                                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">Passed</span>
                                  )}
                                  {g.passed === false && (
                                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20 font-medium">Failed</span>
                                  )}
                                  {g.passed == null && (
                                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/5 text-white/30 border border-white/10">Not Graded</span>
                                  )}
                                </div>
                                <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-white/50 mt-1">
                                  <span>{g.className}</span>
                                  {g.degree && <span>{g.degree}</span>}
                                  <span>{g.teacherName}</span>
                                  {g.totalPoints != null && <span>{g.totalPoints} pts</span>}
                                  {g.gradedAt && <span>{g.gradedAt}</span>}
                                </div>
                                {g.note && <p className="text-xs text-white/40 mt-1.5 italic">{g.note}</p>}
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {!insightLoading && !insightError && insightPanel.type === 'attendance' && (
                    <div className="space-y-2">
                      {insightAttendance.length === 0 ? (
                        <p className="text-sm text-white/50">No attendance records found.</p>
                      ) : insightAttendance.map((a, i) => (
                        <div key={i} className="rounded-xl border border-white/10 bg-white/5 p-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm text-white">{a.date}</p>
                              <p className="text-[11px] text-white/30 mt-0.5">{a.className}</p>
                            </div>
                            <span className={`text-xs px-2 py-0.5 rounded-full border ${
                              a.status === 'present' ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' :
                              a.status === 'late' ? 'bg-amber-500/10 text-amber-300 border-amber-500/20' :
                              'bg-red-500/10 text-red-300 border-red-500/20'
                            }`}>{a.status.charAt(0).toUpperCase() + a.status.slice(1)}</span>
                          </div>
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
                        <h4 className="text-sm font-semibold text-white mb-3">Invoice Records</h4>
                        <div className="space-y-2">
                          {insightInvoices.length === 0 ? (
                            <p className="text-sm text-white/50">No invoices found.</p>
                          ) : insightInvoices.map((inv: any) => (
                            <div key={inv.id} className="rounded-lg border border-white/10 bg-white/5 p-2.5">
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-sm text-white font-medium">{inv.title}</p>
                                <span className={`text-xs px-2 py-0.5 rounded-full border ${inv.status === 'paid' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : inv.status === 'overdue' ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'}`}>{inv.status === 'not_paid' ? 'Not Paid' : inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}</span>
                              </div>
                              <p className="text-xs text-white/50 mt-1">€{Number(inv.amount || 0).toFixed(2)} — Due: {inv.dueDate ? new Date(inv.dueDate + 'T12:00:00').toLocaleDateString() : '—'}</p>
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

      {/* CSV Import Results Modal */}
      <AnimatePresence>
        {(importedStudents.length > 0 || csvNeedsInfo.length > 0) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="glass-card rounded-2xl w-full max-w-lg border border-white/10 max-h-[88vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  {csvView === 'needs-info' && (
                    <button
                      onClick={() => { setCsvView('list'); setCsvIgnoreMode(false); setCsvIgnoreSelected(new Set()); setCsvEditingIdx(null); setCsvEditRow(null); }}
                      className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-colors mr-1"
                    >
                      <ChevronLeft size={16} />
                    </button>
                  )}
                  <h3 className="font-display text-xl font-medium text-white">
                    {csvView === 'needs-info' ? 'Students with Missing Info' : 'Import Complete'}
                  </h3>
                </div>
                <button
                  onClick={() => { setImportedStudents([]); setRemainingIds(new Set()); setCsvSelectedIds(new Set()); setImportErrors([]); setCsvNeedsInfo([]); setCsvView('list'); setCsvIgnoreMode(false); setCsvEditingIdx(null); setCsvEditRow(null); }}
                  className="p-2 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* ── LIST VIEW ── */}
              {csvView === 'list' && (
                <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-4">
                  {/* Banners */}
                  {importedStudents.length > 0 && (
                    <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-sm">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      {importedStudents.length} student{importedStudents.length !== 1 ? 's' : ''} imported successfully
                    </div>
                  )}
                  {importErrors.length > 0 && (
                    <div className="rounded-xl bg-red-500/[0.07] border border-red-500/15 p-3 max-h-24 overflow-y-auto custom-scrollbar">
                      <p className="text-[11px] font-semibold text-white/35 uppercase tracking-widest mb-1.5">Errors</p>
                      {importErrors.map((e, i) => <p key={i} className="text-xs text-red-300/70">{e}</p>)}
                    </div>
                  )}

                  {/* Checklist */}
                  {remainingIds.size > 0 ? (
                    <>
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-white/40">{remainingIds.size} remaining — select to assign to a class</p>
                        <button
                          type="button"
                          onClick={() => setCsvSelectedIds(prev => prev.size === remainingIds.size ? new Set() : new Set(remainingIds))}
                          className="text-xs text-[#949ce4] hover:text-white transition-colors"
                        >
                          {csvSelectedIds.size === remainingIds.size ? 'Deselect all' : 'Select all'}
                        </button>
                      </div>
                      <div className="space-y-1 max-h-52 overflow-y-auto custom-scrollbar pr-1">
                        {importedStudents.filter(u => remainingIds.has(u.id)).map(u => {
                          const checked = csvSelectedIds.has(u.id);
                          return (
                            <button
                              key={u.id}
                              type="button"
                              onClick={() => setCsvSelectedIds(prev => { const next = new Set(prev); if (next.has(u.id)) next.delete(u.id); else next.add(u.id); return next; })}
                              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all text-left ${checked ? 'bg-[#949ce4]/10 border-[#949ce4]/30' : 'bg-white/[0.02] border-white/5 hover:border-white/10'}`}
                            >
                              <div className={`w-[18px] h-[18px] rounded border flex items-center justify-center shrink-0 transition-colors ${checked ? 'bg-[#949ce4] border-[#949ce4]' : 'border-white/20'}`}>
                                {checked && <Check size={10} className="text-white" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-white truncate">{u.firstName} {u.lastName}</p>
                                <p className="text-[11px] text-white/35 truncate">{u.email}</p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                      <button
                        onClick={() => void handleOpenAssignModal()}
                        disabled={csvSelectedIds.size === 0}
                        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-[#fc0ce4] to-[#949ce4] text-white text-sm font-semibold hover:opacity-90 transition-all disabled:opacity-50"
                      >
                        <GraduationCap size={15} />
                        Assign {csvSelectedIds.size > 0 ? `${csvSelectedIds.size} selected` : 'selected'} to class
                      </button>
                    </>
                  ) : importedStudents.length > 0 ? (
                    <div className="flex flex-col items-center gap-2 py-2 text-center">
                      <CheckCircle2 className="w-7 h-7 text-emerald-400/60" />
                      <p className="text-sm text-white/50">All students have been assigned.</p>
                    </div>
                  ) : null}

                  {/* Missing info callout */}
                  {csvNeedsInfo.length > 0 && (
                    <button
                      onClick={() => { setCsvView('needs-info'); setCsvIgnoreMode(false); setCsvIgnoreSelected(new Set()); }}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-amber-500/25 bg-amber-500/[0.07] text-amber-300 text-sm hover:bg-amber-500/10 transition-colors text-left"
                    >
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span className="flex-1">View {csvNeedsInfo.length} student{csvNeedsInfo.length !== 1 ? 's' : ''} with missing information</span>
                      <ChevronRight size={14} className="text-amber-400/50" />
                    </button>
                  )}

                  <button
                    onClick={() => { setImportedStudents([]); setRemainingIds(new Set()); setCsvSelectedIds(new Set()); setImportErrors([]); setCsvNeedsInfo([]); setCsvView('list'); }}
                    className="w-full text-sm text-white/35 hover:text-white transition-colors py-1"
                  >
                    Done
                  </button>
                </div>
              )}

              {/* ── NEEDS INFO VIEW ── */}
              {csvView === 'needs-info' && (
                <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col">
                  {/* Action bar */}
                  <div className="px-6 py-3 border-b border-white/5 flex items-center gap-2 shrink-0">
                    <button
                      onClick={handleIgnoreAll}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium border border-red-500/20 text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      Ignore all
                    </button>
                    <button
                      onClick={() => { setCsvIgnoreMode(m => !m); setCsvIgnoreSelected(new Set()); }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${csvIgnoreMode ? 'bg-white/10 border-white/20 text-white' : 'border-white/10 text-white/50 hover:text-white hover:bg-white/5'}`}
                    >
                      {csvIgnoreMode ? 'Cancel' : 'Select ignore'}
                    </button>
                    {csvIgnoreMode && csvIgnoreSelected.size > 0 && (
                      <button
                        onClick={handleIgnoreSelected}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium border border-red-500/20 bg-red-500/10 text-red-300 hover:bg-red-500/20 transition-colors ml-auto"
                      >
                        Ignore {csvIgnoreSelected.size} selected
                      </button>
                    )}
                  </div>

                  {/* Student list */}
                  <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-2">
                    {csvNeedsInfo.map((row, idx) => {
                      const isEditing = csvEditingIdx === idx;
                      const isSelected = csvIgnoreSelected.has(idx);

                      return (
                        <div key={idx} className={`rounded-xl border transition-all ${isEditing ? 'border-[#949ce4]/40 bg-[#949ce4]/5' : isSelected ? 'border-red-500/25 bg-red-500/[0.05]' : 'border-white/8 bg-white/[0.02]'}`}>
                          {/* Row header */}
                          <div
                            className="flex items-center gap-3 px-3 py-2.5 cursor-pointer"
                            onClick={() => {
                              if (csvIgnoreMode) {
                                setCsvIgnoreSelected(prev => { const next = new Set(prev); if (next.has(idx)) next.delete(idx); else next.add(idx); return next; });
                              } else {
                                if (isEditing) { setCsvEditingIdx(null); setCsvEditRow(null); }
                                else { setCsvEditingIdx(idx); setCsvEditRow({ ...row }); }
                              }
                            }}
                          >
                            {csvIgnoreMode && (
                              <div className={`w-[18px] h-[18px] rounded border flex items-center justify-center shrink-0 transition-colors ${isSelected ? 'bg-red-500 border-red-500' : 'border-white/20'}`}>
                                {isSelected && <Check size={10} className="text-white" />}
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-white truncate">
                                {row.firstName || row.lastName ? `${row.firstName} ${row.lastName}`.trim() : <span className="text-white/30 italic">No name</span>}
                              </p>
                              <p className="text-[11px] text-white/35 truncate">{row.email || <span className="italic">No email</span>}</p>
                            </div>
                            <div className="flex flex-wrap gap-1 justify-end max-w-[160px]">
                              {row._missingFields.map(f => (
                                <span key={f} className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-500/20 text-amber-300/80 whitespace-nowrap">{f}</span>
                              ))}
                            </div>
                          </div>

                          {/* Inline edit form */}
                          {isEditing && csvEditRow && (
                            <div className="px-4 pb-4 pt-1 space-y-3 border-t border-white/8">
                              <p className="text-[11px] font-semibold text-white/35 uppercase tracking-widest pt-1">Fill in missing fields</p>
                              <div className="grid grid-cols-2 gap-2">
                                {(['firstName', 'lastName'] as const).map(field => {
                                  const label = field === 'firstName' ? 'First Name' : 'Last Name';
                                  return (
                                    <div key={field}>
                                      <label className="block text-[10px] font-semibold uppercase tracking-widest mb-1 text-amber-400/70">{label} *</label>
                                      <input
                                        type="text"
                                        value={csvEditRow[field]}
                                        onChange={e => setCsvEditRow(r => r ? { ...r, [field]: e.target.value } : r)}
                                        className="glass-input w-full px-3 py-2 rounded-lg text-sm text-white"
                                      />
                                    </div>
                                  );
                                })}
                              </div>
                              <div>
                                <label className="block text-[10px] font-semibold uppercase tracking-widest mb-1 text-amber-400/70">Email *</label>
                                <input
                                  type="email"
                                  value={csvEditRow.email}
                                  onChange={e => setCsvEditRow(r => r ? { ...r, email: e.target.value } : r)}
                                  className="glass-input w-full px-3 py-2 rounded-lg text-sm text-white"
                                />
                              </div>
                              <div className="flex gap-2 pt-1">
                                <button
                                  onClick={() => { setCsvEditingIdx(null); setCsvEditRow(null); }}
                                  className="flex-1 py-2 rounded-lg border border-white/10 text-sm text-white/50 hover:text-white hover:bg-white/5 transition-colors"
                                >
                                  Cancel
                                </button>
                                <button
                                  onClick={() => void handleSaveNeedsInfo()}
                                  disabled={csvEditSaving || !!(csvEditRow && getMissingFields(csvEditRow).length > 0)}
                                  className="flex-1 py-2 rounded-lg bg-gradient-to-r from-[#fc0ce4] to-[#949ce4] text-white text-sm font-semibold hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
                                >
                                  {csvEditSaving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving...</> : 'Save & Add'}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Assign-to-class modal */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[60]">
          <div className="glass-card rounded-3xl w-full max-w-md max-h-[85vh] flex flex-col">
            <div className="p-5 border-b border-white/10 flex items-center justify-between shrink-0">
              <h3 className="font-display text-xl font-medium">Assign to Class</h3>
              <button onClick={() => setShowAssignModal(false)} className="p-2 text-white/40 hover:text-white hover:bg-white/5 rounded-xl transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-4">
              {/* Selected student chips */}
              <div>
                <p className="text-[11px] font-semibold text-white/35 uppercase tracking-widest mb-2">
                  Assigning {csvSelectedIds.size} student{csvSelectedIds.size !== 1 ? 's' : ''}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {importedStudents.filter(u => csvSelectedIds.has(u.id)).map(u => (
                    <span key={u.id} className="text-xs px-2.5 py-1 rounded-full bg-white/[0.06] border border-white/10 text-white/70">
                      {u.firstName} {u.lastName}
                    </span>
                  ))}
                </div>
              </div>

              {/* Mode toggle */}
              <div className="flex rounded-xl border border-white/10 overflow-hidden">
                {(['existing', 'create'] as const).map(mode => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setAssignMode(mode)}
                    className={`flex-1 py-2.5 text-sm font-medium transition-colors ${assignMode === mode ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/60'}`}
                  >
                    {mode === 'existing' ? 'Existing class' : 'Create new class'}
                  </button>
                ))}
              </div>

              {/* Existing class picker */}
              {assignMode === 'existing' && (
                <select
                  value={assignClassId}
                  onChange={e => setAssignClassId(e.target.value)}
                  className="glass-select w-full px-4 py-3 rounded-xl text-sm text-white"
                >
                  <option value="">Select a class...</option>
                  {assignClasses.map(c => (
                    <option key={c.id} value={c.id}>{c.title}</option>
                  ))}
                </select>
              )}

              {/* New class form */}
              {assignMode === 'create' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-[1fr_auto] gap-3 items-end">
                    <div>
                      <label className="block text-[11px] font-semibold text-white/35 uppercase tracking-widest mb-1.5">Class Name *</label>
                      <input
                        type="text"
                        value={newClassName}
                        onChange={e => setNewClassName(e.target.value)}
                        className="glass-input w-full px-4 py-3 rounded-xl text-sm text-white"
                        placeholder="e.g. Introduction to Design"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-white/35 uppercase tracking-widest mb-1.5">Code</label>
                      <div className="flex items-center gap-2">
                        <div className="glass-input px-3 py-3 rounded-xl text-sm font-mono text-[#949ce4] tracking-widest whitespace-nowrap select-all">
                          {newClassCode}
                        </div>
                        <button
                          type="button"
                          onClick={() => setNewClassCode(generateCode())}
                          className="p-3 rounded-xl border border-white/10 text-white/40 hover:text-white hover:bg-white/5 transition-colors"
                        >
                          <RefreshCw size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-white/35 uppercase tracking-widest mb-1.5">Teacher *</label>
                    <select
                      value={newClassTeacherId}
                      onChange={e => setNewClassTeacherId(e.target.value)}
                      className="glass-select w-full px-4 py-3 rounded-xl text-sm text-white"
                    >
                      <option value="">Select teacher...</option>
                      {assignTeachers.map(t => (
                        <option key={t.id} value={t.id}>{t.firstName} {t.lastName}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-white/35 uppercase tracking-widest mb-1.5">Program *</label>
                    <select
                      value={newClassProgram}
                      onChange={e => setNewClassProgram(e.target.value)}
                      className="glass-select w-full px-4 py-3 rounded-xl text-sm text-white"
                    >
                      <option value="">Select program...</option>
                      {assignPrograms.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>

            <div className="p-5 border-t border-white/10 shrink-0">
              <button
                onClick={() => void handleAssign()}
                disabled={assigning || (assignMode === 'existing' ? !assignClassId : !newClassName.trim() || !newClassTeacherId || !newClassProgram)}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-[#fc0ce4] to-[#949ce4] text-white text-sm font-semibold hover:opacity-90 transition-all disabled:opacity-50"
              >
                {assigning
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Assigning...</>
                  : `Assign ${csvSelectedIds.size} Student${csvSelectedIds.size !== 1 ? 's' : ''}`
                }
              </button>
            </div>
          </div>
        </div>
      )}

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
                    <option value="">{t('students.select_location')}</option>
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
                    {savingEdit ? t('common.saving') : t('common.save_changes')}
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

      {/* CSV Import Modal */}
      {showCsvModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass-card rounded-3xl p-6 w-full max-w-sm space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-medium">CSV Import</h3>
              <button
                onClick={() => setShowCsvModal(false)}
                className="w-8 h-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-colors"
              >
                <X className="w-4 h-4 text-white/40" />
              </button>
            </div>
            <p className="text-sm text-white/50">Download the template first to ensure your CSV matches the required format.</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={handleDownloadStudentTemplate}
                disabled={csvTemplateDownloading}
                className="flex flex-col items-center gap-2 p-4 rounded-2xl border border-white/10 hover:bg-white/5 transition-colors text-center disabled:opacity-50"
              >
                <div className="w-10 h-10 rounded-xl bg-[#fc0ce4]/10 border border-[#fc0ce4]/20 flex items-center justify-center">
                  {csvTemplateDownloading ? <Loader2 className="w-5 h-5 text-[#fc0ce4] animate-spin" /> : <Download className="w-5 h-5 text-[#fc0ce4]" />}
                </div>
                <div className="text-xs font-semibold text-white">Download Template</div>
                <div className="text-[10px] text-white/40">Get the CSV format</div>
              </button>
              <button
                onClick={() => { setShowCsvModal(false); csvInputRef.current?.click(); }}
                className="flex flex-col items-center gap-2 p-4 rounded-2xl border border-white/10 hover:bg-white/5 transition-colors text-center"
              >
                <div className="w-10 h-10 rounded-xl bg-[#949ce4]/10 border border-[#949ce4]/20 flex items-center justify-center">
                  <Upload className="w-5 h-5 text-[#949ce4]" />
                </div>
                <div className="text-xs font-semibold text-white">Import CSV</div>
                <div className="text-[10px] text-white/40">Upload student data</div>
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}
