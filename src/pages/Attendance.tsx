import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Calendar as CalendarIcon, CheckCircle2, XCircle, Clock, AlertTriangle,
  Search, ChevronDown, Download, X, Loader2,
  GraduationCap, ArrowUpDown,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useUser } from '../context/UserContext';
import { api } from '../services/api';
import type { CalendarEvent } from '../types';
import { ClassAttendanceModal } from '../components/ClassAttendanceModal';
import { playPopSound } from '../utils/sound';

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

type AttendanceSession = {
  classId: string;
  className: string;
  teacherName: string;
  date: string;
  present: number;
  absent: number;
  late: number;
  records: { studentId: string; studentName: string; avatar: string; status: 'present' | 'absent' | 'late' }[];
};

type SortCol = 'date' | 'rate' | 'present' | 'late' | 'absent';

export default function Attendance() {
  const { t } = useLanguage();
  const { user } = useUser();

  const [sessions, setSessions]           = useState<AttendanceSession[]>([]);
  const [loading, setLoading]             = useState(true);
  const [todayCounts, setTodayCounts]     = useState({ present: 0, absent: 0, late: 0 });
  const [classAttEvent, setClassAttEvent] = useState<CalendarEvent | null>(null);

  // Filters
  const [search, setSearch]           = useState('');
  const [filterDate, setFilterDate]   = useState('');
  const [filterMonth, setFilterMonth] = useState('');
  const [filterYear, setFilterYear]   = useState('');

  // Sorting
  const [sortBy, setSortBy]   = useState<SortCol>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    setLoading(true);
    api.classAttendance.getAllAttendanceSessions()
      .then(setSessions)
      .catch(() => {})
      .finally(() => setLoading(false));
    api.classAttendance.getTodayCounts().then(setTodayCounts).catch(() => {});
  }, []);

  const overallTotal = sessions.reduce((sum, s) => sum + s.present + s.absent + s.late, 0);
  const overallAttended = sessions.reduce((sum, s) => sum + s.present + s.late, 0);
  const overallPct   = overallTotal > 0
    ? Math.round((overallAttended / overallTotal) * 100)
    : 0;

  const yearOptions = useMemo(() => {
    const years = new Set(sessions.map(s => s.date.slice(0, 4)));
    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [sessions]);

  const filtered = useMemo(() => {
    let result = sessions;

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(s =>
        s.className.toLowerCase().includes(q) ||
        s.teacherName.toLowerCase().includes(q)
      );
    }

    if (filterDate) {
      result = result.filter(s => s.date === filterDate);
    } else {
      if (filterMonth) result = result.filter(s => s.date.slice(5, 7) === filterMonth.padStart(2, '0'));
      if (filterYear)  result = result.filter(s => s.date.slice(0, 4) === filterYear);
    }

    return [...result].sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      if (sortBy === 'date')    return dir * a.date.localeCompare(b.date);
      if (sortBy === 'present') return dir * (a.present - b.present);
      if (sortBy === 'late')    return dir * (a.late - b.late);
      if (sortBy === 'absent')  return dir * (a.absent - b.absent);
      const ta = a.present + a.absent + a.late;
      const tb = b.present + b.absent + b.late;
      const ra = ta > 0 ? (a.present + a.late) / ta : 0;
      const rb = tb > 0 ? (b.present + b.late) / tb : 0;
      return dir * (ra - rb);
    });
  }, [sessions, search, filterDate, filterMonth, filterYear, sortBy, sortDir]);

  function toggleSort(col: SortCol) {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('desc'); }
  }

  const lowParticipationSessions = useMemo(() =>
    sessions.filter(s => {
      const total = s.present + s.absent + s.late;
      return total > 0 && ((s.present + s.late) / total) < 0.4;
    }),
  [sessions]);

  function openModal(s: AttendanceSession) {
    setClassAttEvent({
      id:         `class-${s.classId}-admin-${s.date}`,
      title:      s.className,
      event_type: 'class',
      class_id:   s.classId,
      start_time: `${s.date}T09:00:00`,
      end_time:   `${s.date}T10:00:00`,
      all_day:    false,
      color:      '#10b981',
      created_by: '',
    });
  }

  function SortBtn({ col, label }: { col: SortCol; label: string }) {
    const active = sortBy === col;
    return (
      <button
        onClick={() => toggleSort(col)}
        className={`flex items-center gap-1 transition-colors ${active ? 'text-[#fc0ce4]' : 'hover:text-white'}`}
      >
        {label}
        <ArrowUpDown className={`w-3 h-3 ${active ? 'opacity-100' : 'opacity-40'}`} />
      </button>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div>
        <h1 className="font-display text-3xl font-medium tracking-tight mb-1">{t('attendance.title')}</h1>
        <p className="text-white/50 text-sm">{t('attendance.desc')}</p>
      </div>

      {/* Low participation alert */}
      <AnimatePresence>
        {!loading && lowParticipationSessions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex items-start gap-3 px-4 py-3.5 rounded-2xl bg-red-500/10 border border-red-500/25"
          >
            <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-red-300">Low participation alert</p>
              <p className="text-xs text-red-400/70 mt-0.5">
                {lowParticipationSessions.length} class session{lowParticipationSessions.length !== 1 ? 's' : ''}{' '}
                ha{lowParticipationSessions.length !== 1 ? 've' : 's'} a participation rate below 40%:{' '}
                {lowParticipationSessions.slice(0, 3).map((s, i) => (
                  <span key={`${s.classId}-${s.date}`}>
                    {i > 0 && ', '}
                    <span className="font-medium text-red-300">{s.className}</span>
                    {' '}({new Date(`${s.date}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})
                  </span>
                ))}
                {lowParticipationSessions.length > 3 && (
                  <span className="text-red-400/50"> +{lowParticipationSessions.length - 3} more</span>
                )}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stat cards — today's counts */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-card p-5 rounded-2xl flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
            <CheckCircle2 className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <div className="text-2xl font-display font-medium tracking-tight mb-0.5">
              {overallTotal > 0 ? `${overallPct}%` : '—'}
            </div>
            <div className="text-[11px] font-medium text-white/40 uppercase tracking-wider">{t('attendance.overall')}</div>
          </div>
        </div>
        <div className="glass-card p-5 rounded-2xl flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
            <Clock className="w-6 h-6 text-amber-400" />
          </div>
          <div>
            <div className="text-2xl font-display font-medium tracking-tight mb-0.5">{todayCounts.late}</div>
            <div className="text-[11px] font-medium text-white/40 uppercase tracking-wider">{t('attendance.late_today')}</div>
          </div>
        </div>
        <div className="glass-card p-5 rounded-2xl flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center border border-red-500/20">
            <AlertTriangle className="w-6 h-6 text-red-400" />
          </div>
          <div>
            <div className="text-2xl font-display font-medium tracking-tight mb-0.5">{todayCounts.absent}</div>
            <div className="text-[11px] font-medium text-white/40 uppercase tracking-wider">{t('attendance.low_participation')}</div>
          </div>
        </div>
      </div>

      {/* â”€â”€ Attendance Overview â”€â”€ */}
      <div className="glass-card rounded-3xl p-6 overflow-hidden flex flex-col">
        <div className="flex items-center justify-between mb-5 shrink-0">
          <h2 className="font-display text-lg font-medium">Attendance Overview</h2>
          <button
            onClick={() => { playPopSound(); alert('Exporting attendance report to CSV...'); }}
            className="px-4 py-2 rounded-xl border border-white/10 text-sm font-medium hover:bg-white/5 transition-colors flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-5 shrink-0">
          {/* Search */}
          <div className="relative flex-1 min-w-[180px] group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 group-focus-within:text-[#fc0ce4] transition-colors" />
            <input
              type="text"
              placeholder="Search class or teacher…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-white/5 border border-white/5 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#fc0ce4]/40 focus:bg-[#fc0ce4]/5 transition-all"
            />
          </div>

          {/* Specific date */}
          <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2">
            <CalendarIcon className="w-4 h-4 text-[#fc0ce4] shrink-0" />
            <input
              type="date"
              value={filterDate}
              onChange={e => { setFilterDate(e.target.value); setFilterMonth(''); setFilterYear(''); }}
              className="bg-transparent border-none text-sm text-white focus:outline-none focus:ring-0 [&::-webkit-calendar-picker-indicator]:filter [&::-webkit-calendar-picker-indicator]:invert"
            />
            {filterDate && (
              <button onClick={() => setFilterDate('')} className="text-white/30 hover:text-white transition-colors ml-1">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Month */}
          <div className="relative">
            <select
              value={filterMonth}
              onChange={e => { setFilterMonth(e.target.value); setFilterDate(''); }}
              className="appearance-none bg-white/5 border border-white/10 rounded-xl pl-3 pr-8 py-2.5 text-sm text-white focus:outline-none focus:border-[#fc0ce4]/40 transition-all cursor-pointer"
            >
              <option value="">All Months</option>
              {MONTH_NAMES.map((m, i) => (
                <option key={m} value={String(i + 1)}>{m}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
          </div>

          {/* Year */}
          <div className="relative">
            <select
              value={filterYear}
              onChange={e => { setFilterYear(e.target.value); setFilterDate(''); }}
              className="appearance-none bg-white/5 border border-white/10 rounded-xl pl-3 pr-8 py-2.5 text-sm text-white focus:outline-none focus:border-[#fc0ce4]/40 transition-all cursor-pointer"
            >
              <option value="">All Years</option>
              {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
          </div>
        </div>

        {/* Active filter chips */}
        {(filterDate || filterMonth || filterYear) && (
          <div className="flex items-center gap-2 mb-4 shrink-0 flex-wrap">
            <span className="text-xs text-white/40">Filtering by:</span>
            {filterDate && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-[#fc0ce4]/10 text-[#fc0ce4] border border-[#fc0ce4]/20">
                {new Date(`${filterDate}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            )}
            {filterMonth && !filterDate && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-[#fc0ce4]/10 text-[#fc0ce4] border border-[#fc0ce4]/20">
                {MONTH_NAMES[parseInt(filterMonth) - 1]}
              </span>
            )}
            {filterYear && !filterDate && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-[#fc0ce4]/10 text-[#fc0ce4] border border-[#fc0ce4]/20">
                {filterYear}
              </span>
            )}
            <button
              onClick={() => { setFilterDate(''); setFilterMonth(''); setFilterYear(''); }}
              className="text-xs text-white/30 hover:text-white transition-colors"
            >
              Clear all
            </button>
          </div>
        )}

        {/* Table */}
        <div className="overflow-x-auto pb-4 custom-scrollbar flex-1 -mx-6 px-6">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-white/30">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : (
            <table className="w-full text-left border-collapse min-w-[780px]">
              <thead>
                <tr className="border-b border-white/5 text-[11px] uppercase tracking-widest text-white/30">
                  <th className="pb-3 pl-4 font-medium w-44"><SortBtn col="date" label="Date" /></th>
                  <th className="pb-3 px-4 font-medium">Class</th>
                  <th className="pb-3 px-4 font-medium"><SortBtn col="rate" label="Rate" /></th>
                  <th className="pb-3 px-4 font-medium"><SortBtn col="present" label="Present" /></th>
                  <th className="pb-3 px-4 font-medium"><SortBtn col="late" label="Late" /></th>
                  <th className="pb-3 px-4 font-medium"><SortBtn col="absent" label="Absent" /></th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-16 text-center">
                      <GraduationCap className="w-10 h-10 text-white/10 mx-auto mb-3" />
                      <p className="text-white/30 text-sm">No attendance records found.</p>
                    </td>
                  </tr>
                ) : (
                  filtered.map((s, i) => {
                    const total    = s.present + s.absent + s.late;
                    const pct      = total > 0 ? Math.round(((s.present + s.late) / total) * 100) : 0;
                    const dateObj  = new Date(`${s.date}T12:00:00`);
                    const barColor = pct >= 75 ? 'bg-emerald-400' : pct >= 50 ? 'bg-amber-400' : 'bg-red-400';
                    const txtColor = pct >= 75 ? 'text-emerald-400' : pct >= 50 ? 'text-amber-400' : 'text-red-400';
                    return (
                      <tr
                        key={`${s.classId}-${s.date}-${i}`}
                        onClick={() => openModal(s)}
                        className="border-b border-white/5 hover:bg-white/[0.02] transition-colors group cursor-pointer"
                      >
                        <td className="py-3.5 pl-4">
                          <div className="font-medium text-white/90 text-sm">
                            {dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </div>
                          <div className="text-[11px] text-white/30 mt-0.5">
                            {dateObj.toLocaleDateString('en-US', { weekday: 'long' })}
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                              <GraduationCap className="w-3.5 h-3.5 text-emerald-400" />
                            </div>
                            <div>
                              <div className="font-medium text-white/90 group-hover:text-white transition-colors">{s.className}</div>
                              <div className="text-[11px] text-white/40">{s.teacherName}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            <div className="w-20 h-1.5 bg-white/10 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
                            </div>
                            <span className={`text-xs font-semibold ${txtColor}`}>
                              {total > 0 ? `${pct}%` : '—'}
                            </span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-2 py-1">
                            <CheckCircle2 className="w-3 h-3" />{s.present}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-2 py-1">
                            <Clock className="w-3 h-3" />{s.late}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-2 py-1">
                            <XCircle className="w-3 h-3" />{s.absent}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Row count footer */}
        {!loading && filtered.length > 0 && (
          <div className="pt-4 border-t border-white/5 mt-auto shrink-0">
            <p className="text-xs text-white/30">
              Showing <span className="text-white/60 font-medium">{filtered.length}</span> session{filtered.length !== 1 ? 's' : ''}
              {filtered.length !== sessions.length && (
                <> of <span className="text-white/60 font-medium">{sessions.length}</span> total</>
              )}
            </p>
          </div>
        )}
      </div>

      {/* Class Attendance Modal */}
      <AnimatePresence>
        {classAttEvent && user && (
          <ClassAttendanceModal
            event={classAttEvent}
            viewerRole="admin"
            viewerUserId={user.id}
            onClose={() => setClassAttEvent(null)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
