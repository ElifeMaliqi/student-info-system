import { useState } from 'react';
import { motion } from 'motion/react';
import { CreditCard, Download, Search, Filter, Plus, FileText, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { playPopSound } from '../utils/sound';

const INVOICES = [
  { id: 'INV-2026-001', student: 'Elena Rodriguez', program: 'UI/UX Creative Designer', amount: '$2,500', status: 'Paid', date: 'Feb 01, 2026', due: 'Feb 15, 2026' },
  { id: 'INV-2026-002', student: 'Marcus Chen', program: 'Web Development', amount: '$3,200', status: 'Partial', date: 'Feb 05, 2026', due: 'Feb 20, 2026' },
  { id: 'INV-2026-003', student: 'Sarah Jenkins', program: 'Cybersecurity', amount: '$4,000', status: 'Overdue', date: 'Jan 15, 2026', due: 'Jan 30, 2026' },
  { id: 'INV-2026-004', student: 'David Kim', program: 'UAV Engineering', amount: '$3,800', status: 'Paid', date: 'Feb 10, 2026', due: 'Feb 25, 2026' },
  { id: 'INV-2026-005', student: 'Aisha Patel', program: 'Digital Marketing with AI', amount: '$2,800', status: 'Pending', date: 'Feb 20, 2026', due: 'Mar 05, 2026' },
];

export default function Finance() {
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
            <h1 className="font-display text-3xl font-medium tracking-tight mb-1">Create Invoice</h1>
            <p className="text-white/50 text-sm">Generate a new manual invoice for a student.</p>
          </div>
          <button 
            onClick={() => setView('list')}
            className="px-4 py-2 rounded-xl border border-white/10 text-sm font-medium hover:bg-white/5 transition-colors"
          >
            Cancel
          </button>
        </div>

        <div className="glass-card rounded-3xl p-6 lg:p-8">
          <form className="space-y-8" onSubmit={(e) => { e.preventDefault(); setView('list'); }}>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2 md:col-span-2">
                <label className="text-[11px] font-semibold text-white/60 uppercase tracking-widest ml-1">Select Student</label>
                <select className="glass-input w-full px-4 py-3 rounded-xl text-sm text-white bg-[#0a0a0a] appearance-none">
                  <option>Elena Rodriguez (STU-001)</option>
                  <option>Marcus Chen (STU-002)</option>
                  <option>Sarah Jenkins (STU-003)</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-semibold text-white/60 uppercase tracking-widest ml-1">Amount ($)</label>
                <input type="number" className="glass-input w-full px-4 py-3 rounded-xl text-sm text-white placeholder:text-white/20" placeholder="0.00" />
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-semibold text-white/60 uppercase tracking-widest ml-1">Due Date</label>
                <input type="date" className="glass-input w-full px-4 py-3 rounded-xl text-sm text-white placeholder:text-white/20 [&::-webkit-calendar-picker-indicator]:filter [&::-webkit-calendar-picker-indicator]:invert" />
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-[11px] font-semibold text-white/60 uppercase tracking-widest ml-1">Description / Notes</label>
                <textarea className="glass-input w-full px-4 py-3 rounded-xl text-sm text-white placeholder:text-white/20 h-32 resize-none" placeholder="Tuition fee for Spring 2026..." />
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className="relative flex items-center justify-center w-5 h-5 rounded border border-white/20 bg-white/5 group-hover:border-[#fc0ce4]/50 transition-colors">
                    <input type="checkbox" className="peer sr-only" />
                    <CheckCircle className="w-3 h-3 text-[#fc0ce4] opacity-0 peer-checked:opacity-100 transition-opacity" />
                  </div>
                  <span className="text-sm text-white/70 group-hover:text-white transition-colors">Enable Installment Plan</span>
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-4 pt-6 border-t border-white/5">
              <button type="button" className="px-6 py-3 rounded-xl border border-white/10 text-sm font-medium hover:bg-white/5 transition-colors">
                Save Draft
              </button>
              <button type="submit" className="bg-gradient-to-r from-[#fc0ce4] to-[#949ce4] text-white px-6 py-3 rounded-xl text-sm font-semibold hover:opacity-90 transition-all shadow-[0_0_20px_rgba(252,12,228,0.2)]">
                Generate Invoice
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
          <h1 className="font-display text-3xl font-medium tracking-tight mb-1">{t('finance.title')}</h1>
          <p className="text-white/50 text-sm">{t('finance.desc')}</p>
        </div>
        <div className="flex gap-3 self-start sm:self-auto">
          <button 
            onClick={() => { playPopSound(); alert('Exporting financial report to CSV...'); }}
            className="px-4 py-2.5 rounded-xl border border-white/10 text-sm font-medium hover:bg-white/5 transition-colors flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Export Report</span>
          </button>
          <button 
            onClick={() => setView('create')}
            className="bg-gradient-to-r from-[#fc0ce4] to-[#949ce4] text-white px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 hover:opacity-90 transition-all shadow-[0_0_20px_rgba(252,12,228,0.2)]"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">{t('finance.create_invoice')}</span>
            <span className="sm:hidden">New</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="glass-card p-5 rounded-2xl flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
            <CreditCard className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <div className="text-2xl font-display font-medium tracking-tight mb-0.5">$124.5k</div>
            <div className="text-[11px] font-medium text-white/40 uppercase tracking-wider">{t('finance.total_collected')}</div>
          </div>
        </div>
        <div className="glass-card p-5 rounded-2xl flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
            <Clock className="w-6 h-6 text-amber-400" />
          </div>
          <div>
            <div className="text-2xl font-display font-medium tracking-tight mb-0.5">$32.1k</div>
            <div className="text-[11px] font-medium text-white/40 uppercase tracking-wider">{t('finance.pending_payments')}</div>
          </div>
        </div>
        <div className="glass-card p-5 rounded-2xl flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center border border-red-500/20">
            <AlertCircle className="w-6 h-6 text-red-400" />
          </div>
          <div>
            <div className="text-2xl font-display font-medium tracking-tight mb-0.5">$8.4k</div>
            <div className="text-[11px] font-medium text-white/40 uppercase tracking-wider">{t('finance.overdue_amount')}</div>
          </div>
        </div>
      </div>

      <div className="glass-card rounded-3xl p-6 overflow-hidden flex flex-col">
        <div className="flex flex-col md:flex-row gap-4 justify-between mb-6 shrink-0">
          <div className="relative w-full md:w-96 group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 group-focus-within:text-[#fc0ce4] transition-colors" />
            <input 
              type="text" 
              placeholder={t('finance.search')} 
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
                <th className="pb-3 font-medium">{t('finance.invoice_id')}</th>
                <th className="pb-3 font-medium">{t('table.student')}</th>
                <th className="pb-3 font-medium">{t('finance.amount')}</th>
                <th className="pb-3 font-medium">{t('table.status')}</th>
                <th className="pb-3 font-medium">{t('finance.due_date')}</th>
                <th className="pb-3 font-medium text-right">{t('table.action')}</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {INVOICES.map((invoice) => (
                <tr key={invoice.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors group">
                  <td className="py-4">
                    <div className="font-mono text-white/90 group-hover:text-[#fc0ce4] transition-colors cursor-pointer">{invoice.id}</div>
                    <div className="text-[11px] text-white/40 mt-0.5">{invoice.date}</div>
                  </td>
                  <td className="py-4">
                    <div className="font-medium text-white/90">{invoice.student}</div>
                    <div className="text-[11px] text-white/40 mt-0.5">{invoice.program}</div>
                  </td>
                  <td className="py-4 font-medium text-white/90">{invoice.amount}</td>
                  <td className="py-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium uppercase tracking-wider border ${
                      invoice.status === 'Paid' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 
                      invoice.status === 'Partial' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                      invoice.status === 'Pending' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                      'bg-red-500/10 text-red-400 border-red-500/20'
                    }`}>
                      {t(`status.${invoice.status.toLowerCase()}`)}
                    </span>
                  </td>
                  <td className="py-4 text-white/60 text-xs">{invoice.due}</td>
                  <td className="py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white/40 hover:text-white" title="Download PDF">
                        <FileText className="w-4 h-4" />
                      </button>
                      {invoice.status === 'Overdue' && (
                        <button className="p-2 hover:bg-red-500/10 rounded-lg transition-colors text-red-400/70 hover:text-red-400" title="Send Reminder">
                          <AlertCircle className="w-4 h-4" />
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
    </motion.div>
  );
}
