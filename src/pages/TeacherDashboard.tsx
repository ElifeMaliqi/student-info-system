import { useState } from 'react';
import { motion } from 'motion/react';
import { Users, CalendarCheck, Award, BookOpen, Plus, ArrowUpRight, CheckCircle, Clock, FileText, MoreHorizontal } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

const STATS = [
  { label: 'teacher.total_students', value: '142', trend: 'Across 3 Programs', icon: Users, color: 'text-blue-400' },
  { label: 'teacher.upcoming_classes', value: '4', trend: 'This Week', icon: CalendarCheck, color: 'text-purple-400' },
  { label: 'teacher.avg_grade', value: '88%', trend: '+2.4%', icon: Award, color: 'text-emerald-400' },
  { label: 'teacher.active_quizzes', value: '2', trend: 'Needs Grading', icon: FileText, color: 'text-amber-400' },
];

const RECENT_QUIZZES = [
  { id: 'QZ-101', title: 'UI/UX Fundamentals Midterm', program: 'UI/UX Creative Designer', submissions: '24/28', date: 'Feb 20, 2026', status: 'Grading' },
  { id: 'QZ-102', title: 'Component Architecture', program: 'Web Development', submissions: '18/18', date: 'Feb 15, 2026', status: 'Completed' },
  { id: 'QZ-103', title: 'Cybersecurity Basics', program: 'Cybersecurity', submissions: '0/32', date: 'Feb 25, 2026', status: 'Scheduled' },
];

export default function TeacherDashboard() {
  const [view, setView] = useState<'dashboard' | 'create-quiz'>('dashboard');
  const { t } = useLanguage();

  if (view === 'create-quiz') {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-3xl font-medium tracking-tight mb-1">{t('teacher.new_quiz')}</h1>
            <p className="text-white/50 text-sm">{t('teacher.new_quiz_desc')}</p>
          </div>
          <button 
            onClick={() => setView('dashboard')}
            className="px-4 py-2 rounded-xl border border-white/10 text-sm font-medium hover:bg-white/5 transition-colors"
          >
            {t('teacher.cancel')}
          </button>
        </div>

        <div className="glass-card rounded-3xl p-6 lg:p-8">
          <form className="space-y-8" onSubmit={(e) => { e.preventDefault(); setView('dashboard'); }}>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2 md:col-span-2">
                <label className="text-[11px] font-semibold text-white/60 uppercase tracking-widest ml-1">{t('teacher.title')}</label>
                <input type="text" className="glass-input w-full px-4 py-3 rounded-xl text-sm text-white placeholder:text-white/20" placeholder="e.g. Midterm Exam" />
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-semibold text-white/60 uppercase tracking-widest ml-1">{t('teacher.type')}</label>
                <select className="glass-input w-full px-4 py-3 rounded-xl text-sm text-white bg-[#0a0a0a] appearance-none">
                  <option>{t('teacher.quiz')}</option>
                  <option>{t('teacher.assignment')}</option>
                  <option>{t('teacher.event')}</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-semibold text-white/60 uppercase tracking-widest ml-1">{t('teacher.program')}</label>
                <select className="glass-input w-full px-4 py-3 rounded-xl text-sm text-white bg-[#0a0a0a] appearance-none">
                  <option>UI/UX Creative Designer</option>
                  <option>Web Development</option>
                  <option>Cybersecurity</option>
                  <option>All My Students</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-semibold text-white/60 uppercase tracking-widest ml-1">{t('teacher.date')}</label>
                <input type="datetime-local" className="glass-input w-full px-4 py-3 rounded-xl text-sm text-white placeholder:text-white/20 [&::-webkit-calendar-picker-indicator]:filter [&::-webkit-calendar-picker-indicator]:invert" />
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-semibold text-white/60 uppercase tracking-widest ml-1">{t('teacher.max_score')}</label>
                <input type="number" className="glass-input w-full px-4 py-3 rounded-xl text-sm text-white placeholder:text-white/20" placeholder="100" defaultValue="100" />
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-[11px] font-semibold text-white/60 uppercase tracking-widest ml-1">{t('teacher.description')}</label>
                <textarea className="glass-input w-full px-4 py-3 rounded-xl text-sm text-white placeholder:text-white/20 h-32 resize-none" placeholder="Please complete all sections..." />
              </div>
            </div>

            <div className="flex justify-end gap-4 pt-6 border-t border-white/5">
              <button type="button" className="px-6 py-3 rounded-xl border border-white/10 text-sm font-medium hover:bg-white/5 transition-colors">
                {t('teacher.save_draft')}
              </button>
              <button type="submit" className="bg-gradient-to-r from-[#fc0ce4] to-[#949ce4] text-white px-6 py-3 rounded-xl text-sm font-semibold hover:opacity-90 transition-all shadow-[0_0_20px_rgba(252,12,228,0.2)]">
                {t('teacher.publish')}
              </button>
            </div>
          </form>
        </div>
      </motion.div>
    );
  }

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
          <h1 className="font-display text-3xl font-medium tracking-tight mb-1">{t('teacher.portal')}</h1>
          <p className="text-white/50 text-sm">{t('teacher.desc')}</p>
        </div>
        <button 
          onClick={() => setView('create-quiz')}
          className="bg-gradient-to-r from-[#fc0ce4] to-[#949ce4] text-white px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 hover:opacity-90 transition-all shadow-[0_0_20px_rgba(252,12,228,0.2)] self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          {t('teacher.create_quiz')}
        </button>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {STATS.map((stat, i) => (
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
              <div className="text-3xl font-display font-medium tracking-tight mb-1">{stat.value}</div>
              <div className="text-xs font-medium text-white/40 uppercase tracking-wider">{t(stat.label)}</div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Recent Quizzes */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="lg:col-span-2 glass-card rounded-3xl p-6 overflow-hidden flex flex-col"
        >
          <div className="flex items-center justify-between mb-6 shrink-0">
            <h2 className="font-display text-lg font-medium">{t('teacher.recent_quizzes')}</h2>
            <button className="text-xs font-medium text-white/50 hover:text-[#fc0ce4] flex items-center gap-1 transition-colors">
              {t('dash.view_all')} <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
          
          <div className="overflow-x-auto pb-4 custom-scrollbar flex-1 -mx-6 px-6">
            <table className="w-full text-left border-collapse min-w-[600px]">
              <thead>
                <tr className="border-b border-white/5 text-[11px] uppercase tracking-widest text-white/30">
                  <th className="pb-3 font-medium">{t('teacher.title_program')}</th>
                  <th className="pb-3 font-medium">{t('teacher.submissions')}</th>
                  <th className="pb-3 font-medium">{t('table.status')}</th>
                  <th className="pb-3 font-medium text-right">{t('finance.due_date')}</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {RECENT_QUIZZES.map((quiz) => (
                  <tr key={quiz.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors group">
                    <td className="py-4">
                      <div className="font-medium text-white/90 group-hover:text-white transition-colors">{quiz.title}</div>
                      <div className="text-[11px] text-white/40 mt-0.5">{quiz.program}</div>
                    </td>
                    <td className="py-4 font-medium text-white/90">{quiz.submissions}</td>
                    <td className="py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium uppercase tracking-wider border ${
                        quiz.status === 'Completed' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 
                        quiz.status === 'Grading' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                        'bg-blue-500/10 text-blue-400 border-blue-500/20'
                      }`}>
                        {quiz.status === 'Completed' && <CheckCircle className="w-3 h-3" />}
                        {quiz.status === 'Grading' && <Clock className="w-3 h-3" />}
                        {quiz.status === 'Scheduled' && <CalendarCheck className="w-3 h-3" />}
                        {t(`status.${quiz.status.toLowerCase()}`)}
                      </span>
                    </td>
                    <td className="py-4 text-right text-white/40 text-xs">{quiz.date}</td>
                  </tr>
                ))}
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
              { label: 'teacher.grade_submissions', desc: '24 pending reviews', icon: Award },
              { label: 'dash.record_attendance', desc: 'Mark daily class attendance', icon: CalendarCheck },
              { label: 'teacher.message_class', desc: 'Send an announcement', icon: Users },
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
