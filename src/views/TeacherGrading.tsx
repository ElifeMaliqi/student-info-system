'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, X, Search, Loader2, CheckCircle, XCircle, ClipboardList, Trash2 } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useUser } from '../context/UserContext';
import { api } from '../services/api';
import { PROGRAMS } from '../constants/programs';
import type { GradeTable, GradeTableEntry } from '../types';

export default function TeacherGrading() {
  const { t } = useLanguage();
  const { user } = useUser();

  const [loading, setLoading] = useState(true);
  const [tables, setTables] = useState<GradeTable[]>([]);
  const [selectedTable, setSelectedTable] = useState<GradeTable | null>(null);
  const [enrichedEntries, setEnrichedEntries] = useState<GradeTableEntry[]>([]);
  const [enriching, setEnriching] = useState(false);
  const [search, setSearch] = useState('');

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createDegree, setCreateDegree] = useState('');
  const [createClassId, setCreateClassId] = useState('');
  const [createStudentIds, setCreateStudentIds] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  // Available classes & students for create modal
  const [myClasses, setMyClasses] = useState<{ id: string; title: string; programName: string }[]>([]);
  const [classStudents, setClassStudents] = useState<{ id: string; name: string; avatar: string }[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);

  // Grade modal
  const [gradingEntry, setGradingEntry] = useState<GradeTableEntry | null>(null);
  const [gradePoints, setGradePoints] = useState('');
  const [gradeNote, setGradeNote] = useState('');
  const [grading, setGrading] = useState(false);

  // Load tables
  const loadTables = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await api.gradeTables.getAll(user.id);
      setTables(data);
    } catch { setTables([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadTables(); }, [user]);

  // Load classes for create modal
  useEffect(() => {
    if (!user || !showCreate) return;
    api.teacher.getMyClasses(user.id)
      .then(classes => setMyClasses(classes.map(c => ({ id: c.id, title: c.title, programName: c.programName }))))
      .catch(() => setMyClasses([]));
  }, [user, showCreate]);

  // Reset class & students when degree changes
  useEffect(() => {
    setCreateClassId('');
    setClassStudents([]);
    setCreateStudentIds([]);
  }, [createDegree]);

  // Load students when class selected in create modal
  useEffect(() => {
    if (!createClassId) { setClassStudents([]); setCreateStudentIds([]); return; }
    setLoadingStudents(true);
    supabaseFetchClassStudents(createClassId)
      .then(students => {
        setClassStudents(students);
        setCreateStudentIds(students.map(s => s.id)); // select all by default
      })
      .catch(() => setClassStudents([]))
      .finally(() => setLoadingStudents(false));
  }, [createClassId]);

  // Enrich entries when selecting a table
  useEffect(() => {
    if (!selectedTable) { setEnrichedEntries([]); return; }
    setEnriching(true);
    api.gradeTables.enrichEntries(selectedTable.entries, selectedTable.classId)
      .then(setEnrichedEntries)
      .catch(() => setEnrichedEntries(selectedTable.entries))
      .finally(() => setEnriching(false));
  }, [selectedTable]);

  // Filter classes by selected degree
  const filteredClasses = useMemo(() => {
    if (!createDegree) return [];
    return myClasses.filter(c => c.programName === createDegree);
  }, [myClasses, createDegree]);

  const filteredEntries = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return enrichedEntries;
    return enrichedEntries.filter(e =>
      e.studentName.toLowerCase().includes(q) ||
      e.className.toLowerCase().includes(q)
    );
  }, [enrichedEntries, search]);

  // Create grade table
  const handleCreate = async () => {
    if (!createName.trim() || !createClassId || createStudentIds.length === 0) return;
    setCreating(true);
    try {
      await api.gradeTables.create(createName.trim(), createClassId, createStudentIds, createDegree || undefined);
      setShowCreate(false);
      setCreateName('');
      setCreateDegree('');
      setCreateClassId('');
      setCreateStudentIds([]);
      await loadTables();
    } catch (err: any) {
      alert(err.message || 'Failed to create grade table');
    } finally {
      setCreating(false);
    }
  };

  // Grade a student
  const handleGrade = async (passed: boolean) => {
    if (!gradingEntry) return;
    const pts = parseFloat(gradePoints);
    if (isNaN(pts) || pts < 0) { alert('Enter a valid point total.'); return; }
    setGrading(true);
    try {
      await api.gradeTables.gradeStudent(gradingEntry.id, pts, passed, gradeNote || undefined);
      // Update local state
      const updatedEntries = enrichedEntries.map(e =>
        e.id === gradingEntry.id ? { ...e, totalPoints: pts, passed, note: gradeNote || null, gradedAt: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) } : e
      );
      setEnrichedEntries(updatedEntries);
      if (selectedTable) {
        const updatedTable = { ...selectedTable, entries: updatedEntries };
        setSelectedTable(updatedTable);
        setTables(prev => prev.map(t => t.id === updatedTable.id ? updatedTable : t));
      }
      setGradingEntry(null);
      setGradePoints('');
      setGradeNote('');
    } catch (err: any) {
      alert(err.message || 'Failed to save grade');
    } finally {
      setGrading(false);
    }
  };

  // Delete table
  const handleDelete = async (tableId: string) => {
    if (!confirm('Delete this grade table and all its entries?')) return;
    try {
      await api.gradeTables.delete(tableId);
      if (selectedTable?.id === tableId) setSelectedTable(null);
      setTables(prev => prev.filter(t => t.id !== tableId));
    } catch (err: any) {
      alert(err.message || 'Failed to delete');
    }
  };

  // Toggle student in create modal
  const toggleStudent = (id: string) => {
    setCreateStudentIds(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  // --- Detail view (selected table) ---
  if (selectedTable) {
    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <button onClick={() => setSelectedTable(null)} className="text-sm text-white/50 hover:text-white mb-2 flex items-center gap-1 transition-colors">
              ← Back to Grade Tables
            </button>
            <h1 className="font-display text-3xl font-medium tracking-tight mb-1">{selectedTable.name}</h1>
            <p className="text-white/50 text-sm">{selectedTable.className}{selectedTable.degree ? ` · ${selectedTable.degree}` : ''} · Created {selectedTable.createdAt}</p>
          </div>
        </div>

        <div className="glass-card rounded-3xl p-6 overflow-hidden flex flex-col">
          <div className="flex flex-col md:flex-row gap-4 justify-between mb-6 shrink-0">
            <div className="relative w-full md:w-96 group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 group-focus-within:text-[#fc0ce4] transition-colors" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search students..."
                className="w-full bg-white/5 border border-white/5 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#fc0ce4]/40 focus:bg-[#fc0ce4]/5 focus:shadow-[0_0_15px_rgba(252,12,228,0.1)] transition-all"
              />
            </div>
          </div>

          <div className="overflow-x-auto pb-4 custom-scrollbar flex-1 -mx-6 px-6">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="border-b border-white/5 text-[11px] uppercase tracking-widest text-white/30">
                  <th className="pb-3 font-medium">Student Name</th>
                  <th className="pb-3 font-medium">Class</th>
                  <th className="pb-3 font-medium">Attendance</th>
                  <th className="pb-3 font-medium">Previous Failed Exams</th>
                  <th className="pb-3 font-medium">Result</th>
                  <th className="pb-3 font-medium">Note</th>
                  <th className="pb-3 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {enriching ? (
                  <tr><td colSpan={7} className="py-10 text-center text-white/40"><Loader2 className="w-5 h-5 animate-spin inline mr-2" />Loading...</td></tr>
                ) : filteredEntries.length === 0 ? (
                  <tr><td colSpan={7} className="py-10 text-center text-white/40">No students in this table.</td></tr>
                ) : filteredEntries.map(entry => (
                  <tr key={entry.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors group">
                    <td className="py-4">
                      <div className="flex items-center gap-3">
                        <img src={entry.avatar} alt="" className="w-8 h-8 rounded-full border border-white/10" referrerPolicy="no-referrer" />
                        <span className="font-medium text-white/90 group-hover:text-white transition-colors">{entry.studentName}</span>
                      </div>
                    </td>
                    <td className="py-4 text-white/60">{entry.className}</td>
                    <td className="py-4">
                      {entry.attendanceRate != null ? (
                        <span className={`font-medium ${entry.attendanceRate >= 75 ? 'text-emerald-400' : entry.attendanceRate >= 50 ? 'text-amber-400' : 'text-red-400'}`}>
                          {entry.attendanceRate}%
                        </span>
                      ) : (
                        <span className="text-white/30">N/A</span>
                      )}
                    </td>
                    <td className="py-4">
                      {entry.previousFailedExams > 0 ? (
                        <span className="text-red-400 font-medium">{entry.previousFailedExams}</span>
                      ) : (
                        <span className="text-white/30">0</span>
                      )}
                    </td>
                    <td className="py-4">
                      {entry.passed === true && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <CheckCircle className="w-3 h-3" /> Passed · {entry.totalPoints} pts
                        </span>
                      )}
                      {entry.passed === false && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium uppercase tracking-wider bg-red-500/10 text-red-400 border border-red-500/20">
                          <XCircle className="w-3 h-3" /> Failed · {entry.totalPoints} pts
                        </span>
                      )}
                      {entry.passed == null && (
                        <span className="text-white/30 text-xs">Not graded</span>
                      )}
                    </td>
                    <td className="py-4 text-white/50 text-xs max-w-[160px] truncate" title={entry.note || ''}>
                      {entry.note || <span className="text-white/20">—</span>}
                    </td>
                    <td className="py-4 text-right">
                      <button
                        onClick={() => { setGradingEntry(entry); setGradePoints(entry.totalPoints != null ? String(entry.totalPoints) : ''); setGradeNote(entry.note || ''); }}
                        className="bg-gradient-to-r from-[#fc0ce4] to-[#949ce4] text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:opacity-90 transition-all shadow-[0_0_10px_rgba(252,12,228,0.2)]"
                      >
                        Grade
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Grade modal */}
        <AnimatePresence>
          {gradingEntry && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setGradingEntry(null)} />
              <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-md bg-[#0a0a0a] border border-white/10 rounded-3xl shadow-2xl overflow-hidden">
                <div className="p-6 border-b border-white/5 flex items-center justify-between">
                  <div>
                    <h2 className="font-display text-xl font-medium">Grade Student</h2>
                    <p className="text-sm text-white/50">{gradingEntry.studentName}</p>
                  </div>
                  <button onClick={() => setGradingEntry(null)} className="p-2 hover:bg-white/5 rounded-full transition-colors">
                    <X className="w-5 h-5 text-white/60" />
                  </button>
                </div>
                <div className="p-6 space-y-6">
                  <div className="space-y-2">
                    <label className="text-[11px] font-semibold text-white/60 uppercase tracking-widest ml-1">Total Points</label>
                    <input
                      type="number"
                      value={gradePoints}
                      onChange={(e) => setGradePoints(e.target.value)}
                      className="glass-input w-full px-4 py-3 rounded-xl text-sm text-white placeholder:text-white/20"
                      placeholder="Enter total points"
                      min="0"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[11px] font-semibold text-white/60 uppercase tracking-widest ml-1">Note (optional)</label>
                    <textarea
                      value={gradeNote}
                      onChange={(e) => setGradeNote(e.target.value)}
                      rows={3}
                      className="glass-input w-full px-4 py-3 rounded-xl text-sm text-white placeholder:text-white/20 resize-none"
                      placeholder="Add a note about this student's performance..."
                    />
                  </div>
                  <div className="flex gap-4">
                    <button
                      disabled={grading}
                      onClick={() => handleGrade(true)}
                      className="flex-1 bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 px-4 py-3 rounded-xl text-sm font-semibold hover:bg-emerald-500/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      <CheckCircle className="w-4 h-4" />
                      Pass
                    </button>
                    <button
                      disabled={grading}
                      onClick={() => handleGrade(false)}
                      className="flex-1 bg-red-500/20 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl text-sm font-semibold hover:bg-red-500/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      <XCircle className="w-4 h-4" />
                      Fail
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </motion.div>
    );
  }

  // --- List view ---
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-medium tracking-tight mb-1">Final Project Grades</h1>
          <p className="text-white/50 text-sm">Create and manage grade tables for final projects.</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="bg-gradient-to-r from-[#fc0ce4] to-[#949ce4] text-white px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 hover:opacity-90 transition-all shadow-[0_0_20px_rgba(252,12,228,0.2)] self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          Create Grade Table
        </button>
      </div>

      {loading ? (
        <div className="glass-card rounded-3xl p-12 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-white/40" />
        </div>
      ) : tables.length === 0 ? (
        <div className="glass-card rounded-3xl p-12 text-center">
          <ClipboardList className="w-12 h-12 text-white/20 mx-auto mb-4" />
          <p className="text-white/40 text-sm">No grade tables yet. Create one to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {tables.map(table => {
            const graded = table.entries.filter(e => e.passed != null).length;
            const total = table.entries.length;
            const passed = table.entries.filter(e => e.passed === true).length;
            const failed = table.entries.filter(e => e.passed === false).length;

            return (
              <motion.div
                key={table.id}
                whileHover={{ y: -2 }}
                className="glass-card rounded-3xl p-6 cursor-pointer group relative"
                onClick={() => setSelectedTable(table)}
              >
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(table.id); }}
                  className="absolute top-4 right-4 p-2 rounded-lg text-white/20 hover:text-red-400 hover:bg-red-400/10 transition-all opacity-0 group-hover:opacity-100"
                >
                  <Trash2 className="w-4 h-4" />
                </button>

                <h3 className="font-display text-lg font-medium mb-1 group-hover:text-[#fc0ce4] transition-colors">{table.name}</h3>
                <p className="text-white/40 text-xs mb-4">{table.className}{table.degree ? ` · ${table.degree}` : ''} · {table.createdAt}</p>

                <div className="flex items-center gap-4 text-xs">
                  <span className="text-white/50"><span className="text-white font-medium">{total}</span> students</span>
                  <span className="text-white/50"><span className="text-white font-medium">{graded}</span>/{total} graded</span>
                </div>

                {graded > 0 && (
                  <div className="flex items-center gap-3 mt-3 pt-3 border-t border-white/5 text-xs">
                    <span className="text-emerald-400 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> {passed} passed</span>
                    <span className="text-red-400 flex items-center gap-1"><XCircle className="w-3 h-3" /> {failed} failed</span>
                  </div>
                )}

                {/* Progress bar */}
                <div className="w-full h-1 bg-white/5 rounded-full mt-4 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#fc0ce4] to-[#949ce4] transition-all"
                    style={{ width: total > 0 ? `${(graded / total) * 100}%` : '0%' }}
                  />
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Create Grade Table Modal */}
      <AnimatePresence>
        {showCreate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowCreate(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-lg bg-[#0a0a0a] border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
              <div className="p-6 border-b border-white/5 flex items-center justify-between shrink-0">
                <div>
                  <h2 className="font-display text-xl font-medium">Create Grade Table</h2>
                  <p className="text-sm text-white/50">Set up a new final project grading table.</p>
                </div>
                <button onClick={() => setShowCreate(false)} className="p-2 hover:bg-white/5 rounded-full transition-colors">
                  <X className="w-5 h-5 text-white/60" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto custom-scrollbar space-y-5">
                {/* Name */}
                <div className="space-y-2">
                  <label className="text-[11px] font-semibold text-white/60 uppercase tracking-widest ml-1">Table Name</label>
                  <input
                    type="text"
                    value={createName}
                    onChange={(e) => setCreateName(e.target.value)}
                    className="glass-input w-full px-4 py-3 rounded-xl text-sm text-white placeholder:text-white/20"
                    placeholder="e.g. Final Project - March 2026"
                  />
                </div>

                {/* Degree */}
                <div className="space-y-2">
                  <label className="text-[11px] font-semibold text-white/60 uppercase tracking-widest ml-1">Degree</label>
                  <select
                    value={createDegree}
                    onChange={(e) => setCreateDegree(e.target.value)}
                    className="glass-select w-full px-4 py-3 rounded-xl text-sm"
                  >
                    <option value="">-- Select a degree --</option>
                    {PROGRAMS.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>

                {/* Class */}
                <div className="space-y-2">
                  <label className="text-[11px] font-semibold text-white/60 uppercase tracking-widest ml-1">Select Class</label>
                  <select
                    value={createClassId}
                    onChange={(e) => setCreateClassId(e.target.value)}
                    disabled={!createDegree}
                    className="glass-select w-full px-4 py-3 rounded-xl text-sm"
                  >
                    <option value="">{!createDegree ? '-- Select a degree first --' : '-- Choose a class --'}</option>
                    {filteredClasses.map(c => (
                      <option key={c.id} value={c.id}>{c.title}</option>
                    ))}
                  </select>
                </div>

                {/* Students */}
                <div className="space-y-2">
                  <label className="text-[11px] font-semibold text-white/60 uppercase tracking-widest ml-1">Students</label>
                  {!createDegree ? (
                    <p className="text-white/30 text-sm py-4 text-center">Select a degree first.</p>
                  ) : !createClassId ? (
                    <p className="text-white/30 text-sm py-4 text-center">Select a class to see its students.</p>
                  ) : loadingStudents ? (
                    <div className="flex items-center justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-white/40" /></div>
                  ) : classStudents.length === 0 ? (
                    <p className="text-white/30 text-sm py-4 text-center">No students enrolled in this class.</p>
                  ) : (
                    <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
                      <button
                        type="button"
                        onClick={() => setCreateStudentIds(
                          createStudentIds.length === classStudents.length ? [] : classStudents.map(s => s.id)
                        )}
                        className="text-xs text-[#fc0ce4] hover:underline mb-1"
                      >
                        {createStudentIds.length === classStudents.length ? 'Deselect all' : 'Select all'}
                      </button>
                      {classStudents.map(s => (
                        <label key={s.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/5 cursor-pointer hover:bg-white/[0.07] transition-colors">
                          <input
                            type="checkbox"
                            checked={createStudentIds.includes(s.id)}
                            onChange={() => toggleStudent(s.id)}
                            className="accent-[#fc0ce4] w-4 h-4"
                          />
                          <img src={s.avatar} alt="" className="w-7 h-7 rounded-full border border-white/10" referrerPolicy="no-referrer" />
                          <span className="text-sm text-white/90">{s.name}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="p-6 border-t border-white/5 bg-white/[0.02] shrink-0 flex justify-end gap-4">
                <button onClick={() => setShowCreate(false)} className="px-6 py-2.5 rounded-xl border border-white/10 text-sm font-medium hover:bg-white/5 transition-colors">
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  disabled={creating || !createName.trim() || !createClassId || createStudentIds.length === 0}
                  className="bg-gradient-to-r from-[#fc0ce4] to-[#949ce4] text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition-all shadow-[0_0_20px_rgba(252,12,228,0.2)] disabled:opacity-50"
                >
                  {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Table'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/** Helper to fetch students enrolled in a specific class */
async function supabaseFetchClassStudents(classId: string): Promise<{ id: string; name: string; avatar: string }[]> {
  const { supabase } = await import('../lib/supabase');
  const { data, error } = await supabase
    .from('class_enrollments')
    .select(`
      student_id,
      student:profiles!class_enrollments_student_id_fkey(id, first_name, last_name, avatar_url)
    `)
    .eq('class_id', classId);

  if (error) throw new Error(error.message);

  return (data || []).map((e: any) => ({
    id: e.student?.id || e.student_id,
    name: e.student ? `${e.student.first_name} ${e.student.last_name}` : 'Unknown',
    avatar: e.student?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${e.student_id}`,
  }));
}
