'use client';

import { useState, useEffect, useMemo, type FormEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  CreditCard, Search, CheckCircle, Clock,
  AlertCircle, X, Loader2, Trash2, DollarSign, Settings2, Pencil, Users, RotateCcw, Download, Archive, Upload, FileText,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useModulePermissions, useUser } from '../context/UserContext';
import { api } from '../services/api';
import { Invoice, InvoiceSettings, SettingsStudent } from '../types';
import { playPopSound } from '../utils/sound';
import { exportCsv } from '../utils/csv';
import { UnmatchedStudentsModal, type UnmatchedStudent } from '../components/UnmatchedStudentsModal';

type StatusFilter = 'all' | 'paid' | 'partial' | 'not_paid' | 'overdue';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const MONTH_KEYS = [
  'january','february','march','april','may','june',
  'july','august','september','october','november','december',
] as const;
const fmtMoney = (n: number) =>
  `\u20AC${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (d: string | null | undefined) => {
  if (!d) return '—';
  const dateStr = d.slice(0, 10);
  return new Date(`${dateStr}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const STATUS_BADGE: Record<string, string> = {
  paid:     'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  partial:  'bg-blue-500/10 text-blue-400 border-blue-500/20',
  not_paid: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  overdue:  'bg-red-500/10 text-red-400 border-red-500/20',
};
const STATUS_LABEL: Record<string, string> = {
  paid: 'status.paid', partial: 'status.partial', not_paid: 'status.not_paid', overdue: 'status.overdue',
};
const STATUS_ICON: Record<string, typeof CheckCircle> = {
  paid: CheckCircle, partial: DollarSign, not_paid: Clock, overdue: AlertCircle,
};

export default function Finance() {
  const { t } = useLanguage();
  const { user } = useUser();
  const { isOverridden: permOverridden, canCreate, canUpdate, canDelete } = useModulePermissions('finance');

  // Only admins/superadmins may import payment documents.
  const canImportDocs = user?.role === 'admin' || user?.role === 'superadmin';
  const [showImport, setShowImport]     = useState(false);
  const [impFiles, setImpFiles]         = useState<File[]>([]);
  const [importing, setImporting]       = useState(false);
  const [importError, setImportError]   = useState('');
  const [importSummary, setImportSummary] = useState<{ created: number; items: { studentName: string; amount: number; month: number; year: number }[] } | null>(null);
  const [unmatched, setUnmatched]       = useState<UnmatchedStudent[] | null>(null);
  const [pendingFiles, setPendingFiles] = useState<{ file: File; names: string[] }[]>([]); // files whose student wasn't found

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [filterMonth, setFilterMonth] = useState('');
  const [filterYear, setFilterYear] = useState('');
  const [filterClass, setFilterClass] = useState('');
  const [filterTeacher, setFilterTeacher] = useState('');
  const [stats, setStats] = useState({ totalPaid: 0, pending: 0, overdue: 0, invoiceCount: 0 });

  const [showSettings, setShowSettings] = useState(false);
  const [settingsStep, setSettingsStep] = useState<1 | 2>(1);
  const [settings, setSettings] = useState<InvoiceSettings | null>(null);
  const [settingsStudents, setSettingsStudents] = useState<SettingsStudent[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [settingsSearch, setSettingsSearch] = useState('');
  const [settingsForm, setSettingsForm] = useState({ defaultAmount: '60', titleTemplate: '{class} - {month}', discountPercent: '0', dueDay: '1' });
  const [savingSettings, setSavingSettings] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [restoringDefaults, setRestoringDefaults] = useState(false);
  const [archivingStudentId, setArchivingStudentId] = useState<string | null>(null);

  const [statusInvoice, setStatusInvoice] = useState<Invoice | null>(null);
  const [changingStatus, setChangingStatus] = useState(false);

  const [editInvoice, setEditInvoice] = useState<Invoice | null>(null);
  const [editAmount, setEditAmount]   = useState('');
  const [editTitle, setEditTitle]     = useState('');
  const [editDueDate, setEditDueDate] = useState('');
  const [savingEdit, setSavingEdit]   = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Invoice | null>(null);
  const [deleting, setDeleting]         = useState(false);
  const [showCreateInvoice, setShowCreateInvoice] = useState(false);
  const [loadingCreateOptions, setLoadingCreateOptions] = useState(false);
  const [creatingInvoice, setCreatingInvoice] = useState(false);
  const [createInvoiceError, setCreateInvoiceError] = useState('');
  const [enrollmentOptions, setEnrollmentOptions] = useState<Array<{
    enrollmentId: string;
    studentId: string;
    studentName: string;
    studentEmail: string;
    studentPhone?: string;
    classId: string;
    className: string;
    teacherName: string;
  }>>([]);
  const [createForm, setCreateForm] = useState(() => {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    return {
      enrollmentId: '',
      title: '',
      month: String(month),
      year: String(year),
      dueDate: `${year}-${String(month).padStart(2, '0')}-15`,
      amount: '60',
      discountPercent: '0',
    };
  });

  useEffect(() => { void loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    try {
      try {
        await api.finance.syncInvoices();
      } catch (syncErr) {
        console.error('Invoice sync error (non-fatal):', syncErr);
      }
      const [inv, st, sett] = await Promise.all([
        api.finance.getInvoices(),
        api.finance.getStats(),
        api.finance.getSettings(),
      ]);
      setInvoices(inv);
      setStats(st);
      if (sett) {
        setSettings(sett);
        setSettingsForm({
          defaultAmount: String(sett.defaultAmount),
          titleTemplate: sett.titleTemplate,
          discountPercent: String(sett.discountPercent),
          dueDay: String(sett.dueDay),
        });
      }
    } catch (e) {
      console.error('Finance load error:', e);
    } finally {
      setLoading(false);
    }
  }

  async function openSettings() {
    setShowSettings(true);
    setSettingsStep(1);
    setSelectedStudentIds(new Set());
    setSettingsSearch('');
    setLoadingStudents(true);
    try {
      const students = await api.finance.getStudentsForSettings();
      setSettingsStudents(students);
    } catch (e) {
      console.error('Failed to load students for settings:', e);
    } finally {
      setLoadingStudents(false);
    }
  }

  function toggleStudent(id: string) {
    setSelectedStudentIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllStudents() {
    const visibleIds = filteredSettingsStudents.map(s => s.studentId);
    const allSelected = visibleIds.every(id => selectedStudentIds.has(id));
    setSelectedStudentIds(prev => {
      const next = new Set(prev);
      for (const id of visibleIds) {
        if (allSelected) next.delete(id);
        else next.add(id);
      }
      return next;
    });
  }

  const filteredSettingsStudents = useMemo(() => {
    if (!settingsSearch.trim()) return settingsStudents;
    const q = settingsSearch.toLowerCase();
    return settingsStudents.filter(s =>
      s.studentName.toLowerCase().includes(q) ||
      s.program.toLowerCase().includes(q) ||
      s.classes.some(c => c.toLowerCase().includes(q))
    );
  }, [settingsStudents, settingsSearch]);

  async function handleArchiveStudent(studentId: string) {
    setArchivingStudentId(studentId);
    try {
      await api.finance.archiveStudent(studentId);
      playPopSound();
      const students = await api.finance.getStudentsForSettings();
      setSettingsStudents(students);
    } catch (err) { console.error(err); }
    finally { setArchivingStudentId(null); }
  }

  async function restoreToDefault() {
    if (selectedStudentIds.size === 0) return;
    setRestoringDefaults(true);
    try {
      await api.finance.deleteOverrides(Array.from(selectedStudentIds));
      playPopSound();
      const students = await api.finance.getStudentsForSettings();
      setSettingsStudents(students);
      setSelectedStudentIds(new Set());
    } catch (err) { console.error(err); }
    finally { setRestoringDefaults(false); }
  }

  function computeFormForSelected() {
    const selected = settingsStudents.filter(s => selectedStudentIds.has(s.studentId));
    if (selected.length === 0 || !settings) return;

    // Check if all selected students have overrides with identical values
    const withOverrides = selected.filter(s => s.hasOverride);
    if (withOverrides.length === selected.length) {
      const first = withOverrides[0];
      const allSame = withOverrides.every(s =>
        s.overrideAmount === first.overrideAmount &&
        s.overrideDiscountPercent === first.overrideDiscountPercent &&
        s.overrideDueDay === first.overrideDueDay &&
        s.overrideTitleTemplate === first.overrideTitleTemplate
      );
      if (allSame) {
        setSettingsForm({
          defaultAmount: String(first.overrideAmount ?? settings.defaultAmount),
          discountPercent: String(first.overrideDiscountPercent ?? settings.discountPercent),
          dueDay: String(first.overrideDueDay ?? settings.dueDay),
          titleTemplate: first.overrideTitleTemplate ?? settings.titleTemplate,
        });
        return;
      }
    }

    // Different overrides or mixed ? show global defaults
    setSettingsForm({
      defaultAmount: String(settings.defaultAmount),
      titleTemplate: settings.titleTemplate,
      discountPercent: String(settings.discountPercent),
      dueDay: String(settings.dueDay),
    });
  }

  const filterOptions = useMemo(() => {
    const months = Array.from<number>(new Set(invoices.map(i => i.month))).sort((a, b) => a - b);
    const years = Array.from<number>(new Set(invoices.map(i => i.year))).sort((a, b) => b - a);
    const classes = [...new Set(invoices.map(i => i.className).filter(Boolean))].sort();
    const teachers = [...new Set(invoices.map(i => i.teacherName).filter(Boolean))].sort();
    return { months, years, classes, teachers };
  }, [invoices]);

  const filtered = useMemo(() => {
    let list = invoices;
    if (statusFilter !== 'all') list = list.filter(i => i.status === statusFilter);
    if (filterMonth) list = list.filter(i => i.month === Number(filterMonth));
    if (filterYear) list = list.filter(i => i.year === Number(filterYear));
    if (filterClass) list = list.filter(i => i.className === filterClass);
    if (filterTeacher) list = list.filter(i => i.teacherName === filterTeacher);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(i =>
        (i.studentName || '').toLowerCase().includes(q) ||
        i.title.toLowerCase().includes(q) ||
        (i.teacherName || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [invoices, statusFilter, filterMonth, filterYear, filterClass, filterTeacher, search]);

  const hasActiveFilters = statusFilter !== 'all' || !!filterMonth || !!filterYear || !!filterClass || !!filterTeacher || !!search.trim();

  function clearAllFilters() {
    setStatusFilter('all');
    setFilterMonth('');
    setFilterYear('');
    setFilterClass('');
    setFilterTeacher('');
    setSearch('');
  }

  function handleExportCsv() {
    exportCsv({
      filename: 'invoices',
      headers: ['Invoice ID', 'Student', 'Title', 'Teacher', 'Month', 'Year', 'Due Date', 'Amount', 'Status'],
      rows: filtered.map(inv => [
        inv.invoiceId || inv.id,
        inv.studentName || '',
        inv.title,
        inv.teacherName || '',
        MONTH_NAMES[inv.month - 1],
        inv.year,
        inv.dueDate,
        inv.amount,
        STATUS_LABEL[inv.status] || inv.status,
      ]),
    });
  }

  async function openGenerateNewInvoice() {
    setShowCreateInvoice(true);
    setCreateInvoiceError('');
    setLoadingCreateOptions(true);
    try {
      const options = await api.finance.getActiveEnrollmentOptions();
      setEnrollmentOptions(options);

      const first = options[0];
      setCreateForm(prev => {
        if (!first) return { ...prev, enrollmentId: '' };
        const title = prev.title || `${first.className} - ${MONTH_NAMES[Number(prev.month) - 1]} ${prev.year}`;
        return { ...prev, enrollmentId: first.enrollmentId, title };
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingCreateOptions(false);
    }
  }

  async function createManualInvoice() {
    if (!createForm.enrollmentId || !createForm.title || !createForm.dueDate || !createForm.amount) return;
    const selected = enrollmentOptions.find(opt => opt.enrollmentId === createForm.enrollmentId);
    if (!selected) return;

    setCreatingInvoice(true);
    setCreateInvoiceError('');
    try {
      await api.finance.createManualInvoice({
        enrollmentId: selected.enrollmentId,
        studentId: selected.studentId,
        classId: selected.classId,
        title: createForm.title,
        month: Number(createForm.month),
        year: Number(createForm.year),
        dueDate: createForm.dueDate,
        amount: parseFloat(createForm.amount),
        discountPercent: parseFloat(createForm.discountPercent || '0'),
        studentName: selected.studentName,
        studentEmail: selected.studentEmail,
        studentPhone: selected.studentPhone,
        className: selected.className,
      });
      playPopSound();
      setShowCreateInvoice(false);
      await loadAll();
    } catch (err) {
      setCreateInvoiceError(err instanceof Error ? err.message : 'Failed to create invoice');
    } finally {
      setCreatingInvoice(false);
    }
  }

  function openImport() {
    setImportError('');
    setImportSummary(null);
    setImpFiles([]);
    setUnmatched(null);
    setPendingFiles([]);
    setShowImport(true);
  }

  // Import one or more .docx files. Only the given files are processed, so a
  // re-import (after adding missing students) re-runs just the unmatched ones —
  // already-created invoices are never duplicated.
  async function runImport(filesToRun: File[] = impFiles) {
    if (filesToRun.length === 0) return;
    setImporting(true);
    setImportError('');

    const created: { studentName: string; amount: number; month: number; year: number }[] = [];
    const stillUnmatched: UnmatchedStudent[] = [];
    const stillPending: { file: File; names: string[] }[] = [];
    let lastError = '';

    for (const file of filesToRun) {
      try {
        const res = await api.finance.importInvoiceDoc(file);
        if (res.imported) {
          created.push({ studentName: res.studentName, amount: res.amount, month: res.month, year: res.year });
        } else {
          stillUnmatched.push(...res.unmatched);
          stillPending.push({ file, names: res.unmatched.map(u => u.name) });
        }
      } catch (err) {
        lastError = err instanceof Error ? err.message : 'Import failed';
        stillPending.push({ file, names: [] });
      }
    }

    if (created.length) { playPopSound(); await loadAll(); }
    setImportSummary(prev => ({
      created: (prev?.created || 0) + created.length,
      items: [...(prev?.items || []), ...created],
    }));
    setPendingFiles(stillPending);
    const dedup = Array.from(new Map(stillUnmatched.map(u => [u.name.toLowerCase(), u])).values());
    setUnmatched(dedup.length ? dedup : null);
    if (lastError && created.length === 0 && dedup.length === 0) setImportError(lastError);
    setImporting(false);
  }

  function handleUnmatchedReimport(dismissedNames: string[] = []) {
    setUnmatched(null);
    const dismissed = new Set(dismissedNames.map(n => n.toLowerCase()));
    // Re-run only files whose student wasn't dismissed.
    const files = pendingFiles.filter(p => !p.names.some(n => dismissed.has(n.toLowerCase()))).map(p => p.file);
    void runImport(files);
  }

  async function changeStatus(newStatus: string) {
    if (!statusInvoice) return;
    setChangingStatus(true);
    try {
      await api.finance.updateInvoice(statusInvoice.id, { status: newStatus });
      setStatusInvoice(null);
      playPopSound();
      await loadAll();
    } catch (err) { console.error(err); }
    finally { setChangingStatus(false); }
  }

  async function saveEdit() {
    if (!editInvoice || !editAmount) return;
    setSavingEdit(true);
    try {
      // Convert dd/mm/yy ? yyyy-mm-dd for DB
      let dueDateIso: string | undefined;
      if (editDueDate) {
        const parts = editDueDate.split('/');
        if (parts.length === 3) {
          const [dd, mm, yy] = parts;
          const fullYear = parseInt(yy) < 100 ? 2000 + parseInt(yy) : parseInt(yy);
          dueDateIso = `${fullYear}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
        }
      }
      await api.finance.updateInvoice(editInvoice.id, {
        amount: parseFloat(editAmount),
        title: editTitle || undefined,
        due_date: dueDateIso,
      });
      setEditInvoice(null);
      playPopSound();
      await loadAll();
    } catch (err) { console.error(err); }
    finally { setSavingEdit(false); }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.finance.deleteInvoice(deleteTarget.id);
      setDeleteTarget(null);
      await loadAll();
    } catch (err) { console.error(err); }
    finally { setDeleting(false); }
  }

  async function saveSettings(e: FormEvent) {
    e.preventDefault();
    if (selectedStudentIds.size === 0) return;
    setSavingSettings(true);
    try {
      await api.finance.upsertOverrides(Array.from(selectedStudentIds), {
        amount: parseFloat(settingsForm.defaultAmount),
        discountPercent: parseFloat(settingsForm.discountPercent),
        dueDay: parseInt(settingsForm.dueDay),
        titleTemplate: settingsForm.titleTemplate,
      });
      playPopSound();
      // Refresh student list and go back to step 1 so the table reflects the update
      const students = await api.finance.getStudentsForSettings();
      setSettingsStudents(students);
      setSelectedStudentIds(new Set());
      setSettingsStep(1);
    } catch (err) { console.error(err); }
    finally { setSavingSettings(false); }
  }

  if (showSettings) {
    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-3xl font-medium tracking-tight mb-1">
              {settingsStep === 1 ? 'Invoice Settings' : 'Edit Invoice Settings'}
            </h1>
            <p className="text-white/50 text-sm">
              {settingsStep === 1
                ? 'Select students to customize their invoice settings. Changes apply to future invoices only.'
                : `Editing settings for ${selectedStudentIds.size} selected student${selectedStudentIds.size > 1 ? 's' : ''}.`}
            </p>
          </div>
          <button onClick={() => {
            if (settingsStep === 2) setSettingsStep(1);
            else setShowSettings(false);
          }} className="px-4 py-2 rounded-xl border border-white/10 text-sm font-medium hover:bg-white/5 transition-colors">
            {settingsStep === 2 ? 'Back' : 'Close'}
          </button>
        </div>

        {settingsStep === 1 ? (
          <div className="glass-card rounded-3xl p-6 overflow-hidden flex flex-col">
            <div className="flex flex-col md:flex-row gap-4 justify-between mb-6 shrink-0">
              <div className="relative w-full md:w-96 group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 group-focus-within:text-[#fc0ce4] transition-colors" />
                <input type="text" placeholder="Search students..." value={settingsSearch} onChange={e => setSettingsSearch(e.target.value)} className="w-full bg-white/5 border border-white/5 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#fc0ce4]/40 focus:bg-[#fc0ce4]/5 focus:shadow-[0_0_15px_rgba(252,12,228,0.1)] transition-all" />
              </div>
              <div className="text-sm text-white/40 self-center">
                {selectedStudentIds.size} selected
              </div>
            </div>

            <div className="overflow-x-auto pb-4 custom-scrollbar flex-1 -mx-6 px-6">
              {loadingStudents ? (
                <div className="flex items-center justify-center py-16 text-white/30 gap-2"><Loader2 className="w-5 h-5 animate-spin" /></div>
              ) : filteredSettingsStudents.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-white/30 gap-3">
                  <Users className="w-8 h-8 opacity-40" />
                  <p className="text-sm">No students with active enrollments found.</p>
                </div>
              ) : (
                <table className="w-full text-left border-collapse min-w-[700px]">
                  <thead>
                    <tr className="border-b border-white/5 text-[11px] uppercase tracking-widest text-white/30">
                      <th className="pb-3 font-medium w-10">
                        <input
                          type="checkbox"
                          checked={filteredSettingsStudents.length > 0 && filteredSettingsStudents.every(s => selectedStudentIds.has(s.studentId))}
                          onChange={toggleAllStudents}
                          className="w-4 h-4 rounded border-white/20 bg-white/5 accent-[#fc0ce4]"
                        />
                      </th>
                      <th className="pb-3 font-medium">Student</th>
                      <th className="pb-3 font-medium">Program</th>
                      <th className="pb-3 font-medium">Class(es)</th>
                      <th className="pb-3 font-medium">Amount</th>
                      <th className="pb-3 font-medium">Discount</th>
                      <th className="pb-3 font-medium">Override</th>
                      <th className="pb-3 font-medium w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    {filteredSettingsStudents.map(s => (
                      <tr key={s.studentId} onClick={() => toggleStudent(s.studentId)} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors cursor-pointer">
                        <td className="py-4">
                          <input
                            type="checkbox"
                            checked={selectedStudentIds.has(s.studentId)}
                            onChange={() => toggleStudent(s.studentId)}
                            onClick={e => e.stopPropagation()}
                            className="w-4 h-4 rounded border-white/20 bg-white/5 accent-[#fc0ce4]"
                          />
                        </td>
                        <td className="py-4 font-medium text-white/90">{s.studentName}</td>
                        <td className="py-4 text-white/60 text-xs">{s.program || '-'}</td>
                        <td className="py-4 text-white/60 text-xs">{s.classes.join(', ') || '-'}</td>
                        <td className="py-4 font-medium text-white/90">{fmtMoney(s.currentAmount)}</td>
                        <td className="py-4 text-white/60 text-xs">{s.currentDiscount}%</td>
                        <td className="py-4">
                          {s.hasOverride && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#fc0ce4]/10 text-[#fc0ce4] border border-[#fc0ce4]/20">Custom</span>
                          )}
                        </td>
                        <td className="py-4" onClick={e => e.stopPropagation()}>
                          <button
                            onClick={() => handleArchiveStudent(s.studentId)}
                            disabled={archivingStudentId === s.studentId}
                            className="p-2 rounded-xl bg-white/5 text-white/40 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-50"
                            title="Archive student"
                          >
                            {archivingStudentId === s.studentId ? <Loader2 className="w-4 h-4 animate-spin" /> : <Archive className="w-4 h-4" />}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="pt-4 border-t border-white/5 flex justify-between">
              <button
                onClick={restoreToDefault}
                disabled={selectedStudentIds.size === 0 || restoringDefaults || !Array.from(selectedStudentIds).some(id => settingsStudents.find(s => s.studentId === id)?.hasOverride)}
                className="px-5 py-3 rounded-xl border border-white/10 text-sm font-medium hover:bg-white/5 transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2 text-white/70"
              >
                {restoringDefaults ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                Restore to Default
              </button>
              <button
                onClick={() => {
                  computeFormForSelected();
                  setSettingsStep(2);
                }}
                disabled={selectedStudentIds.size === 0}
                className="bg-gradient-to-r from-[#fc0ce4] to-[#949ce4] text-white px-6 py-3 rounded-xl text-sm font-semibold hover:opacity-90 transition-all shadow-[0_0_20px_rgba(252,12,228,0.2)] disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Settings2 className="w-4 h-4" />
                Edit invoices for {selectedStudentIds.size > 0 ? `${selectedStudentIds.size} student${selectedStudentIds.size > 1 ? 's' : ''}` : 'selected students'}
              </button>
            </div>
          </div>
        ) : (
          <div className="glass-card rounded-3xl p-6 lg:p-8">
            <form className="space-y-8" onSubmit={saveSettings}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[11px] font-semibold text-white/60 uppercase tracking-widest ml-1">Amount (EUR)</label>
                  <input type="number" step="0.01" min="0" value={settingsForm.defaultAmount} onChange={e => setSettingsForm(f => ({ ...f, defaultAmount: e.target.value }))} className="glass-input w-full px-4 py-3 rounded-xl text-sm text-white placeholder:text-white/20" />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-semibold text-white/60 uppercase tracking-widest ml-1">Discount %</label>
                  <input type="number" step="0.1" min="0" max="100" value={settingsForm.discountPercent} onChange={e => setSettingsForm(f => ({ ...f, discountPercent: e.target.value }))} className="glass-input w-full px-4 py-3 rounded-xl text-sm text-white placeholder:text-white/20" />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="text-[11px] font-semibold text-white/60 uppercase tracking-widest ml-1">Invoice Title Template</label>
                  <input type="text" value={settingsForm.titleTemplate} onChange={e => setSettingsForm(f => ({ ...f, titleTemplate: e.target.value }))} className="glass-input w-full px-4 py-3 rounded-xl text-sm text-white placeholder:text-white/20" placeholder="{class} - {month}" />
                  <p className="text-[11px] text-white/30 ml-1">Use {'{class}'} for class name and {'{month}'} for month + year.</p>
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-semibold text-white/60 uppercase tracking-widest ml-1">Due Day of Month (1-28)</label>
                  <input type="number" min="1" max="28" value={settingsForm.dueDay} onChange={e => setSettingsForm(f => ({ ...f, dueDay: e.target.value }))} className="glass-input w-full px-4 py-3 rounded-xl text-sm text-white placeholder:text-white/20" />
                  <p className="text-[11px] text-white/30 ml-1">Due date is set to this day of the month after the invoice month.</p>
                </div>
              </div>

              <div className="px-4 py-3 rounded-xl bg-white/[0.04] border border-white/8 text-sm text-white/50">
                <strong className="text-white/70">Applying to:</strong> {selectedStudentIds.size} student{selectedStudentIds.size > 1 ? 's' : ''}. These settings will override the global defaults for the selected students&apos; future invoices.
              </div>

              <div className="flex justify-end gap-4 pt-6 border-t border-white/5">
                <button type="button" onClick={() => setSettingsStep(1)} className="px-6 py-3 rounded-xl border border-white/10 text-sm font-medium hover:bg-white/5 transition-colors">Back</button>
                <button type="submit" disabled={savingSettings} className="bg-gradient-to-r from-[#fc0ce4] to-[#949ce4] text-white px-6 py-3 rounded-xl text-sm font-semibold hover:opacity-90 transition-all shadow-[0_0_20px_rgba(252,12,228,0.2)] disabled:opacity-50 flex items-center gap-2">
                  {savingSettings && <Loader2 className="w-4 h-4 animate-spin" />}
                  Save Settings
                </button>
              </div>
            </form>
          </div>
        )}
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-medium tracking-tight mb-1">{t('finance.title')}</h1>
          <p className="text-white/50 text-sm">{t('finance.desc')}</p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          {(!permOverridden || canCreate) && (
            <button
              onClick={openGenerateNewInvoice}
              className="px-4 py-2.5 rounded-xl border border-white/10 text-sm font-medium hover:bg-white/5 transition-colors flex items-center gap-2 disabled:opacity-40"
            >
              <CreditCard className="w-4 h-4" />
              Generate New Invoice
            </button>
          )}
          {canImportDocs && (!permOverridden || canCreate) && (
            <button
              onClick={openImport}
              className="px-4 py-2.5 rounded-xl border border-white/10 text-sm font-medium hover:bg-white/5 transition-colors flex items-center gap-2"
            >
              <Upload className="w-4 h-4" />
              Import Document
            </button>
          )}
          {(!permOverridden || canCreate) && (
            <button onClick={openSettings} className="px-4 py-2.5 rounded-xl border border-white/10 text-sm font-medium hover:bg-white/5 transition-colors flex items-center gap-2">
              <Settings2 className="w-4 h-4" />
              Invoice Settings
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-card p-5 rounded-2xl flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20"><CreditCard className="w-6 h-6 text-emerald-400" /></div>
          <div>
            <div className="text-2xl font-display font-medium tracking-tight mb-0.5">{fmtMoney(stats.totalPaid)}</div>
            <div className="text-[11px] font-medium text-white/40 uppercase tracking-wider">{t('finance.total_collected')}</div>
          </div>
        </div>
        <div className="glass-card p-5 rounded-2xl flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20"><Clock className="w-6 h-6 text-amber-400" /></div>
          <div>
            <div className="text-2xl font-display font-medium tracking-tight mb-0.5">{fmtMoney(stats.pending)}</div>
            <div className="text-[11px] font-medium text-white/40 uppercase tracking-wider">{t('finance.pending_payments')}</div>
          </div>
        </div>
        <div className="glass-card p-5 rounded-2xl flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center border border-red-500/20"><AlertCircle className="w-6 h-6 text-red-400" /></div>
          <div>
            <div className="text-2xl font-display font-medium tracking-tight mb-0.5">{fmtMoney(stats.overdue)}</div>
            <div className="text-[11px] font-medium text-white/40 uppercase tracking-wider">{t('finance.overdue_amount')}</div>
          </div>
        </div>
      </div>

      <div className="glass-card rounded-3xl p-6 overflow-hidden flex flex-col">
        <div className="flex flex-col gap-4 mb-6 shrink-0">
          <div className="flex flex-col md:flex-row gap-4 justify-between">
            <div className="relative w-full md:w-96 group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 group-focus-within:text-[#fc0ce4] transition-colors" />
              <input type="text" placeholder={t('finance.search')} value={search} onChange={e => setSearch(e.target.value)} className="w-full bg-white/5 border border-white/5 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#fc0ce4]/40 focus:bg-[#fc0ce4]/5 focus:shadow-[0_0_15px_rgba(252,12,228,0.1)] transition-all" />
            </div>
            <button onClick={handleExportCsv} disabled={filtered.length === 0} className="px-4 py-2.5 rounded-xl border border-white/10 text-sm font-medium hover:bg-white/5 transition-colors flex items-center gap-2 disabled:opacity-30 self-start">
              <Download className="w-4 h-4" />
              {t('common.export_csv')}
            </button>
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            {(['all', 'paid', 'partial', 'not_paid', 'overdue'] as StatusFilter[]).map(s => (
              <button key={s} onClick={() => setStatusFilter(s)} className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${statusFilter === s ? 'bg-[#fc0ce4]/15 border-[#fc0ce4]/30 text-[#fc0ce4]' : 'border-white/10 text-white/40 hover:bg-white/5 hover:text-white/60'}`}>
                {s === 'all' ? t('finance.all') : t(STATUS_LABEL[s])}
              </button>
            ))}

            <div className="w-px h-5 bg-white/10 mx-1" />

            <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)} className="glass-select px-3 py-1.5 rounded-lg text-xs">
              <option value="">{t('finance.all_months')}</option>
              {filterOptions.months.map(m => <option key={m} value={m}>{t(`months.${MONTH_KEYS[m - 1]}`)}</option>)}
            </select>
            <select value={filterYear} onChange={e => setFilterYear(e.target.value)} className="glass-select px-3 py-1.5 rounded-lg text-xs">
              <option value="">{t('finance.all_years')}</option>
              {filterOptions.years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <select value={filterClass} onChange={e => setFilterClass(e.target.value)} className="glass-select px-3 py-1.5 rounded-lg text-xs">
              <option value="">{t('finance.all_classes')}</option>
              {filterOptions.classes.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={filterTeacher} onChange={e => setFilterTeacher(e.target.value)} className="glass-select px-3 py-1.5 rounded-lg text-xs">
              <option value="">{t('finance.all_teachers')}</option>
              {filterOptions.teachers.map(t => <option key={t} value={t}>{t}</option>)}
            </select>

            {hasActiveFilters && (
              <button onClick={clearAllFilters} className="text-xs text-white/30 hover:text-white transition-colors ml-1">
                {t('common.clear_all')}
              </button>
            )}
          </div>
        </div>
        <div className="overflow-x-auto flex-1">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-white/30 gap-2"><Loader2 className="w-5 h-5 animate-spin" /></div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-white/30 gap-3">
              <CreditCard className="w-8 h-8 opacity-40" />
              <p className="text-sm">{hasActiveFilters ? 'No invoices match your filters.' : 'No invoices yet. Enroll students into classes to generate invoices automatically.'}</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse min-w-[1050px]">
              <thead>
                <tr className="border-b border-white/5 text-[11px] uppercase tracking-widest text-white/30">
                  <th className="pb-3 font-medium">{t('finance.invoice_id')}</th>
                  <th className="pb-3 font-medium">{t('table.student')}</th>
                  <th className="pb-3 font-medium">{t('finance.col_title')}</th>
                  <th className="pb-3 font-medium">{t('finance.col_teacher')}</th>
                  <th className="pb-3 font-medium">{t('finance.col_month')}</th>
                  <th className="pb-3 font-medium">{t('finance.col_year')}</th>
                  <th className="pb-3 font-medium">{t('finance.due_date')}</th>
                  <th className="pb-3 font-medium">{t('finance.amount')}</th>
                  <th className="pb-3 font-medium">{t('table.status')}</th>
                  <th className="pb-3 font-medium text-right">{t('table.action')}</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {filtered.map((inv, idx) => {
                  const Icon = STATUS_ICON[inv.status] || Clock;
                  return (
                    <tr key={inv.id || inv.invoiceId || idx} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                      <td className="py-4 text-white/60 text-xs font-mono">{inv.invoiceId || inv.id.slice(0, 8).toUpperCase()}</td>
                      <td className="py-4 font-medium text-white/90">{inv.studentName}</td>
                      <td className="py-4 text-white/70 max-w-[200px]">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="truncate">{inv.title}</span>
                          {inv.isManual && <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-md bg-[#949ce4]/10 border border-[#949ce4]/25 text-[#949ce4]/70 font-medium">Manual</span>}
                        </div>
                      </td>
                      <td className="py-4 text-white/50 text-xs">{inv.teacherName || '-'}</td>
                      <td className="py-4 text-white/60 text-xs">{t(`months.${MONTH_KEYS[inv.month - 1]}`)}</td>
                      <td className="py-4 text-white/60 text-xs">{inv.year}</td>
                      <td className="py-4 text-white/60 text-xs">{fmtDate(inv.dueDate)}</td>
                      <td className="py-4 font-medium text-white/90">{fmtMoney(inv.amount)}</td>
                      <td className="py-4">
                        <button onClick={() => setStatusInvoice(inv)} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium uppercase tracking-wider border cursor-pointer hover:opacity-80 transition-opacity ${STATUS_BADGE[inv.status]}`}>
                          <Icon className="w-3 h-3" />
                          {t(STATUS_LABEL[inv.status])}
                        </button>
                      </td>
                      <td className="py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {(!permOverridden || canUpdate) && (
                            <button onClick={() => { setEditInvoice(inv); setEditAmount(String(inv.amount)); setEditTitle(inv.title); setEditDueDate(inv.dueDate ? (() => { const d = inv.dueDate.slice(0, 10).split('-'); return `${d[2]}/${d[1]}/${d[0].slice(2)}`; })() : ''); }} className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white/40 hover:text-white" title="Edit">
                              <Pencil className="w-4 h-4" />
                            </button>
                          )}
                          {(!permOverridden || canDelete) && (
                            <button onClick={() => setDeleteTarget(inv)} className="p-2 hover:bg-red-500/10 rounded-lg transition-colors text-red-400/40 hover:text-red-400" title="Remove">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Import payment document modal */}
      <AnimatePresence>
        {showImport && (
          <>
            <motion.div key="imp-bg" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => !importing && setShowImport(false)} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" />
            <motion.div key="imp-modal" initial={{ opacity: 0, scale: 0.96, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 12 }} transition={{ type: 'spring', damping: 28, stiffness: 340 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
              <div className="w-full max-w-md bg-[#0f0f0f] border border-white/10 rounded-2xl shadow-2xl pointer-events-auto" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                      <FileText className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-white">Import Payment Documents</h2>
                      <p className="text-[11px] text-white/40 mt-0.5">Upload one or more payment-confirmation .docx files to record paid invoices.</p>
                    </div>
                  </div>
                  <button onClick={() => !importing && setShowImport(false)} className="p-1.5 hover:bg-white/10 rounded-lg text-white/40 hover:text-white transition-all"><X className="w-4 h-4" /></button>
                </div>

                <div className="px-5 py-4 space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold text-white/60 uppercase tracking-widest">Documents (.docx)</label>
                    <input
                      type="file"
                      accept=".docx"
                      multiple
                      onChange={e => setImpFiles(Array.from(e.target.files ?? []))}
                      className="w-full text-sm text-white/70 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-medium file:bg-white/10 file:text-white hover:file:bg-white/15 file:cursor-pointer"
                    />
                    <p className="text-[11px] text-white/30">
                      {impFiles.length > 0 ? `${impFiles.length} file${impFiles.length !== 1 ? 's' : ''} selected. ` : ''}
                      Reads Student Name, Payment Amount and Date/Month of Payment. Creates paid invoices shown as “Imported Doc”.
                    </p>
                  </div>

                  {importError && (
                    <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{importError}</span>
                    </div>
                  )}

                  {importSummary && importSummary.created > 0 && (
                    <div className="px-3 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs space-y-1 max-h-40 overflow-y-auto custom-scrollbar">
                      <p className="font-semibold text-emerald-400">{importSummary.created} invoice{importSummary.created !== 1 ? 's' : ''} imported</p>
                      {importSummary.items.map((it, i) => (
                        <p key={i}>{it.studentName} · {fmtMoney(it.amount)} · {MONTH_NAMES[it.month - 1]} {it.year}</p>
                      ))}
                    </div>
                  )}
                </div>

                <div className="px-5 py-4 border-t border-white/8 flex justify-end gap-2">
                  <button onClick={() => setShowImport(false)} disabled={importing} className="px-4 py-2 rounded-xl border border-white/10 text-sm font-medium hover:bg-white/5 transition-colors disabled:opacity-40">
                    {importSummary ? 'Close' : 'Cancel'}
                  </button>
                  <button onClick={() => runImport()} disabled={importing || impFiles.length === 0} className="px-4 py-2 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-sm font-medium hover:bg-emerald-500/30 transition-colors flex items-center gap-2 disabled:opacity-40">
                    {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    {importing ? 'Importing…' : `Import${impFiles.length ? ` ${impFiles.length}` : ''}`}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Students-not-found modal (invoice import) */}
      <AnimatePresence>
        {unmatched && (
          <UnmatchedStudentsModal
            students={unmatched}
            context="invoice"
            onClose={() => setUnmatched(null)}
            onReimport={handleUnmatchedReimport}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showCreateInvoice && (
          <>
            <motion.div key="create-bg" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => !creatingInvoice && setShowCreateInvoice(false)} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" />
            <motion.div key="create-modal" initial={{ opacity: 0, scale: 0.96, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 12 }} transition={{ type: 'spring', damping: 28, stiffness: 340 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
              <div className="w-full max-w-lg bg-[#0f0f0f] border border-white/10 rounded-2xl shadow-2xl pointer-events-auto" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
                  <div>
                    <h2 className="text-sm font-bold text-white">Generate New Invoice</h2>
                    <p className="text-[11px] text-white/40 mt-0.5">Create one invoice manually for an active enrollment.</p>
                  </div>
                  <button onClick={() => !creatingInvoice && setShowCreateInvoice(false)} className="p-1.5 hover:bg-white/10 rounded-lg text-white/40 hover:text-white transition-all"><X className="w-4 h-4" /></button>
                </div>

                <div className="px-5 py-4 space-y-4">
                  {createInvoiceError && (
                    <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{createInvoiceError}</span>
                    </div>
                  )}
                  {loadingCreateOptions ? (
                    <div className="flex items-center justify-center py-10 text-white/30 gap-2"><Loader2 className="w-5 h-5 animate-spin" /></div>
                  ) : (
                    <>
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-semibold text-white/60 uppercase tracking-widest">Student / Class</label>
                        <select
                          value={createForm.enrollmentId}
                          onChange={e => {
                            const enrollmentId = e.target.value;
                            const selected = enrollmentOptions.find(opt => opt.enrollmentId === enrollmentId);
                            setCreateForm(prev => ({
                              ...prev,
                              enrollmentId,
                              title: selected ? `${selected.className} - ${MONTH_NAMES[Number(prev.month) - 1]} ${prev.year}` : prev.title,
                            }));
                          }}
                          className="glass-select w-full px-3 py-2.5 rounded-xl text-sm"
                        >
                          {enrollmentOptions.length === 0 && <option value="">No active enrollments</option>}
                          {enrollmentOptions.map(opt => (
                            <option key={opt.enrollmentId} value={opt.enrollmentId}>
                              {opt.studentName} - {opt.className}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[11px] font-semibold text-white/60 uppercase tracking-widest">Title</label>
                        <input type="text" value={createForm.title} onChange={e => setCreateForm(f => ({ ...f, title: e.target.value }))} className="glass-input w-full px-3 py-2.5 rounded-xl text-sm text-white" />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-semibold text-white/60 uppercase tracking-widest">Month</label>
                          <select value={createForm.month} onChange={e => setCreateForm(f => ({ ...f, month: e.target.value }))} className="glass-select w-full px-3 py-2.5 rounded-xl text-sm">
                            {MONTH_KEYS.map((mk, idx) => <option key={mk} value={idx + 1}>{t(`months.${mk}`)}</option>)}
                          </select>
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-semibold text-white/60 uppercase tracking-widest">Year</label>
                          <input type="number" min="2020" value={createForm.year} onChange={e => setCreateForm(f => ({ ...f, year: e.target.value }))} className="glass-input w-full px-3 py-2.5 rounded-xl text-sm text-white" />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-semibold text-white/60 uppercase tracking-widest">Due Date</label>
                          <input type="date" value={createForm.dueDate} onChange={e => setCreateForm(f => ({ ...f, dueDate: e.target.value }))} className="glass-input w-full px-3 py-2.5 rounded-xl text-sm text-white" />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-semibold text-white/60 uppercase tracking-widest">Amount (EUR)</label>
                          <input type="number" step="0.01" min="0" value={createForm.amount} onChange={e => setCreateForm(f => ({ ...f, amount: e.target.value }))} className="glass-input w-full px-3 py-2.5 rounded-xl text-sm text-white" />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[11px] font-semibold text-white/60 uppercase tracking-widest">Discount %</label>
                        <input type="number" step="0.1" min="0" max="100" value={createForm.discountPercent} onChange={e => setCreateForm(f => ({ ...f, discountPercent: e.target.value }))} className="glass-input w-full px-3 py-2.5 rounded-xl text-sm text-white" />
                      </div>
                    </>
                  )}
                </div>

                <div className="px-5 py-4 border-t border-white/8 flex gap-3">
                  <button onClick={() => setShowCreateInvoice(false)} disabled={creatingInvoice} className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 text-sm font-medium hover:bg-white/5 transition-colors disabled:opacity-50">Cancel</button>
                  <button onClick={createManualInvoice} disabled={creatingInvoice || loadingCreateOptions || enrollmentOptions.length === 0} className="flex-1 bg-gradient-to-r from-[#fc0ce4] to-[#949ce4] text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                    {creatingInvoice && <Loader2 className="w-4 h-4 animate-spin" />}
                    Create Invoice
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {statusInvoice && (
          <>
            <motion.div key="st-bg" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setStatusInvoice(null)} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" />
            <motion.div key="st-modal" initial={{ opacity: 0, scale: 0.96, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 12 }} transition={{ type: 'spring', damping: 28, stiffness: 340 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
              <div className="w-full max-w-sm bg-[#0f0f0f] border border-white/10 rounded-2xl shadow-2xl pointer-events-auto" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
                  <div>
                    <h2 className="text-sm font-bold text-white">Invoice Status</h2>
                    <p className="text-[11px] text-white/40 mt-0.5">{statusInvoice.title} - {statusInvoice.studentName}</p>
                  </div>
                  <button onClick={() => setStatusInvoice(null)} className="p-1.5 hover:bg-white/10 rounded-lg text-white/40 hover:text-white transition-all"><X className="w-4 h-4" /></button>
                </div>
                <div className="px-5 py-4 space-y-4">
                  <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/8">
                    <span className="text-sm text-white/60">Current Status</span>
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium uppercase tracking-wider border ${STATUS_BADGE[statusInvoice.status]}`}>{t(STATUS_LABEL[statusInvoice.status])}</span>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold text-white/60 uppercase tracking-widest">Mark Status As:</label>
                    <div className="grid grid-cols-2 gap-2">
                      {(['paid', 'partial', 'not_paid', 'overdue'] as const).map(st => {
                        const Ic = STATUS_ICON[st];
                        const isActive = statusInvoice.status === st;
                        return (
                          <button key={st} disabled={changingStatus || isActive} onClick={() => changeStatus(st)} className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all ${isActive ? 'border-white/20 bg-white/[0.06] text-white/30 cursor-default' : `${STATUS_BADGE[st]} hover:opacity-80 cursor-pointer`}`}>
                            {changingStatus ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Ic className="w-3.5 h-3.5" />}
                            {t(STATUS_LABEL[st])}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {editInvoice && (
          <>
            <motion.div key="ed-bg" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setEditInvoice(null)} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" />
            <motion.div key="ed-modal" initial={{ opacity: 0, scale: 0.96, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 12 }} transition={{ type: 'spring', damping: 28, stiffness: 340 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
              <div className="w-full max-w-sm bg-[#0f0f0f] border border-white/10 rounded-2xl shadow-2xl pointer-events-auto" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
                  <div>
                    <h2 className="text-sm font-bold text-white">Edit Invoice</h2>
                    <p className="text-[11px] text-white/40 mt-0.5">{editInvoice.title} - {editInvoice.studentName}</p>
                  </div>
                  <button onClick={() => setEditInvoice(null)} className="p-1.5 hover:bg-white/10 rounded-lg text-white/40 hover:text-white transition-all"><X className="w-4 h-4" /></button>
                </div>
                <div className="px-5 py-4 space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold text-white/60 uppercase tracking-widest">Title</label>
                    <input type="text" value={editTitle} onChange={e => setEditTitle(e.target.value)} className="glass-input w-full px-3 py-2.5 rounded-xl text-sm text-white" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold text-white/60 uppercase tracking-widest">Due Date (dd/mm/yy)</label>
                      <input type="text" placeholder="01/04/26" value={editDueDate} onChange={e => setEditDueDate(e.target.value)} className="glass-input w-full px-3 py-2.5 rounded-xl text-sm text-white" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold text-white/60 uppercase tracking-widest">Amount (EUR)</label>
                      <input type="number" step="0.01" min="0" value={editAmount} onChange={e => setEditAmount(e.target.value)} className="glass-input w-full px-3 py-2.5 rounded-xl text-sm text-white" />
                    </div>
                  </div>
                </div>
                <div className="px-5 py-4 border-t border-white/8 flex gap-3">
                  <button onClick={() => setEditInvoice(null)} className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 text-sm font-medium hover:bg-white/5 transition-colors">Cancel</button>
                  <button onClick={saveEdit} disabled={savingEdit || !editAmount} className="flex-1 bg-gradient-to-r from-[#fc0ce4] to-[#949ce4] text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                    {savingEdit && <Loader2 className="w-4 h-4 animate-spin" />}
                    Save
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deleteTarget && (
          <>
            <motion.div key="del-bg" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDeleteTarget(null)} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" />
            <motion.div key="del-modal" initial={{ opacity: 0, scale: 0.96, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 12 }} transition={{ type: 'spring', damping: 28, stiffness: 340 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
              <div className="w-full max-w-xs bg-[#0f0f0f] border border-white/10 rounded-2xl shadow-2xl pointer-events-auto" onClick={e => e.stopPropagation()}>
                <div className="px-5 py-5 text-center space-y-3">
                  <div className="mx-auto w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center border border-red-500/20"><Trash2 className="w-6 h-6 text-red-400" /></div>
                  <h2 className="text-sm font-bold text-white">Remove Invoice?</h2>
                  <p className="text-[13px] text-white/50">This will permanently remove <strong className="text-white/80">{deleteTarget.title}</strong> for {deleteTarget.studentName}.</p>
                </div>
                <div className="px-5 py-4 border-t border-white/8 flex gap-3">
                  <button onClick={() => setDeleteTarget(null)} className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 text-sm font-medium hover:bg-white/5 transition-colors">Cancel</button>
                  <button onClick={confirmDelete} disabled={deleting} className="flex-1 bg-red-500/20 border border-red-500/30 text-red-400 px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-red-500/30 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                    {deleting && <Loader2 className="w-4 h-4 animate-spin" />}
                    Remove
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
