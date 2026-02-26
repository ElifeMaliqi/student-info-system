import { motion } from 'motion/react';
import { ArrowLeft, Mail, Phone, MapPin, Calendar, BookOpen, CreditCard, Award, Edit2 } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';

// Mock data - in a real app this would come from an API based on the ID
const STUDENT_DATA = {
  id: 'STU-001',
  name: 'Elena Rodriguez',
  email: 'elena.r@example.com',
  phone: '+1 (555) 123-4567',
  address: '123 Innovation Drive, Tech City, TC 90210',
  program: 'UI/UX Creative Designer',
  status: 'Active',
  date: 'Feb 23, 2026',
  avatar: 'https://picsum.photos/seed/elena/200/200',
  attendance: 98,
  grade: 'A',
  finance: {
    total: '$5,000',
    paid: '$2,500',
    balance: '$2,500'
  },
  recentGrades: [
    { course: 'Design Thinking', score: 95, date: 'Feb 20, 2026' },
    { course: 'UI Fundamentals', score: 92, date: 'Feb 15, 2026' },
    { course: 'Prototyping', score: 98, date: 'Feb 10, 2026' }
  ]
};

export default function StudentProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useLanguage();

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 max-w-5xl mx-auto"
    >
      {/* Header Actions */}
      <div className="flex items-center justify-between">
        <button 
          onClick={() => navigate('/students')}
          className="flex items-center gap-2 text-sm font-medium text-white/60 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          {t('profile.back')}
        </button>
        <button className="px-4 py-2 rounded-xl border border-white/10 text-sm font-medium hover:bg-white/5 transition-colors flex items-center gap-2">
          <Edit2 className="w-4 h-4" />
          {t('profile.edit')}
        </button>
      </div>

      {/* Main Profile Card */}
      <div className="glass-card rounded-3xl p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-[#fc0ce4]/10 to-transparent rounded-bl-full pointer-events-none" />
        
        <div className="flex flex-col md:flex-row gap-8 items-start relative z-10">
          <img 
            src={STUDENT_DATA.avatar} 
            alt={STUDENT_DATA.name} 
            className="w-32 h-32 rounded-2xl border-4 border-white/10 object-cover shadow-2xl"
            referrerPolicy="no-referrer"
          />
          
          <div className="flex-1 space-y-4">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="font-display text-3xl font-medium tracking-tight text-white">{STUDENT_DATA.name}</h1>
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-medium uppercase tracking-wider border ${
                  STUDENT_DATA.status === 'Active' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 
                  'bg-amber-500/10 text-amber-400 border-amber-500/20'
                }`}>
                  {t(`status.${STUDENT_DATA.status.toLowerCase()}`)}
                </span>
              </div>
              <p className="text-white/50 font-mono text-sm">{STUDENT_DATA.id}</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-white/5">
              <div className="flex items-center gap-3 text-sm text-white/70">
                <Mail className="w-4 h-4 text-white/40" />
                {STUDENT_DATA.email}
              </div>
              <div className="flex items-center gap-3 text-sm text-white/70">
                <Phone className="w-4 h-4 text-white/40" />
                {STUDENT_DATA.phone}
              </div>
              <div className="flex items-center gap-3 text-sm text-white/70 sm:col-span-2">
                <MapPin className="w-4 h-4 text-white/40" />
                {STUDENT_DATA.address}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Academic Info */}
        <div className="md:col-span-2 space-y-6">
          <div className="glass-card rounded-3xl p-6">
            <h2 className="font-display text-lg font-medium mb-6 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-[#fc0ce4]" />
              {t('profile.academic_info')}
            </h2>
            
            <div className="grid grid-cols-2 gap-4 mb-8">
              <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                <div className="text-[10px] font-semibold text-white/40 uppercase tracking-widest mb-1">{t('profile.program')}</div>
                <div className="text-sm font-medium text-white/90">{STUDENT_DATA.program}</div>
              </div>
              <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                <div className="text-[10px] font-semibold text-white/40 uppercase tracking-widest mb-1">{t('profile.enrollment_date')}</div>
                <div className="text-sm font-medium text-white/90">{STUDENT_DATA.date}</div>
              </div>
              <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                <div className="text-[10px] font-semibold text-white/40 uppercase tracking-widest mb-1">{t('profile.attendance_rate')}</div>
                <div className="text-2xl font-display font-medium text-emerald-400">{STUDENT_DATA.attendance}%</div>
              </div>
              <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                <div className="text-[10px] font-semibold text-white/40 uppercase tracking-widest mb-1">{t('profile.current_grade')}</div>
                <div className="text-2xl font-display font-medium text-[#fc0ce4]">{STUDENT_DATA.grade}</div>
              </div>
            </div>

            <h3 className="text-sm font-medium text-white/60 mb-4">{t('student.recent_grades')}</h3>
            <div className="space-y-3">
              {STUDENT_DATA.recentGrades.map((grade, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5">
                  <div>
                    <div className="text-sm font-medium text-white/90">{grade.course}</div>
                    <div className="text-[11px] text-white/40 mt-0.5">{grade.date}</div>
                  </div>
                  <div className="text-sm font-bold text-emerald-400">{grade.score}%</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Financial Info */}
        <div className="space-y-6">
          <div className="glass-card rounded-3xl p-6">
            <h2 className="font-display text-lg font-medium mb-6 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-amber-400" />
              {t('profile.financial_info')}
            </h2>
            
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-white/60">{t('profile.total_invoiced')}</span>
                  <span className="font-medium text-white">{STUDENT_DATA.finance.total}</span>
                </div>
                <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-white/20 w-full" />
                </div>
              </div>
              
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-white/60">{t('profile.total_paid')}</span>
                  <span className="font-medium text-emerald-400">{STUDENT_DATA.finance.paid}</span>
                </div>
                <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-400 w-1/2" />
                </div>
              </div>

              <div className="pt-4 border-t border-white/5">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-white/60">{t('profile.outstanding_balance')}</span>
                  <span className="text-xl font-display font-medium text-amber-400">{STUDENT_DATA.finance.balance}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
