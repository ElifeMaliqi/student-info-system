import { motion } from 'motion/react';
import { BookOpen, CalendarCheck, CreditCard, Award, ArrowUpRight, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

const STATS = [
  { label: 'student.overall_grade', value: 'A-', trend: 'Top 10%', icon: Award, color: 'text-emerald-400' },
  { label: 'student.attendance', value: '98%', trend: 'Excellent', icon: CalendarCheck, color: 'text-blue-400' },
  { label: 'student.active_courses', value: '4', trend: 'This Semester', icon: BookOpen, color: 'text-purple-400' },
  { label: 'student.next_payment', value: '$1,200', trend: 'Due in 12 days', icon: CreditCard, color: 'text-amber-400' },
];

const RECENT_GRADES = [
  { id: 'QZ-001', course: 'UI/UX Fundamentals', title: 'Midterm Quiz', score: '94/100', date: 'Feb 20, 2026', status: 'Excellent' },
  { id: 'QZ-002', course: 'Design Systems', title: 'Component Architecture', score: '88/100', date: 'Feb 15, 2026', status: 'Good' },
  { id: 'AS-001', course: 'Prototyping', title: 'Interactive Prototype Assignment', score: '96/100', date: 'Feb 10, 2026', status: 'Excellent' },
];

const INVOICES = [
  { id: 'INV-2026-001', amount: '$1,200', status: 'Pending', date: 'Feb 01, 2026', due: 'Mar 01, 2026' },
  { id: 'INV-2025-012', amount: '$1,200', status: 'Paid', date: 'Jan 01, 2026', due: 'Jan 15, 2026' },
];

export default function StudentDashboard() {
  const { t } = useLanguage();

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
          <h1 className="font-display text-3xl font-medium tracking-tight mb-1">{t('student.welcome')}, Elena!</h1>
          <p className="text-white/50 text-sm">{t('student.desc')}</p>
        </div>
        <div className="text-sm font-medium text-[#fc0ce4] bg-[#fc0ce4]/10 px-4 py-2 rounded-full border border-[#fc0ce4]/20 self-start sm:self-auto">
          UI/UX Creative Designer
        </div>
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
                {RECENT_GRADES.map((grade) => (
                  <tr key={grade.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors group">
                    <td className="py-4">
                      <div className="font-medium text-white/90 group-hover:text-white transition-colors">{grade.title}</div>
                      <div className="text-[11px] text-white/40 mt-0.5">{grade.course}</div>
                    </td>
                    <td className="py-4">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-[10px] font-medium uppercase tracking-wider border ${
                        grade.status === 'Excellent' 
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                          : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                      }`}>
                        {grade.score}
                      </span>
                    </td>
                    <td className="py-4 text-right text-white/40 text-xs">{grade.date}</td>
                  </tr>
                ))}
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
                {INVOICES.map((invoice) => (
                  <tr key={invoice.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors group">
                    <td className="py-4">
                      <div className="font-mono text-white/90 group-hover:text-[#fc0ce4] transition-colors cursor-pointer">{invoice.id}</div>
                      <div className="text-[11px] text-white/40 mt-0.5">{invoice.date}</div>
                    </td>
                    <td className="py-4 font-medium text-white/90">{invoice.amount}</td>
                    <td className="py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium uppercase tracking-wider border ${
                        invoice.status === 'Paid' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 
                        'bg-amber-500/10 text-amber-400 border-amber-500/20'
                      }`}>
                        {invoice.status === 'Paid' ? <CheckCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                        {t(`status.${invoice.status.toLowerCase()}`)}
                      </span>
                    </td>
                    <td className="py-4 text-right text-white/60 text-xs">{invoice.due}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>

      </div>
    </div>
  );
}
