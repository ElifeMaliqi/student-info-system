import { useState } from 'react';
import { motion } from 'motion/react';
import { Calendar as CalendarIcon, CheckCircle, XCircle, Clock, AlertTriangle, Search, Filter, ChevronLeft, ChevronRight, List, Download } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { playPopSound } from '../utils/sound';

const ATTENDANCE_DATA = [
  { id: 'STU-001', name: 'Elena Rodriguez', program: 'UI/UX Creative Designer', status: 'Present', percentage: 98 },
  { id: 'STU-002', name: 'Marcus Chen', program: 'Web Development', status: 'Late', percentage: 85 },
  { id: 'STU-003', name: 'Sarah Jenkins', program: 'Cybersecurity', status: 'Absent', percentage: 72 },
  { id: 'STU-004', name: 'David Kim', program: 'UAV Engineering', status: 'Present', percentage: 95 },
  { id: 'STU-005', name: 'Aisha Patel', program: 'Digital Marketing with AI', status: 'Present', percentage: 100 },
];

const CALENDAR_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function Attendance() {
  const [date, setDate] = useState('2026-02-23');
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('calendar');
  const { t } = useLanguage();

  // Generate dummy calendar data
  const generateCalendarDays = () => {
    const days = [];
    for (let i = 0; i < 35; i++) {
      const dayNumber = i - 3 > 0 && i - 3 <= 28 ? i - 3 : null;
      days.push({
        day: dayNumber,
        events: dayNumber ? [
          { type: 'present', count: Math.floor(Math.random() * 20) + 100 },
          { type: 'absent', count: Math.floor(Math.random() * 5) },
          { type: 'late', count: Math.floor(Math.random() * 10) }
        ] : []
      });
    }
    return days;
  };

  const calendarDays = generateCalendarDays();

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-medium tracking-tight mb-1">{t('attendance.title')}</h1>
          <p className="text-white/50 text-sm">{t('attendance.desc')}</p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto bg-white/5 p-1 rounded-xl border border-white/10">
          <button 
            onClick={() => setViewMode('calendar')}
            className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all ${
              viewMode === 'calendar' ? 'bg-white/10 text-white shadow-sm' : 'text-white/40 hover:text-white/80'
            }`}
          >
            <CalendarIcon className="w-4 h-4" />
            {t('attendance.calendar')}
          </button>
          <button 
            onClick={() => setViewMode('list')}
            className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all ${
              viewMode === 'list' ? 'bg-white/10 text-white shadow-sm' : 'text-white/40 hover:text-white/80'
            }`}
          >
            <List className="w-4 h-4" />
            {t('attendance.daily_list')}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="glass-card p-5 rounded-2xl flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
            <CheckCircle className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <div className="text-2xl font-display font-medium tracking-tight mb-0.5">92%</div>
            <div className="text-[11px] font-medium text-white/40 uppercase tracking-wider">{t('attendance.overall')}</div>
          </div>
        </div>
        <div className="glass-card p-5 rounded-2xl flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
            <Clock className="w-6 h-6 text-amber-400" />
          </div>
          <div>
            <div className="text-2xl font-display font-medium tracking-tight mb-0.5">14</div>
            <div className="text-[11px] font-medium text-white/40 uppercase tracking-wider">{t('attendance.late_today')}</div>
          </div>
        </div>
        <div className="glass-card p-5 rounded-2xl flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center border border-red-500/20">
            <AlertTriangle className="w-6 h-6 text-red-400" />
          </div>
          <div>
            <div className="text-2xl font-display font-medium tracking-tight mb-0.5">3</div>
            <div className="text-[11px] font-medium text-white/40 uppercase tracking-wider">{t('attendance.low_participation')}</div>
          </div>
        </div>
      </div>

      {viewMode === 'calendar' ? (
        <div className="glass-card rounded-3xl p-6">
          <div className="flex flex-col md:flex-row items-center justify-between mb-6 gap-4">
            <div className="flex items-center gap-4">
              <h2 className="font-display text-xl font-medium">February 2026</h2>
              <div className="flex items-center gap-1">
                <button className="p-1 hover:bg-white/10 rounded-lg transition-colors text-white/60 hover:text-white">
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button className="p-1 hover:bg-white/10 rounded-lg transition-colors text-white/60 hover:text-white">
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => { playPopSound(); alert('Exporting attendance report to CSV...'); }}
                className="px-4 py-2.5 rounded-xl border border-white/10 text-sm font-medium hover:bg-white/5 transition-colors flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Export
              </button>
              <select className="px-4 py-2.5 rounded-xl border border-white/10 text-sm font-medium bg-[#0a0a0a] text-white hover:bg-white/5 transition-colors appearance-none pr-8">
                <option>{t('students.all_programs')}</option>
                <option>Web Development</option>
                <option>Cybersecurity</option>
              </select>
              <select className="px-4 py-2.5 rounded-xl border border-white/10 text-sm font-medium bg-[#0a0a0a] text-white hover:bg-white/5 transition-colors appearance-none pr-8">
                <option>All Professors</option>
                <option>Alan Turing</option>
                <option>Ada Lovelace</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto pb-4 custom-scrollbar -mx-6 px-6 md:mx-0 md:px-0">
            <div className="grid grid-cols-7 gap-px bg-white/5 rounded-2xl overflow-hidden border border-white/10 min-w-[700px]">
              {CALENDAR_DAYS.map(day => (
                <div key={day} className="bg-[#0a0a0a] py-3 text-center text-[11px] font-semibold text-white/40 uppercase tracking-widest">
                  {day}
                </div>
              ))}
              
              {calendarDays.map((cell, i) => (
                <div key={i} className={`bg-[#050505] min-h-[120px] p-2 border-t border-white/5 ${!cell.day ? 'opacity-30' : 'hover:bg-white/[0.02] transition-colors cursor-pointer group'}`}>
                  {cell.day && (
                    <>
                      <div className={`text-sm font-medium mb-2 w-7 h-7 flex items-center justify-center rounded-full ${cell.day === 23 ? 'bg-[#fc0ce4] text-white' : 'text-white/70 group-hover:text-white'}`}>
                        {cell.day}
                      </div>
                      <div className="space-y-1">
                        {cell.events.map((event, j) => (
                          <div key={j} className={`text-[10px] px-2 py-1 rounded-md flex justify-between items-center ${
                            event.type === 'present' ? 'bg-emerald-500/10 text-emerald-400' :
                            event.type === 'late' ? 'bg-amber-500/10 text-amber-400' :
                            'bg-red-500/10 text-red-400'
                          }`}>
                            <span className="capitalize">{t(`status.${event.type}`)}</span>
                            <span className="font-bold">{event.count}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="glass-card rounded-3xl p-6 overflow-hidden flex flex-col">
          <div className="flex flex-col md:flex-row gap-4 justify-between mb-6 shrink-0">
            <div className="flex flex-col md:flex-row items-center gap-4">
              <div className="relative w-full md:w-80 group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 group-focus-within:text-[#fc0ce4] transition-colors" />
                <input 
                  type="text" 
                  placeholder={t('attendance.search')} 
                  className="w-full bg-white/5 border border-white/5 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#fc0ce4]/40 focus:bg-[#fc0ce4]/5 focus:shadow-[0_0_15px_rgba(252,12,228,0.1)] transition-all"
                />
              </div>
              <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-4 py-2">
                <CalendarIcon className="w-4 h-4 text-[#fc0ce4]" />
                <input 
                  type="date" 
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="bg-transparent border-none text-sm text-white focus:outline-none focus:ring-0 [&::-webkit-calendar-picker-indicator]:filter [&::-webkit-calendar-picker-indicator]:invert"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => { playPopSound(); alert('Exporting attendance report to CSV...'); }}
                className="px-4 py-2.5 rounded-xl border border-white/10 text-sm font-medium hover:bg-white/5 transition-colors flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Export
              </button>
              <select className="px-4 py-2.5 rounded-xl border border-white/10 text-sm font-medium bg-[#0a0a0a] text-white hover:bg-white/5 transition-colors appearance-none pr-8">
                <option>{t('students.all_programs')}</option>
                <option>Web Development</option>
                <option>Cybersecurity</option>
              </select>
              <button className="px-4 py-2.5 rounded-xl border border-white/10 text-sm font-medium hover:bg-white/5 transition-colors flex items-center gap-2">
                <Filter className="w-4 h-4" />
                {t('students.filter')}
              </button>
            </div>
          </div>

          <div className="overflow-x-auto pb-4 custom-scrollbar flex-1 -mx-6 px-6">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="border-b border-white/5 text-[11px] uppercase tracking-widest text-white/30">
                  <th className="pb-3 font-medium px-4">{t('attendance.student_info')}</th>
                  <th className="pb-3 font-medium px-4">{t('table.program')}</th>
                  <th className="pb-3 font-medium px-4">{t('attendance.overall_percent')}</th>
                  <th className="pb-3 font-medium px-4 text-center">{t('attendance.today_status')}</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {ATTENDANCE_DATA.map((student) => (
                  <tr key={student.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors group">
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3">
                        <div>
                          <div className="font-medium text-white/90 group-hover:text-white transition-colors">{student.name}</div>
                          <div className="text-[11px] text-white/40 font-mono mt-0.5">{student.id}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-white/60">{student.program}</td>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full ${
                              student.percentage >= 90 ? 'bg-emerald-400' : 
                              student.percentage >= 75 ? 'bg-amber-400' : 'bg-red-400'
                            }`}
                            style={{ width: `${student.percentage}%` }}
                          />
                        </div>
                        <span className={`text-xs font-medium ${
                          student.percentage >= 90 ? 'text-emerald-400' : 
                          student.percentage >= 75 ? 'text-amber-400' : 'text-red-400'
                        }`}>
                          {student.percentage}%
                        </span>
                        {student.percentage < 75 && (
                          <AlertTriangle className="w-3 h-3 text-red-400 ml-1" title="Low participation alert" />
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                          student.status === 'Present' 
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                            : 'bg-white/5 text-white/30 hover:bg-white/10 border border-transparent'
                        }`} title="Present">
                          <CheckCircle className="w-4 h-4" />
                        </button>
                        <button className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                          student.status === 'Late' 
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' 
                            : 'bg-white/5 text-white/30 hover:bg-white/10 border border-transparent'
                        }`} title="Late">
                          <Clock className="w-4 h-4" />
                        </button>
                        <button className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                          student.status === 'Absent' 
                            ? 'bg-red-500/20 text-red-400 border border-red-500/30' 
                            : 'bg-white/5 text-white/30 hover:bg-white/10 border border-transparent'
                        }`} title="Absent">
                          <XCircle className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </motion.div>
  );
}
