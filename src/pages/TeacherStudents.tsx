import { motion } from 'motion/react';
import { Search, Filter, MoreHorizontal, CheckCircle, Clock, XCircle } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

const STUDENTS = [
  { id: 'STU-001', name: 'Elena Rodriguez', email: 'elena.r@example.com', program: 'UI/UX Creative Designer', status: 'Active', grade: 'A-', attendance: '98%', avatar: 'https://picsum.photos/seed/elena/100/100' },
  { id: 'STU-002', name: 'Marcus Chen', email: 'marcus.c@example.com', program: 'Web Development', status: 'Active', grade: 'B+', attendance: '85%', avatar: 'https://picsum.photos/seed/marcus/100/100' },
  { id: 'STU-003', name: 'Sarah Jenkins', email: 'sarah.j@example.com', program: 'Cybersecurity', status: 'Active', grade: 'A', attendance: '92%', avatar: 'https://picsum.photos/seed/sarah/100/100' },
  { id: 'STU-004', name: 'David Kim', email: 'david.k@example.com', program: 'UAV Engineering Degree', status: 'Suspended', grade: 'C', attendance: '75%', avatar: 'https://picsum.photos/seed/david/100/100' },
  { id: 'STU-005', name: 'Aisha Patel', email: 'aisha.p@example.com', program: 'Digital Marketing with AI', status: 'Active', grade: 'A+', attendance: '100%', avatar: 'https://picsum.photos/seed/aisha/100/100' },
];

export default function TeacherStudents() {
  const { t } = useLanguage();

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-medium tracking-tight mb-1">{t('nav.my_students')}</h1>
          <p className="text-white/50 text-sm">View and manage students enrolled in your courses.</p>
        </div>
      </div>

      <div className="glass-card rounded-3xl p-6 overflow-hidden flex flex-col">
        <div className="flex flex-col md:flex-row gap-4 justify-between mb-6 shrink-0">
          <div className="relative w-full md:w-96 group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 group-focus-within:text-[#fc0ce4] transition-colors" />
            <input 
              type="text" 
              placeholder={t('students.search')} 
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
                <th className="pb-3 font-medium">{t('attendance.student_info')}</th>
                <th className="pb-3 font-medium">{t('table.program')}</th>
                <th className="pb-3 font-medium">{t('table.status')}</th>
                <th className="pb-3 font-medium">Current Grade</th>
                <th className="pb-3 font-medium">Attendance</th>
                <th className="pb-3 font-medium text-right">{t('table.action')}</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {STUDENTS.map((student) => (
                <tr key={student.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors group">
                  <td className="py-4">
                    <div className="flex items-center gap-3">
                      <img src={student.avatar} alt={student.name} className="w-10 h-10 rounded-full border border-white/10" referrerPolicy="no-referrer" />
                      <div>
                        <div className="font-medium text-white/90 group-hover:text-white transition-colors">{student.name}</div>
                        <div className="text-[11px] text-white/40 font-mono mt-0.5">{student.id} • {student.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 text-white/60">{student.program}</td>
                  <td className="py-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium uppercase tracking-wider border ${
                      student.status === 'Active' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 
                      student.status === 'Pending' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                      student.status === 'Graduated' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                      'bg-red-500/10 text-red-400 border-red-500/20'
                    }`}>
                      {student.status === 'Active' && <CheckCircle className="w-3 h-3" />}
                      {student.status === 'Pending' && <Clock className="w-3 h-3" />}
                      {student.status === 'Suspended' && <XCircle className="w-3 h-3" />}
                      {t(`status.${student.status.toLowerCase()}`)}
                    </span>
                  </td>
                  <td className="py-4 font-medium text-white/90">{student.grade}</td>
                  <td className="py-4 text-white/60">{student.attendance}</td>
                  <td className="py-4 text-right">
                    <button className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white/40 hover:text-white">
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
}
