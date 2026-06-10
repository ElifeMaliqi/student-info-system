'use client';
import React, { useEffect, useState, useMemo } from 'react';
import {
  BookOpen, Plus, Edit2, Trash2, Users, Link2, RefreshCw,
  Clock, X, Search, Loader2, Check,
} from 'lucide-react';
import { api } from '../services/api';
import type { Program, Class, ClassEnrollment } from '../types';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 7 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

interface SessionForm {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

interface ClassForm {
  title: string;
  code: string;
  teacherId: string;
  programId: string;
  meetLink: string;
  sessions: SessionForm[];
}

const emptyForm = (): ClassForm => ({
  title: '',
  code: generateCode(),
  teacherId: '',
  programId: '',
  meetLink: '',
  sessions: [{ dayOfWeek: 0, startTime: '09:00', endTime: '10:00' }],
});

type StudentOption = { id: string; firstName: string; lastName: string; email: string };
type ClassWithProgram = Class & { programName: string };

export const AdminClasses: React.FC = () => {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [classes, setClasses] = useState<ClassWithProgram[]>([]);
  const [teachers, setTeachers] = useState<StudentOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [editingClass, setEditingClass] = useState<ClassWithProgram | null>(null);
  const [createdClass, setCreatedClass] = useState<Class | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<ClassForm>(emptyForm());
  const [modalTab, setModalTab] = useState<'details' | 'students'>('details');

  // Pre-selection for create form
  const [allStudents, setAllStudents] = useState<StudentOption[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [createStudentSearch, setCreateStudentSearch] = useState('');
  const [studentsLoading, setStudentsLoading] = useState(false);

  // Post-create enrollment management (students tab)
  const [enrollments, setEnrollments] = useState<ClassEnrollment[]>([]);
  const [availableStudents, setAvailableStudents] = useState<StudentOption[]>([]);
  const [studentSearch, setStudentSearch] = useState('');
  const [enrollLoading, setEnrollLoading] = useState(false);
  const [enrolling, setEnrolling] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadAll = async () => {
    try {
      setLoading(true);
      setError('');
      const [progs, allClasses, teacherList] = await Promise.all([
        api.programs.getAll(),
        api.classes.getAll(),
        api.classes.getAvailableTeachers(),
      ]);
      setPrograms(progs);
      setClasses(allClasses);
      setTeachers(teacherList);
    } catch (e: any) {
      setError(e.message || 'Failed to load classes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, []);

  const classesByProgram = useMemo(() => {
    const map = new Map<string, ClassWithProgram[]>();
    for (const p of programs) map.set(p.name, []);
    for (const c of classes) {
      const arr = map.get(c.program_id) || [];
      arr.push(c);
      map.set(c.program_id, arr);
    }
    return map;
  }, [programs, classes]);

  const programsWithClasses = useMemo(
    () => programs.filter(p => (classesByProgram.get(p.name) || []).length > 0),
    [programs, classesByProgram]
  );

  const loadEnrollments = async (classId: string) => {
    setEnrollLoading(true);
    try {
      const [enrs, avail] = await Promise.all([
        api.classes.getEnrollments(classId),
        api.classes.getAvailableStudents(classId),
      ]);
      setEnrollments(enrs);
      setAvailableStudents(avail);
    } catch {}
    finally { setEnrollLoading(false); }
  };

  const openCreate = async () => {
    setEditingClass(null);
    setCreatedClass(null);
    setForm(emptyForm());
    setModalTab('details');
    setEnrollments([]);
    setAvailableStudents([]);
    setStudentSearch('');
    setSelectedStudentIds(new Set());
    setCreateStudentSearch('');
    setError('');
    setShowModal(true);
    setStudentsLoading(true);
    try {
      const students = await api.classes.getAllStudents();
      setAllStudents(students);
    } catch {}
    finally { setStudentsLoading(false); }
  };

  const openEdit = (cls: ClassWithProgram) => {
    setEditingClass(cls);
    setCreatedClass(null);
    setForm({
      title: cls.title,
      code: cls.code || '',
      teacherId: cls.teacher_id,
      programId: cls.program_id,
      meetLink: cls.meetLink || '',
      sessions: cls.sessions?.length
        ? cls.sessions.map(s => ({ dayOfWeek: s.day_of_week, startTime: s.start_time, endTime: s.end_time }))
        : [{ dayOfWeek: 0, startTime: '09:00', endTime: '10:00' }],
    });
    setModalTab('details');
    setStudentSearch('');
    setSelectedStudentIds(new Set());
    setError('');
    setShowModal(true);
    loadEnrollments(cls.id);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingClass(null);
    setCreatedClass(null);
    setSelectedStudentIds(new Set());
    setCreateStudentSearch('');
    setError('');
  };

  const toggleStudent = (id: string) => {
    setSelectedStudentIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSave = async () => {
    if (!form.title.trim()) { setError('Class name is required.'); return; }
    if (!form.teacherId) { setError('Please select a teacher.'); return; }
    if (!editingClass && !form.programId) { setError('Please select a degree.'); return; }
    if (form.sessions.some(s => !s.startTime || !s.endTime)) {
      setError('All sessions need start and end times.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      if (editingClass) {
        await api.classes.update(
          editingClass.id,
          form.title.trim(),
          form.teacherId,
          form.sessions,
          form.meetLink || null,
        );
        await loadAll();
        setModalTab('students');
      } else {
        const created = await api.classes.create(
          form.programId,
          form.title.trim(),
          form.teacherId,
          form.sessions,
          form.code,
          form.meetLink || null,
        );
        // Enroll pre-selected students
        if (selectedStudentIds.size > 0) {
          await Promise.allSettled(
            [...selectedStudentIds].map(id => api.classes.enrollStudent(created.id, id))
          );
        }
        setCreatedClass(created);
        await loadAll();
        setModalTab('students');
        loadEnrollments(created.id);
      }
    } catch (e: any) {
      setError(e.message || 'Failed to save class');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await api.classes.delete(deleteId);
      setClasses(prev => prev.filter(c => c.id !== deleteId));
      setDeleteId(null);
    } catch (e: any) {
      setError(e.message || 'Failed to delete class');
      setDeleteId(null);
    } finally {
      setDeleting(false);
    }
  };

  const handleEnroll = async (studentId: string) => {
    const classId = editingClass?.id || createdClass?.id;
    if (!classId) return;
    setEnrolling(studentId);
    setError('');
    try {
      await api.classes.enrollStudent(classId, studentId);
      await loadEnrollments(classId);
    } catch (e: any) {
      setError(e.message || 'Failed to enroll student');
    } finally {
      setEnrolling(null);
    }
  };

  const handleRemove = async (enrollmentId: string) => {
    const classId = editingClass?.id || createdClass?.id;
    setRemoving(enrollmentId);
    try {
      await api.classes.removeStudent(enrollmentId);
      setEnrollments(prev => prev.filter(e => e.id !== enrollmentId));
      if (classId) {
        const avail = await api.classes.getAvailableStudents(classId);
        setAvailableStudents(avail);
      }
    } catch (e: any) {
      setError(e.message || 'Failed to remove student');
    } finally {
      setRemoving(null);
    }
  };

  const addSession = () =>
    setForm(f => ({ ...f, sessions: [...f.sessions, { dayOfWeek: 0, startTime: '09:00', endTime: '10:00' }] }));
  const removeSession = (i: number) =>
    setForm(f => ({ ...f, sessions: f.sessions.filter((_, idx) => idx !== i) }));
  const updateSession = (i: number, key: keyof SessionForm, value: string | number) =>
    setForm(f => ({ ...f, sessions: f.sessions.map((s, idx) => idx === i ? { ...s, [key]: value } : s) }));

  const filteredAvailable = studentSearch
    ? availableStudents.filter(s =>
        `${s.firstName} ${s.lastName} ${s.email}`.toLowerCase().includes(studentSearch.toLowerCase())
      )
    : availableStudents;

  const filteredAllStudents = createStudentSearch
    ? allStudents.filter(s =>
        `${s.firstName} ${s.lastName} ${s.email}`.toLowerCase().includes(createStudentSearch.toLowerCase())
      )
    : allStudents;

  const activeClassId = editingClass?.id || createdClass?.id;
  const isCreating = !editingClass && !createdClass;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-medium">Classes</h1>
          <p className="text-white/40 text-sm mt-1">
            {classes.length} class{classes.length !== 1 ? 'es' : ''} across{' '}
            {programsWithClasses.length} degree{programsWithClasses.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#fc0ce4] to-[#949ce4] text-white text-sm font-semibold hover:opacity-90 transition-all"
        >
          <Plus size={16} /> New Class
        </button>
      </div>

      {error && !showModal && (
        <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm">{error}</div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-24 text-white/30">
          <Loader2 className="w-5 h-5 animate-spin mr-3" /> Loading classes...
        </div>
      ) : classes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-white/30">
          <BookOpen className="w-10 h-10 mb-3 opacity-30" />
          <p className="text-sm">No classes yet. Create your first class.</p>
        </div>
      ) : (
        <div className="space-y-10">
          {programs.map(program => {
            const programClasses = classesByProgram.get(program.name) || [];
            if (programClasses.length === 0) return null;
            return (
              <div key={program.id}>
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-1 h-5 rounded-full bg-gradient-to-b from-[#fc0ce4] to-[#949ce4]" />
                  <h2 className="text-base font-semibold text-white">{program.name}</h2>
                  <span className="text-xs text-white/30">
                    {programClasses.length} class{programClasses.length !== 1 ? 'es' : ''}
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {programClasses.map(cls => (
                    <ClassCard
                      key={cls.id}
                      cls={cls}
                      onEdit={() => openEdit(cls)}
                      onDelete={() => setDeleteId(cls.id)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="glass-card rounded-3xl w-full max-w-xl max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="p-6 border-b border-white/10 flex items-start justify-between shrink-0">
              <div>
                <h2 className="font-display text-2xl font-medium">
                  {editingClass ? 'Edit Class' : createdClass ? 'Class Created' : 'New Class'}
                </h2>
                {(editingClass || createdClass) && (
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => setModalTab('details')}
                      className={`text-xs font-semibold uppercase tracking-widest px-3 py-1.5 rounded-lg transition-colors ${
                        modalTab === 'details'
                          ? 'bg-[#fc0ce4]/10 text-[#fc0ce4] border border-[#fc0ce4]/20'
                          : 'text-white/40 hover:text-white'
                      }`}
                    >
                      Details
                    </button>
                    <button
                      onClick={() => setModalTab('students')}
                      className={`text-xs font-semibold uppercase tracking-widest px-3 py-1.5 rounded-lg transition-colors ${
                        modalTab === 'students'
                          ? 'bg-[#949ce4]/10 text-[#949ce4] border border-[#949ce4]/20'
                          : 'text-white/40 hover:text-white'
                      }`}
                    >
                      Students{enrollments.length > 0 ? ` (${enrollments.length})` : ''}
                    </button>
                  </div>
                )}
              </div>
              <button
                onClick={closeModal}
                className="p-2 rounded-xl text-white/40 hover:text-white hover:bg-white/5 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-4">
              {error && (
                <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm">{error}</div>
              )}

              {/* ── Details Tab (create & edit) ── */}
              {modalTab === 'details' && (
                <>
                  {/* Name + Code */}
                  <div className="grid grid-cols-[1fr_auto] gap-3 items-end">
                    <div>
                      <label className="block text-[11px] font-semibold text-white/40 uppercase tracking-widest mb-1.5">
                        Class Name *
                      </label>
                      <input
                        type="text"
                        value={form.title}
                        onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                        className="glass-input w-full px-4 py-3 rounded-xl text-sm text-white"
                        placeholder="e.g. Introduction to Piano"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-white/40 uppercase tracking-widest mb-1.5">
                        Code
                      </label>
                      <div className="flex items-center gap-2">
                        <div className="glass-input px-3 py-3 rounded-xl text-sm font-mono text-[#949ce4] tracking-widest select-all whitespace-nowrap">
                          {form.code || '—'}
                        </div>
                        {!editingClass && (
                          <button
                            onClick={() => setForm(f => ({ ...f, code: generateCode() }))}
                            className="p-3 rounded-xl border border-white/10 text-white/40 hover:text-white hover:bg-white/5 transition-colors"
                            title="Regenerate code"
                          >
                            <RefreshCw size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Degree */}
                  <div>
                    <label className="block text-[11px] font-semibold text-white/40 uppercase tracking-widest mb-1.5">
                      Degree *
                    </label>
                    {editingClass ? (
                      <div className="glass-input px-4 py-3 rounded-xl text-sm text-white/50">
                        {form.programId || '—'}
                      </div>
                    ) : (
                      <select
                        value={form.programId}
                        onChange={e => setForm(f => ({ ...f, programId: e.target.value }))}
                        className="glass-select w-full px-4 py-3 rounded-xl text-sm text-white"
                      >
                        <option value="">Select a degree</option>
                        {programs.map(p => (
                          <option key={p.id} value={p.name}>{p.name}</option>
                        ))}
                      </select>
                    )}
                  </div>

                  {/* Teacher */}
                  <div>
                    <label className="block text-[11px] font-semibold text-white/40 uppercase tracking-widest mb-1.5">
                      Assigned Teacher *
                    </label>
                    <select
                      value={form.teacherId}
                      onChange={e => setForm(f => ({ ...f, teacherId: e.target.value }))}
                      className="glass-select w-full px-4 py-3 rounded-xl text-sm text-white"
                    >
                      <option value="">Select a teacher</option>
                      {teachers.map(t => (
                        <option key={t.id} value={t.id}>{t.firstName} {t.lastName}</option>
                      ))}
                    </select>
                  </div>

                  {/* Google Meet Link */}
                  <div>
                    <label className="block text-[11px] font-semibold text-white/40 uppercase tracking-widest mb-1.5">
                      Google Meet Link
                    </label>
                    <div className="relative">
                      <Link2 size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
                      <input
                        type="url"
                        value={form.meetLink}
                        onChange={e => setForm(f => ({ ...f, meetLink: e.target.value }))}
                        className="glass-input w-full pl-9 pr-4 py-3 rounded-xl text-sm text-white"
                        placeholder="https://meet.google.com/abc-defg-hij"
                      />
                    </div>
                  </div>

                  {/* Sessions */}
                  <div>
                    <label className="block text-[11px] font-semibold text-white/40 uppercase tracking-widest mb-2">
                      Sessions
                    </label>
                    <div className="space-y-2">
                      {form.sessions.map((session, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-2 p-3 rounded-xl bg-white/[0.03] border border-white/5"
                        >
                          <select
                            value={session.dayOfWeek}
                            onChange={e => updateSession(i, 'dayOfWeek', parseInt(e.target.value))}
                            className="glass-select flex-1 min-w-0 px-3 py-2 rounded-lg text-xs text-white"
                          >
                            {DAYS.map((d, idx) => (
                              <option key={d} value={idx}>{d}</option>
                            ))}
                          </select>
                          <input
                            type="time"
                            value={session.startTime}
                            onChange={e => updateSession(i, 'startTime', e.target.value)}
                            className="glass-input px-2.5 py-2 rounded-lg text-xs text-white w-[88px] shrink-0"
                          />
                          <span className="text-white/25 text-xs shrink-0">→</span>
                          <input
                            type="time"
                            value={session.endTime}
                            onChange={e => updateSession(i, 'endTime', e.target.value)}
                            className="glass-input px-2.5 py-2 rounded-lg text-xs text-white w-[88px] shrink-0"
                          />
                          {form.sessions.length > 1 && (
                            <button
                              onClick={() => removeSession(i)}
                              className="p-1.5 rounded-lg text-white/25 hover:text-red-300 hover:bg-red-500/10 transition-colors shrink-0"
                            >
                              <X size={13} />
                            </button>
                          )}
                        </div>
                      ))}
                      <button
                        onClick={addSession}
                        className="flex items-center gap-1.5 text-xs text-[#949ce4] hover:text-white transition-colors px-1 pt-1"
                      >
                        <Plus size={13} /> Add Session
                      </button>
                    </div>
                  </div>

                  {/* ── Student pre-selection (create only) ── */}
                  {isCreating && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-[11px] font-semibold text-white/40 uppercase tracking-widest">
                          Enroll Students
                        </label>
                        {selectedStudentIds.size > 0 && (
                          <span className="text-xs text-[#949ce4] font-medium">
                            {selectedStudentIds.size} selected
                          </span>
                        )}
                      </div>
                      <div className="relative mb-2">
                        <Search size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
                        <input
                          type="text"
                          value={createStudentSearch}
                          onChange={e => setCreateStudentSearch(e.target.value)}
                          className="glass-input w-full pl-9 pr-4 py-2.5 rounded-xl text-sm text-white"
                          placeholder="Search students..."
                        />
                      </div>
                      {studentsLoading ? (
                        <div className="flex items-center gap-2 text-white/30 text-xs py-3">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading students...
                        </div>
                      ) : filteredAllStudents.length === 0 ? (
                        <p className="text-white/30 text-xs py-2">
                          {allStudents.length === 0 ? 'No active students found.' : 'No students match your search.'}
                        </p>
                      ) : (
                        <div className="space-y-1 max-h-48 overflow-y-auto custom-scrollbar pr-1">
                          {filteredAllStudents.map(s => {
                            const selected = selectedStudentIds.has(s.id);
                            return (
                              <button
                                key={s.id}
                                onClick={() => toggleStudent(s.id)}
                                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all text-left ${
                                  selected
                                    ? 'bg-[#949ce4]/10 border-[#949ce4]/30'
                                    : 'bg-white/[0.02] border-white/5 hover:border-white/10'
                                }`}
                              >
                                <div className="min-w-0">
                                  <p className="text-sm font-medium text-white truncate">
                                    {s.firstName} {s.lastName}
                                  </p>
                                  <p className="text-[11px] text-white/35 truncate">{s.email}</p>
                                </div>
                                <div className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ml-2 transition-colors ${
                                  selected
                                    ? 'bg-[#949ce4] border-[#949ce4]'
                                    : 'border-white/20'
                                }`}>
                                  {selected && <Check size={11} className="text-white" />}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              {/* ── Students Tab (edit & post-create) ── */}
              {modalTab === 'students' && activeClassId && (
                <>
                  <div>
                    <div className="text-[11px] font-semibold text-white/40 uppercase tracking-widest mb-3">
                      Enrolled ({enrollments.length})
                    </div>
                    {enrollLoading ? (
                      <div className="flex items-center gap-2 text-white/30 text-sm py-4">
                        <Loader2 className="w-4 h-4 animate-spin" /> Loading...
                      </div>
                    ) : enrollments.length === 0 ? (
                      <p className="text-white/30 text-sm py-2">No students enrolled yet.</p>
                    ) : (
                      <div className="space-y-1.5 max-h-44 overflow-y-auto custom-scrollbar pr-1">
                        {enrollments.map(e => (
                          <div
                            key={e.id}
                            className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/5"
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-white truncate">
                                {e.student?.firstName} {e.student?.lastName}
                              </p>
                              <p className="text-[11px] text-white/35 truncate">{e.student?.email}</p>
                            </div>
                            <button
                              onClick={() => handleRemove(e.id)}
                              disabled={removing === e.id}
                              className="p-1.5 ml-2 rounded-lg text-white/30 hover:text-red-300 hover:bg-red-500/10 transition-colors disabled:opacity-40 shrink-0"
                            >
                              {removing === e.id
                                ? <Loader2 size={13} className="animate-spin" />
                                : <X size={13} />
                              }
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="text-[11px] font-semibold text-white/40 uppercase tracking-widest mb-2">
                      Add Students
                    </div>
                    <div className="relative mb-3">
                      <Search size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
                      <input
                        type="text"
                        value={studentSearch}
                        onChange={e => setStudentSearch(e.target.value)}
                        className="glass-input w-full pl-9 pr-4 py-2.5 rounded-xl text-sm text-white"
                        placeholder="Search by name or email..."
                      />
                    </div>
                    {availableStudents.length === 0 && !enrollLoading ? (
                      <p className="text-white/30 text-sm">All students are already enrolled.</p>
                    ) : filteredAvailable.length === 0 ? (
                      <p className="text-white/30 text-sm">No students match your search.</p>
                    ) : (
                      <div className="space-y-1.5 max-h-52 overflow-y-auto custom-scrollbar pr-1">
                        {filteredAvailable.map(s => (
                          <div
                            key={s.id}
                            className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/5 hover:border-white/10 transition-colors"
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-white truncate">
                                {s.firstName} {s.lastName}
                              </p>
                              <p className="text-[11px] text-white/35 truncate">{s.email}</p>
                            </div>
                            <button
                              onClick={() => handleEnroll(s.id)}
                              disabled={enrolling === s.id}
                              className="flex items-center gap-1.5 ml-2 px-3 py-1.5 rounded-lg bg-[#949ce4]/10 border border-[#949ce4]/20 text-[#949ce4] text-xs font-medium hover:bg-[#949ce4]/20 transition-colors disabled:opacity-40 shrink-0"
                            >
                              {enrolling === s.id
                                ? <Loader2 size={11} className="animate-spin" />
                                : <Plus size={11} />
                              }
                              Enroll
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-white/10 flex gap-3 justify-end shrink-0">
              {/* Creating — not yet saved */}
              {isCreating && (
                <>
                  <button
                    onClick={closeModal}
                    className="px-4 py-2.5 rounded-xl border border-white/10 text-white/60 hover:text-white hover:bg-white/5 text-sm font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#fc0ce4] to-[#949ce4] text-white text-sm font-semibold hover:opacity-90 transition-all disabled:opacity-50"
                  >
                    {saving
                      ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating...</>
                      : <><Plus size={15} /> Create{selectedStudentIds.size > 0 ? ` & Enroll ${selectedStudentIds.size}` : ''}</>
                    }
                  </button>
                </>
              )}

              {/* After creation — students tab */}
              {!editingClass && createdClass && (
                <button
                  onClick={closeModal}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#fc0ce4] to-[#949ce4] text-white text-sm font-semibold hover:opacity-90 transition-all"
                >
                  Done
                </button>
              )}

              {/* Editing — details tab */}
              {editingClass && modalTab === 'details' && (
                <>
                  <button
                    onClick={closeModal}
                    className="px-4 py-2.5 rounded-xl border border-white/10 text-white/60 hover:text-white hover:bg-white/5 text-sm font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#fc0ce4] to-[#949ce4] text-white text-sm font-semibold hover:opacity-90 transition-all disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </>
              )}

              {/* Editing — students tab */}
              {editingClass && modalTab === 'students' && (
                <button
                  onClick={closeModal}
                  className="px-4 py-2.5 rounded-xl border border-white/10 text-white/60 hover:text-white hover:bg-white/5 text-sm font-medium transition-colors"
                >
                  Done
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="glass-card rounded-3xl max-w-sm w-full p-6 space-y-4">
            <h2 className="font-display text-xl font-medium">Delete Class?</h2>
            <p className="text-sm text-white/50">
              This will permanently remove the class, all its sessions, and all enrollments.
            </p>
            <div className="flex gap-3 justify-end pt-2">
              <button
                onClick={() => setDeleteId(null)}
                className="px-4 py-2.5 rounded-xl border border-white/10 text-white/60 hover:text-white hover:bg-white/5 text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2.5 rounded-xl bg-red-500/20 border border-red-500/30 text-red-300 hover:bg-red-500/30 text-sm font-medium transition-colors disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const ClassCard = ({
  cls,
  onEdit,
  onDelete,
}: {
  cls: ClassWithProgram;
  onEdit: () => void;
  onDelete: () => void;
}) => (
  <div className="glass-card rounded-2xl p-5 space-y-3.5 group hover:border-white/10 transition-all">
    <div className="flex items-start justify-between gap-3">
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-white text-sm leading-snug truncate">{cls.title}</h3>
        {cls.code && (
          <span className="inline-block mt-1.5 px-2 py-0.5 rounded-md bg-[#949ce4]/10 border border-[#949ce4]/20 text-[#949ce4] text-[10px] font-mono tracking-widest">
            {cls.code}
          </span>
        )}
      </div>
      <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <button
          onClick={onEdit}
          className="p-1.5 rounded-lg border border-white/10 text-white/40 hover:text-white hover:bg-white/5 transition-colors"
        >
          <Edit2 size={13} />
        </button>
        <button
          onClick={onDelete}
          className="p-1.5 rounded-lg border border-red-500/20 text-red-300/50 hover:text-red-300 hover:bg-red-500/10 transition-colors"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>

    {cls.teacher && (
      <div className="flex items-center gap-2">
        <div className="w-5 h-5 rounded-full bg-[#fc0ce4]/10 border border-[#fc0ce4]/20 flex items-center justify-center shrink-0">
          <span className="text-[8px] font-bold text-[#fc0ce4]">
            {cls.teacher.firstName?.[0]}{cls.teacher.lastName?.[0]}
          </span>
        </div>
        <span className="text-xs text-white/50 truncate">
          {cls.teacher.firstName} {cls.teacher.lastName}
        </span>
      </div>
    )}

    {cls.sessions && cls.sessions.length > 0 && (
      <div className="flex flex-wrap gap-1.5">
        {cls.sessions.map((s, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/5 border border-white/[0.06] text-white/40 text-[10px]"
          >
            <Clock size={9} />
            {DAYS[s.day_of_week]?.slice(0, 3)} {s.start_time?.slice(0, 5)}–{s.end_time?.slice(0, 5)}
          </span>
        ))}
      </div>
    )}

    <div className="flex items-center justify-between pt-0.5">
      <div className="flex items-center gap-1 text-[11px] text-white/30">
        <Users size={11} />
        <span>{cls.enrollmentCount ?? 0} enrolled</span>
      </div>
      {cls.meetLink && (
        <a
          href={cls.meetLink.startsWith('http') ? cls.meetLink : `https://${cls.meetLink}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
          className="flex items-center gap-1 text-[11px] text-[#949ce4]/50 hover:text-[#949ce4] transition-colors"
        >
          <Link2 size={11} /> Meet
        </a>
      )}
    </div>
  </div>
);
