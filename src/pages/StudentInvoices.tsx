import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CreditCard, Download, CheckCircle, Clock, AlertCircle, X, MapPin, Mail } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

const INVOICES = [
  { id: 'INV-2026-001', amount: '$1,200', status: 'Pending', date: 'Feb 01, 2026', due: 'Mar 01, 2026', desc: 'Spring Semester Tuition - Installment 1' },
  { id: 'INV-2025-012', amount: '$1,200', status: 'Paid', date: 'Jan 01, 2026', due: 'Jan 15, 2026', desc: 'Fall Semester Tuition - Final Installment' },
  { id: 'INV-2025-011', amount: '$1,200', status: 'Paid', date: 'Dec 01, 2025', due: 'Dec 15, 2025', desc: 'Fall Semester Tuition - Installment 2' },
  { id: 'INV-2025-010', amount: '$1,200', status: 'Paid', date: 'Nov 01, 2025', due: 'Nov 15, 2025', desc: 'Fall Semester Tuition - Installment 1' },
];

export default function StudentInvoices() {
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const { t } = useLanguage();

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-medium tracking-tight mb-1">{t('nav.invoices')}</h1>
          <p className="text-white/50 text-sm">Manage your tuition payments and billing history.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="glass-card p-5 rounded-2xl flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
            <CheckCircle className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <div className="text-2xl font-display font-medium tracking-tight mb-0.5">$3,600</div>
            <div className="text-[11px] font-medium text-white/40 uppercase tracking-wider">{t('student.total_paid')}</div>
          </div>
        </div>
        <div className="glass-card p-5 rounded-2xl flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
            <Clock className="w-6 h-6 text-amber-400" />
          </div>
          <div>
            <div className="text-2xl font-display font-medium tracking-tight mb-0.5">$1,200</div>
            <div className="text-[11px] font-medium text-white/40 uppercase tracking-wider">{t('student.pending_balance')}</div>
          </div>
        </div>
        <div className="glass-card p-5 rounded-2xl flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#fc0ce4]/10 flex items-center justify-center border border-[#fc0ce4]/20">
            <CreditCard className="w-6 h-6 text-[#fc0ce4]" />
          </div>
          <div>
            <div className="text-2xl font-display font-medium tracking-tight mb-0.5">Mar 01</div>
            <div className="text-[11px] font-medium text-white/40 uppercase tracking-wider">{t('student.next_due')}</div>
          </div>
        </div>
      </div>

      <div className="glass-card rounded-3xl p-6 overflow-hidden flex flex-col">
        <div className="overflow-x-auto pb-4 custom-scrollbar flex-1 -mx-6 px-6">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="border-b border-white/5 text-[11px] uppercase tracking-widest text-white/30">
                <th className="pb-3 font-medium">{t('finance.invoice_id')}</th>
                <th className="pb-3 font-medium">Description</th>
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
                  <td className="py-4 text-white/60">{invoice.desc}</td>
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
                  <td className="py-4 text-white/60 text-xs">{invoice.due}</td>
                  <td className="py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {invoice.status === 'Pending' && (
                        <button 
                          onClick={() => setShowPaymentModal(true)}
                          className="bg-gradient-to-r from-[#fc0ce4] to-[#949ce4] text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:opacity-90 transition-all shadow-[0_0_10px_rgba(252,12,228,0.2)]"
                        >
                          {t('student.pay_now')}
                        </button>
                      )}
                      <button className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white/40 hover:text-white" title="Download PDF">
                        <Download className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {showPaymentModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setShowPaymentModal(false)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-[#0a0a0a] border border-white/10 rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-white/5 flex items-center justify-between">
                <h2 className="font-display text-xl font-medium">{t('payment.title')}</h2>
                <button 
                  onClick={() => setShowPaymentModal(false)}
                  className="p-2 hover:bg-white/5 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-white/60" />
                </button>
              </div>
              <div className="p-6 space-y-6">
                <p className="text-white/60 text-sm leading-relaxed">
                  {t('payment.desc')}
                </p>
                <div className="space-y-4">
                  <div className="flex items-start gap-4 p-4 rounded-2xl bg-white/5 border border-white/5">
                    <div className="w-10 h-10 rounded-xl bg-[#fc0ce4]/10 flex items-center justify-center border border-[#fc0ce4]/20 shrink-0">
                      <MapPin className="w-5 h-5 text-[#fc0ce4]" />
                    </div>
                    <div>
                      <div className="text-[11px] font-semibold text-white/40 uppercase tracking-widest mb-1">{t('payment.address')}</div>
                      <div className="text-sm text-white/90">Rr. Muharrem Ibrahimi<br/>Gjilan, Kosova 60000</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-4 p-4 rounded-2xl bg-white/5 border border-white/5">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20 shrink-0">
                      <Mail className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                      <div className="text-[11px] font-semibold text-white/40 uppercase tracking-widest mb-1">{t('payment.email')}</div>
                      <a href="mailto:info@futureminds.io" className="text-sm text-blue-400 hover:underline">info@futureminds.io</a>
                    </div>
                  </div>
                </div>
              </div>
              <div className="p-6 border-t border-white/5 bg-white/[0.02]">
                <button 
                  onClick={() => setShowPaymentModal(false)}
                  className="w-full bg-white/10 hover:bg-white/15 text-white px-4 py-3 rounded-xl text-sm font-semibold transition-colors"
                >
                  {t('payment.close')}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
