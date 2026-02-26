import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Users, CalendarCheck, CreditCard, BookOpen, TrendingUp, ArrowUpRight, MoreHorizontal, AlertCircle } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { Skeleton } from '../components/Skeleton';

const STATS = [
  { label: 'dash.total_students', value: '1,248', trend: '+12%', icon: Users, color: 'text-blue-400' },
  { label: 'dash.active_programs', value: '8', trend: 'Stable', icon: BookOpen, color: 'text-purple-400' },
  { label: 'dash.avg_attendance', value: '94.2%', trend: '+2.1%', icon: CalendarCheck, color: 'text-emerald-400' },
  { label: 'dash.monthly_revenue', value: '$124.5k', trend: '+8.4%', icon: CreditCard, color: 'text-amber-400' },
];

const RECENT_STUDENTS = [
  { id: 'STU-001', name: 'Elena Rodriguez', program: 'UI/UX Creative Designer', status: 'Active', date: 'Today, 09:24 AM', avatar: 'https://picsum.photos/seed/elena/100/100' },
  { id: 'STU-002', name: 'Marcus Chen', program: 'Web Development', status: 'Pending', date: 'Today, 08:12 AM', avatar: 'https://picsum.photos/seed/marcus/100/100' },
  { id: 'STU-003', name: 'Sarah Jenkins', program: 'Cybersecurity', status: 'Active', date: 'Yesterday', avatar: 'https://picsum.photos/seed/sarah/100/100' },
  { id: 'STU-004', name: 'David Kim', program: 'UAV Engineering', status: 'Active', date: 'Yesterday', avatar: 'https://picsum.photos/seed/david/100/100' },
];

export default function Dashboard() {
  const { t } = useLanguage();
  const [isLoading, setIsLoading] = useState(true);

  // Simulate API fetch delay
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col sm:flex-row sm:items-end justify-between gap-4"
      >
        <div>
          <h1 className="font-display text-3xl font-medium tracking-tight mb-1">{t('dash.overview')}</h1>
          <p className="text-white/50 text-sm">{t('dash.overview_desc')}</p>
        </div>
        <div className="text-sm font-medium text-[#fc0ce4] bg-[#fc0ce4]/10 px-4 py-2 rounded-full border border-[#fc0ce4]/20 self-start sm:self-auto">
          Feb 23, 2026
        </div>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="glass-card p-5 rounded-2xl flex flex-col gap-4">
              <div className="flex justify-between items-start">
                <Skeleton className="w-10 h-10 rounded-xl" />
                <Skeleton className="w-16 h-5 rounded-full" />
              </div>
              <div>
                <Skeleton className="w-24 h-8 mb-2" />
                <Skeleton className="w-32 h-3" />
              </div>
            </div>
          ))
        ) : (
          STATS.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="glass-card p-5 rounded-2xl flex flex-col gap-4 group cursor-pointer"
            >
              <div className="flex justify-between items-start">
                <div className={`w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/5 group-hover:scale-110 transition-transform duration-300`}>
                  <stat.icon className={`w-5 h-5 ${stat.color}`} />
                </div>
                <div className="flex items-center gap-1 text-[11px] font-medium text-[#fc0ce4] bg-[#fc0ce4]/10 px-2 py-1 rounded-full">
                  <TrendingUp className="w-3 h-3" />
                  {stat.trend}
                </div>
              </div>
              <div>
                <div className="text-3xl font-display font-medium tracking-tight mb-1">{stat.value}</div>
                <div className="text-xs font-medium text-white/40 uppercase tracking-wider">{t(stat.label)}</div>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* Two Column Layout for Tables/Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Needs Attention Hub */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="lg:col-span-3 glass-card rounded-3xl p-6 border border-amber-500/20 bg-gradient-to-br from-amber-500/5 to-transparent"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400">
              <AlertCircle className="w-4 h-4" />
            </div>
            <h2 className="font-display text-lg font-medium text-amber-400">Needs Attention</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-black/20 rounded-2xl p-4 border border-white/5 flex items-center justify-between group cursor-pointer hover:bg-black/40 transition-colors">
              <div>
                <div className="text-2xl font-display font-medium text-white mb-1">5</div>
                <div className="text-xs text-white/50 uppercase tracking-wider">Pending Applications</div>
              </div>
              <ArrowUpRight className="w-4 h-4 text-white/20 group-hover:text-amber-400 transition-colors" />
            </div>
            <div className="bg-black/20 rounded-2xl p-4 border border-white/5 flex items-center justify-between group cursor-pointer hover:bg-black/40 transition-colors">
              <div>
                <div className="text-2xl font-display font-medium text-white mb-1">12</div>
                <div className="text-xs text-white/50 uppercase tracking-wider">Overdue Invoices</div>
              </div>
              <ArrowUpRight className="w-4 h-4 text-white/20 group-hover:text-amber-400 transition-colors" />
            </div>
            <div className="bg-black/20 rounded-2xl p-4 border border-white/5 flex items-center justify-between group cursor-pointer hover:bg-black/40 transition-colors">
              <div>
                <div className="text-2xl font-display font-medium text-white mb-1">3</div>
                <div className="text-xs text-white/50 uppercase tracking-wider">Students at Risk (Attendance)</div>
              </div>
              <ArrowUpRight className="w-4 h-4 text-white/20 group-hover:text-amber-400 transition-colors" />
            </div>
          </div>
        </motion.div>

        {/* Recent Enrollments Table */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="lg:col-span-2 glass-card rounded-3xl p-6 overflow-hidden flex flex-col"
        >
          <div className="flex items-center justify-between mb-6 shrink-0">
            <h2 className="font-display text-lg font-medium">{t('dash.recent_enrollments')}</h2>
            <button className="text-xs font-medium text-white/50 hover:text-[#fc0ce4] flex items-center gap-1 transition-colors">
              {t('dash.view_all')} <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
          
          <div className="overflow-x-auto pb-4 custom-scrollbar flex-1 -mx-6 px-6">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="border-b border-white/5 text-[11px] uppercase tracking-widest text-white/30">
                  <th className="pb-3 font-medium px-4">{t('table.student')}</th>
                  <th className="pb-3 font-medium px-4">{t('table.program')}</th>
                  <th className="pb-3 font-medium px-4">{t('table.status')}</th>
                  <th className="pb-3 font-medium px-4 text-right">{t('table.date')}</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {isLoading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i} className="border-b border-white/5">
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <Skeleton className="w-8 h-8 rounded-full" />
                          <div>
                            <Skeleton className="w-32 h-4 mb-1" />
                            <Skeleton className="w-20 h-3" />
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4"><Skeleton className="w-24 h-4" /></td>
                      <td className="py-4 px-4"><Skeleton className="w-16 h-5 rounded-full" /></td>
                      <td className="py-4 px-4 flex justify-end"><Skeleton className="w-20 h-4" /></td>
                    </tr>
                  ))
                ) : (
                  RECENT_STUDENTS.map((student) => (
                    <tr key={student.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors group">
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <img src={student.avatar} alt={student.name} className="w-8 h-8 rounded-full border border-white/10" referrerPolicy="no-referrer" />
                          <div>
                            <div className="font-medium text-white/90 group-hover:text-white transition-colors">{student.name}</div>
                            <div className="text-[11px] text-white/40 font-mono mt-0.5">{student.id}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-white/60">{student.program}</td>
                      <td className="py-4 px-4">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-[10px] font-medium uppercase tracking-wider border ${
                          student.status === 'Active' 
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                            : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                        }`}>
                          {t(`status.${student.status.toLowerCase()}`)}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-right text-white/40 text-xs whitespace-nowrap">{student.date}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* Quick Actions / Mini Widget */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="glass-card rounded-3xl p-6 flex flex-col"
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-display text-lg font-medium">{t('dash.quick_actions')}</h2>
            <button className="text-white/40 hover:text-white transition-colors">
              <MoreHorizontal className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 flex flex-col gap-3">
            {[
              { label: 'dash.generate_invoice', desc: 'Create a new manual invoice', icon: CreditCard },
              { label: 'dash.record_attendance', desc: 'Mark daily class attendance', icon: CalendarCheck },
              { label: 'dash.add_program', desc: 'Create a new academic program', icon: BookOpen },
            ].map((action, i) => (
              <button key={i} className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-[#fc0ce4]/5 hover:border-[#fc0ce4]/20 transition-all text-left group">
                <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/5 group-hover:bg-gradient-to-br group-hover:from-[#fc0ce4] group-hover:to-[#949ce4] group-hover:text-white group-hover:border-transparent transition-all">
                  <action.icon className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm font-medium text-white/90 group-hover:text-white transition-colors">{t(action.label)}</div>
                  <div className="text-xs text-white/40 mt-0.5">{action.desc}</div>
                </div>
              </button>
            ))}
          </div>
        </motion.div>

      </div>
    </div>
  );
}
