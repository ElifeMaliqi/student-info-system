'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Loader2, AlertCircle, GraduationCap, Phone, X, Pencil, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '../context/LanguageContext';
import { useModulePermissions, useUser } from '../context/UserContext';
import { api } from '../services/api';
import { TeacherOverview } from '../types';

// Same bands as the Students page, so attendance colours mean the same everywhere.
const tone = (rate: number) => (rate >= 75 ? 0 : rate >= 50 ? 1 : 2);
const BADGE = [
  'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20',
  'bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20',
  'bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20',
];
const TEXT = ['text-emerald-400', 'text-amber-400', 'text-red-400'];
const BAR = ['bg-emerald-400', 'bg-amber-400', 'bg-red-400'];

type ClassOption = { id: string; title: string; teacherId: string; teacherName: string };

export default function Teachers() {
  const { t } = useLanguage();
  const router = useRouter();
  const { user } = useUser();
  const { isOverridden: permOverridden, canUpdate: canEdit, canDelete: canRemove } = useModulePermissions('users');
  const isPrivileged = user?.role === 'admin' || user?.role === 'superadmin';

  const [teachers, setTeachers] = useState<TeacherOverview[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [breakdown, setBreakdown] = useState<TeacherOverview | null>(null);

  const [editing, setEditing] = useState<TeacherOverview | null>(null);
  const [editForm, setEditForm] = useState({ firstName: '', lastName: '', email: '', phone: '' });
  const [classOptions, setClassOptions] = useState<ClassOption[]>([]);
  const [addedClasses, setAddedClasses] = useState<ClassOption[]>([]);
  const [classSelect, setClassSelect] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const loadTeachers = () =>
    api.users.getTeacherOverview()
      .then(setTeachers)
      .catch((e) => { console.error('Teachers load error:', e); setFailed(true); })
      .finally(() => setLoading(false));

  useEffect(() => { void loadTeachers(); }, []);

  // en-US in both languages, like the rest of the app. Albanian number data isn't
  // shipped by every browser, so 'sq-AL' would print differently per browser.
  const fmtHours = (h: number) =>
    `${h.toLocaleString('en-US', { maximumFractionDigits: 1 })} ${t('teachers.hours_unit')}`;

  const handleEditOpen = (teacher: TeacherOverview) => {
    setEditing(teacher);
    setEditForm({ firstName: teacher.firstName, lastName: teacher.lastName, email: teacher.email, phone: teacher.phone || '' });
    setAddedClasses([]);
    setClassSelect('');
    api.users.getClassesWithTeacher().then(setClassOptions).catch(() => setClassOptions([]));
  };

  const handleEditSave = async () => {
    if (!editing) return;
    if (!editForm.firstName.trim() || !editForm.lastName.trim()) {
      alert(t('teachers.name_required'));
      return;
    }
    if (!editForm.email.trim()) {
      alert(t('teachers.email_required'));
      return;
    }

    setSavingEdit(true);
    try {
      await api.users.updateTeacher(editing.id, {
        firstName: editForm.firstName.trim(),
        lastName: editForm.lastName.trim(),
        email: editForm.email,
        phone: editForm.phone.trim() || undefined,
      });
      await api.users.assignClassesToTeacher(editing.id, addedClasses.map(c => c.id));
      setEditing(null);
      await loadTeachers();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update teacher.');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleRemove = async (teacher: TeacherOverview) => {
    if (teacher.classCount > 0) {
      alert(t('teachers.remove_has_classes').replace('{name}', teacher.name).replace('{count}', String(teacher.classCount)));
      return;
    }
    if (!confirm(t('teachers.remove_confirm').replace('{name}', teacher.name))) return;

    try {
      await api.users.deleteTeacher(teacher.id);
      await loadTeachers();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to remove teacher.');
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-medium tracking-tight mb-1">{t('teachers.title')}</h1>
        <p className="text-white/50 text-sm">{t('teachers.desc')}</p>
      </div>

      <div className="glass-card rounded-3xl p-6 overflow-hidden flex flex-col">
        <div className="overflow-x-auto pb-4 custom-scrollbar flex-1 -mx-6 px-6">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-white/30" />
            </div>
          ) : failed ? (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{t('teachers.load_error')}</span>
            </div>
          ) : teachers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-white/30 gap-3">
              <GraduationCap className="w-8 h-8 opacity-40" />
              <p className="text-sm">{t('teachers.empty')}</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse min-w-[960px]">
              <thead>
                <tr className="border-b border-white/5 text-[11px] uppercase tracking-widest text-white/30">
                  <th className="pb-3 pl-4 font-medium">{t('teachers.col_teacher')}</th>
                  <th className="pb-3 font-medium">{t('teachers.col_classes')}</th>
                  <th className="pb-3 font-medium">{t('teachers.col_students')}</th>
                  <th className="pb-3 font-medium">{t('teachers.col_hours')}</th>
                  <th className="pb-3 font-medium">{t('teachers.col_attendance')}</th>
                  <th className="pb-3 font-medium">{t('teachers.col_contact')}</th>
                  <th className="pb-3 font-medium">{t('teachers.col_action')}</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {teachers.map(teacher => (
                  <tr
                    key={teacher.id}
                    className="border-b border-white/5 hover:bg-white/[0.02] transition-colors group cursor-pointer"
                    onClick={() => router.push(`/teachers/${teacher.id}`)}
                  >
                    <td className="py-4 pl-4">
                      <div className="flex items-center gap-3">
                        <img src={teacher.avatar} alt={teacher.name} className="w-9 h-9 rounded-full border border-white/10 shrink-0" referrerPolicy="no-referrer" />
                        <div>
                          <div className="font-medium text-white/90 group-hover:text-white transition-colors">{teacher.name}</div>
                          <div className="text-[11px] text-white/40 font-mono mt-0.5">{teacher.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 text-white/60">{teacher.classCount}</td>
                    <td className="py-4 text-white/60">{teacher.studentCount}</td>
                    <td className="py-4 text-white/60">{fmtHours(teacher.weeklyHours)}</td>
                    <td className="py-4">
                      {teacher.attendanceRate !== null ? (
                        <button
                          onClick={(e) => { e.stopPropagation(); setBreakdown(teacher); }}
                          className={`inline-flex px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${BADGE[tone(teacher.attendanceRate)]}`}
                        >
                          {Math.round(teacher.attendanceRate)}%
                        </button>
                      ) : <span className="text-white/30">–</span>}
                    </td>
                    <td className="py-4" onClick={(e) => e.stopPropagation()}>
                      {teacher.phone ? (
                        <a href={`tel:${teacher.phone}`} className="inline-flex items-center gap-1.5 text-xs text-white/60 hover:text-white transition-colors">
                          <Phone className="w-3.5 h-3.5 shrink-0" />
                          {teacher.phone}
                        </a>
                      ) : <span className="text-white/30">–</span>}
                    </td>
                    <td className="py-4 pr-2" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-2">
                        {isPrivileged && (!permOverridden || canEdit) && (
                          <button
                            onClick={() => handleEditOpen(teacher)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs border border-white/10 hover:bg-white/5 transition-colors"
                            title="Edit teacher"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            {t('teachers.edit')}
                          </button>
                        )}
                        {isPrivileged && (!permOverridden || canRemove) && (
                          <button
                            onClick={() => void handleRemove(teacher)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs border border-red-500/25 text-red-300 hover:bg-red-500/10 transition-colors"
                            title="Remove teacher"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            {t('teachers.remove')}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <AnimatePresence>
        {editing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setEditing(null)}
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
                <h3 className="font-display text-xl font-medium text-white">{t('teachers.edit_title')}</h3>
                <button
                  onClick={() => setEditing(null)}
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
                    placeholder={t('teachers.first_name')}
                    className="glass-input w-full px-3 py-2.5 rounded-xl text-sm"
                  />
                  <input
                    type="text"
                    value={editForm.lastName}
                    onChange={(e) => setEditForm((f) => ({ ...f, lastName: e.target.value }))}
                    placeholder={t('teachers.last_name')}
                    className="glass-input w-full px-3 py-2.5 rounded-xl text-sm"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input
                    type="email"
                    value={editForm.email}
                    onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                    placeholder={t('teachers.email')}
                    className="glass-input w-full px-3 py-2.5 rounded-xl text-sm"
                  />
                  <input
                    type="tel"
                    value={editForm.phone}
                    onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
                    placeholder={t('teachers.phone')}
                    className="glass-input w-full px-3 py-2.5 rounded-xl text-sm"
                  />
                </div>

                {/* Classes this teacher teaches */}
                <div className="space-y-3 pt-2 border-t border-white/5">
                  <div>
                    <label className="block text-[11px] font-semibold text-white/40 uppercase tracking-widest mb-1.5">{t('teachers.classes')}</label>
                    {(editing.classes.length > 0 || addedClasses.length > 0) && (
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {editing.classes.map(c => (
                          <span key={c.id} className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-white/[0.06] border border-white/10 text-white/70">
                            {c.title}
                          </span>
                        ))}
                        {addedClasses.map(c => (
                          <span key={c.id} className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-white/[0.06] border border-white/10 text-white/70">
                            {c.title}
                            <button
                              type="button"
                              onClick={() => setAddedClasses(prev => prev.filter(x => x.id !== c.id))}
                              className="text-white/40 hover:text-red-300 transition-colors"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <select
                        value={classSelect}
                        onChange={(e) => setClassSelect(e.target.value)}
                        className="glass-select flex-1 px-3 py-2.5 rounded-xl text-sm"
                      >
                        <option value="">{t('teachers.select_class')}</option>
                        {classOptions
                          .filter(c => c.teacherId !== editing.id && !addedClasses.some(a => a.id === c.id))
                          .map(c => (
                            <option key={c.id} value={c.id}>{c.title} ({c.teacherName})</option>
                          ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => {
                          const cls = classOptions.find(c => c.id === classSelect);
                          if (!cls) return;
                          setAddedClasses(prev => prev.some(x => x.id === cls.id) ? prev : [...prev, cls]);
                          setClassSelect('');
                        }}
                        disabled={!classSelect}
                        className="px-3 py-2.5 rounded-xl border border-white/10 text-sm hover:bg-white/5 transition-colors disabled:opacity-40"
                      >
                        {t('teachers.add')}
                      </button>
                    </div>
                    <p className="text-[10px] text-white/30 mt-1 ml-1">{t('teachers.class_move_note')}</p>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={() => setEditing(null)}
                    className="px-4 py-2 rounded-xl border border-white/10 text-sm hover:bg-white/5 transition-colors"
                  >
                    {t('common.cancel')}
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

      {/* Attendance by class — same look as the Students attendance popup */}
      <AnimatePresence>
        {breakdown && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setBreakdown(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="glass-card rounded-2xl p-6 w-full max-w-md border border-white/10"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="font-display text-base font-medium text-white">{t('teachers.breakdown_title')}</h3>
                  <p className="text-xs text-white/40 mt-0.5">{breakdown.name}</p>
                </div>
                <button onClick={() => setBreakdown(null)} className="p-1.5 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-4">
                {breakdown.classes.map(c => (
                  <div key={c.id}>
                    <div className="flex justify-between gap-3 text-xs mb-1.5">
                      <span className="text-white/60 truncate" title={c.title}>{c.title}</span>
                      {c.attendanceRate !== null ? (
                        <span className={`font-semibold shrink-0 ${TEXT[tone(c.attendanceRate)]}`}>{Math.round(c.attendanceRate)}%</span>
                      ) : (
                        <span className="text-white/30 shrink-0">{t('teachers.no_records')}</span>
                      )}
                    </div>
                    <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                      {c.attendanceRate !== null && (
                        <div className={`h-full rounded-full ${BAR[tone(c.attendanceRate)]}`} style={{ width: `${c.attendanceRate}%` }} />
                      )}
                    </div>
                  </div>
                ))}

                <p className="text-[11px] text-white/40 leading-relaxed pt-4 border-t border-white/5">
                  {t('teachers.breakdown_note')}
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
