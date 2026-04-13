import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { Users, CalendarCheck, CreditCard, BookOpen, TrendingUp, ArrowUpRight, MoreHorizontal, AlertCircle } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { Skeleton } from '../components/Skeleton';
import { supabase } from '../lib/supabase';

interface DashStats {
  totalStudents: number;
  activePrograms: number;
  avgAttendance: number;
  monthlyRevenue: number;
}

interface RecentStudent {
  id: string;
  name: string;
  program: string;
  status: string;
  date: string;
  avatar: string;
}

interface AttentionData {
  pendingApplications: number;
  overdueInvoices: number;
  atRiskStudents: number;
}

export default function Dashboard() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<DashStats>({ totalStudents: 0, activePrograms: 0, avgAttendance: 0, monthlyRevenue: 0 });
  const [recentStudents, setRecentStudents] = useState<RecentStudent[]>([]);
  const [attention, setAttention] = useState<AttentionData>({ pendingApplications: 0, overdueInvoices: 0, atRiskStudents: 0 });

  useEffect(() => {
    const load = async () => {
      try {
        const now = new Date();
        const [studentRes, programRes, attendanceRes, paidRes, enrollmentsRes, pendingRes, overdueRes] = await Promise.all([
          supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'student'),
          supabase.from('programs').select('id', { count: 'exact', head: true }).eq('is_active', true),
          supabase.from('class_attendance').select('status, student_id'),
          supabase.from('invoices').select('amount').eq('status', 'paid').eq('month', now.getMonth() + 1).eq('year', now.getFullYear()),
          supabase
            .from('class_enrollments')
            .select('student_id, enrolled_at, status, class:classes(program_id)')
            .order('enrolled_at', { ascending: false })
            .limit(5),
          supabase.from('registration_applications').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
          supabase.from('invoices').select('id', { count: 'exact', head: true }).eq('status', 'overdue'),
        ]);

        const { count: studentCount } = studentRes;
        const { count: programCount } = programRes;
        const { data: attData } = attendanceRes;
        const { data: paidData } = paidRes;
        const { data: enrollments } = enrollmentsRes;
        const { count: pendingApps } = pendingRes;
        const { count: overdueInv } = overdueRes;

        let attTotal = 0, attPresent = 0;
        (attData || []).forEach((r: any) => { attTotal++; if (r.status === 'present' || r.status === 'late') attPresent++; });
        const avgAtt = attTotal > 0 ? Math.round((attPresent / attTotal) * 1000) / 10 : 0;
        const monthRev = (paidData || []).reduce((sum: number, r: any) => sum + parseFloat(r.amount), 0);

        setStats({ totalStudents: studentCount || 0, activePrograms: programCount || 0, avgAttendance: avgAtt, monthlyRevenue: monthRev });

        const studentIds = [...new Set((enrollments || []).map((e: any) => e.student_id))];
        const { data: profiles } = await supabase.from('profiles').select('id, first_name, last_name, avatar_url').in('id', studentIds.length ? studentIds : ['__none__']);
        const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));

        const recent: RecentStudent[] = [];
        const seen = new Set<string>();
        for (const e of (enrollments || [])) {
          if (seen.has(e.student_id)) continue;
          seen.add(e.student_id);
          const p = profileMap.get(e.student_id);
          if (!p) continue;
          recent.push({
            id: `STU-${e.student_id.slice(0, 8)}`,
            name: `${p.first_name} ${p.last_name}`,
            program: (e.class as any)?.program_id || 'N/A',
            status: e.status === 'active' ? 'Active' : 'Pending',
            date: new Date(e.enrolled_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
            avatar: p.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${e.student_id}`,
          });
        }
        setRecentStudents(recent);

        // At-risk students: attendance < 70%
        const attByStudent: Record<string, { total: number; present: number }> = {};
        (attData || []).forEach((r: any) => {
          const sid = r.student_id || 'unknown';
          if (!attByStudent[sid]) attByStudent[sid] = { total: 0, present: 0 };
          attByStudent[sid].total++;
          if (r.status === 'present' || r.status === 'late') attByStudent[sid].present++;
        });
        const atRisk = Object.values(attByStudent).filter(s => s.total > 0 && (s.present / s.total) < 0.7).length;

        setAttention({ pendingApplications: pendingApps || 0, overdueInvoices: overdueInv || 0, atRiskStudents: atRisk });
      } catch (err) {
        console.error('Dashboard load error:', err);
      } finally {
        setIsLoading(false);
      }
    };
    load();
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
          {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
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
          [
            { label: 'dash.total_students', value: stats.totalStudents.toLocaleString(), icon: Users, color: 'text-blue-400' },
            { label: 'dash.active_programs', value: String(stats.activePrograms), icon: BookOpen, color: 'text-purple-400' },
            { label: 'dash.avg_attendance', value: `${stats.avgAttendance}%`, icon: CalendarCheck, color: 'text-emerald-400' },
            { label: 'dash.monthly_revenue', value: `€${stats.monthlyRevenue.toLocaleString()}`, icon: CreditCard, color: 'text-amber-400' },
          ].map((stat, i) => (
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
            <div onClick={() => navigate('/registrations')} className="bg-black/20 rounded-2xl p-4 border border-white/5 flex items-center justify-between group cursor-pointer hover:bg-black/40 transition-colors">
              <div>
                <div className="text-2xl font-display font-medium text-white mb-1">{attention.pendingApplications}</div>
                <div className="text-xs text-white/50 uppercase tracking-wider">Pending Applications</div>
              </div>
              <ArrowUpRight className="w-4 h-4 text-white/20 group-hover:text-amber-400 transition-colors" />
            </div>
            <div onClick={() => navigate('/finance')} className="bg-black/20 rounded-2xl p-4 border border-white/5 flex items-center justify-between group cursor-pointer hover:bg-black/40 transition-colors">
              <div>
                <div className="text-2xl font-display font-medium text-white mb-1">{attention.overdueInvoices}</div>
                <div className="text-xs text-white/50 uppercase tracking-wider">Overdue Invoices</div>
              </div>
              <ArrowUpRight className="w-4 h-4 text-white/20 group-hover:text-amber-400 transition-colors" />
            </div>
            <div onClick={() => navigate('/attendance')} className="bg-black/20 rounded-2xl p-4 border border-white/5 flex items-center justify-between group cursor-pointer hover:bg-black/40 transition-colors">
              <div>
                <div className="text-2xl font-display font-medium text-white mb-1">{attention.atRiskStudents}</div>
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
                ) : recentStudents.length === 0 ? (
                  <tr><td colSpan={4} className="py-8 text-center text-white/30 text-sm">No recent enrollments</td></tr>
                ) : (
                  recentStudents.map((student) => (
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
              { label: 'dash.generate_invoice', desc: 'Create a new manual invoice', icon: CreditCard, path: '/finance' },
              { label: 'dash.record_attendance', desc: 'Mark daily class attendance', icon: CalendarCheck, path: '/attendance' },
              { label: 'dash.add_program', desc: 'Create a new academic program', icon: BookOpen, path: '/programs' },
            ].map((action, i) => (
              <button key={i} onClick={() => navigate(action.path)} className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-[#fc0ce4]/5 hover:border-[#fc0ce4]/20 transition-all text-left group">
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
