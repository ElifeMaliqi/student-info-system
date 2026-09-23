'use client';

import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, Mail, Phone, Clock, GraduationCap, Loader2, Link2, X } from 'lucide-react';
import { useRouter, useParams } from 'next/navigation';
import { useLanguage } from '../context/LanguageContext';
import { api } from '../services/api';
import { ClassCard, ClassWithProgram, DAYS } from './AdminClasses';
import type { ClassEnrollment } from '../types';

type TeacherProfileData = NonNullable<Awaited<ReturnType<typeof api.users.getTeacherProfile>>>;

// "18:30:00" → hours since midnight
const toHours = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return (h || 0) + (m || 0) / 60;
};

export default function TeacherProfile() {
  const { t } = useLanguage();
  const router = useRouter();
  const params = useParams();
  const teacherId = params?.id as string;

  const [teacher, setTeacher] = useState<TeacherProfileData | null>(null);
  const [classes, setClasses] = useState<ClassWithProgram[]>([]);
  const [loading, setLoading] = useState(true);

  // Class popup
  const [viewClass, setViewClass] = useState<ClassWithProgram | null>(null);
  const [viewEnrollments, setViewEnrollments] = useState<ClassEnrollment[]>([]);
  const [viewStatuses, setViewStatuses] = useState<Record<string, string>>({});
  const [viewAttendance, setViewAttendance] = useState<{ markedDays: number; attended: Record<string, number> }>({ markedDays: 0, attended: {} });
  const [viewLoading, setViewLoading] = useState(false);
  const monthName = new Date().toLocaleDateString('en-US', { month: 'long' });

  useEffect(() => {
    if (!teacherId) return;
    Promise.all([api.users.getTeacherProfile(teacherId), api.classes.getAll()])
      .then(([profile, allClasses]) => {
        setTeacher(profile);
        setClasses(allClasses.filter(c => c.teacher_id === teacherId));
      })
      .catch((e) => console.error('Teacher profile load error:', e))
      .finally(() => setLoading(false));
  }, [teacherId]);

  const openView = async (cls: ClassWithProgram) => {
    setViewClass(cls);
    setViewEnrollments([]);
    setViewStatuses({});
    setViewAttendance({ markedDays: 0, attended: {} });
    setViewLoading(true);
    try {
      const now = new Date();
      const month = now.getMonth() + 1;
      const year = now.getFullYear();
      const [enrs, statuses, attendance] = await Promise.all([
        api.classes.getEnrollments(cls.id),
        api.classes.getMonthInvoiceStatuses(cls.id, month, year),
        api.classes.getMonthAttendance(cls.id, month, year),
      ]);
      setViewEnrollments(enrs);
      setViewStatuses(statuses);
      setViewAttendance(attendance);
    } catch (e) {
      console.error('Class details load error:', e);
    } finally {
      setViewLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-6 h-6 animate-spin text-white/40" />
      </div>
    );
  }

  if (!teacher) {
    return (
      <div className="text-center py-20 text-white/40">
        <p>{t('teachers.not_found')}</p>
        <button onClick={() => router.push('/teachers')} className="mt-4 text-sm text-[#fc0ce4] hover:underline">{t('teachers.back')}</button>
      </div>
    );
  }

  // Same rule as the Teachers table: scheduled session length summed over all classes.
  const weeklyHours = classes.reduce(
    (sum, c) => sum + (c.sessions || []).reduce((s, x) => s + (toHours(x.end_time) - toHours(x.start_time)), 0),
    0,
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 max-w-5xl mx-auto"
    >
      {/* Header Actions */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.push('/teachers')}
          className="flex items-center gap-2 text-sm font-medium text-white/60 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          {t('teachers.back')}
        </button>
      </div>

      {/* Main Profile Card */}
      <div className="glass-card rounded-3xl p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-[#fc0ce4]/10 to-transparent rounded-bl-full pointer-events-none" />

        <div className="flex flex-col md:flex-row gap-8 items-start relative z-10">
          <img
            src={teacher.avatar}
            alt={teacher.name}
            className="w-32 h-32 rounded-2xl border-4 border-white/10 object-cover shadow-2xl"
            referrerPolicy="no-referrer"
          />

          <div className="flex-1 space-y-4">
            <div>
              <h1 className="font-display text-3xl font-medium tracking-tight text-white mb-1">{teacher.name}</h1>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-white/5">
              <div className="flex items-center gap-3 text-sm text-white/70">
                <Mail className="w-4 h-4 text-white/40" />
                {teacher.email}
              </div>
              {teacher.phone && (
                <div className="flex items-center gap-3 text-sm text-white/70">
                  <Phone className="w-4 h-4 text-white/40" />
                  {teacher.phone}
                </div>
              )}
              <div className="flex items-center gap-3 text-sm text-white/70">
                <Clock className="w-4 h-4 text-white/40" />
                {t('teachers.col_hours')}: {weeklyHours.toLocaleString('en-US', { maximumFractionDigits: 1 })} {t('teachers.hours_unit')}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Classes */}
      <div>
        <div className="flex items-center gap-3 mb-5">
          <div className="w-1 h-5 rounded-full bg-gradient-to-b from-[#fc0ce4] to-[#949ce4]" />
          <h2 className="text-base font-semibold text-white">{t('teachers.classes')}</h2>
          <span className="text-xs text-white/30">{classes.length}</span>
        </div>
        {classes.length === 0 ? (
          <div className="glass-card rounded-3xl p-6 flex flex-col items-center justify-center py-12 text-white/30">
            <GraduationCap className="w-8 h-8 mb-3 opacity-40" />
            <p className="text-sm">{t('teachers.no_classes')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {classes.map(cls => (
              <ClassCard key={cls.id} cls={cls} onOpen={() => openView(cls)} />
            ))}
          </div>
        )}
      </div>

      {/* Class details */}
      {viewClass && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50"
          onClick={() => setViewClass(null)}
        >
          <div className="glass-card rounded-3xl w-full max-w-xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-white/10 flex items-start justify-between shrink-0">
              <div className="min-w-0">
                <h2 className="font-display text-xl font-medium truncate">{viewClass.title}</h2>
                <p className="text-white/40 text-sm mt-0.5">{viewClass.programName}</p>
              </div>
              <button
                onClick={() => setViewClass(null)}
                className="p-2 rounded-xl hover:bg-white/10 text-white/40 hover:text-white transition-colors shrink-0"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto custom-scrollbar space-y-6">
              {/* Class info */}
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  {viewClass.code && (
                    <span className="inline-block px-2 py-0.5 rounded-md bg-[#949ce4]/10 border border-[#949ce4]/20 text-[#949ce4] text-[10px] font-mono tracking-widest">
                      {viewClass.code}
                    </span>
                  )}
                  {viewClass.meetLink && (
                    <a
                      href={viewClass.meetLink.startsWith('http') ? viewClass.meetLink : `https://${viewClass.meetLink}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-[11px] text-[#949ce4]/70 hover:text-[#949ce4] transition-colors"
                    >
                      <Link2 size={11} /> Meet
                    </a>
                  )}
                </div>
                <div>
                  <div className="text-[11px] font-semibold text-white/40 uppercase tracking-widest mb-2">{t('teachers.sessions')}</div>
                  {viewClass.sessions && viewClass.sessions.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {viewClass.sessions.map((s, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/5 border border-white/[0.06] text-white/60 text-[11px]"
                        >
                          <Clock size={10} />
                          {DAYS[s.day_of_week]} {s.start_time?.slice(0, 5)}–{s.end_time?.slice(0, 5)}
                        </span>
                      ))}
                    </div>
                  ) : <p className="text-white/30 text-sm">—</p>}
                </div>
              </div>

              {/* Enrolled students */}
              <div>
                <div className="flex items-baseline justify-between gap-3 mb-3">
                  <div className="text-[11px] font-semibold text-white/40 uppercase tracking-widest">
                    {t('teachers.enrolled')} ({viewEnrollments.length})
                  </div>
                  <div className="text-[10px] text-white/30">
                    {t('teachers.attendance_month').replace('{month}', monthName)}
                  </div>
                </div>
                {viewLoading ? (
                  <div className="flex items-center gap-2 text-white/30 text-sm py-4">
                    <Loader2 className="w-4 h-4 animate-spin" />
                  </div>
                ) : viewEnrollments.length === 0 ? (
                  <p className="text-white/30 text-sm py-2">{t('teachers.no_students')}</p>
                ) : (
                  <div className="space-y-1.5">
                    {viewEnrollments.map(e => {
                      const status = viewStatuses[e.id];
                      return (
                        <div
                          key={e.id}
                          className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/5"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-white truncate">
                              {e.student?.firstName} {e.student?.lastName}
                            </p>
                            <p className="text-[11px] text-white/35 truncate">{e.student?.email}</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs text-white/60 font-mono">
                              {viewAttendance.attended[e.student_id] || 0}/{viewAttendance.markedDays}
                            </span>
                            {status && (
                              <span className={`inline-flex items-center px-2 py-1 rounded-full text-[10px] font-medium uppercase tracking-wider border ${
                                status === 'paid'
                                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                  : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                              }`}>
                                {status === 'paid' ? t('teachers.paid') : t('teachers.unpaid')} {monthName}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
