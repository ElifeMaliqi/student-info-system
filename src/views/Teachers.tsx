'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Loader2, AlertCircle, GraduationCap, Mail, Phone, X } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
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

export default function Teachers() {
  const { t } = useLanguage();

  const [teachers, setTeachers] = useState<TeacherOverview[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [breakdown, setBreakdown] = useState<TeacherOverview | null>(null);

  useEffect(() => {
    api.users.getTeacherOverview()
      .then(setTeachers)
      .catch((e) => { console.error('Teachers load error:', e); setFailed(true); })
      .finally(() => setLoading(false));
  }, []);

  // en-US in both languages, like the rest of the app. Albanian number data isn't
  // shipped by every browser, so 'sq-AL' would print differently per browser.
  const fmtHours = (h: number) =>
    `${h.toLocaleString('en-US', { maximumFractionDigits: 1 })} ${t('teachers.hours_unit')}`;

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
            <table className="w-full text-left border-collapse min-w-[860px]">
              <thead>
                <tr className="border-b border-white/5 text-[11px] uppercase tracking-widest text-white/30">
                  <th className="pb-3 font-medium">{t('teachers.col_teacher')}</th>
                  <th className="pb-3 font-medium">{t('teachers.col_classes')}</th>
                  <th className="pb-3 font-medium">{t('teachers.col_students')}</th>
                  <th className="pb-3 font-medium">{t('teachers.col_hours')}</th>
                  <th className="pb-3 font-medium">{t('teachers.col_attendance')}</th>
                  <th className="pb-3 font-medium">{t('teachers.col_contact')}</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {teachers.map(teacher => (
                  <tr key={teacher.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                    <td className="py-4">
                      <div className="flex items-center gap-3">
                        <img src={teacher.avatar} alt={teacher.name} className="w-9 h-9 rounded-full border border-white/10 shrink-0" referrerPolicy="no-referrer" />
                        <span className="font-medium text-white/90">{teacher.name}</span>
                      </div>
                    </td>
                    <td className="py-4 text-white/60">{teacher.classCount}</td>
                    <td className="py-4 text-white/60">{teacher.studentCount}</td>
                    <td className="py-4 text-white/60">{fmtHours(teacher.weeklyHours)}</td>
                    <td className="py-4">
                      {teacher.attendanceRate !== null ? (
                        <button
                          onClick={() => setBreakdown(teacher)}
                          className={`inline-flex px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${BADGE[tone(teacher.attendanceRate)]}`}
                        >
                          {Math.round(teacher.attendanceRate)}%
                        </button>
                      ) : <span className="text-white/30">–</span>}
                    </td>
                    <td className="py-4">
                      <div className="flex flex-col gap-1 text-xs">
                        <a href={`mailto:${teacher.email}`} className="inline-flex items-center gap-1.5 text-white/60 hover:text-white transition-colors">
                          <Mail className="w-3.5 h-3.5 shrink-0" />
                          {teacher.email}
                        </a>
                        {teacher.phone && (
                          <a href={`tel:${teacher.phone}`} className="inline-flex items-center gap-1.5 text-white/60 hover:text-white transition-colors">
                            <Phone className="w-3.5 h-3.5 shrink-0" />
                            {teacher.phone}
                          </a>
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
