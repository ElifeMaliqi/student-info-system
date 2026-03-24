import { useState, useEffect, useMemo } from 'react';
import { motion } from 'motion/react';
import { CalendarCheck, CheckCircle2, XCircle, Clock, Loader2, BarChart2 } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useUser } from '../context/UserContext';
import { api } from '../services/api';

interface AttRecord {
  classId: string;
  className: string;
  date: string;
  status: 'present' | 'absent' | 'late';
}

export default function StudentAttendance() {
  const { t } = useLanguage();
  const { user } = useUser();
  const [records, setRecords] = useState<AttRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterClass, setFilterClass] = useState('');

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    api.classAttendance.getForStudent(user.id)
      .then(setRecords)
      .catch(() => setRecords([]))
      .finally(() => setLoading(false));
  }, [user]);

  const classes = useMemo(() => {
    const set = new Map<string, string>();
    records.forEach(r => set.set(r.classId, r.className));
    return Array.from(set.entries()).map(([id, name]) => ({ id, name }));
  }, [records]);

  const filtered = useMemo(() => {
    if (!filterClass) return records;
    return records.filter(r => r.classId === filterClass);
  }, [records, filterClass]);

  const stats = useMemo(() => {
    const total = filtered.length;
    const present = filtered.filter(r => r.status === 'present').length;
    const late = filtered.filter(r => r.status === 'late').length;
    const absent = filtered.filter(r => r.status === 'absent').length;
    const pct = total > 0 ? Math.round(((present + late) / total) * 100) : 0;
    return { total, present, late, absent, pct };
  }, [filtered]);

  const pctColor = stats.pct >= 75 ? 'text-emerald-400' : stats.pct >= 50 ? 'text-amber-400' : 'text-red-400';
  const barColor = stats.pct >= 75 ? 'bg-emerald-400' : stats.pct >= 50 ? 'bg-amber-400' : 'bg-red-400';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div>
        <h1 className="font-display text-3xl font-medium tracking-tight mb-1">{t('nav.attendance')}</h1>
        <p className="text-white/50 text-sm">Your attendance history across all classes.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="glass-card p-4 rounded-2xl text-center">
          <div className={`text-2xl font-display font-medium ${pctColor}`}>{stats.pct}%</div>
          <div className="text-[11px] text-white/40 uppercase tracking-wider mt-1">Rate</div>
        </div>
        <div className="glass-card p-4 rounded-2xl text-center">
          <div className="text-2xl font-display font-medium text-emerald-400">{stats.present}</div>
          <div className="text-[11px] text-white/40 uppercase tracking-wider mt-1">Present</div>
        </div>
        <div className="glass-card p-4 rounded-2xl text-center">
          <div className="text-2xl font-display font-medium text-amber-400">{stats.late}</div>
          <div className="text-[11px] text-white/40 uppercase tracking-wider mt-1">Late</div>
        </div>
        <div className="glass-card p-4 rounded-2xl text-center">
          <div className="text-2xl font-display font-medium text-red-400">{stats.absent}</div>
          <div className="text-[11px] text-white/40 uppercase tracking-wider mt-1">Absent</div>
        </div>
      </div>

      {/* Rate bar */}
      {stats.total > 0 && (
        <div className="glass-card rounded-2xl p-4 flex items-center gap-4">
          <span className="text-xs text-white/40 shrink-0">Overall</span>
          <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${barColor} transition-all`} style={{ width: `${stats.pct}%` }} />
          </div>
          <span className={`text-sm font-bold shrink-0 ${pctColor}`}>{stats.pct}%</span>
        </div>
      )}

      {/* Filter */}
      {classes.length > 1 && (
        <div>
          <select
            value={filterClass}
            onChange={e => setFilterClass(e.target.value)}
            className="glass-select px-4 py-2.5 rounded-xl text-sm"
          >
            <option value="">All classes</option>
            {classes.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Records */}
      <div className="glass-card rounded-3xl p-6 overflow-hidden flex flex-col">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-white/30">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading attendance...
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-white/20">
            <BarChart2 className="w-10 h-10 mb-3" />
            <p className="text-sm">No attendance records found.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((r, i) => {
              const dateObj = new Date(`${r.date}T12:00:00`);
              const statusIcon = r.status === 'present'
                ? <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                : r.status === 'late'
                ? <Clock className="w-4 h-4 text-amber-400" />
                : <XCircle className="w-4 h-4 text-red-400" />;
              const statusColor = r.status === 'present' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                : r.status === 'late' ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                : 'bg-red-500/10 border-red-500/20 text-red-400';
              return (
                <div key={`${r.classId}-${r.date}-${i}`} className="flex items-center gap-4 px-4 py-3 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-colors">
                  <div className="w-10 text-center shrink-0">
                    <div className="text-xs font-bold text-white/60">
                      {dateObj.toLocaleDateString('en-US', { month: 'short' })}
                    </div>
                    <div className="text-lg font-display font-medium leading-none">
                      {dateObj.getDate()}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white/80 truncate">{r.className}</div>
                    <div className="text-xs text-white/30 mt-0.5">
                      {dateObj.toLocaleDateString('en-US', { weekday: 'long' })}
                    </div>
                  </div>
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium uppercase tracking-wider border ${statusColor}`}>
                    {statusIcon}
                    {r.status}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
}
