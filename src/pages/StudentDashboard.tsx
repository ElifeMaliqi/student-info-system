import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { BookOpen, CalendarCheck, CreditCard, Award, ArrowUpRight, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useUser } from '../context/UserContext';
import { supabase } from '../lib/supabase';
import { Skeleton } from '../components/Skeleton';

interface StudentStats {
  overallGrade: string;
  attendanceRate: number;
  activeCourses: number;
  nextPaymentAmount: number;
  nextPaymentDue: string;
}

interface RecentGradeRow {
  id: string;
  title: string;
  className: string;
  score: string;
  date: string;
  status: string;
}

interface InvoiceRow {
  id: string;
  title: string;
  amount: string;
  status: string;
  date: string;
  due: string;
}

export default function StudentDashboard() {
  const { t } = useLanguage();
  const { user } = useUser();
  const [isLoading, setIsLoading] = useState(true);
  const [program, setProgram] = useState<string | null>(null);
  const [stats, setStats] = useState<StudentStats>({ overallGrade: 'N/A', attendanceRate: 0, activeCourses: 0, nextPaymentAmount: 0, nextPaymentDue: '' });
  const [recentGrades, setRecentGrades] = useState<RecentGradeRow[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      try {
        // Enrollments (active courses + program)
        const { data: enrollments } = await supabase
          .from('class_enrollments')
          .select('class:classes(title, program_id)')
          .eq('student_id', user.id)
          .eq('status', 'active');
        const courses = enrollments || [];
        if (courses.length > 0) {
          const prog = (courses[0].class as any)?.program_id;
          if (prog) setProgram(prog);
        }

        // Attendance
        const { data: attData } = await supabase.from('class_attendance').select('status').eq('student_id', user.id);
        let attTotal = 0, attPresent = 0;
        (attData || []).forEach((r: any) => { attTotal++; if (r.status === 'present' || r.status === 'late') attPresent++; });
        const attendanceRate = attTotal > 0 ? Math.round((attPresent / attTotal) * 100) : 0;

        // Grade table entries for this student
        const { data: gradeEntries } = await supabase
          .from('grade_table_entries')
          .select(`
            id, total_points, passed, graded_at,
            grade_table:grade_tables!grade_table_entries_grade_table_id_fkey(
              name,
              class:classes!grade_tables_class_id_fkey(title)
            )
          `)
          .eq('student_id', user.id)
          .not('total_points', 'is', null)
          .order('graded_at', { ascending: false })
          .limit(5);

        const gradeRows: RecentGradeRow[] = (gradeEntries || []).map((e: any) => {
          const pts = parseFloat(e.total_points);
          return {
            id: e.id,
            title: e.grade_table?.name || 'Exam',
            className: e.grade_table?.class?.title || '',
            score: `${pts} pts`,
            date: e.graded_at ? new Date(e.graded_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '',
            status: pts >= 90 ? 'excellent' : pts >= 70 ? 'good' : 'needs_improvement',
          };
        });
        setRecentGrades(gradeRows);

        // Compute overall grade from all entries (show as avg pts)
        const allPts = (gradeEntries || []).filter((e: any) => e.total_points != null).map((e: any) => parseFloat(e.total_points));
        let overallGrade = 'N/A';
        if (allPts.length > 0) {
          const avg = Math.round(allPts.reduce((a: number, b: number) => a + b, 0) / allPts.length);
          overallGrade = `${avg} pts`;
        }

        // Invoices
        const { data: invData } = await supabase
          .from('invoices')
          .select('id, title, amount, status, due_date, month, year')
          .eq('student_id', user.id)
          .order('year', { ascending: false })
          .order('month', { ascending: false })
          .limit(5);

        const fmt = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        const invRows: InvoiceRow[] = (invData || []).map((inv: any) => ({
          id: inv.id.slice(0, 8).toUpperCase(),
          title: inv.title,
          amount: `€${parseFloat(inv.amount).toLocaleString()}`,
          status: inv.status === 'paid' ? 'paid' : inv.status === 'overdue' ? 'overdue' : 'pending',
          date: inv.title,
          due: inv.due_date ? fmt(inv.due_date) : '',
        }));
        setInvoices(invRows);

        // Next payment
        const unpaid = (invData || []).filter((inv: any) => inv.status !== 'paid').sort((a: any, b: any) => (a.due_date || '').localeCompare(b.due_date || ''));
        const next = unpaid[0];
        const nextAmt = next ? parseFloat(next.amount) : 0;
        const nextDue = next?.due_date ? (() => {
          const diff = Math.ceil((new Date(next.due_date + 'T12:00:00').getTime() - Date.now()) / 86400000);
          return diff > 0 ? t('student.due_in_days').replace('{n}', String(diff)) : diff === 0 ? t('student.due_today') : t('student.days_overdue').replace('{n}', String(Math.abs(diff)));
        })() : '';

        setStats({ overallGrade, attendanceRate, activeCourses: courses.length, nextPaymentAmount: nextAmt, nextPaymentDue: nextDue });
      } catch (err) {
        console.error('StudentDashboard load error:', err);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [user]);

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
          <h1 className="font-display text-3xl font-medium tracking-tight mb-1">{t('student.welcome')}, {user?.firstName || 'Student'}!</h1>
          <p className="text-white/50 text-sm">{t('student.desc')}</p>
        </div>
        {program && (
          <div className="text-sm font-medium text-[#fc0ce4] bg-[#fc0ce4]/10 px-4 py-2 rounded-full border border-[#fc0ce4]/20 self-start sm:self-auto">
            {program}
          </div>
        )}
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
            { label: 'student.overall_grade', value: stats.overallGrade, trend: '', icon: Award, color: 'text-emerald-400' },
            { label: 'student.attendance', value: `${stats.attendanceRate}%`, trend: stats.attendanceRate >= 90 ? 'student.grade_excellent' : stats.attendanceRate >= 70 ? 'student.grade_good' : 'student.grade_needs_improvement', icon: CalendarCheck, color: 'text-blue-400' },
            { label: 'student.active_courses', value: String(stats.activeCourses), trend: '', icon: BookOpen, color: 'text-purple-400' },
            { label: 'student.next_payment', value: stats.nextPaymentAmount ? `€${stats.nextPaymentAmount.toLocaleString()}` : t('common.none'), trend: stats.nextPaymentDue, icon: CreditCard, color: 'text-amber-400' },
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
              <div className="flex items-center gap-1 text-[11px] font-medium text-white/40 bg-white/5 px-2 py-1 rounded-full">
                {stat.trend ? t(stat.trend) : ''}
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

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Recent Grades */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="glass-card rounded-3xl p-6 overflow-hidden flex flex-col"
        >
          <div className="flex items-center justify-between mb-6 shrink-0">
            <h2 className="font-display text-lg font-medium">{t('student.recent_grades')}</h2>
            <button className="text-xs font-medium text-white/50 hover:text-[#fc0ce4] flex items-center gap-1 transition-colors">
              {t('dash.view_all')} <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
          
          <div className="overflow-x-auto pb-4 custom-scrollbar flex-1 -mx-6 px-6">
            <table className="w-full text-left border-collapse min-w-[400px]">
              <thead>
                <tr className="border-b border-white/5 text-[11px] uppercase tracking-widest text-white/30">
                  <th className="pb-3 font-medium">{t('student.assessment')}</th>
                  <th className="pb-3 font-medium">{t('student.score')}</th>
                  <th className="pb-3 font-medium text-right">{t('table.date')}</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {isLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <tr key={i} className="border-b border-white/5">
                      <td className="py-4"><Skeleton className="w-32 h-4" /></td>
                      <td className="py-4"><Skeleton className="w-16 h-5 rounded-full" /></td>
                      <td className="py-4 text-right"><Skeleton className="w-20 h-4" /></td>
                    </tr>
                  ))
                ) : recentGrades.length === 0 ? (
                  <tr><td colSpan={3} className="py-8 text-center text-white/30 text-sm">{t('student.no_grades')}</td></tr>
                ) : (
                  recentGrades.map((grade) => (
                  <tr key={grade.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors group">
                    <td className="py-4">
                      <div className="font-medium text-white/90 group-hover:text-white transition-colors">{grade.title}</div>
                      <div className="text-[11px] text-white/40 mt-0.5">{grade.className}</div>
                    </td>
                    <td className="py-4">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-[10px] font-medium uppercase tracking-wider border ${
                        grade.status === 'excellent' 
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                          : grade.status === 'good'
                          ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                          : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                      }`}>
                        {grade.score}
                      </span>
                    </td>
                    <td className="py-4 text-right text-white/40 text-xs">{grade.date}</td>
                  </tr>
                ))
                )}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* Invoices */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="glass-card rounded-3xl p-6 overflow-hidden flex flex-col"
        >
          <div className="flex items-center justify-between mb-6 shrink-0">
            <h2 className="font-display text-lg font-medium">{t('student.my_invoices')}</h2>
            <button className="text-xs font-medium text-white/50 hover:text-[#fc0ce4] flex items-center gap-1 transition-colors">
              {t('dash.view_all')} <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>

          <div className="overflow-x-auto pb-4 custom-scrollbar flex-1 -mx-6 px-6">
            <table className="w-full text-left border-collapse min-w-[400px]">
              <thead>
                <tr className="border-b border-white/5 text-[11px] uppercase tracking-widest text-white/30">
                  <th className="pb-3 font-medium">{t('finance.invoice_id')}</th>
                  <th className="pb-3 font-medium">{t('finance.amount')}</th>
                  <th className="pb-3 font-medium">{t('table.status')}</th>
                  <th className="pb-3 font-medium text-right">{t('finance.due_date')}</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {isLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <tr key={i} className="border-b border-white/5">
                      <td className="py-4"><Skeleton className="w-24 h-4" /></td>
                      <td className="py-4"><Skeleton className="w-16 h-4" /></td>
                      <td className="py-4"><Skeleton className="w-16 h-5 rounded-full" /></td>
                      <td className="py-4 text-right"><Skeleton className="w-20 h-4" /></td>
                    </tr>
                  ))
                ) : invoices.length === 0 ? (
                  <tr><td colSpan={4} className="py-8 text-center text-white/30 text-sm">{t('student.no_invoices')}</td></tr>
                ) : (
                  invoices.map((invoice) => (
                  <tr key={invoice.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors group">
                    <td className="py-4">
                      <div className="font-mono text-white/90 group-hover:text-[#fc0ce4] transition-colors cursor-pointer">{invoice.id.slice(0, 8)}</div>
                      <div className="text-[11px] text-white/40 mt-0.5">{invoice.date}</div>
                    </td>
                    <td className="py-4 font-medium text-white/90">{invoice.amount}</td>
                    <td className="py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium uppercase tracking-wider border ${
                        invoice.status === 'paid' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 
                        invoice.status === 'overdue' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                        'bg-amber-500/10 text-amber-400 border-amber-500/20'
                      }`}>
                        {invoice.status === 'paid' ? <CheckCircle className="w-3 h-3" /> : invoice.status === 'overdue' ? <AlertCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                        {t(`status.${invoice.status}`)}
                      </span>
                    </td>
                    <td className="py-4 text-right text-white/60 text-xs">{invoice.due}</td>
                  </tr>
                ))
                )}
              </tbody>
            </table>
          </div>
        </motion.div>

      </div>
    </div>
  );
}
