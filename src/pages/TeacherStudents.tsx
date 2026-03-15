import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search, Plus, X, Loader2, StickyNote, Pencil, Check, AlertCircle, GraduationCap,
  BarChart2, CheckCircle2, XCircle, Clock,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useUser } from '../context/UserContext';
import { api } from '../services/api';

interface StudentRow {
  studentId: string;
  studentName: string;
  email: string;
  avatar: string;
  className: string;
  classId: string;
}

interface GroupedStudent {
  studentId: string;
  studentName: string;
  email: string;
  avatar: string;
  classes: { classId: string; className: string }[];
}

export default function TeacherStudents() {
  const { t } = useLanguage();
  const { user } = useUser();

  const [rows,     setRows    ] = useState<StudentRow[]>([]);
  const [notes,    setNotes   ] = useState<Record<string, string>>({});
  const [attStats, setAttStats] = useState<Record<string, { total: number; present: number; late: number; absent: number }>>({});
  const [loading,  setLoading ] = useState(true);
  const [search,   setSearch  ] = useState('');

  // Classes popover
  const [classesModal, setClassesModal] = useState<{ studentName: string; classes: { classId: string; className: string }[] } | null>(null);

  // Attendance breakdown popover
  const [attModal, setAttModal] = useState<{ studentName: string; stats: { total: number; present: number; late: number; absent: number } } | null>(null);

  // Note modal
  const [noteModal,  setNoteModal ] = useState<{ studentId: string; studentName: string } | null>(null);
  const [noteText,   setNoteText  ] = useState('');
  const [saving,     setSaving    ] = useState(false);
  const [saveError,  setSaveError ] = useState('');

  useEffect(() => { if (user) void loadData(); }, [user]);

  async function loadData() {
    if (!user) return;
    setLoading(true);
    try {
      const [fetchedRows, fetchedNotes, fetchedAtt] = await Promise.all([
        api.teacher.getClassStudents(user.id),
        api.teacher.getStudentNotes(user.id),
        api.classAttendance.getSummaryForTeacher(user.id),
      ]);
      setRows(fetchedRows);
      setNotes(fetchedNotes);
      setAttStats(fetchedAtt);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  // Group flat rows by studentId
  const grouped = useMemo<GroupedStudent[]>(() => {
    const map = new Map<string, GroupedStudent>();
    for (const r of rows) {
      if (!map.has(r.studentId)) {
        map.set(r.studentId, { studentId: r.studentId, studentName: r.studentName, email: r.email, avatar: r.avatar, classes: [] });
      }
      map.get(r.studentId)!.classes.push({ classId: r.classId, className: r.className });
    }
    return Array.from(map.values());
  }, [rows]);

  const filtered = useMemo<GroupedStudent[]>(() => {
    if (!search.trim()) return grouped;
    const q = search.toLowerCase();
    return grouped.filter(s =>
      s.studentName.toLowerCase().includes(q) ||
      s.email.toLowerCase().includes(q) ||
      s.classes.some(c => c.className.toLowerCase().includes(q))
    );
  }, [grouped, search]);

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
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Failed to save note');
    } finally {
      setSaving(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div>
        <h1 className="font-display text-3xl font-medium tracking-tight mb-1">{t('nav.my_students')}</h1>
        <p className="text-white/50 text-sm">Students enrolled in your classes.</p>
      </div>

      {/* Table card */}
      <div className="glass-card rounded-3xl p-6 overflow-hidden flex flex-col">

        {/* Search */}
        <div className="mb-6 shrink-0">
          <div className="relative w-full md:w-96 group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 group-focus-within:text-[#fc0ce4] transition-colors" />
            <input
              type="text"
              placeholder="Search by name, email or class…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-white/5 border border-white/5 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#fc0ce4]/40 focus:bg-[#fc0ce4]/5 focus:shadow-[0_0_15px_rgba(252,12,228,0.1)] transition-all"
            />
          </div>
        </div>

        {/* Content */}
        <div className="overflow-x-auto pb-4 custom-scrollbar flex-1 -mx-6 px-6">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-white/30 gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-white/30 gap-3">
              <GraduationCap className="w-8 h-8 opacity-40" />
              <p className="text-sm">
                {search ? 'No students match your search.' : 'No students enrolled in your classes yet.'}
              </p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="border-b border-white/5 text-[11px] uppercase tracking-widest text-white/30">
                  <th className="pb-3 font-medium">Student</th>
                  <th className="pb-3 font-medium">Class</th>
                  <th className="pb-3 font-medium">Attendance</th>
                  <th className="pb-3 font-medium">Avg. Grade</th>
                  <th className="pb-3 font-medium">Notes</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {filtered.map(student => {
                  const note = notes[student.studentId];
                  const [firstClass, ...extraClasses] = student.classes;
                  return (
                    <tr
                      key={student.studentId}
                      className="border-b border-white/5 hover:bg-white/[0.02] transition-colors group"
                    >
                      {/* Student */}
                      <td className="py-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={student.avatar}
                            alt={student.studentName}
                            className="w-9 h-9 rounded-full border border-white/10 shrink-0"
                            referrerPolicy="no-referrer"
                          />
                          <div>
                            <div className="font-medium text-white/90 group-hover:text-white transition-colors">{student.studentName}</div>
                            <div className="text-[11px] text-white/40 mt-0.5">{student.email}</div>
                          </div>
                        </div>
                      </td>

                      {/* Class */}
                      <td className="py-4">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-medium">
                            <GraduationCap className="w-3 h-3" />
                            {firstClass.className}
                          </span>
                          {extraClasses.length > 0 && (
                            <button
                              onClick={() => setClassesModal({ studentName: student.studentName, classes: student.classes })}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white/5 border border-white/10 hover:bg-blue-500/10 hover:border-blue-500/20 hover:text-blue-400 text-white/40 text-xs font-medium transition-all"
                            >
                              <Plus className="w-3 h-3" />
                              {extraClasses.length}
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Attendance */}
                      <td className="py-4">
                        {(() => {
                          const s = attStats[student.studentId];
                          if (!s || s.total === 0) return <span className="text-white/25 font-medium">–</span>;
                          const attended = s.present + s.late;
                          const pct = Math.round((attended / s.total) * 100);
                          const color = pct >= 75 ? 'text-emerald-400 hover:text-emerald-300' : pct >= 50 ? 'text-amber-400 hover:text-amber-300' : 'text-red-400 hover:text-red-300';
                          return (
                            <button
                              onClick={() => setAttModal({ studentName: student.studentName, stats: s })}
                              className={`font-semibold text-sm transition-colors ${color}`}
                            >
                              {pct}%
                            </button>
                          );
                        })()}
                      </td>

                      {/* Avg. Grade */}
                      <td className="py-4 text-white/25 font-medium text-base">–</td>

                      {/* Notes */}
                      <td className="py-4">
                        {note ? (
                          <button
                            onClick={() => openNote(student.studentId, student.studentName)}
                            className="flex items-center gap-1.5 max-w-[200px] px-2.5 py-1.5 rounded-lg bg-[#fc0ce4]/10 border border-[#fc0ce4]/20 hover:bg-[#fc0ce4]/15 transition-all text-left group/note"
                          >
                            <StickyNote className="w-3 h-3 text-[#fc0ce4]/70 shrink-0" />
                            <span className="text-[11px] text-white/60 truncate flex-1">{note}</span>
                            <Pencil className="w-3 h-3 text-white/25 group-hover/note:text-[#fc0ce4] shrink-0 transition-colors" />
                          </button>
                        ) : (
                          <button
                            onClick={() => openNote(student.studentId, student.studentName)}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-dashed border-white/15 hover:border-[#fc0ce4]/40 hover:bg-[#fc0ce4]/5 transition-all text-white/30 hover:text-[#fc0ce4]"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span className="text-[11px] font-medium">Add note</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Attendance breakdown modal */}
      <AnimatePresence>
        {attModal && (
          <>
            <motion.div
              key="att-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setAttModal(null)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            />
            <motion.div
              key="att-modal"
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              transition={{ type: 'spring', damping: 28, stiffness: 340 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
            >
              <div
                className="w-full max-w-xs bg-[#0f0f0f] border border-white/10 rounded-2xl shadow-2xl pointer-events-auto"
                onClick={e => e.stopPropagation()}
              >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
                  <div className="flex items-center gap-2.5">
                    <BarChart2 className="w-4 h-4 text-[#fc0ce4]" />
                    <div>
                      <h2 className="text-sm font-bold text-white">Attendance Breakdown</h2>
                      <p className="text-[11px] text-white/40 mt-0.5">{attModal.studentName}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setAttModal(null)}
                    className="p-1.5 hover:bg-white/10 rounded-lg text-white/40 hover:text-white transition-all"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                {/* Stats */}
                <div className="px-5 py-4 space-y-2.5">
                  {(() => {
                    const { total, present, late, absent } = attModal.stats;
                    const attended = present + late;
                    const pct = Math.round((attended / total) * 100);
                    const barColor = pct >= 75 ? 'bg-emerald-400' : pct >= 50 ? 'bg-amber-400' : 'bg-red-400';
                    const textColor = pct >= 75 ? 'text-emerald-400' : pct >= 50 ? 'text-amber-400' : 'text-red-400';
                    return (
                      <>
                        {/* Rate bar */}
                        <div className="flex items-center gap-3 pb-1">
                          <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
                          </div>
                          <span className={`text-base font-bold ${textColor}`}>{pct}%</span>
                        </div>
                        {/* Row: total */}
                        <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/8">
                          <div className="flex items-center gap-2 text-white/60 text-sm">
                            <BarChart2 className="w-3.5 h-3.5" />
                            Total classes
                          </div>
                          <span className="text-sm font-bold text-white">{total}</span>
                        </div>
                        {/* Row: present */}
                        <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-emerald-500/8 border border-emerald-500/15">
                          <div className="flex items-center gap-2 text-emerald-400 text-sm">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Present
                          </div>
                          <span className="text-sm font-bold text-emerald-400">{present}</span>
                        </div>
                        {/* Row: late */}
                        <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-amber-500/8 border border-amber-500/15">
                          <div className="flex items-center gap-2 text-amber-400 text-sm">
                            <Clock className="w-3.5 h-3.5" />
                            Late
                          </div>
                          <span className="text-sm font-bold text-amber-400">{late}</span>
                        </div>
                        {/* Row: missed */}
                        <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-red-500/8 border border-red-500/15">
                          <div className="flex items-center gap-2 text-red-400 text-sm">
                            <XCircle className="w-3.5 h-3.5" />
                            Absent
                          </div>
                          <span className="text-sm font-bold text-red-400">{absent}</span>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Classes modal */}
      <AnimatePresence>
        {classesModal && (
          <>
            <motion.div
              key="classes-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setClassesModal(null)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            />
            <motion.div
              key="classes-modal"
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              transition={{ type: 'spring', damping: 28, stiffness: 340 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
            >
              <div
                className="w-full max-w-sm bg-[#0f0f0f] border border-white/10 rounded-2xl shadow-2xl pointer-events-auto"
                onClick={e => e.stopPropagation()}
              >
                <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
                  <div className="flex items-center gap-2.5">
                    <GraduationCap className="w-4 h-4 text-blue-400" />
                    <div>
                      <h2 className="text-sm font-bold text-white">Enrolled Classes</h2>
                      <p className="text-[11px] text-white/40 mt-0.5">{classesModal.studentName}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setClassesModal(null)}
                    className="p-1.5 hover:bg-white/10 rounded-lg text-white/40 hover:text-white transition-all"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <ul className="px-5 py-4 space-y-2">
                  {classesModal.classes.map(c => (
                    <li key={c.classId} className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-blue-500/5 border border-blue-500/15">
                      <GraduationCap className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                      <span className="text-sm text-blue-300">{c.className}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Note modal */}
      <AnimatePresence>
        {noteModal && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !saving && setNoteModal(null)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            />
            <motion.div
              key="modal"
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              transition={{ type: 'spring', damping: 28, stiffness: 340 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
            >
              <div
                className="w-full max-w-md bg-[#0f0f0f] border border-white/10 rounded-2xl shadow-2xl pointer-events-auto"
                onClick={e => e.stopPropagation()}
              >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-5 border-b border-white/8">
                  <div className="flex items-center gap-2.5">
                    <StickyNote className="w-4 h-4 text-[#fc0ce4]" />
                    <div>
                      <h2 className="text-sm font-bold text-white">Student Note</h2>
                      <p className="text-[11px] text-white/40 mt-0.5">{noteModal.studentName}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setNoteModal(null)}
                    disabled={saving}
                    className="p-1.5 hover:bg-white/10 rounded-lg text-white/40 hover:text-white transition-all"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Body */}
                <div className="px-6 py-5">
                  <textarea
                    value={noteText}
                    onChange={e => { setNoteText(e.target.value); setSaveError(''); }}
                    placeholder="Write a private note about this student…"
                    rows={5}
                    autoFocus
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-[#fc0ce4]/50 focus:bg-[#fc0ce4]/5 transition-all resize-none"
                  />
                  <p className="text-[10px] text-white/25 mt-2 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#fc0ce4]/40 inline-block" />
                    Only visible to you
                  </p>
                  {saveError && (
                    <p className="mt-2 text-xs text-red-400 flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      {saveError}
                    </p>
                  )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-white/5 flex items-center justify-end gap-3">
                  <button
                    onClick={() => setNoteModal(null)}
                    disabled={saving}
                    className="px-4 py-2 rounded-xl border border-white/10 text-white/50 hover:text-white hover:border-white/20 text-sm transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => void saveNote()}
                    disabled={saving}
                    className="flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-[#fc0ce4] to-[#949ce4] text-white text-sm font-semibold disabled:opacity-50 hover:shadow-lg hover:shadow-[#fc0ce4]/20 transition-all"
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    Save Note
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

