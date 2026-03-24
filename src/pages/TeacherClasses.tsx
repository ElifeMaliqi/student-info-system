import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  BookOpen, Users, ChevronRight, ArrowLeft, Search,
  CalendarCheck, FileText, CheckCircle2, XCircle, Clock,
  GraduationCap, Loader2, CheckCircle, BarChart2,
  StickyNote, Pencil, Check, AlertCircle, ClipboardList,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useUser } from '../context/UserContext';
import { api } from '../services/api';
import type { GradeTable } from '../types';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

type MyClass = {
  id: string;
  title: string;
  programName: string;
  enrollmentCount: number;
  sessions: { dayOfWeek: number; startTime: string; endTime: string }[];
};

type StudentRow = {
  studentId: string;
  studentName: string;
  email: string;
  avatar: string;
};

type AttSession = {
  classId: string;
  className: string;
  date: string;
  present: number;
  absent: number;
  late: number;
};

type Quiz = {
  id: string;
  title: string;
  program: string;
  submissions: string;
  date: string;
  status: string;
  type?: string;
};

type Tab = 'students' | 'projects' | 'attendance';

export default function TeacherClasses() {
  const { t } = useLanguage();
  const { user } = useUser();

  // --- List state ---
  const [classes, setClasses]       = useState<MyClass[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listSearch, setListSearch]   = useState('');

  // --- Detail state ---
  const [selected, setSelected]         = useState<MyClass | null>(null);
  const [activeTab, setActiveTab]       = useState<Tab>('students');
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Detail data
  const [students,    setStudents   ] = useState<StudentRow[]>([]);
  const [gradeTables,  setGradeTables] = useState<GradeTable[]>([]);
  const [attSessions, setAttSessions] = useState<AttSession[]>([]);
  const [attStats,    setAttStats   ] = useState<Record<string, { total: number; present: number; late: number; absent: number }>>({});
  const [notes,       setNotes      ] = useState<Record<string, string>>({});

  // Note modal
  const [noteModal,  setNoteModal ] = useState<{ studentId: string; studentName: string } | null>(null);
  const [noteText,   setNoteText  ] = useState('');
  const [saving,     setSaving    ] = useState(false);
  const [saveError,  setSaveError ] = useState('');

  // Attendance detail modal (per session)
  const [attModal, setAttModal] = useState<AttSession | null>(null);

  // Grading modal
  const [gradingEntry, setGradingEntry] = useState<{ id: string; studentName: string } | null>(null);
  const [gradePoints, setGradePoints] = useState('');
  const [gradePassed, setGradePassed] = useState<boolean | null>(null);
  const [gradeNote, setGradeNote] = useState('');
  const [grading, setGrading] = useState(false);
  const [gradeError, setGradeError] = useState('');

  // Detail searches
  const [studSearch, setStudSearch] = useState('');

  // Load list
  useEffect(() => {
    if (!user) return;
    setLoadingList(true);
    api.teacher.getMyClasses(user.id)
      .then(setClasses)
      .catch(() => {})
      .finally(() => setLoadingList(false));
  }, [user]);

  // Load detail when class selected
  useEffect(() => {
    if (!selected || !user) return;
    setLoadingDetail(true);
    setStudents([]);
    setGradeTables([]);
    setAttSessions([]);

    Promise.all([
      api.teacher.getClassStudents(user.id),
      api.gradeTables.getForClass(selected.id),
      api.classAttendance.getSessionsForClass(selected.id),
      api.classAttendance.getSummaryForTeacher(user.id),
      api.teacher.getStudentNotes(user.id),
    ])
      .then(([allStudents, classTables, classAtt, attSummary, teacherNotes]) => {
        // Filter students to this class
        const classStudents = allStudents
          .filter(r => r.classId === selected.id)
          .map(r => ({
            studentId:   r.studentId,
            studentName: r.studentName,
            email:       r.email,
            avatar:      r.avatar,
          }));
        setStudents(classStudents);

        setAttSessions(classAtt);

        setGradeTables(classTables);
        setAttStats(attSummary);
        setNotes(teacherNotes);
      })
      .catch(() => {})
      .finally(() => setLoadingDetail(false));
  }, [selected, user]);

  const filteredClasses = useMemo(() => {
    if (!listSearch.trim()) return classes;
    const q = listSearch.toLowerCase();
    return classes.filter(c =>
      c.title.toLowerCase().includes(q) ||
      c.programName.toLowerCase().includes(q)
    );
  }, [classes, listSearch]);

  const filteredStudents = useMemo(() => {
    if (!studSearch.trim()) return students;
    const q = studSearch.toLowerCase();
    return students.filter(s =>
      s.studentName.toLowerCase().includes(q) ||
      s.email.toLowerCase().includes(q)
    );
  }, [students, studSearch]);

  function openNote(studentId: string, studentName: string) {
    setNoteText(notes[studentId] ?? '');
    setSaveError('');
    setNoteModal({ studentId, studentName });
  }

  async function saveNote() {
    if (!user || !noteModal) return;
    setSaving(true);
    setSaveError('');
    try {
      await api.teacher.upsertStudentNote(user.id, noteModal.studentId, noteText);
      setNotes(prev => ({ ...prev, [noteModal.studentId]: noteText }));
      setNoteModal(null);
    } catch {
      setSaveError('Failed to save note.');
    } finally {
      setSaving(false);
    }
  }

  function openGrading(entryId: string, studentName: string) {
    setGradingEntry({ id: entryId, studentName });
    setGradePoints('');
    setGradePassed(null);
    setGradeNote('');
    setGradeError('');
  }

  async function submitGrade() {
    if (!gradingEntry || gradePassed === null) return;
    const pts = parseFloat(gradePoints);
    if (isNaN(pts) || pts < 0) {
      setGradeError('Enter a valid point value.');
      return;
    }
    setGrading(true);
    setGradeError('');
    try {
      await api.gradeTables.gradeStudent(gradingEntry.id, pts, gradePassed, gradeNote || undefined);
      // Refresh grade tables
      if (selected) {
        const updated = await api.gradeTables.getForClass(selected.id);
        setGradeTables(updated);
      }
      setGradingEntry(null);
    } catch {
      setGradeError('Failed to save grade.');
    } finally {
      setGrading(false);
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  if (selected) {
    return (
      <motion.div
        key="detail"
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        className="space-y-6"
      >
        {/* Header */}
        <div className="flex items-start gap-4">
          <button
            onClick={() => { setSelected(null); setActiveTab('students'); }}
            className="mt-1 p-2 rounded-xl border border-white/10 hover:bg-white/5 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs px-2 py-0.5 rounded-full bg-[#fc0ce4]/10 text-[#fc0ce4] border border-[#fc0ce4]/20 font-medium">
                {selected.programName}
              </span>
            </div>
            <h1 className="font-display text-3xl font-medium tracking-tight">{selected.title}</h1>
            <div className="flex items-center gap-4 mt-1 text-sm text-white/40">
              <span className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" />
                {selected.enrollmentCount} students
              </span>
              {selected.sessions.length > 0 && (
                <span className="flex items-center gap-1.5">
                  <CalendarCheck className="w-3.5 h-3.5" />
                  {selected.sessions.map(s =>
                    `${DAYS[s.dayOfWeek]} ${s.startTime.slice(0, 5)}–${s.endTime.slice(0, 5)}`
                  ).join(', ')}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-white/5 rounded-2xl w-fit">
          {(['students', 'projects', 'attendance'] as Tab[]).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-2 rounded-xl text-sm font-medium transition-all capitalize ${
                activeTab === tab
                  ? 'bg-gradient-to-r from-[#fc0ce4]/20 to-[#949ce4]/20 text-white border border-[#fc0ce4]/20'
                  : 'text-white/40 hover:text-white'
              }`}
            >
              {tab === 'students' && <Users className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" />}
              {tab === 'projects' && <ClipboardList className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" />}
              {tab === 'attendance' && <CalendarCheck className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" />}
              {tab === 'projects' ? 'Final Projects' : tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {loadingDetail ? (
          <div className="flex items-center justify-center py-20 text-white/30">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : (
          <>
            {/* ── Students Tab ── */}
            {activeTab === 'students' && (
              <div className="glass-card rounded-3xl p-6 overflow-hidden flex flex-col">
                <div className="flex items-center justify-between mb-5 shrink-0">
                  <h2 className="font-display text-lg font-medium">Enrolled Students</h2>
                  <div className="relative group">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 group-focus-within:text-[#fc0ce4] transition-colors" />
                    <input
                      type="text"
                      placeholder="Search students…"
                      value={studSearch}
                      onChange={e => setStudSearch(e.target.value)}
                      className="bg-white/5 border border-white/5 rounded-xl py-2 pl-9 pr-4 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#fc0ce4]/40 transition-all w-56"
                    />
                  </div>
                </div>
                <div className="overflow-x-auto -mx-6 px-6">
                  <table className="w-full text-left border-collapse min-w-[600px]">
                    <thead>
                      <tr className="border-b border-white/5 text-[11px] uppercase tracking-widest text-white/30">
                        <th className="pb-3 font-medium">Student</th>
                        <th className="pb-3 px-4 font-medium">Attendance</th>
                        <th className="pb-3 px-4 font-medium text-right">Note</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm">
                      {filteredStudents.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="py-12 text-center">
                            <GraduationCap className="w-8 h-8 text-white/10 mx-auto mb-2" />
                            <p className="text-white/30 text-sm">No students found.</p>
                          </td>
                        </tr>
                      ) : (
                        filteredStudents.map(s => {
                          const att = attStats[s.studentId];
                          const pct = att && att.total > 0
                            ? Math.round(((att.present + att.late) / att.total) * 100)
                            : null;
                          const barColor = pct === null ? '' : pct >= 75 ? 'bg-emerald-400' : pct >= 50 ? 'bg-amber-400' : 'bg-red-400';
                          const txtColor = pct === null ? 'text-white/30' : pct >= 75 ? 'text-emerald-400' : pct >= 50 ? 'text-amber-400' : 'text-red-400';
                          return (
                            <tr key={s.studentId} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors group">
                              <td className="py-3.5">
                                <div className="flex items-center gap-3">
                                  <img
                                    src={s.avatar}
                                    alt={s.studentName}
                                    className="w-8 h-8 rounded-full border border-white/10 shrink-0"
                                  />
                                  <div>
                                    <div className="font-medium text-white/90 group-hover:text-white transition-colors">{s.studentName}</div>
                                    <div className="text-[11px] text-white/40">{s.email}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="py-3.5 px-4">
                                {pct !== null ? (
                                  <div className="flex items-center gap-2">
                                    <div className="w-20 h-1.5 bg-white/10 rounded-full overflow-hidden">
                                      <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
                                    </div>
                                    <span className={`text-xs font-semibold ${txtColor}`}>{pct}%</span>
                                  </div>
                                ) : (
                                  <span className="text-white/20 text-xs">—</span>
                                )}
                              </td>
                              <td className="py-3.5 px-4 text-right">
                                <button
                                  onClick={() => openNote(s.studentId, s.studentName)}
                                  className={`p-1.5 rounded-lg transition-colors ${notes[s.studentId] ? 'text-[#fc0ce4]' : 'text-white/20 hover:text-white/60'}`}
                                  title={notes[s.studentId] ? 'Edit note' : 'Add note'}
                                >
                                  <StickyNote className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── Final Projects Tab ── */}
            {activeTab === 'projects' && (
              <div className="glass-card rounded-3xl p-6 overflow-hidden flex flex-col">
                <div className="flex items-center justify-between mb-5 shrink-0">
                  <h2 className="font-display text-lg font-medium">Final Project Grade Tables</h2>
                </div>
                {gradeTables.length === 0 ? (
                  <div className="flex flex-col items-center py-12 text-white/20">
                    <ClipboardList className="w-8 h-8 mb-2" />
                    <p className="text-sm">No grade tables for this class yet.</p>
                    <p className="text-xs text-white/30 mt-1">Create one from the Grading page.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {gradeTables.map(table => {
                      const graded = table.entries.filter(e => e.passed != null).length;
                      const total = table.entries.length;
                      const passed = table.entries.filter(e => e.passed === true).length;
                      const failed = table.entries.filter(e => e.passed === false).length;
                      return (
                        <div key={table.id} className="p-4 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-colors">
                          <div className="flex items-start justify-between gap-3 mb-3">
                            <div>
                              <h3 className="font-medium text-white/90 text-sm">{table.name}</h3>
                              <p className="text-xs text-white/40 mt-0.5">{table.degree ? `${table.degree} · ` : ''}{table.createdAt}</p>
                            </div>
                            <div className="flex items-center gap-3 text-xs shrink-0">
                              <span className="text-white/50"><span className="text-white font-medium">{graded}</span>/{total} graded</span>
                              {passed > 0 && <span className="text-emerald-400 flex items-center gap-1"><CheckCircle className="w-3 h-3" />{passed}</span>}
                              {failed > 0 && <span className="text-red-400 flex items-center gap-1"><XCircle className="w-3 h-3" />{failed}</span>}
                            </div>
                          </div>
                          <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-[#fc0ce4] to-[#949ce4] transition-all" style={{ width: total > 0 ? `${(graded / total) * 100}%` : '0%' }} />
                          </div>
                          {/* Student entries */}
                          {table.entries.length > 0 && (
                            <div className="mt-3 space-y-1">
                              {table.entries.map(entry => (
                                <div key={entry.id} className="flex items-center justify-between text-xs py-1.5 px-2 rounded-lg hover:bg-white/[0.03] transition-colors">
                                  <span className="text-white/70">{entry.studentName}</span>
                                  <span>
                                    {entry.passed === true && <span className="text-emerald-400 font-medium">Passed · {entry.totalPoints} pts</span>}
                                    {entry.passed === false && <span className="text-red-400 font-medium">Failed · {entry.totalPoints} pts</span>}
                                    {entry.passed == null && (
                                      <button
                                        onClick={() => openGrading(entry.id, entry.studentName)}
                                        className="px-2.5 py-1 rounded-lg bg-[#fc0ce4]/10 text-[#fc0ce4] border border-[#fc0ce4]/20 hover:bg-[#fc0ce4]/20 transition-colors font-medium"
                                      >
                                        Grade
                                      </button>
                                    )}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ── Attendance Tab ── */}
            {activeTab === 'attendance' && (
              <div className="glass-card rounded-3xl p-6 overflow-hidden flex flex-col">
                <div className="flex items-center justify-between mb-5 shrink-0">
                  <h2 className="font-display text-lg font-medium">Attendance History</h2>
                  <span className="text-xs text-white/30">{attSessions.length} session{attSessions.length !== 1 ? 's' : ''} recorded</span>
                </div>
                {attSessions.length === 0 ? (
                  <div className="flex flex-col items-center py-12 text-white/20">
                    <BarChart2 className="w-10 h-10 mb-3" />
                    <p className="text-sm">No attendance recorded yet.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {attSessions.map((s, i) => {
                      const total = s.present + s.absent + s.late;
                      const pct = total > 0 ? Math.round(((s.present + s.late) / total) * 100) : 0;
                      const barColor = pct >= 75 ? 'bg-emerald-400' : pct >= 50 ? 'bg-amber-400' : 'bg-red-400';
                      const txtColor = pct >= 75 ? 'text-emerald-400' : pct >= 50 ? 'text-amber-400' : 'text-red-400';
                      const dateObj  = new Date(`${s.date}T12:00:00`);
                      return (
                        <button
                          key={`${s.classId}-${s.date}-${i}`}
                          onClick={() => setAttModal(s)}
                          className="w-full flex items-center gap-4 px-4 py-3 rounded-xl bg-white/[0.02] hover:bg-white/5 border border-white/5 transition-colors text-left group"
                        >
                          <div className="w-10 text-center shrink-0">
                            <div className="text-xs font-bold text-white/60">
                              {dateObj.toLocaleDateString('en-US', { month: 'short' })}
                            </div>
                            <div className="text-lg font-display font-medium leading-none">
                              {dateObj.getDate()}
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
                              </div>
                              <span className={`text-xs font-semibold shrink-0 ${txtColor}`}>{pct}%</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <span className="flex items-center gap-1 text-xs text-emerald-400"><CheckCircle2 className="w-3 h-3" />{s.present}</span>
                            <span className="flex items-center gap-1 text-xs text-amber-400"><Clock className="w-3 h-3" />{s.late}</span>
                            <span className="flex items-center gap-1 text-xs text-red-400"><XCircle className="w-3 h-3" />{s.absent}</span>
                          </div>
                          <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-white/60 transition-colors shrink-0" />
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Attendance session breakdown modal */}
        <AnimatePresence>
          {attModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={() => setAttModal(null)}
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative w-full max-w-sm bg-[#0a0a0a] border border-white/10 rounded-3xl shadow-2xl p-6"
              >
                <div className="mb-4">
                  <div className="text-xs text-white/40 mb-1">
                    {new Date(`${attModal.date}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                  </div>
                  <h3 className="font-display text-lg font-medium">Attendance Breakdown</h3>
                </div>
                {(() => {
                  const total = attModal.present + attModal.absent + attModal.late;
                  const pct = total > 0 ? Math.round(((attModal.present + attModal.late) / total) * 100) : 0;
                  return (
                    <>
                      <div className="mb-4">
                        <div className="flex justify-between text-xs text-white/40 mb-1.5">
                          <span>Participation rate</span>
                          <span className="font-semibold text-white">{pct}%</span>
                        </div>
                        <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${pct >= 75 ? 'bg-emerald-400' : pct >= 50 ? 'bg-amber-400' : 'bg-red-400'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                          <span className="flex items-center gap-2 text-sm text-emerald-400"><CheckCircle2 className="w-4 h-4" />Present</span>
                          <span className="font-semibold text-emerald-400">{attModal.present}</span>
                        </div>
                        <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
                          <span className="flex items-center gap-2 text-sm text-amber-400"><Clock className="w-4 h-4" />Late</span>
                          <span className="font-semibold text-amber-400">{attModal.late}</span>
                        </div>
                        <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20">
                          <span className="flex items-center gap-2 text-sm text-red-400"><XCircle className="w-4 h-4" />Absent</span>
                          <span className="font-semibold text-red-400">{attModal.absent}</span>
                        </div>
                      </div>
                      <div className="mt-4 text-xs text-white/30 text-center">{total} student{total !== 1 ? 's' : ''} total</div>
                    </>
                  );
                })()}
                <button
                  onClick={() => setAttModal(null)}
                  className="mt-5 w-full py-2.5 rounded-xl border border-white/10 text-sm font-medium hover:bg-white/5 transition-colors"
                >
                  Close
                </button>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Note modal */}
        <AnimatePresence>
          {noteModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={() => setNoteModal(null)}
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative w-full max-w-sm bg-[#0a0a0a] border border-white/10 rounded-3xl shadow-2xl p-6"
              >
                <h3 className="font-display text-lg font-medium mb-1">Student Note</h3>
                <p className="text-sm text-white/40 mb-4">{noteModal.studentName}</p>
                <textarea
                  rows={5}
                  value={noteText}
                  onChange={e => setNoteText(e.target.value)}
                  placeholder="Write a private note about this student…"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-[#fc0ce4]/40 resize-none"
                />
                {saveError && (
                  <p className="text-xs text-red-400 mt-2 flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5" />{saveError}
                  </p>
                )}
                <div className="flex gap-3 mt-4">
                  <button
                    onClick={() => setNoteModal(null)}
                    className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm font-medium hover:bg-white/5 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveNote}
                    disabled={saving}
                    className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-[#fc0ce4] to-[#949ce4] text-white text-sm font-semibold hover:opacity-90 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    Save
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Grading modal */}
        <AnimatePresence>
          {gradingEntry && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={() => setGradingEntry(null)}
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative w-full max-w-sm bg-[#0a0a0a] border border-white/10 rounded-3xl shadow-2xl p-6"
              >
                <h3 className="font-display text-lg font-medium mb-1">Grade Student</h3>
                <p className="text-sm text-white/40 mb-4">{gradingEntry.studentName}</p>

                <label className="block text-xs text-white/50 mb-1.5">Total Points</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={gradePoints}
                  onChange={e => setGradePoints(e.target.value)}
                  placeholder="0"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-[#fc0ce4]/40 mb-4"
                />

                <label className="block text-xs text-white/50 mb-1.5">Result</label>
                <div className="flex gap-2 mb-4">
                  <button
                    onClick={() => setGradePassed(true)}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                      gradePassed === true
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'border border-white/10 text-white/40 hover:bg-white/5'
                    }`}
                  >
                    <CheckCircle className="w-4 h-4" /> Passed
                  </button>
                  <button
                    onClick={() => setGradePassed(false)}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                      gradePassed === false
                        ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                        : 'border border-white/10 text-white/40 hover:bg-white/5'
                    }`}
                  >
                    <XCircle className="w-4 h-4" /> Failed
                  </button>
                </div>

                <label className="block text-xs text-white/50 mb-1.5">Note (optional)</label>
                <textarea
                  rows={3}
                  value={gradeNote}
                  onChange={e => setGradeNote(e.target.value)}
                  placeholder="Add a note…"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-[#fc0ce4]/40 resize-none"
                />

                {gradeError && (
                  <p className="text-xs text-red-400 mt-2 flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5" />{gradeError}
                  </p>
                )}

                <div className="flex gap-3 mt-4">
                  <button
                    onClick={() => setGradingEntry(null)}
                    className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm font-medium hover:bg-white/5 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={submitGrade}
                    disabled={grading || gradePassed === null || !gradePoints}
                    className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-[#fc0ce4] to-[#949ce4] text-white text-sm font-semibold hover:opacity-90 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                  >
                    {grading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    Save Grade
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

      </motion.div>
    );
  }

  // ─── Classes List ─────────────────────────────────────────────────────────

  return (
    <motion.div
      key="list"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-medium tracking-tight mb-1">My Classes</h1>
          <p className="text-white/50 text-sm">Click a class to view its students, quizzes, and attendance.</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative w-full max-w-xs group">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 group-focus-within:text-[#fc0ce4] transition-colors" />
        <input
          type="text"
          placeholder="Search classes…"
          value={listSearch}
          onChange={e => setListSearch(e.target.value)}
          className="w-full bg-white/5 border border-white/5 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#fc0ce4]/40 focus:bg-[#fc0ce4]/5 transition-all"
        />
      </div>

      {loadingList ? (
        <div className="flex items-center justify-center py-20 text-white/30">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : filteredClasses.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-white/20">
          <BookOpen className="w-12 h-12 mb-4" />
          <p className="text-base">No classes found.</p>
          <p className="text-sm mt-1">Classes you teach will appear here.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredClasses.map((cls, i) => (
            <motion.button
              key={cls.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => setSelected(cls)}
              className="glass-card rounded-2xl p-5 text-left hover:border-[#fc0ce4]/20 transition-all group flex flex-col gap-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#fc0ce4]/20 to-[#949ce4]/20 border border-[#fc0ce4]/20 flex items-center justify-center shrink-0">
                  <BookOpen className="w-5 h-5 text-[#fc0ce4]" />
                </div>
                <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-[#fc0ce4] group-hover:translate-x-0.5 transition-all mt-1 shrink-0" />
              </div>

              <div className="flex-1">
                <h3 className="font-display font-medium text-base text-white/90 group-hover:text-white transition-colors leading-snug mb-1">
                  {cls.title}
                </h3>
                <span className="text-xs px-2 py-0.5 rounded-full bg-white/5 text-white/40 border border-white/10">
                  {cls.programName}
                </span>
              </div>

              <div className="flex items-center gap-4 pt-3 border-t border-white/5">
                <span className="flex items-center gap-1.5 text-xs text-white/50">
                  <Users className="w-3.5 h-3.5" />
                  {cls.enrollmentCount} student{cls.enrollmentCount !== 1 ? 's' : ''}
                </span>
                {cls.sessions.length > 0 && (
                  <span className="flex items-center gap-1.5 text-xs text-white/50">
                    <CalendarCheck className="w-3.5 h-3.5" />
                    {cls.sessions.map(s => DAYS[s.dayOfWeek]).join(', ')}
                  </span>
                )}
              </div>
            </motion.button>
          ))}
        </div>
      )}
    </motion.div>
  );
}
