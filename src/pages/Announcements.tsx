import { useState } from 'react';
import { motion } from 'motion/react';
import { Megaphone, Plus, Users, Calendar, Clock } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

const ANNOUNCEMENTS = [
  { id: 1, title: 'Welcome to Spring Semester 2026', message: 'We are excited to welcome everyone back to campus. Please ensure your registration is complete by Friday.', author: 'Sarah Connor', role: 'Admin', date: 'Feb 23, 2026', time: '09:00 AM', audience: 'All Users' },
  { id: 2, title: 'UI/UX Guest Lecture', message: 'Join us this Thursday for a special guest lecture from a senior designer at Google. Attendance is mandatory for UI/UX students.', author: 'Prof. Alan Turing', role: 'Teacher', date: 'Feb 21, 2026', time: '14:30 PM', audience: 'UI/UX Creative Designer' },
  { id: 3, title: 'System Maintenance Notice', message: 'The student portal will be down for scheduled maintenance this Sunday from 2 AM to 4 AM.', author: 'System Admin', role: 'Admin', date: 'Feb 18, 2026', time: '10:15 AM', audience: 'All Users' },
];

export default function Announcements({ role }: { role: 'admin' | 'teacher' | 'student' }) {
  const [view, setView] = useState<'list' | 'create'>('list');
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
            <h1 className="font-display text-3xl font-medium tracking-tight mb-1">{t('announcements.new')}</h1>
            <p className="text-white/50 text-sm">Create a new announcement to broadcast to students or staff.</p>
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
            
            <div className="grid grid-cols-1 gap-6">
              <div className="space-y-2">
                <label className="text-[11px] font-semibold text-white/60 uppercase tracking-widest ml-1">{t('announcements.msg_title')}</label>
                <input type="text" className="glass-input w-full px-4 py-3 rounded-xl text-sm text-white placeholder:text-white/20" placeholder="e.g. Important Update" required />
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-semibold text-white/60 uppercase tracking-widest ml-1">{t('announcements.audience')}</label>
                <select className="glass-input w-full px-4 py-3 rounded-xl text-sm text-white bg-[#0a0a0a] appearance-none">
                  <option>All Users</option>
                  <option>All Students</option>
                  <option>UI/UX Creative Designer</option>
                  <option>Web Development</option>
                  <option>Cybersecurity</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-semibold text-white/60 uppercase tracking-widest ml-1">{t('announcements.message')}</label>
                <textarea className="glass-input w-full px-4 py-3 rounded-xl text-sm text-white placeholder:text-white/20 h-40 resize-none" placeholder="Write your announcement here..." required />
              </div>
            </div>

            <div className="flex justify-end pt-6 border-t border-white/5">
              <button type="submit" className="bg-gradient-to-r from-[#fc0ce4] to-[#949ce4] text-white px-6 py-3 rounded-xl text-sm font-semibold hover:opacity-90 transition-all shadow-[0_0_20px_rgba(252,12,228,0.2)]">
                {t('announcements.publish')}
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
          <h1 className="font-display text-3xl font-medium tracking-tight mb-1">{t('announcements.title')}</h1>
          <p className="text-white/50 text-sm">{t('announcements.desc')}</p>
        </div>
        {(role === 'admin' || role === 'teacher') && (
          <button 
            onClick={() => setView('create')}
            className="bg-gradient-to-r from-[#fc0ce4] to-[#949ce4] text-white px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 hover:opacity-90 transition-all shadow-[0_0_20px_rgba(252,12,228,0.2)] self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            {t('announcements.new')}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4">
        {ANNOUNCEMENTS.map((announcement) => (
          <div key={announcement.id} className="glass-card rounded-2xl p-6 hover:bg-white/[0.02] transition-colors group">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center border border-white/5 shrink-0 group-hover:bg-[#fc0ce4]/10 group-hover:border-[#fc0ce4]/20 transition-all">
                <Megaphone className="w-6 h-6 text-white/40 group-hover:text-[#fc0ce4] transition-colors" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                  <h3 className="text-lg font-medium text-white/90">{announcement.title}</h3>
                  <div className="flex items-center gap-3 text-xs text-white/40">
                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {announcement.date}</span>
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {announcement.time}</span>
                  </div>
                </div>
                <p className="text-sm text-white/60 leading-relaxed mb-4">{announcement.message}</p>
                <div className="flex items-center gap-4 text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-bold">
                      {announcement.author.charAt(0)}
                    </div>
                    <span className="font-medium text-white/70">{announcement.author}</span>
                    <span className="text-white/30 px-1">•</span>
                    <span className="text-white/40">{announcement.role}</span>
                  </div>
                  <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/5 border border-white/5 text-white/50">
                    <Users className="w-3 h-3" />
                    {announcement.audience}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
