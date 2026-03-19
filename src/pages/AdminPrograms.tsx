import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BookOpen, Plus, X, Clock, Users, ChevronDown, Trash2, UserPlus } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { PROGRAM_DETAILS } from '../constants/programs';
import { api } from '../services/api';
import { Class, ClassSession, ClassEnrollment } from '../types';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function AdminPrograms() {
  const { t } = useLanguage();
  const [selectedProgram, setSelectedProgram] = useState<string | null>(null);
  const [classes, setClasses] = useState<Class[]>([]);
  const [selectedClass, setSelectedClass] = useState<Class | null>(null);
  const [enrollments, setEnrollments] = useState<ClassEnrollment[]>([]);
  const [showCreateClass, setShowCreateClass] = useState(false);
  const [showTeacherModal, setShowTeacherModal] = useState(false);
  const [showEnrollmentModal, setShowEnrollmentModal] = useState(false);
  const [showClassEditModal, setShowClassEditModal] = useState(false);
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
  
  const [newClass, setNewClass] = useState({
    title: '',
    teacherId: '',
    sessions: [
      { dayOfWeek: 0, startTime: '09:00', endTime: '10:30' },
      { dayOfWeek: 2, startTime: '14:00', endTime: '15:30' }
    ]
  });

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

  const handleCreateClass = async (e: { preventDefault: () => void }) => {
    e.preventDefault();
    if (!selectedProgram || !newClass.title || !newClass.teacherId) {
      setError('Please fill in all required fields');
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
          sessionPayload
        );
      } else {
        await api.classes.create(
          selectedProgram,
          newClass.title,
          newClass.teacherId,
          sessionPayload
        );
      }

      setNewClass({
        title: '',
        teacherId: '',
        sessions: [
          { dayOfWeek: 0, startTime: '09:00', endTime: '10:30' },
          { dayOfWeek: 2, startTime: '14:00', endTime: '15:30' }
        ]
      });
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
      sessions: (cls.sessions && cls.sessions.length > 0)
        ? cls.sessions.map((s) => ({
            dayOfWeek: s.day_of_week,
            startTime: s.start_time,
            endTime: s.end_time,
          }))
        : [{ dayOfWeek: 0, startTime: '09:00', endTime: '10:30' }],
    });
    setShowCreateClass(true);
  };

  const openClassEditModal = async (cls: Class) => {
    setModalClass(cls);
    setEditingClassId(cls.id);
    setNewClass({
      title: cls.title,
      teacherId: cls.teacher_id || '',
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
            <h1 className="font-display text-3xl font-medium tracking-tight mb-1">Degrees</h1>
            <p className="text-white/50 text-sm">Manage degrees, create classes, and assign teachers & students.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {PROGRAM_DETAILS.map((program, idx) => (
            <motion.button
              key={program.id}
              onClick={() => setSelectedProgram(program.name)}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="glass-card rounded-2xl p-6 text-left hover:bg-white/10 transition-colors group"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                  <BookOpen size={20} className="text-white" />
                </div>
                <ChevronDown size={16} className="text-white/30 group-hover:text-white/70 transition-colors" />
              </div>
              <h3 className="font-semibold mb-2 text-white">{program.name}</h3>
              <div className="space-y-1 text-xs text-white/60">
                <p>Duration: {program.duration} months</p>
                <p>Price: {program.price}</p>
              </div>
            </motion.button>
          ))}
        </div>
      </motion.div>
    );
  }

  // Degree Detail View
  const currentProgram = PROGRAM_DETAILS.find(p => p.name === selectedProgram);

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
          <p className="text-white/50 text-sm ml-14">Manage classes for this degree</p>
        </div>
        <button
          onClick={() => {
            setEditingClassId(null);
            setNewClass({
              title: '',
              teacherId: '',
              sessions: [
                { dayOfWeek: 0, startTime: '09:00', endTime: '10:30' },
                { dayOfWeek: 2, startTime: '14:00', endTime: '15:30' }
              ]
            });
            setShowCreateClass(true);
          }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 transition-colors font-medium text-sm"
        >
          <Plus size={18} />
          New Class
        </button>
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
              <p>No classes created yet</p>
            </div>
          ) : (
            <table className="w-full min-w-[920px] text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-widest text-white/35 border-b border-white/10">
                  <th className="py-3 px-3">Class Name</th>
                  <th className="py-3 px-3">Teacher</th>
                  <th className="py-3 px-3">Number of Students</th>
                  <th className="py-3 px-3">Schedule</th>
                  <th className="py-3 px-3">Degree</th>
                  <th className="py-3 px-3">Action</th>
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
                      {cls.teacher ? `${cls.teacher.firstName} ${cls.teacher.lastName}` : 'Not assigned'}
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
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteClass(cls.id)}
                          className="px-2 py-1 text-xs rounded-lg border border-red-500/25 text-red-300 hover:bg-red-500/10 transition-colors"
                        >
                          Remove
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
                {isInlineEditing ? 'Cancel Edit' : 'Edit Class'}
              </button>
              {isInlineEditing && (
                <button
                  onClick={() => { void handleSaveInlineClass(); }}
                  disabled={loading}
                  className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-sm transition-colors"
                >
                  Save
                </button>
              )}
              <button
                onClick={() => handleDeleteClass(selectedClass.id)}
                className="p-2 rounded-lg hover:bg-red-500/10 text-red-400 transition-colors"
              >
                <Trash2 size={20} />
              </button>
            </div>
          </div>

          {/* Teacher Assignment */}
          <div className="glass-card rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-white">Teacher</h3>
              {!isInlineEditing && (
                <button
                  onClick={() => {
                    loadTeachers();
                    setShowTeacherModal(true);
                  }}
                  className="text-sm px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                >
                  {selectedClass.teacher ? 'Change' : 'Assign'}
                </button>
              )}
            </div>
            {isInlineEditing ? (
              <select
                value={inlineClassForm.teacherId}
                onChange={(e) => setInlineClassForm((f) => ({ ...f, teacherId: e.target.value }))}
                className="glass-select w-full px-4 py-3 rounded-xl text-sm text-white"
              >
                <option value="">Select a teacher...</option>
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
              <p className="text-white/50 text-sm">No teacher assigned</p>
            )}
          </div>

          {/* Sessions */}
          <div className="glass-card rounded-2xl p-6">
            <h3 className="font-semibold text-white mb-4">Weekly Sessions</h3>
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
                          <option key={i} value={i}>{day}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => {
                          const updated = inlineClassForm.sessions.filter((_, i) => i !== idx);
                          setInlineClassForm((f) => ({ ...f, sessions: updated }));
                        }}
                        className="px-2 py-1 text-xs rounded-lg border border-red-500/25 text-red-300 hover:bg-red-500/10"
                      >
                        Remove
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
                  Add Session
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
                  Add Student
                </button>
              )}
            </div>

            {enrollments.length === 0 ? (
              <p className="text-white/50 text-sm">No students enrolled yet</p>
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

      {/* Create Class Modal */}
      <AnimatePresence>
        {showCreateClass && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => {
              setShowCreateClass(false);
              setEditingClassId(null);
            }}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-card rounded-3xl p-8 max-w-md w-full space-y-6"
            >
              <div className="flex items-center justify-between">
                <h2 className="font-display text-2xl font-medium">{editingClassId ? 'Edit Class' : 'Create Class'}</h2>
                <button
                  onClick={() => {
                    setShowCreateClass(false);
                    setEditingClassId(null);
                  }}
                  className="p-1 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleCreateClass} className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-white/60 uppercase tracking-widest ml-1 block mb-2">
                    Class Title
                  </label>
                  <input
                    type="text"
                    value={newClass.title}
                    onChange={(e) => setNewClass({ ...newClass, title: e.target.value })}
                    placeholder="e.g., Web Dev - Batch 1"
                    className="glass-input w-full px-4 py-3 rounded-xl text-sm text-white"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-white/60 uppercase tracking-widest ml-1 block mb-2">
                    Assign Teacher
                  </label>
                  <select
                    value={newClass.teacherId}
                    onChange={(e) => setNewClass({ ...newClass, teacherId: e.target.value })}
                    className="glass-select w-full px-4 py-3 rounded-xl text-sm text-white"
                    required
                  >
                    <option value="">Select a teacher...</option>
                    {teachers.map((teacher) => (
                      <option key={teacher.id} value={teacher.id}>
                        {teacher.firstName} {teacher.lastName}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-semibold text-white/60 uppercase tracking-widest ml-1 block">
                    Weekly Sessions
                  </label>
                  {newClass.sessions.map((session, idx) => (
                    <div key={idx} className="space-y-2 p-3 rounded-lg bg-white/5">
                      <select
                        value={session.dayOfWeek}
                        onChange={(e) => {
                          const updated = [...newClass.sessions];
                          updated[idx].dayOfWeek = parseInt(e.target.value);
                          setNewClass({ ...newClass, sessions: updated });
                        }}
                        className="glass-select w-full px-3 py-2 rounded-lg text-xs text-white"
                      >
                        {DAYS.map((day, i) => (
                          <option key={i} value={i}>{day}</option>
                        ))}
                      </select>
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
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-colors font-medium"
                >
                  {loading ? (editingClassId ? 'Saving...' : 'Creating...') : (editingClassId ? 'Save Class' : 'Create Class')}
                </button>
              </form>
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
                <h2 className="font-display text-2xl font-medium">Edit Class</h2>
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
                      Class Title
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
                      Assign Teacher
                    </label>
                    <select
                      value={newClass.teacherId}
                      onChange={(e) => setNewClass({ ...newClass, teacherId: e.target.value })}
                      className="glass-select w-full px-4 py-3 rounded-xl text-sm text-white"
                      required
                    >
                      <option value="">Select a teacher...</option>
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
                    Weekly Sessions
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
                            <option key={i} value={i}>{day}</option>
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
                          Remove
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
                    Add Session
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="glass-card rounded-2xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-white">Enrolled Students</h3>
                      <span className="text-xs text-white/50">{modalEnrollments.length}/40</span>
                    </div>
                    <div className="space-y-2 max-h-52 overflow-y-auto">
                      {modalEnrollments.length === 0 ? (
                        <p className="text-white/50 text-sm">No students enrolled yet</p>
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
                      <h3 className="font-semibold text-white">Available Students</h3>
                    </div>
                    <div className="space-y-2 max-h-52 overflow-y-auto">
                      {modalAvailableStudents.length === 0 ? (
                        <p className="text-white/50 text-sm">No available students</p>
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
                  {loading ? 'Saving...' : 'Save Class'}
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
                <h2 className="font-display text-2xl font-medium">Select Teacher</h2>
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
                <h2 className="font-display text-2xl font-medium">Add Student</h2>
                <button
                  onClick={() => setShowEnrollmentModal(false)}
                  className="p-1 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {availableStudents.length === 0 ? (
                <p className="text-white/50 text-sm text-center py-8">No available students</p>
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
