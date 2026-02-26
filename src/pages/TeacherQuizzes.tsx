import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { FileText, Plus, CheckCircle, Clock, CalendarCheck, Search, Filter, X } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

const QUIZZES = [
  { id: 'QZ-101', title: 'UI/UX Fundamentals Midterm', program: 'UI/UX Creative Designer', submissions: '24/28', date: 'Feb 20, 2026', status: 'Grading', type: 'Quiz' },
  { id: 'QZ-102', title: 'Component Architecture', program: 'Web Development', submissions: '18/18', date: 'Feb 15, 2026', status: 'Completed', type: 'Assignment' },
  { id: 'QZ-103', title: 'Cybersecurity Basics', program: 'Cybersecurity', submissions: '0/32', date: 'Feb 25, 2026', status: 'Scheduled', type: 'Quiz' },
  { id: 'EV-001', title: 'Guest Lecture: AI in Design', program: 'All Programs', submissions: '-', date: 'Mar 01, 2026', status: 'Scheduled', type: 'Event' },
  { id: 'AS-002', title: 'Final Project Phase 1', program: 'UI/UX Creative Designer', submissions: '28/28', date: 'Jan 28, 2026', status: 'Completed', type: 'Assignment' },
];

export default function TeacherQuizzes() {
  const [view, setView] = useState<'list' | 'create'>('list');
  const [gradingQuiz, setGradingQuiz] = useState<string | null>(null);
  const { t } = useLanguage();

  if (view === 'create') {
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
            onClick={() => setView('list')}
            className="px-4 py-2 rounded-xl border border-white/10 text-sm font-medium hover:bg-white/5 transition-colors"
          >
            {t('teacher.cancel')}
          </button>
        </div>

        <div className="glass-card rounded-3xl p-6 lg:p-8">
          <form className="space-y-8" onSubmit={(e) => { e.preventDefault(); setView('list'); }}>
            
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
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-medium tracking-tight mb-1">{t('nav.quizzes')}</h1>
          <p className="text-white/50 text-sm">Manage your assessments, assignments, and class events.</p>
        </div>
        <button 
          onClick={() => setView('create')}
          className="bg-gradient-to-r from-[#fc0ce4] to-[#949ce4] text-white px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 hover:opacity-90 transition-all shadow-[0_0_20px_rgba(252,12,228,0.2)] self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          {t('teacher.create_quiz')}
        </button>
      </div>

      <div className="glass-card rounded-3xl p-6 overflow-hidden flex flex-col">
        <div className="flex flex-col md:flex-row gap-4 justify-between mb-6 shrink-0">
          <div className="relative w-full md:w-96 group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 group-focus-within:text-[#fc0ce4] transition-colors" />
            <input 
              type="text" 
              placeholder="Search quizzes and events..." 
              className="w-full bg-white/5 border border-white/5 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#fc0ce4]/40 focus:bg-[#fc0ce4]/5 focus:shadow-[0_0_15px_rgba(252,12,228,0.1)] transition-all"
            />
          </div>
          <div className="flex gap-2">
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
                <th className="pb-3 font-medium">{t('teacher.title_program')}</th>
                <th className="pb-3 font-medium">Type</th>
                <th className="pb-3 font-medium">{t('teacher.submissions')}</th>
                <th className="pb-3 font-medium">{t('table.status')}</th>
                <th className="pb-3 font-medium text-right">{t('finance.due_date')}</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {QUIZZES.map((quiz) => (
                <tr key={quiz.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors group">
                  <td className="py-4">
                    <div className="font-medium text-white/90 group-hover:text-white transition-colors">{quiz.title}</div>
                    <div className="text-[11px] text-white/40 mt-0.5">{quiz.program}</div>
                  </td>
                  <td className="py-4 text-white/60">
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-[10px] font-medium uppercase tracking-wider border bg-white/5 text-white/60 border-white/10">
                      {quiz.type}
                    </span>
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
                  <td className="py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <span className="text-white/40 text-xs mr-2">{quiz.date}</span>
                      {quiz.status === 'Grading' && (
                        <button 
                          onClick={() => setGradingQuiz(quiz.id)}
                          className="bg-gradient-to-r from-[#fc0ce4] to-[#949ce4] text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:opacity-90 transition-all shadow-[0_0_10px_rgba(252,12,228,0.2)]"
                        >
                          Grade
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {gradingQuiz && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setGradingQuiz(null)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-[#0a0a0a] border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b border-white/5 flex items-center justify-between shrink-0">
                <div>
                  <h2 className="font-display text-xl font-medium">{t('teacher.grade_modal_title')}</h2>
                  <p className="text-sm text-white/50">{t('teacher.grade_modal_desc')}</p>
                </div>
                <button 
                  onClick={() => setGradingQuiz(null)}
                  className="p-2 hover:bg-white/5 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-white/60" />
                </button>
              </div>
              <div className="p-6 overflow-y-auto custom-scrollbar">
                <div className="space-y-4">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5">
                      <div className="flex items-center gap-3">
                        <img src={`https://picsum.photos/seed/${i}/100/100`} alt="Student" className="w-10 h-10 rounded-full border border-white/10" referrerPolicy="no-referrer" />
                        <div>
                          <div className="text-sm font-medium text-white/90">Student Name {i}</div>
                          <div className="text-xs text-white/40">Submitted: Feb 20, 2026 • 14:30</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <button className="text-xs text-[#fc0ce4] hover:underline font-medium">View Submission</button>
                        <div className="flex items-center gap-2">
                          <input type="number" className="glass-input w-20 px-3 py-2 rounded-lg text-sm text-center text-white" placeholder="0" />
                          <span className="text-white/40 text-sm">/ 100</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="p-6 border-t border-white/5 bg-white/[0.02] shrink-0 flex justify-end gap-4">
                <button 
                  onClick={() => setGradingQuiz(null)}
                  className="px-6 py-2.5 rounded-xl border border-white/10 text-sm font-medium hover:bg-white/5 transition-colors"
                >
                  {t('teacher.cancel')}
                </button>
                <button 
                  onClick={() => setGradingQuiz(null)}
                  className="bg-gradient-to-r from-[#fc0ce4] to-[#949ce4] text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition-all shadow-[0_0_20px_rgba(252,12,228,0.2)]"
                >
                  {t('teacher.save_grades')}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
