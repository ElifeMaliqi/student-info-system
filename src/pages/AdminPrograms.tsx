import { useState } from 'react';
import { motion } from 'motion/react';
import { BookOpen, Plus, Users, DollarSign, Clock, MoreHorizontal } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { PROGRAM_DETAILS } from '../constants/programs';

export default function AdminPrograms() {
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
            <h1 className="font-display text-3xl font-medium tracking-tight mb-1">{t('programs.new')}</h1>
            <p className="text-white/50 text-sm">Create a new academic program and set its pricing.</p>
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
                <label className="text-[11px] font-semibold text-white/60 uppercase tracking-widest ml-1">{t('programs.name')}</label>
                <input type="text" className="glass-input w-full px-4 py-3 rounded-xl text-sm text-white placeholder:text-white/20" placeholder="e.g. Data Science Bootcamp" required />
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-semibold text-white/60 uppercase tracking-widest ml-1">{t('programs.price')}</label>
                <input type="number" className="glass-input w-full px-4 py-3 rounded-xl text-sm text-white placeholder:text-white/20" placeholder="0.00" required />
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-semibold text-white/60 uppercase tracking-widest ml-1">{t('programs.duration')}</label>
                <input type="number" className="glass-input w-full px-4 py-3 rounded-xl text-sm text-white placeholder:text-white/20" placeholder="6" required />
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-[11px] font-semibold text-white/60 uppercase tracking-widest ml-1">{t('teacher.description')}</label>
                <textarea className="glass-input w-full px-4 py-3 rounded-xl text-sm text-white placeholder:text-white/20 h-32 resize-none" placeholder="Program overview and curriculum details..." />
              </div>
            </div>

            <div className="flex justify-end pt-6 border-t border-white/5">
              <button type="submit" className="bg-gradient-to-r from-[#fc0ce4] to-[#949ce4] text-white px-6 py-3 rounded-xl text-sm font-semibold hover:opacity-90 transition-all shadow-[0_0_20px_rgba(252,12,228,0.2)]">
                {t('programs.save')}
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
          <h1 className="font-display text-3xl font-medium tracking-tight mb-1">{t('programs.title')}</h1>
          <p className="text-white/50 text-sm">{t('programs.desc')}</p>
        </div>
        <button 
          onClick={() => setView('create')}
          className="bg-gradient-to-r from-[#fc0ce4] to-[#949ce4] text-white px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 hover:opacity-90 transition-all shadow-[0_0_20px_rgba(252,12,228,0.2)] self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          {t('programs.new')}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {PROGRAM_DETAILS.map((program) => (
          <div key={program.id} className="glass-card rounded-2xl p-6 hover:bg-white/[0.02] transition-colors group flex flex-col">
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center border border-white/5 group-hover:bg-[#fc0ce4]/10 group-hover:border-[#fc0ce4]/20 transition-all">
                <BookOpen className="w-6 h-6 text-white/40 group-hover:text-[#fc0ce4] transition-colors" />
              </div>
              <button className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white/40 hover:text-white">
                <MoreHorizontal className="w-4 h-4" />
              </button>
            </div>
            <h3 className="text-lg font-medium text-white/90 mb-1">{program.name}</h3>
            <div className="text-[11px] text-white/40 font-mono mb-4">{program.id}</div>
            
            <div className="grid grid-cols-2 gap-4 mt-auto">
              <div className="flex items-center gap-2 text-sm text-white/60">
                <DollarSign className="w-4 h-4 text-emerald-400" />
                {program.price}
              </div>
              <div className="flex items-center gap-2 text-sm text-white/60">
                <Clock className="w-4 h-4 text-amber-400" />
                {program.duration} Months
              </div>
              <div className="flex items-center gap-2 text-sm text-white/60">
                <Users className="w-4 h-4 text-blue-400" />
                {program.students} Students
              </div>
              <div className="flex items-center gap-2 text-sm text-white/60">
                <Users className="w-4 h-4 text-purple-400" />
                {program.teachers} Teachers
              </div>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
