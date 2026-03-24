import { useState, useEffect, useMemo } from 'react';
import { motion } from 'motion/react';
import { CheckCircle, XCircle, Loader2, ClipboardList, BookOpen, Award } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useUser } from '../context/UserContext';
import { api } from '../services/api';

interface GradeEntry {
  tableName: string;
  className: string;
  teacherName: string;
  totalPoints: number | null;
  passed: boolean | null;
  gradedAt: string | null;
  note: string | null;
}

export default function StudentGrades() {
  const { t } = useLanguage();
  const { user } = useUser();
  const [entries, setEntries] = useState<GradeEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    api.gradeTables.getForStudent(user.id)
      .then(setEntries)
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, [user]);

  const stats = useMemo(() => {
    const graded = entries.filter(e => e.passed != null);
    const passed = graded.filter(e => e.passed === true).length;
    const failed = graded.filter(e => e.passed === false).length;
    return { total: entries.length, graded: graded.length, passed, failed };
  }, [entries]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div>
        <h1 className="font-display text-3xl font-medium tracking-tight mb-1">{t('nav.grades')}</h1>
        <p className="text-white/50 text-sm">Your final project grades and assessment results.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-card p-5 rounded-2xl flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20">
            <BookOpen className="w-6 h-6 text-purple-400" />
          </div>
          <div>
            <div className="text-2xl font-display font-medium tracking-tight mb-0.5">{stats.total}</div>
            <div className="text-[11px] font-medium text-white/40 uppercase tracking-wider">Grade Tables</div>
          </div>
        </div>
        <div className="glass-card p-5 rounded-2xl flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
            <Award className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <div className="text-2xl font-display font-medium tracking-tight mb-0.5">{stats.passed}</div>
            <div className="text-[11px] font-medium text-white/40 uppercase tracking-wider">Passed</div>
          </div>
        </div>
        <div className="glass-card p-5 rounded-2xl flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center border border-red-500/20">
            <XCircle className="w-6 h-6 text-red-400" />
          </div>
          <div>
            <div className="text-2xl font-display font-medium tracking-tight mb-0.5">{stats.failed}</div>
            <div className="text-[11px] font-medium text-white/40 uppercase tracking-wider">Failed</div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="glass-card rounded-3xl p-6 overflow-hidden flex flex-col">
        <div className="overflow-x-auto pb-4 custom-scrollbar flex-1 -mx-6 px-6">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-white/30">
              <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading grades...
            </div>
          ) : entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-white/20">
              <ClipboardList className="w-10 h-10 mb-3" />
              <p className="text-sm">No grades recorded yet.</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="border-b border-white/5 text-[11px] uppercase tracking-widest text-white/30">
                  <th className="pb-3 font-medium">Grade Table</th>
                  <th className="pb-3 font-medium">Class</th>
                  <th className="pb-3 font-medium">Teacher</th>
                  <th className="pb-3 font-medium">Result</th>
                  <th className="pb-3 font-medium">Note</th>
                  <th className="pb-3 font-medium text-right">Date</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {entries.map((entry, i) => (
                  <tr key={i} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors group">
                    <td className="py-4">
                      <div className="font-medium text-white/90 group-hover:text-white transition-colors">{entry.tableName}</div>
                    </td>
                    <td className="py-4 text-white/60">{entry.className}</td>
                    <td className="py-4 text-white/60">{entry.teacherName}</td>
                    <td className="py-4">
                      {entry.passed === true && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <CheckCircle className="w-3 h-3" /> Passed{entry.totalPoints != null ? ` · ${entry.totalPoints} pts` : ''}
                        </span>
                      )}
                      {entry.passed === false && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium uppercase tracking-wider bg-red-500/10 text-red-400 border border-red-500/20">
                          <XCircle className="w-3 h-3" /> Failed{entry.totalPoints != null ? ` · ${entry.totalPoints} pts` : ''}
                        </span>
                      )}
                      {entry.passed == null && (
                        <span className="text-white/30 text-xs">Not graded</span>
                      )}
                    </td>
                    <td className="py-4 text-white/50 text-xs max-w-[160px] truncate" title={entry.note || ''}>
                      {entry.note || <span className="text-white/20">—</span>}
                    </td>
                    <td className="py-4 text-right text-white/40 text-xs">{entry.gradedAt || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </motion.div>
  );
}
