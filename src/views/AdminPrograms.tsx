'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BookOpen, Plus, X, Clock, Users, ChevronDown, Trash2, UserPlus, GraduationCap, Edit2, Loader2, RefreshCw, Link2, Search, Check } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useModulePermissions } from '../context/UserContext';
import { api } from '../services/api';
import { Class, ClassSession, ClassEnrollment, Program } from '../types';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 7 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export default function AdminPrograms() {
  const { t } = useLanguage();
  const { isOverridden: permOverridden, canCreate, canUpdate, canDelete } = useModulePermissions('programs');
  const [programs, setPrograms] = useState<Program[]>([]);
  const [selectedProgram, setSelectedProgram] = useState<string | null>(null);
  const [classes, setClasses] = useState<Class[]>([]);
  const [selectedClass, setSelectedClass] = useState<Class | null>(null);
  const [enrollments, setEnrollments] = useState<ClassEnrollment[]>([]);
  const [showCreateClass, setShowCreateClass] = useState(false);
  const [showTeacherModal, setShowTeacherModal] = useState(false);
  const [showEnrollmentModal, setShowEnrollmentModal] = useState(false);
  const [showClassEditModal, setShowClassEditModal] = useState(false);
  const [showDegreeModal, setShowDegreeModal] = useState(false);
  const [editingDegree, setEditingDegree] = useState<Program | null>(null);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [availableStudents, setAvailableStudents] = useState<any[]>([]);
  const [modalEnrollments, setModalEnrollments] = useState<ClassEnrollment[]>([]);
  const [modalAvailableStudents, setModalAvailableStudents] = useState<any[]>([]);
  const [modalClass, setModalClass] = useState<Class | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [editingClassId, setEditingClassId] = useState<string | null>(null);
  const [isInlineEditing, setIsInlineEditing] = useState(false);
  const [inlineClassForm, setInlineClassForm] = useState({
    title: '',
    teacherId: '',
    sessions: [] as { dayOfWeek: number; startTime: string; endTime: string }[],
  });
  const [degreeForm, setDegreeForm] = useState({
    name: '',
    description: '',
    duration: 12,
    price: 0,
    capacity: 30,
  });
  
  const [newClass, setNewClass] = useState({
    title: '',
    teacherId: '',
    code: generateCode(),
    meetLink: '',
    sessions: [
      { dayOfWeek: 0, startTime: '09:00', endTime: '10:30' },
      { dayOfWeek: 2, startTime: '14:00', endTime: '15:30' }
    ]
  });

  // Student pre-selection for the create form
  const [createAllStudents, setCreateAllStudents] = useState<{ id: string; firstName: string; lastName: string; email: string }[]>([]);
  const [createSelectedIds, setCreateSelectedIds] = useState<Set<string>>(new Set());
  const [createStudentSearch, setCreateStudentSearch] = useState('');
  const [createStudentsLoading, setCreateStudentsLoading] = useState(false);

  useEffect(() => {
    loadPrograms();
  }, []);

  useEffect(() => {
    if (selectedProgram) {
      loadClasses();
      loadTeachers();
    }
  }, [selectedProgram]);

  useEffect(() => {
    if (selectedClass) {
      loadEnrollments();
      setIsInlineEditing(false);
      setInlineClassForm({
        title: selectedClass.title,
        teacherId: selectedClass.teacher_id || '',
        sessions: (selectedClass.sessions || []).map((s) => ({
          dayOfWeek: s.day_of_week,
          startTime: s.start_time,
          endTime: s.end_time,
        })),
      });
    }
  }, [selectedClass]);

  const loadPrograms = async () => {
    try {
      const data = await api.programs.getAll();
      setPrograms(data);
    } catch (err) {
      console.error('Failed to load programs:', err);
    }
  };

  const loadClasses = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await api.classes.getByProgram(selectedProgram!);
      setClasses(data);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to load classes';
      if (errorMsg.includes("relation \"public.classes\" does not exist")) {
        setError('Database tables not initialized. Please run the migration SQL first. See APPLY_MIGRATION.sql in your project root.');
      } else {
        setError(errorMsg);
      }
    } finally {
      setLoading(false);
    }
  };

  const loadTeachers = async () => {
    try {
      const data = await api.classes.getAvailableTeachers();
      setTeachers(data);
    } catch (err) {
      console.error('Failed to load teachers');
    }
  };

  const loadAvailableStudents = async (classId?: string) => {
    const targetClassId = classId || selectedClass?.id;
    if (!targetClassId) return;
    try {
      const data = await api.classes.getAvailableStudents(targetClassId);
      setAvailableStudents(data);
    } catch (err) {
      console.error('Failed to load available students');
    }
  };

  const loadModalAvailableStudents = async (classId: string) => {
    try {
      const data = await api.classes.getAvailableStudents(classId);
      setModalAvailableStudents(data);
    } catch (err) {
      console.error('Failed to load modal available students');
    }
  };

  const loadEnrollments = async (classId?: string) => {
    const targetClassId = classId || selectedClass?.id;
    if (!targetClassId) return;
    try {
      const data = await api.classes.getEnrollments(targetClassId);
      setEnrollments(data);
    } catch (err) {
      console.error('Failed to load enrollments');
    }
  };

  const loadModalEnrollments = async (classId: string) => {
    try {
      const data = await api.classes.getEnrollments(classId);
      setModalEnrollments(data);
    } catch (err) {
      console.error('Failed to load modal enrollments');
    }
  };

  const handleCreateDegree = async (e: { preventDefault: () => void }) => {
    e.preventDefault();
    if (!degreeForm.name.trim()) {
      setError('Please provide a degree name.');
      return;
    }
    try {
      setLoading(true);
      if (editingDegree) {
        await api.programs.update(editingDegree.id, {
          name: degreeForm.name.trim(),
          description: degreeForm.description.trim(),
          duration: degreeForm.duration,
          price: degreeForm.price,
          capacity: degreeForm.capacity,
        });
      } else {
        await api.programs.create({
          name: degreeForm.name.trim(),
          description: degreeForm.description.trim(),
          duration: degreeForm.duration,
          price: degreeForm.price,
          capacity: degreeForm.capacity,
        });
      }
      setShowDegreeModal(false);
      setEditingDegree(null);
      setDegreeForm({ name: '', description: '', duration: 12, price: 0, capacity: 30 });
      setError('');
      await loadPrograms();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save degree');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDegree = async (programId: string, programName: string) => {
    if (!confirm(`Are you sure you want to delete "${programName}"? This will deactivate the degree.`)) return;
    try {
      setLoading(true);
      await api.programs.delete(programId);
      await loadPrograms();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete degree');
    } finally {
      setLoading(false);
    }
  };

  const openEditDegree = (program: Program) => {
    setEditingDegree(program);
    setDegreeForm({
      name: program.name,
      description: program.description || '',
      duration: program.duration,
      price: program.price,
      capacity: program.capacity,
    });
    setShowDegreeModal(true);
  };

  const handleCreateClass = async (e: { preventDefault: () => void }) => {
    e.preventDefault();
    if (!selectedProgram || !newClass.title.trim() || !newClass.teacherId) {
      setError('Please fill in all required fields (title and teacher).');
      return;
    }

    if (newClass.sessions.length === 0) {
      setError('Please add at least one weekly session.');
      return;
    }

    const invalidSession = newClass.sessions.find(s => !s.startTime || !s.endTime);
    if (invalidSession) {
      setError('Please fill in start and end times for all sessions.');
      return;
    }

    if (enrollments.length >= 40) {
      setError('Class is at maximum capacity (40 students)');
      return;
    }

    try {
      setLoading(true);
      const sessionPayload = newClass.sessions.map(s => ({
        dayOfWeek: s.dayOfWeek,
        startTime: s.startTime,
        endTime: s.endTime
      }));

      if (editingClassId) {
        await api.classes.update(
          editingClassId,
          newClass.title,
          newClass.teacherId,
          sessionPayload,
          newClass.meetLink || null,
        );
      } else {
        const created = await api.classes.create(
          selectedProgram,
          newClass.title,
          newClass.teacherId,
          sessionPayload,
          newClass.code,
          newClass.meetLink || null,
        );
        if (createSelectedIds.size > 0) {
          await Promise.allSettled(
            [...createSelectedIds].map(id => api.classes.enrollStudent(created.id, id))
          );
        }
      }

      setNewClass({
        title: '',
        teacherId: '',
        code: generateCode(),
        meetLink: '',
        sessions: [
          { dayOfWeek: 0, startTime: '09:00', endTime: '10:30' },
          { dayOfWeek: 2, startTime: '14:00', endTime: '15:30' }
        ]
      });
      setCreateSelectedIds(new Set());
      setCreateStudentSearch('');
      if (editingClassId) {
        setShowClassEditModal(false);
      } else {
        setShowCreateClass(false);
      }
      setEditingClassId(null);
      setModalClass(null);
      setModalEnrollments([]);
      setModalAvailableStudents([]);
      setError('');
      await loadClasses();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save class');
    } finally {
      setLoading(false);
    }
  };

  const handleAssignTeacher = async (teacherId: string) => {
    if (!selectedClass) return;
    try {
      setLoading(true);
      await api.classes.assignTeacher(selectedClass.id, teacherId);
      setSelectedClass({
        ...selectedClass,
        teacher_id: teacherId,
        teacher: teachers.find(t => t.id === teacherId)
      });
      setShowTeacherModal(false);
      await loadClasses();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assign teacher');
    } finally {
      setLoading(false);
    }
  };

  const handleEnrollStudent = async (studentId: string, classId?: string) => {
    const targetClassId = classId || selectedClass?.id;
    if (!targetClassId) return;
    
    if (enrollments.length >= 40) {
      setError('Class is at maximum capacity (40 students)');
      return;
    }

    try {
      setLoading(true);
      await api.classes.enrollStudent(targetClassId, studentId);
      await loadEnrollments(targetClassId);
      await loadAvailableStudents(targetClassId);
      if (showClassEditModal && modalClass) {
        await loadModalEnrollments(modalClass.id);
        await loadModalAvailableStudents(modalClass.id);
      }
      setShowEnrollmentModal(false);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to enroll student');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveStudent = async (enrollmentId: string, classId?: string) => {
    const targetClassId = classId || selectedClass?.id;
    if (!targetClassId) return;
    try {
      setLoading(true);
      await api.classes.removeStudent(enrollmentId);
      await loadEnrollments(targetClassId);
      await loadAvailableStudents(targetClassId);
      if (showClassEditModal && modalClass) {
        await loadModalEnrollments(modalClass.id);
        await loadModalAvailableStudents(modalClass.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove student');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClass = async (classId: string) => {
    if (confirm('Are you sure you want to delete this class?')) {
      try {
        setLoading(true);
        await api.classes.delete(classId);
        setSelectedClass(null);
        await loadClasses();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to delete class');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleEditClass = (cls: Class) => {
    setEditingClassId(cls.id);
    setNewClass({
      title: cls.title,
      teacherId: cls.teacher_id || '',
      code: cls.code || '',
      meetLink: cls.meetLink || '',
      sessions: (cls.sessions && cls.sessions.length > 0)
        ? cls.sessions.map((s) => ({
            dayOfWeek: s.day_of_week,
            startTime: s.start_time,
            endTime: s.end_time,
          }))
        : [{ dayOfWeek: 0, startTime: '09:00', endTime: '10:30' }],
    });
    setCreateSelectedIds(new Set());
    setShowCreateClass(true);
  };

  const openClassEditModal = async (cls: Class) => {
    setModalClass(cls);
    setEditingClassId(cls.id);
    setNewClass({
      title: cls.title,
      teacherId: cls.teacher_id || '',
      code: cls.code || '',
      meetLink: cls.meetLink || '',
      sessions: (cls.sessions && cls.sessions.length > 0)
        ? cls.sessions.map((s) => ({
            dayOfWeek: s.day_of_week,
            startTime: s.start_time,
            endTime: s.end_time,
          }))
        : [{ dayOfWeek: 0, startTime: '09:00', endTime: '10:30' }],
    });
    await Promise.all([
      loadModalEnrollments(cls.id),
      loadModalAvailableStudents(cls.id),
      loadTeachers(),
    ]);
    setShowClassEditModal(true);
  };

  const handleSaveInlineClass = async () => {
    if (!selectedClass) return;
    if (!inlineClassForm.title.trim() || !inlineClassForm.teacherId) {
      setError('Please provide class name and teacher.');
      return;
    }
    try {
      setLoading(true);
      await api.classes.update(selectedClass.id, inlineClassForm.title.trim(), inlineClassForm.teacherId, inlineClassForm.sessions);
      await loadClasses();
      const refreshed = await api.classes.getByProgram(selectedProgram!);
      const updatedClass = refreshed.find(c => c.id === selectedClass.id) || null;
      setClasses(refreshed);
      setSelectedClass(updatedClass);
      setIsInlineEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save class changes');
    } finally {
      setLoading(false);
    }
  };

  const formatSchedule = (sessions?: ClassSession[]): string => {
    if (!sessions || sessions.length === 0) return '-';
    return sessions.map((s) => `${DAYS[s.day_of_week]} ${s.start_time}-${s.end_time}`).join(', ');
  };

  // Degree Grid View
  if (!selectedProgram) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-3xl font-medium tracking-tight mb-1">{t('programs.degrees_title')}</h1>
            <p className="text-white/50 text-sm">{t('programs.degrees_desc')}</p>
          </div>
          {(!permOverridden || canCreate) && (
            <button
              onClick={() => {
                setEditingDegree(null);
                setDegreeForm({ name: '', description: '', duration: 12, price: 0, capacity: 30 });
                setShowDegreeModal(true);
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 transition-colors font-medium text-sm"
            >
              <Plus size={18} />
              {t('programs.new_degree')}
            </button>
          )}
        </div>

        {error && (
          <div className="glass-card rounded-xl p-4 border border-red-500/20 bg-red-500/5 text-red-400 text-sm">
            {error}
          </div>
        )}

        {programs.length === 0 ? (
          <div className="glass-card rounded-2xl p-12 text-center text-white/50">
            <GraduationCap size={32} className="mx-auto mb-4 opacity-50" />
            <p>{t('programs.empty_hint')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {programs.map((program, idx) => (
              <motion.div
                key={program.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="glass-card rounded-2xl p-6 text-left group relative"
              >
                <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {(!permOverridden || canUpdate) && (
                    <button
                      onClick={(e) => { e.stopPropagation(); openEditDegree(program); }}
                      className="p-1.5 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors"
                      title="Edit degree"
                    >
                      <Edit2 size={14} />
                    </button>
                  )}
                  {(!permOverridden || canDelete) && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteDegree(program.id, program.name); }}
                      className="p-1.5 rounded-lg hover:bg-red-500/10 text-white/50 hover:text-red-400 transition-colors"
                      title="Delete degree"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>

                <button
                  onClick={() => setSelectedProgram(program.name)}
                  className="w-full text-left"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                      <BookOpen size={20} className="text-white" />
                    </div>
                    <ChevronDown size={16} className="text-white/30 group-hover:text-white/70 transition-colors" />
                  </div>
                  <h3 className="font-semibold mb-2 text-white">{program.name}</h3>
                  <div className="space-y-1 text-xs text-white/60">
                    <p>{t('programs.duration_label').replace('{n}', String(program.duration))}</p>
                    <p>{t('programs.price_label').replace('{n}', program.price.toLocaleString())}</p>
                  </div>
                </button>
              </motion.div>
            ))}
          </div>
        )}

        {/* Create / Edit Degree Modal */}
        <AnimatePresence>
          {showDegreeModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
              onClick={() => { setShowDegreeModal(false); setEditingDegree(null); }}
            >
              <motion.div
                initial={{ scale: 0.95 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.95 }}
                onClick={(e) => e.stopPropagation()}
                className="glass-card rounded-3xl p-8 max-w-md w-full space-y-6"
              >
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-2xl font-medium">{editingDegree ? t('programs.edit_degree') : t('programs.new_degree')}</h2>
                  <button
                    onClick={() => { setShowDegreeModal(false); setEditingDegree(null); }}
                    className="p-1 hover:bg-white/10 rounded-lg transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>

                <form onSubmit={handleCreateDegree} className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-white/60 uppercase tracking-widest ml-1 block mb-2">
                      {t('programs.degree_name_req')}
                    </label>
                    <input
                      type="text"
                      value={degreeForm.name}
                      onChange={(e) => setDegreeForm({ ...degreeForm, name: e.target.value })}
                      placeholder={t('programs.degree_name_ph')}
                      className="glass-input w-full px-4 py-3 rounded-xl text-sm text-white"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-white/60 uppercase tracking-widest ml-1 block mb-2">
                      {t('programs.description')}
                    </label>
                    <textarea
                      value={degreeForm.description}
                      onChange={(e) => setDegreeForm({ ...degreeForm, description: e.target.value })}
                      placeholder={t('programs.description_ph')}
                      rows={3}
                      className="glass-input w-full px-4 py-3 rounded-xl text-sm text-white resize-none"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-white/60 uppercase tracking-widest ml-1 block mb-2">
                        {t('programs.duration_mo')}
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={degreeForm.duration}
                        onChange={(e) => setDegreeForm({ ...degreeForm, duration: parseInt(e.target.value) || 1 })}
                        className="glass-input w-full px-4 py-3 rounded-xl text-sm text-white"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-white/60 uppercase tracking-widest ml-1 block mb-2">
                        {t('programs.price_eur')}
                      </label>
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        value={degreeForm.price}
                        onChange={(e) => setDegreeForm({ ...degreeForm, price: parseFloat(e.target.value) || 0 })}
                        className="glass-input w-full px-4 py-3 rounded-xl text-sm text-white"
                        required
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading || !degreeForm.name.trim()}
                    className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-colors font-medium flex items-center justify-center gap-2"
                  >
                    {loading && <Loader2 size={16} className="animate-spin" />}
                    {loading ? t('programs.saving') : (editingDegree ? t('programs.save_changes') : t('programs.create_degree'))}
                  </button>
                </form>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    );
  }

  // Degree Detail View
  const currentProgram = programs.find(p => p.name === selectedProgram);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <button
              onClick={() => {
                setSelectedProgram(null);
                setSelectedClass(null);
              }}
              className="px-3 py-1 rounded-lg border border-white/10 text-sm hover:bg-white/5 transition-colors"
            >
              ←
            </button>
            <h1 className="font-display text-3xl font-medium tracking-tight">{selectedProgram}</h1>
          </div>
          <p className="text-white/50 text-sm ml-14">{t('programs.manage_classes')}</p>
        </div>
        {(!permOverridden || canCreate) && (
          <button
            onClick={async () => {
              setEditingClassId(null);
              setNewClass({
                title: '',
                teacherId: '',
                code: generateCode(),
                meetLink: '',
                sessions: [
                  { dayOfWeek: 0, startTime: '09:00', endTime: '10:30' },
                  { dayOfWeek: 2, startTime: '14:00', endTime: '15:30' }
                ]
              });
              setCreateSelectedIds(new Set());
              setCreateStudentSearch('');
              setShowCreateClass(true);
              setCreateStudentsLoading(true);
              try {
                const students = await api.classes.getAllStudents();
                setCreateAllStudents(students);
              } catch {}
              finally { setCreateStudentsLoading(false); }
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 transition-colors font-medium text-sm"
          >
            <Plus size={18} />
            {t('programs.new_class')}
          </button>
        )}
      </div>

      {error && (
        <div className="glass-card rounded-xl p-4 border border-red-500/20 bg-red-500/5 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Classes Table */}
      {!selectedClass ? (
        <div className="glass-card rounded-2xl p-4 overflow-x-auto">
          {classes.length === 0 ? (
            <div className="rounded-2xl p-12 text-center text-white/50">
              <BookOpen size={32} className="mx-auto mb-4 opacity-50" />
              <p>{t('programs.no_classes')}</p>
            </div>
          ) : (
            <table className="w-full min-w-[920px] text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-widest text-white/35 border-b border-white/10">
                  <th className="py-3 px-3">{t('programs.col_class_name')}</th>
                  <th className="py-3 px-3">{t('programs.col_teacher')}</th>
                  <th className="py-3 px-3">{t('programs.col_students_num')}</th>
                  <th className="py-3 px-3">{t('programs.col_schedule')}</th>
                  <th className="py-3 px-3">{t('programs.col_degree')}</th>
                  <th className="py-3 px-3">{t('programs.col_action')}</th>
                </tr>
              </thead>
              <tbody>
                {classes.map((cls) => (
                  <motion.tr
                    key={cls.id}
                    whileHover={{ backgroundColor: 'rgba(255,255,255,0.03)' }}
                    className="border-b border-white/5"
                  >
                    <td className="py-3 px-3">
                      <button
                        onClick={() => setSelectedClass(cls)}
                        className="text-left font-medium text-white hover:text-blue-300 transition-colors"
                      >
                        {cls.title}
                      </button>
                    </td>
                    <td className="py-3 px-3 text-white/70">
                      {cls.teacher ? `${cls.teacher.firstName} ${cls.teacher.lastName}` : t('programs.not_assigned')}
                    </td>
                    <td className="py-3 px-3 text-white/70">{cls.enrollmentCount || 0}</td>
                    <td className="py-3 px-3 text-white/70 max-w-[280px] truncate" title={formatSchedule(cls.sessions)}>{formatSchedule(cls.sessions)}</td>
                    <td className="py-3 px-3 text-white/70">{selectedProgram}</td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => { void openClassEditModal(cls); }}
                          className="px-2 py-1 text-xs rounded-lg border border-white/15 hover:bg-white/10 transition-colors"
                        >
                          {t('programs.edit')}
                        </button>
                        <button
                          onClick={() => handleDeleteClass(cls.id)}
                          className="px-2 py-1 text-xs rounded-lg border border-red-500/25 text-red-300 hover:bg-red-500/10 transition-colors"
                        >
                          {t('programs.remove')}
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : (
        // Class Detail View
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="space-y-6"
        >
          <div className="flex items-center justify-between">
            <div>
              <button
                onClick={() => {
                  setSelectedClass(null);
                  setEnrollments([]);
                }}
                className="px-3 py-1 rounded-lg border border-white/10 text-sm hover:bg-white/5 transition-colors mb-2"
              >
                ← Back to Classes
              </button>
              {isInlineEditing ? (
                <input
                  type="text"
                  value={inlineClassForm.title}
                  onChange={(e) => setInlineClassForm((f) => ({ ...f, title: e.target.value }))}
                  className="glass-input px-3 py-2 rounded-xl text-base font-medium w-80 max-w-full"
                />
              ) : (
                <h2 className="font-display text-2xl font-medium tracking-tight">{selectedClass.title}</h2>
              )}
            </div>
            <div className="flex items-center gap-2">
              {(!permOverridden || canUpdate) && (
                <button
                  onClick={() => {
                    if (isInlineEditing) {
                      setIsInlineEditing(false);
                      setInlineClassForm({
                        title: selectedClass.title,
                        teacherId: selectedClass.teacher_id || '',
                        sessions: (selectedClass.sessions || []).map((s) => ({
                          dayOfWeek: s.day_of_week,
                          startTime: s.start_time,
                          endTime: s.end_time,
                        })),
                      });
                    } else {
                      setIsInlineEditing(true);
                      void loadTeachers();
                      void loadAvailableStudents(selectedClass.id);
                    }
                  }}
                  className="px-3 py-2 rounded-lg border border-white/10 text-sm hover:bg-white/5 transition-colors"
                >
                  {isInlineEditing ? t('programs.cancel_edit') : t('programs.edit_class')}
                </button>
              )}
              {(!permOverridden || canUpdate) && isInlineEditing && (
                <button
                  onClick={() => { void handleSaveInlineClass(); }}
                  disabled={loading}
                  className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-sm transition-colors"
                >
                  {t('common.save')}
                </button>
              )}
              {(!permOverridden || canDelete) && (
                <button
                  onClick={() => handleDeleteClass(selectedClass.id)}
                  className="p-2 rounded-lg hover:bg-red-500/10 text-red-400 transition-colors"
                >
                  <Trash2 size={20} />
                </button>
              )}
            </div>
          </div>

          {/* Teacher Assignment */}
          <div className="glass-card rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-white">{t('programs.col_teacher')}</h3>
              {!isInlineEditing && (
                <button
                  onClick={() => {
                    loadTeachers();
                    setShowTeacherModal(true);
                  }}
                  className="text-sm px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                >
                  {selectedClass.teacher ? t('common.change') : t('common.assign')}
                </button>
              )}
            </div>
            {isInlineEditing ? (
              <select
                value={inlineClassForm.teacherId}
                onChange={(e) => setInlineClassForm((f) => ({ ...f, teacherId: e.target.value }))}
                className="glass-select w-full px-4 py-3 rounded-xl text-sm text-white"
              >
                <option value="">{t('programs.select_teacher_ph')}</option>
                {teachers.map((teacher) => (
                  <option key={teacher.id} value={teacher.id}>
                    {teacher.firstName} {teacher.lastName}
                  </option>
                ))}
              </select>
            ) : selectedClass.teacher ? (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white font-semibold">
                  {selectedClass.teacher.firstName[0]}{selectedClass.teacher.lastName[0]}
                </div>
                <div>
                  <p className="font-medium text-white">{selectedClass.teacher.firstName} {selectedClass.teacher.lastName}</p>
                  <p className="text-xs text-white/60">{selectedClass.teacher.email}</p>
                </div>
              </div>
            ) : (
              <p className="text-white/50 text-sm">{t('programs.no_teacher')}</p>
            )}
          </div>

          {/* Sessions */}
          <div className="glass-card rounded-2xl p-6">
            <h3 className="font-semibold text-white mb-4">{t('programs.weekly_sessions')}</h3>
            {isInlineEditing ? (
              <div className="space-y-2">
                {inlineClassForm.sessions.map((session, idx) => (
                  <div key={idx} className="space-y-2 p-3 rounded-lg bg-white/5">
                    <div className="flex gap-2">
                      <select
                        value={session.dayOfWeek}
                        onChange={(e) => {
                          const updated = [...inlineClassForm.sessions];
                          updated[idx].dayOfWeek = parseInt(e.target.value);
                          setInlineClassForm((f) => ({ ...f, sessions: updated }));
                        }}
                        className="glass-select flex-1 px-3 py-2 rounded-lg text-xs text-white"
                      >
                        {DAYS.map((day, i) => (
                          <option key={i} value={i}>{t(`programs.day_${day.toLowerCase()}`)}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => {
                          const updated = inlineClassForm.sessions.filter((_, i) => i !== idx);
                          setInlineClassForm((f) => ({ ...f, sessions: updated }));
                        }}
                        className="px-2 py-1 text-xs rounded-lg border border-red-500/25 text-red-300 hover:bg-red-500/10"
                      >
                        {t('programs.remove')}
                      </button>
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="time"
                        value={session.startTime}
                        onChange={(e) => {
                          const updated = [...inlineClassForm.sessions];
                          updated[idx].startTime = e.target.value;
                          setInlineClassForm((f) => ({ ...f, sessions: updated }));
                        }}
                        className="glass-input flex-1 px-3 py-2 rounded-lg text-xs text-white"
                      />
                      <input
                        type="time"
                        value={session.endTime}
                        onChange={(e) => {
                          const updated = [...inlineClassForm.sessions];
                          updated[idx].endTime = e.target.value;
                          setInlineClassForm((f) => ({ ...f, sessions: updated }));
                        }}
                        className="glass-input flex-1 px-3 py-2 rounded-lg text-xs text-white"
                      />
                    </div>
                  </div>
                ))}
                <button
                  onClick={() => setInlineClassForm((f) => ({ ...f, sessions: [...f.sessions, { dayOfWeek: 0, startTime: '09:00', endTime: '10:30' }] }))}
                  className="text-sm px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                >
                  {t('programs.add_session')}
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {selectedClass.sessions?.map((session) => (
                  <div key={session.id} className="flex items-center gap-3 p-3 rounded-lg bg-white/5">
                    <Clock size={16} className="text-blue-400" />
                    <span className="text-white">{DAYS[session.day_of_week]}</span>
                    <span className="text-white/60">{session.start_time} - {session.end_time}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Enrollment */}
          <div className="glass-card rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Users size={20} className="text-blue-400" />
                <h3 className="font-semibold text-white">
                  Enrolled Students ({enrollments.length}/40)
                </h3>
              </div>
              {enrollments.length < 40 && (
                <button
                  onClick={() => {
                    loadAvailableStudents();
                    setShowEnrollmentModal(true);
                  }}
                  className="text-sm px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 transition-colors flex items-center gap-1"
                >
                  <UserPlus size={16} />
                  {t('programs.add_student')}
                </button>
              )}
            </div>

            {enrollments.length === 0 ? (
              <p className="text-white/50 text-sm">{t('programs.no_students')}</p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {enrollments.map((enrollment) => (
                  <div key={enrollment.id} className="flex items-center justify-between p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
                        {enrollment.student?.firstName[0]}{enrollment.student?.lastName[0]}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-white truncate">{enrollment.student?.firstName} {enrollment.student?.lastName}</p>
                        <p className="text-xs text-white/60 truncate">{enrollment.student?.email}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemoveStudent(enrollment.id)}
                      className="p-1 rounded hover:bg-red-500/20 text-red-400 transition-colors ml-2"
                      title="Remove student"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* Create / Edit Class Modal */}
      <AnimatePresence>
        {showCreateClass && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => { setShowCreateClass(false); setEditingClassId(null); setCreateSelectedIds(new Set()); }}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-card rounded-3xl w-full max-w-xl max-h-[90vh] flex flex-col"
            >
              {/* Header */}
              <div className="p-6 border-b border-white/10 flex items-center justify-between shrink-0">
                <h2 className="font-display text-2xl font-medium">
                  {editingClassId ? t('programs.edit_class') : t('programs.create_class')}
                </h2>
                <button
                  onClick={() => { setShowCreateClass(false); setEditingClassId(null); setCreateSelectedIds(new Set()); }}
                  className="p-2 rounded-xl text-white/40 hover:text-white hover:bg-white/5 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                <form onSubmit={handleCreateClass} className="space-y-4">
                  {error && (
                    <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm">{error}</div>
                  )}

                  {/* Name + Code */}
                  <div className="grid grid-cols-[1fr_auto] gap-3 items-end">
                    <div>
                      <label className="block text-[11px] font-semibold text-white/40 uppercase tracking-widest mb-1.5">
                        {t('programs.class_title')} *
                      </label>
                      <input
                        type="text"
                        value={newClass.title}
                        onChange={(e) => setNewClass({ ...newClass, title: e.target.value })}
                        placeholder={t('programs.class_title_ph')}
                        className="glass-input w-full px-4 py-3 rounded-xl text-sm text-white"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-white/40 uppercase tracking-widest mb-1.5">
                        Code
                      </label>
                      <div className="flex items-center gap-2">
                        <div className="glass-input px-3 py-3 rounded-xl text-sm font-mono text-[#949ce4] tracking-widest select-all whitespace-nowrap">
                          {newClass.code || '—'}
                        </div>
                        {!editingClassId && (
                          <button
                            type="button"
                            onClick={() => setNewClass(c => ({ ...c, code: generateCode() }))}
                            className="p-3 rounded-xl border border-white/10 text-white/40 hover:text-white hover:bg-white/5 transition-colors"
                            title="Regenerate code"
                          >
                            <RefreshCw size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Teacher */}
                  <div>
                    <label className="block text-[11px] font-semibold text-white/40 uppercase tracking-widest mb-1.5">
                      {t('programs.assign_teacher')} *
                    </label>
                    <select
                      value={newClass.teacherId}
                      onChange={(e) => setNewClass({ ...newClass, teacherId: e.target.value })}
                      className="glass-select w-full px-4 py-3 rounded-xl text-sm text-white"
                      required
                    >
                      <option value="">{t('programs.select_teacher_ph')}</option>
                      {teachers.map((teacher) => (
                        <option key={teacher.id} value={teacher.id}>
                          {teacher.firstName} {teacher.lastName}
                        </option>
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
                        value={newClass.meetLink}
                        onChange={(e) => setNewClass({ ...newClass, meetLink: e.target.value })}
                        className="glass-input w-full pl-9 pr-4 py-3 rounded-xl text-sm text-white"
                        placeholder="https://meet.google.com/abc-defg-hij"
                      />
                    </div>
                  </div>

                  {/* Sessions */}
                  <div>
                    <label className="block text-[11px] font-semibold text-white/40 uppercase tracking-widest mb-2">
                      {t('programs.weekly_sessions')}
                    </label>
                    <div className="space-y-2">
                      {newClass.sessions.map((session, idx) => (
                        <div key={idx} className="flex items-center gap-2 p-3 rounded-xl bg-white/[0.03] border border-white/5">
                          <select
                            value={session.dayOfWeek}
                            onChange={(e) => {
                              const updated = [...newClass.sessions];
                              updated[idx] = { ...updated[idx], dayOfWeek: parseInt(e.target.value) };
                              setNewClass({ ...newClass, sessions: updated });
                            }}
                            className="glass-select flex-1 min-w-0 px-3 py-2 rounded-lg text-xs text-white"
                          >
                            {DAYS.map((day, i) => (
                              <option key={i} value={i}>{t(`programs.day_${day.toLowerCase()}`)}</option>
                            ))}
                          </select>
                          <input
                            type="time"
                            value={session.startTime}
                            onChange={(e) => {
                              const updated = [...newClass.sessions];
                              updated[idx] = { ...updated[idx], startTime: e.target.value };
                              setNewClass({ ...newClass, sessions: updated });
                            }}
                            className="glass-input px-2.5 py-2 rounded-lg text-xs text-white w-[88px] shrink-0"
                          />
                          <span className="text-white/25 text-xs shrink-0">→</span>
                          <input
                            type="time"
                            value={session.endTime}
                            onChange={(e) => {
                              const updated = [...newClass.sessions];
                              updated[idx] = { ...updated[idx], endTime: e.target.value };
                              setNewClass({ ...newClass, sessions: updated });
                            }}
                            className="glass-input px-2.5 py-2 rounded-lg text-xs text-white w-[88px] shrink-0"
                          />
                          {newClass.sessions.length > 1 && (
                            <button
                              type="button"
                              onClick={() => setNewClass(c => ({ ...c, sessions: c.sessions.filter((_, i) => i !== idx) }))}
                              className="p-1.5 rounded-lg text-white/25 hover:text-red-300 hover:bg-red-500/10 transition-colors shrink-0"
                            >
                              <X size={13} />
                            </button>
                          )}
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => setNewClass(c => ({ ...c, sessions: [...c.sessions, { dayOfWeek: 0, startTime: '09:00', endTime: '10:00' }] }))}
                        className="flex items-center gap-1.5 text-xs text-[#949ce4] hover:text-white transition-colors px-1 pt-1"
                      >
                        <Plus size={13} /> Add Session
                      </button>
                    </div>
                  </div>

                  {/* Student pre-selection (create only) */}
                  {!editingClassId && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-[11px] font-semibold text-white/40 uppercase tracking-widest">
                          Enroll Students
                        </label>
                        {createSelectedIds.size > 0 && (
                          <span className="text-xs text-[#949ce4] font-medium">{createSelectedIds.size} selected</span>
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
                      {createStudentsLoading ? (
                        <div className="flex items-center gap-2 text-white/30 text-xs py-3">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading students...
                        </div>
                      ) : (
                        <div className="space-y-1 max-h-44 overflow-y-auto custom-scrollbar pr-1">
                          {(createStudentSearch
                            ? createAllStudents.filter(s =>
                                `${s.firstName} ${s.lastName} ${s.email}`.toLowerCase().includes(createStudentSearch.toLowerCase())
                              )
                            : createAllStudents
                          ).map(s => {
                            const selected = createSelectedIds.has(s.id);
                            return (
                              <button
                                key={s.id}
                                type="button"
                                onClick={() => setCreateSelectedIds(prev => {
                                  const next = new Set(prev);
                                  if (next.has(s.id)) next.delete(s.id); else next.add(s.id);
                                  return next;
                                })}
                                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all text-left ${
                                  selected
                                    ? 'bg-[#949ce4]/10 border-[#949ce4]/30'
                                    : 'bg-white/[0.02] border-white/5 hover:border-white/10'
                                }`}
                              >
                                <div className="min-w-0">
                                  <p className="text-sm font-medium text-white truncate">{s.firstName} {s.lastName}</p>
                                  <p className="text-[11px] text-white/35 truncate">{s.email}</p>
                                </div>
                                <div className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ml-2 transition-colors ${
                                  selected ? 'bg-[#949ce4] border-[#949ce4]' : 'border-white/20'
                                }`}>
                                  {selected && <Check size={11} className="text-white" />}
                                </div>
                              </button>
                            );
                          })}
                          {createAllStudents.length === 0 && !createStudentsLoading && (
                            <p className="text-white/30 text-xs py-2">No active students found.</p>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-[#fc0ce4] to-[#949ce4] text-white font-semibold text-sm hover:opacity-90 transition-all disabled:opacity-50"
                  >
                    {loading
                      ? <><Loader2 className="w-4 h-4 animate-spin" /> {editingClassId ? t('programs.saving') : t('programs.creating')}</>
                      : editingClassId
                        ? t('programs.save_class')
                        : (createSelectedIds.size > 0 ? `Create & Enroll ${createSelectedIds.size}` : t('programs.create_class'))
                    }
                  </button>
                </form>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit Class Modal (from action column) */}
      <AnimatePresence>
        {showClassEditModal && modalClass && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => {
              setShowClassEditModal(false);
              setEditingClassId(null);
              setModalClass(null);
            }}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-card rounded-3xl p-8 max-w-4xl w-full max-h-[90vh] overflow-y-auto space-y-6"
            >
              <div className="flex items-center justify-between">
                <h2 className="font-display text-2xl font-medium">{t('programs.edit_class')}</h2>
                <button
                  onClick={() => {
                    setShowClassEditModal(false);
                    setEditingClassId(null);
                    setModalClass(null);
                  }}
                  className="p-1 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleCreateClass} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-white/60 uppercase tracking-widest ml-1 block mb-2">
                      {t('programs.class_title')}
                    </label>
                    <input
                      type="text"
                      value={newClass.title}
                      onChange={(e) => setNewClass({ ...newClass, title: e.target.value })}
                      className="glass-input w-full px-4 py-3 rounded-xl text-sm text-white"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-white/60 uppercase tracking-widest ml-1 block mb-2">
                      {t('programs.assign_teacher')}
                    </label>
                    <select
                      value={newClass.teacherId}
                      onChange={(e) => setNewClass({ ...newClass, teacherId: e.target.value })}
                      className="glass-select w-full px-4 py-3 rounded-xl text-sm text-white"
                      required
                    >
                      <option value="">{t('programs.select_teacher_ph')}</option>
                      {teachers.map((teacher) => (
                        <option key={teacher.id} value={teacher.id}>
                          {teacher.firstName} {teacher.lastName}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-semibold text-white/60 uppercase tracking-widest ml-1 block">
                    {t('programs.weekly_sessions')}
                  </label>
                  {newClass.sessions.map((session, idx) => (
                    <div key={idx} className="space-y-2 p-3 rounded-lg bg-white/5">
                      <div className="flex gap-2">
                        <select
                          value={session.dayOfWeek}
                          onChange={(e) => {
                            const updated = [...newClass.sessions];
                            updated[idx].dayOfWeek = parseInt(e.target.value);
                            setNewClass({ ...newClass, sessions: updated });
                          }}
                          className="glass-select flex-1 px-3 py-2 rounded-lg text-xs text-white"
                        >
                          {DAYS.map((day, i) => (
                            <option key={i} value={i}>{t(`programs.day_${day.toLowerCase()}`)}</option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => {
                            const updated = newClass.sessions.filter((_, i) => i !== idx);
                            setNewClass({ ...newClass, sessions: updated });
                          }}
                          className="px-2 py-1 text-xs rounded-lg border border-red-500/25 text-red-300 hover:bg-red-500/10"
                        >
                          {t('programs.remove')}
                        </button>
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="time"
                          value={session.startTime}
                          onChange={(e) => {
                            const updated = [...newClass.sessions];
                            updated[idx].startTime = e.target.value;
                            setNewClass({ ...newClass, sessions: updated });
                          }}
                          className="glass-input flex-1 px-3 py-2 rounded-lg text-xs text-white"
                        />
                        <input
                          type="time"
                          value={session.endTime}
                          onChange={(e) => {
                            const updated = [...newClass.sessions];
                            updated[idx].endTime = e.target.value;
                            setNewClass({ ...newClass, sessions: updated });
                          }}
                          className="glass-input flex-1 px-3 py-2 rounded-lg text-xs text-white"
                        />
                      </div>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setNewClass({ ...newClass, sessions: [...newClass.sessions, { dayOfWeek: 0, startTime: '09:00', endTime: '10:30' }] })}
                    className="text-sm px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                  >
                    {t('programs.add_session')}
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="glass-card rounded-2xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-white">{t('programs.enrolled_students')}</h3>
                      <span className="text-xs text-white/50">{modalEnrollments.length}/40</span>
                    </div>
                    <div className="space-y-2 max-h-52 overflow-y-auto">
                      {modalEnrollments.length === 0 ? (
                        <p className="text-white/50 text-sm">{t('programs.no_students')}</p>
                      ) : (
                        modalEnrollments.map((enrollment) => (
                          <div key={enrollment.id} className="flex items-center justify-between p-2 rounded-lg bg-white/5">
                            <div className="min-w-0">
                              <p className="text-sm text-white truncate">{enrollment.student?.firstName} {enrollment.student?.lastName}</p>
                              <p className="text-xs text-white/50 truncate">{enrollment.student?.email}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => { void handleRemoveStudent(enrollment.id, modalClass.id); }}
                              className="p-1 rounded hover:bg-red-500/20 text-red-400 transition-colors"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="glass-card rounded-2xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-white">{t('programs.available_students')}</h3>
                    </div>
                    <div className="space-y-2 max-h-52 overflow-y-auto">
                      {modalAvailableStudents.length === 0 ? (
                        <p className="text-white/50 text-sm">{t('programs.no_available')}</p>
                      ) : (
                        modalAvailableStudents.map((student) => (
                          <button
                            key={student.id}
                            type="button"
                            onClick={() => { void handleEnrollStudent(student.id, modalClass.id); }}
                            className="w-full text-left p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                          >
                            <p className="text-sm text-white truncate">{student.firstName} {student.lastName}</p>
                            <p className="text-xs text-white/50 truncate">{student.email}</p>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-colors font-medium"
                >
                  {loading ? t('programs.saving') : t('programs.save_class')}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Teacher Assignment Modal */}
      <AnimatePresence>
        {showTeacherModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowTeacherModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-card rounded-3xl p-8 max-w-md w-full max-h-96 space-y-4"
            >
              <div className="flex items-center justify-between">
                <h2 className="font-display text-2xl font-medium">{t('programs.select_teacher')}</h2>
                <button
                  onClick={() => setShowTeacherModal(false)}
                  className="p-1 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-2 overflow-y-auto max-h-64">
                {teachers.map((teacher) => (
                  <button
                    key={teacher.id}
                    onClick={() => handleAssignTeacher(teacher.id)}
                    disabled={loading}
                    className="w-full text-left p-3 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50"
                  >
                    <p className="font-medium text-white">{teacher.firstName} {teacher.lastName}</p>
                    <p className="text-xs text-white/60">{teacher.email}</p>
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Enrollment Modal */}
      <AnimatePresence>
        {showEnrollmentModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowEnrollmentModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-card rounded-3xl p-8 max-w-md w-full max-h-96 space-y-4"
            >
              <div className="flex items-center justify-between">
                <h2 className="font-display text-2xl font-medium">{t('programs.add_student')}</h2>
                <button
                  onClick={() => setShowEnrollmentModal(false)}
                  className="p-1 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {availableStudents.length === 0 ? (
                <p className="text-white/50 text-sm text-center py-8">{t('programs.no_available')}</p>
              ) : (
                <div className="space-y-2 overflow-y-auto max-h-64">
                  {availableStudents.map((student) => (
                    <button
                      key={student.id}
                      onClick={() => handleEnrollStudent(student.id)}
                      disabled={loading}
                      className="w-full text-left p-3 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50"
                    >
                      <p className="font-medium text-white">{student.firstName} {student.lastName}</p>
                      <p className="text-xs text-white/60">{student.email}</p>
                    </button>
                  ))}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
