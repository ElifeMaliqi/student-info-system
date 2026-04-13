import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { Users, CalendarCheck, Award, ArrowUpRight, CheckCircle, Clock, MoreHorizontal } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useUser } from '../context/UserContext';
import { supabase } from '../lib/supabase';
import { Skeleton } from '../components/Skeleton';

interface TeacherStats {
  totalStudents: string;
  studentsTrend: string;
  upcomingClasses: string;
  avgGrade: string;
}

interface RecentGradeRow {
  id: string;
  studentName: string;
  className: string;
  points: string;
  date: string;
}

export default function TeacherDashboard() {
  const { t } = useLanguage();
  const { user } = useUser();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<TeacherStats>({ totalStudents: '0', studentsTrend: '', upcomingClasses: '0', avgGrade: '—' });
  const [recentGrades, setRecentGrades] = useState<RecentGradeRow[]>([]);

  useEffect(() => {
    if (!user) return;
    const teacherId = user.id;

    (async () => {
      try {
        // 1. Fetch classes and grade tables for this teacher
        const [classesRes, gradeTablesRes] = await Promise.all([
          supabase
            .from('classes')
            .select('id, title, program_id')
            .eq('teacher_id', teacherId),
          supabase
            .from('grade_tables')
            .select('id')
            .eq('teacher_id', teacherId),
        ]);

        const { data: classes } = classesRes;
        const { data: gradeTables } = gradeTablesRes;

        const classIds = (classes || []).map(c => c.id);
        const gradeTableIds = (gradeTables || []).map(g => g.id);

        // 2. Total unique students & upcoming classes
        let totalStudents = 0;
        let studentsTrend = '';
        let upcomingClasses = 0;
        if (classIds.length > 0) {
          const today = new Date();
          const jsDayToday = today.getDay();
          const remainingDays = new Set<number>();
          for (let jsDay = jsDayToday; jsDay <= 6; jsDay++) {
            remainingDays.add(jsDay === 0 ? 6 : jsDay - 1);
          }
          if (jsDayToday === 0) remainingDays.add(6);

          const [enrollmentsRes, sessionsRes] = await Promise.all([
            supabase
              .from('class_enrollments')
              .select('student_id')
              .in('class_id', classIds),
            supabase
              .from('class_sessions')
              .select('day_of_week, start_time')
              .in('class_id', classIds)
              .in('day_of_week', Array.from(remainingDays)),
          ]);

          const { data: enrollments } = enrollmentsRes;
          const { data: sessions } = sessionsRes;
          const uniqueStudents = new Set((enrollments || []).map(e => e.student_id));
          totalStudents = uniqueStudents.size;
          studentsTrend = `Across ${classIds.length} class${classIds.length !== 1 ? 'es' : ''}`;

          const dbDayToday = jsDayToday === 0 ? 6 : jsDayToday - 1;
          const nowTime = today.toTimeString().slice(0, 5);
          upcomingClasses = (sessions || []).filter(s => {
            if (s.day_of_week === dbDayToday) {
              return (s.start_time || '00:00') > nowTime;
            }
            return true;
          }).length;
        }

        // 3. Average grade & recent grades
        let avgGrade = '—';
        if (gradeTableIds.length > 0) {
          const [entriesRes, recentEntriesRes] = await Promise.all([
            supabase
              .from('grade_table_entries')
              .select('total_points')
              .in('grade_table_id', gradeTableIds)
              .not('total_points', 'is', null),
            supabase
              .from('grade_table_entries')
              .select('id, total_points, graded_at, student:profiles!grade_table_entries_student_id_fkey(first_name, last_name), grade_table:grade_tables!inner(name, class:classes(title))')
              .in('grade_table_id', gradeTableIds)
              .not('total_points', 'is', null)
              .order('graded_at', { ascending: false })
              .limit(5),
          ]);

          const { data: entries } = entriesRes;
          const { data: recentEntries } = recentEntriesRes;

          if (entries && entries.length > 0) {
            const avg = entries.reduce((sum, e) => sum + (parseFloat(e.total_points) || 0), 0) / entries.length;
            avgGrade = `${Math.round(avg)} pts`;
          }

          setRecentGrades((recentEntries || []).map((e: any) => ({
            id: e.id,
            studentName: e.student ? `${e.student.first_name} ${e.student.last_name}` : 'Unknown',
            className: e.grade_table?.class?.title || e.grade_table?.name || '—',
            points: `${e.total_points} pts`,
            date: e.graded_at ? new Date(e.graded_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—',
          })));
        }

        setStats({
          totalStudents: String(totalStudents),
          studentsTrend,
          upcomingClasses: String(upcomingClasses),
          avgGrade,
        });
      } catch (err) {
        console.error('Teacher dashboard error:', err);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [user]);

  const statCards = [
    { label: 'teacher.total_students', value: stats.totalStudents, trend: stats.studentsTrend, icon: Users, color: 'text-[#fc0ce4]' },
    { label: 'teacher.upcoming_classes', value: stats.upcomingClasses, trend: 'This week', icon: CalendarCheck, color: 'text-[#949ce4]' },
    { label: 'teacher.avg_grade', value: stats.avgGrade, trend: 'All classes', icon: Award, color: 'text-emerald-400' },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div>
        <h1 className="font-display text-3xl font-medium tracking-tight mb-1">{t('teacher.portal')}</h1>
        <p className="text-white/50 text-sm">{t('teacher.desc')}</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {statCards.map((stat, i) => (
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
                {stat.trend}
              </div>
            </div>
            <div>
              {isLoading ? <Skeleton className="w-16 h-8 mb-1" /> : (
                <div className="text-3xl font-display font-medium tracking-tight mb-1">{stat.value}</div>
              )}
              <div className="text-xs font-medium text-white/40 uppercase tracking-wider">{t(stat.label)}</div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Grades */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="lg:col-span-2 glass-card rounded-3xl p-6 overflow-hidden flex flex-col"
        >
          <div className="flex items-center justify-between mb-6 shrink-0">
            <h2 className="font-display text-lg font-medium">{t('teacher.recent_grades')}</h2>
            <button onClick={() => navigate('/grading')} className="text-xs font-medium text-white/50 hover:text-[#fc0ce4] flex items-center gap-1 transition-colors">
              {t('dash.view_all')} <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
          
          <div className="overflow-x-auto pb-4 custom-scrollbar flex-1 -mx-6 px-6">
            <table className="w-full text-left border-collapse min-w-[600px]">
              <thead>
                <tr className="border-b border-white/5 text-[11px] uppercase tracking-widest text-white/30">
                  <th className="pb-3 font-medium">{t('table.student')}</th>
                  <th className="pb-3 font-medium">{t('teacher.class')}</th>
                  <th className="pb-3 font-medium">{t('teacher.score')}</th>
                  <th className="pb-3 font-medium text-right">{t('table.date')}</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {isLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <tr key={i} className="border-b border-white/5">
                      <td className="py-4"><Skeleton className="w-40 h-4" /></td>
                      <td className="py-4"><Skeleton className="w-24 h-4" /></td>
                      <td className="py-4"><Skeleton className="w-16 h-5 rounded-full" /></td>
                      <td className="py-4 text-right"><Skeleton className="w-20 h-4" /></td>
                    </tr>
                  ))
                ) : recentGrades.length === 0 ? (
                  <tr><td colSpan={4} className="py-8 text-center text-white/30 text-sm">No grades yet</td></tr>
                ) : (
                  recentGrades.map((grade) => (
                  <tr key={grade.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors group">
                    <td className="py-4">
                      <div className="font-medium text-white/90 group-hover:text-white transition-colors">{grade.studentName}</div>
                    </td>
                    <td className="py-4 text-white/60">{grade.className}</td>
                    <td className="py-4">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-[10px] font-medium uppercase tracking-wider border ${
                        parseFloat(grade.points) >= 80 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 
                        parseFloat(grade.points) >= 60 ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                        'bg-amber-500/10 text-amber-400 border-amber-500/20'
                      }`}>
                        {grade.points}
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
              { label: 'teacher.grade_submissions', desc: 'Review and grade students', icon: Award, path: '/grading' },
              { label: 'dash.record_attendance', desc: 'Mark daily class attendance', icon: CalendarCheck, path: '/classes' },
              { label: 'teacher.message_class', desc: 'Send an announcement', icon: Users, path: '/announcements' },
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
