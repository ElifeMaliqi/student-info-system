import { motion } from 'motion/react';
import { Award, BookOpen, CheckCircle, Clock } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

const GRADES = [
  { id: 'QZ-001', course: 'UI/UX Fundamentals', title: 'Midterm Quiz', score: '94/100', percentage: 94, date: 'Feb 20, 2026', status: 'Excellent', type: 'Quiz' },
  { id: 'QZ-002', course: 'Design Systems', title: 'Component Architecture', score: '88/100', percentage: 88, date: 'Feb 15, 2026', status: 'Good', type: 'Quiz' },
  { id: 'AS-001', course: 'Prototyping', title: 'Interactive Prototype Assignment', score: '96/100', percentage: 96, date: 'Feb 10, 2026', status: 'Excellent', type: 'Assignment' },
  { id: 'PR-001', course: 'UI/UX Fundamentals', title: 'Final Project Phase 1', score: '85/100', percentage: 85, date: 'Jan 28, 2026', status: 'Good', type: 'Project' },
  { id: 'QZ-003', course: 'User Research', title: 'Survey Methods', score: '92/100', percentage: 92, date: 'Jan 15, 2026', status: 'Excellent', type: 'Quiz' },
];

export default function StudentGrades() {
  const { t } = useLanguage();

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-medium tracking-tight mb-1">{t('nav.grades')}</h1>
          <p className="text-white/50 text-sm">View your academic performance and assessment history.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="glass-card p-5 rounded-2xl flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
            <Award className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <div className="text-2xl font-display font-medium tracking-tight mb-0.5">91%</div>
            <div className="text-[11px] font-medium text-white/40 uppercase tracking-wider">Overall Average</div>
          </div>
        </div>
        <div className="glass-card p-5 rounded-2xl flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20">
            <BookOpen className="w-6 h-6 text-purple-400" />
          </div>
          <div>
            <div className="text-2xl font-display font-medium tracking-tight mb-0.5">5</div>
            <div className="text-[11px] font-medium text-white/40 uppercase tracking-wider">Assessments Completed</div>
          </div>
        </div>
        <div className="glass-card p-5 rounded-2xl flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
            <CheckCircle className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <div className="text-2xl font-display font-medium tracking-tight mb-0.5">A-</div>
            <div className="text-[11px] font-medium text-white/40 uppercase tracking-wider">Current Grade</div>
          </div>
        </div>
      </div>

      <div className="glass-card rounded-3xl p-6 overflow-hidden flex flex-col">
        <div className="overflow-x-auto pb-4 custom-scrollbar flex-1 -mx-6 px-6">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="border-b border-white/5 text-[11px] uppercase tracking-widest text-white/30">
                <th className="pb-3 font-medium">{t('student.assessment')}</th>
                <th className="pb-3 font-medium">Course</th>
                <th className="pb-3 font-medium">Type</th>
                <th className="pb-3 font-medium">{t('student.score')}</th>
                <th className="pb-3 font-medium text-right">{t('table.date')}</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {GRADES.map((grade) => (
                <tr key={grade.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors group">
                  <td className="py-4">
                    <div className="font-medium text-white/90 group-hover:text-white transition-colors">{grade.title}</div>
                    <div className="text-[11px] text-white/40 mt-0.5">{grade.id}</div>
                  </td>
                  <td className="py-4 text-white/60">{grade.course}</td>
                  <td className="py-4">
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-[10px] font-medium uppercase tracking-wider border bg-white/5 text-white/60 border-white/10">
                      {grade.type}
                    </span>
                  </td>
                  <td className="py-4">
                    <div className="flex items-center gap-3">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-[10px] font-medium uppercase tracking-wider border ${
                        grade.status === 'Excellent' 
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                          : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                      }`}>
                        {grade.score}
                      </span>
                      <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden hidden sm:block">
                        <div 
                          className={`h-full rounded-full ${grade.percentage >= 90 ? 'bg-emerald-400' : 'bg-blue-400'}`}
                          style={{ width: `${grade.percentage}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="py-4 text-right text-white/40 text-xs">{grade.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
}
