import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search, Plus, Filter, MoreHorizontal, FileText, CheckCircle, XCircle, Clock,
  ChevronLeft, ChevronRight, Download, User, Loader2, AlertCircle, UserPlus,
  GraduationCap, BarChart2, CheckCircle2, X, BookOpen,
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { useDebounce } from '../hooks/useDebounce';
import { SlideOver } from '../components/SlideOver';
import { playPopSound } from '../utils/sound';
import { PROGRAMS } from '../constants/programs';
import { api } from '../services/api';

type AdminStudent = {
  id: string;
  name: string;
  email: string;
  avatar: string;
  classes: { classId: string; className: string; programId: string; programName: string; enrolledAt: string }[];
  programs: { programId: string; programName: string }[];
  attStats: { total: number; present: number; late: number; absent: number } | null;
};

interface EnrollForm {
  firstName: string;
  lastName: string;
  parentFirstName: string;
  email: string;
  password: string;
  confirmPassword: string;
  phone: string;
  program: string;
}

const BLANK_FORM: EnrollForm = {
  firstName: '', lastName: '', parentFirstName: '',
  email: '', password: '', confirmPassword: '', phone: '', program: '',
};

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

  const totalPages = Math.ceil(filteredStudents.length / itemsPerPage);
  const paginatedStudents = filteredStudents.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  function setField(key: keyof EnrollForm, value: string) {
    setForm(f => ({ ...f, [key]: value }));
    setEnrollError('');
  }

  async function handleAdminEnroll(e: React.FormEvent) {
    e.preventDefault();
    setEnrollError('');

    if (!form.firstName.trim())  { setEnrollError('First name is required.'); return; }
    if (!form.lastName.trim())   { setEnrollError('Last name is required.'); return; }
    if (!form.parentFirstName.trim()) { setEnrollError("Parent's first name is required."); return; }
    if (!form.email.includes('@')) { setEnrollError('Please enter a valid email address.'); return; }
    if (form.password.length < 6) { setEnrollError('Password must be at least 6 characters.'); return; }
    if (form.password !== form.confirmPassword) { setEnrollError('Passwords do not match.'); return; }
    if (!form.phone.trim()) { setEnrollError('Phone number is required.'); return; }
    if (!form.program) { setEnrollError('Please select a program.'); return; }

    setEnrolling(true);
    try {
      await api.registrations.adminEnroll({
        email:            form.email.trim().toLowerCase(),
        firstName:        form.firstName.trim(),
        lastName:         form.lastName.trim(),
        parentFirstName:  form.parentFirstName.trim(),
        password:         form.password,
        phone:            form.phone.trim(),
        program:          form.program,
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
          <p className="text-white/35 text-xs mb-8">They can log in immediately with the credentials you set.</p>
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
            </div>

            {/* Passwords */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[11px] font-semibold text-white/60 uppercase tracking-widest ml-1">Initial Password *</label>
                <input
                  type="password" value={form.password}
                  onChange={e => setField('password', e.target.value)}
                  className={inp} placeholder="Min. 6 characters"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-semibold text-white/60 uppercase tracking-widest ml-1">Confirm Password *</label>
                <input
                  type="password" value={form.confirmPassword}
                  onChange={e => setField('confirmPassword', e.target.value)}
                  className={inp} placeholder="Repeat password"
                />
              </div>
            </div>

            {/* Program */}
            <div className="space-y-2">
              <label className="text-[11px] font-semibold text-white/60 uppercase tracking-widest ml-1">{t('students.select_program')} *</label>
              <select
                value={form.program}
                onChange={e => setField('program', e.target.value)}
                className="glass-select w-full px-4 py-3 rounded-xl text-sm appearance-none"
              >
                <option value="">Select Program</option>
                {PROGRAMS.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
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
        <button 
          onClick={() => setView('add')}
          className="bg-gradient-to-r from-[#fc0ce4] to-[#949ce4] text-white px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 hover:opacity-90 transition-all shadow-[0_0_20px_rgba(252,12,228,0.2)] self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          {t('students.add_new')}
        </button>
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
                  <th className="pb-3 font-medium">Program</th>
                  <th className="pb-3 font-medium">Class</th>
                  <th className="pb-3 font-medium">Enrollment Date</th>
                  <th className="pb-3 font-medium">Payment</th>
                  <th className="pb-3 font-medium">Attendance</th>
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
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={7} className="py-16 text-center">
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

            <button
              onClick={() => {
                playPopSound();
                navigate(`/students/${selectedStudentForPanel.id}`);
              }}
              className="w-full py-3 rounded-xl border border-white/10 text-sm font-medium hover:bg-white/5 transition-colors flex items-center justify-center gap-2"
            >
              <User className="w-4 h-4" />
              View Full Profile
            </button>
          </div>
        )}
      </SlideOver>

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
