'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion } from 'motion/react';
import {
  CreditCard, CheckCircle, Clock, AlertCircle,
  Loader2, DollarSign, Search, Download,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useUser } from '../context/UserContext';
import { api } from '../services/api';
import { Invoice } from '../types';
import { exportCsv } from '../utils/csv';

type StatusFilter = 'all' | 'paid' | 'partial' | 'not_paid' | 'overdue';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const MONTH_KEYS = ['january','february','march','april','may','june','july','august','september','october','november','december'] as const;
const fmtMoney = (n: number) => `\u20AC${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate  = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

const STATUS_BADGE: Record<string, string> = {
  paid:     'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  partial:  'bg-blue-500/10 text-blue-400 border-blue-500/20',
  not_paid: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  overdue:  'bg-red-500/10 text-red-400 border-red-500/20',
};
const STATUS_LABEL: Record<string, string> = {
  paid: 'status.paid', partial: 'status.partial', not_paid: 'status.not_paid', overdue: 'status.overdue',
};
const STATUS_ICON: Record<string, typeof CheckCircle> = {
  paid: CheckCircle, partial: DollarSign, not_paid: Clock, overdue: AlertCircle,
};

export default function StudentInvoices() {
  const { t } = useLanguage();
  const { user } = useUser();

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [filterMonth, setFilterMonth] = useState('');
  const [filterYear, setFilterYear] = useState('');

  useEffect(() => {
    if (!user) return;
    void loadAll(user.id);
  }, [user]);

  async function loadAll(uid: string) {
    setLoading(true);
    try {
      const inv = await api.finance.getInvoices(uid);
      setInvoices(inv);
    } catch (e) {
      console.error('StudentInvoices load error:', e);
    } finally {
      setLoading(false);
    }
  }

  const totalPaid = useMemo(() => invoices.filter(i => i.status === 'paid').reduce((s, i) => s + i.amount, 0), [invoices]);
  const pendingBalance = useMemo(() => invoices.filter(i => i.status !== 'paid').reduce((s, i) => s + i.amount, 0), [invoices]);
  const nextDue = useMemo(() => {
    const upcoming = invoices.filter(i => i.status !== 'paid').sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    return upcoming.length > 0 ? fmtDate(upcoming[0].dueDate) : '-';
  }, [invoices]);

  const invoiceFilterOptions = useMemo(() => {
    const months = Array.from<number>(new Set(invoices.map(i => i.month))).sort((a, b) => a - b);
    const years = Array.from<number>(new Set(invoices.map(i => i.year))).sort((a, b) => b - a);
    return { months, years };
  }, [invoices]);

  const filtered = useMemo(() => {
    let list = invoices;
    if (statusFilter !== 'all') list = list.filter(i => i.status === statusFilter);
    if (filterMonth) list = list.filter(i => i.month === Number(filterMonth));
    if (filterYear) list = list.filter(i => i.year === Number(filterYear));
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(i =>
        i.title.toLowerCase().includes(q) ||
        (i.className || '').toLowerCase().includes(q) ||
        (i.teacherName || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [invoices, statusFilter, filterMonth, filterYear, search]);

  const hasFilters = statusFilter !== 'all' || !!filterMonth || !!filterYear || !!search.trim();

  function handleExportCsv() {
    if (filtered.length === 0) return;
    exportCsv({
      filename: 'my_invoices',
      headers: ['Title', 'Class', 'Teacher', 'Month', 'Year', 'Due Date', 'Amount', 'Status'],
      rows: filtered.map(inv => [
        inv.title,
        inv.className || '',
        inv.teacherName || '',
        MONTH_NAMES[inv.month - 1],
        inv.year,
        inv.dueDate,
        inv.amount,
        STATUS_LABEL[inv.status] || inv.status,
      ]),
    });
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-medium tracking-tight mb-1">{t('nav.invoices')}</h1>
        <p className="text-white/50 text-sm">{t('student.invoices_desc')}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-card p-5 rounded-2xl flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
            <CheckCircle className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <div className="text-2xl font-display font-medium tracking-tight mb-0.5">{fmtMoney(totalPaid)}</div>
            <div className="text-[11px] font-medium text-white/40 uppercase tracking-wider">{t('student.total_paid')}</div>
          </div>
        </div>
        <div className="glass-card p-5 rounded-2xl flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
            <Clock className="w-6 h-6 text-amber-400" />
          </div>
          <div>
            <div className="text-2xl font-display font-medium tracking-tight mb-0.5">{fmtMoney(pendingBalance)}</div>
            <div className="text-[11px] font-medium text-white/40 uppercase tracking-wider">{t('student.pending_balance')}</div>
          </div>
        </div>
        <div className="glass-card p-5 rounded-2xl flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#fc0ce4]/10 flex items-center justify-center border border-[#fc0ce4]/20">
            <CreditCard className="w-6 h-6 text-[#fc0ce4]" />
          </div>
          <div>
            <div className="text-2xl font-display font-medium tracking-tight mb-0.5">{nextDue}</div>
            <div className="text-[11px] font-medium text-white/40 uppercase tracking-wider">{t('student.next_due')}</div>
          </div>
        </div>
      </div>

      <div className="glass-card rounded-3xl p-6 overflow-hidden flex flex-col">
        <div className="flex flex-col gap-4 mb-6 shrink-0">
          <div className="flex flex-col md:flex-row gap-4 justify-between">
            <div className="relative w-full md:w-96 group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 group-focus-within:text-[#fc0ce4] transition-colors" />
              <input type="text" placeholder={t('student.invoices_search')} value={search} onChange={e => setSearch(e.target.value)} className="w-full bg-white/5 border border-white/5 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#fc0ce4]/40 focus:bg-[#fc0ce4]/5 focus:shadow-[0_0_15px_rgba(252,12,228,0.1)] transition-all" />
            </div>
            <button onClick={handleExportCsv} disabled={filtered.length === 0} className="px-4 py-2.5 rounded-xl border border-white/10 text-sm font-medium hover:bg-white/5 transition-colors flex items-center gap-2 disabled:opacity-30 self-start">
              <Download className="w-4 h-4" />
              {t('common.export_csv')}
            </button>
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            {(['all', 'paid', 'partial', 'not_paid', 'overdue'] as StatusFilter[]).map(s => (
              <button key={s} onClick={() => setStatusFilter(s)} className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${statusFilter === s ? 'bg-[#fc0ce4]/15 border-[#fc0ce4]/30 text-[#fc0ce4]' : 'border-white/10 text-white/40 hover:bg-white/5 hover:text-white/60'}`}>
                {s === 'all' ? t('student.invoices_all') : t(STATUS_LABEL[s])}
              </button>
            ))}

            <div className="w-px h-5 bg-white/10 mx-1" />

            <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)} className="glass-select px-3 py-1.5 rounded-lg text-xs">
              <option value="">{t('student.invoices_all_months')}</option>
              {invoiceFilterOptions.months.map(m => <option key={m} value={m}>{t(`months.${MONTH_KEYS[m - 1]}`)}</option>)}
            </select>
            <select value={filterYear} onChange={e => setFilterYear(e.target.value)} className="glass-select px-3 py-1.5 rounded-lg text-xs">
              <option value="">{t('student.invoices_all_years')}</option>
              {invoiceFilterOptions.years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>

            {hasFilters && (
              <button onClick={() => { setStatusFilter('all'); setFilterMonth(''); setFilterYear(''); setSearch(''); }} className="text-xs text-white/30 hover:text-white transition-colors ml-1">
                Clear all
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto pb-4 custom-scrollbar flex-1 -mx-6 px-6">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-white/30 gap-2"><Loader2 className="w-5 h-5 animate-spin" /></div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-white/30 gap-3">
              <CreditCard className="w-8 h-8 opacity-40" />
              <p className="text-sm">{hasFilters ? t('student.invoices_empty_filtered') : t('student.invoices_empty')}</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="border-b border-white/5 text-[11px] uppercase tracking-widest text-white/30">
                  <th className="pb-3 font-medium">{t('finance.col_title')}</th>
                  <th className="pb-3 font-medium">{t('table.class')}</th>
                  <th className="pb-3 font-medium">{t('table.teacher')}</th>
                  <th className="pb-3 font-medium">{t('finance.col_month')}</th>
                  <th className="pb-3 font-medium">{t('finance.col_year')}</th>
                  <th className="pb-3 font-medium">{t('finance.due_date')}</th>
                  <th className="pb-3 font-medium">{t('finance.amount')}</th>
                  <th className="pb-3 font-medium">{t('table.status')}</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {filtered.map(inv => {
                  const Icon = STATUS_ICON[inv.status] || Clock;
                  return (
                    <tr key={inv.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                      <td className="py-4 font-medium text-white/90">{inv.title}</td>
                      <td className="py-4 text-white/60 text-xs">{inv.className || '-'}</td>
                      <td className="py-4 text-white/50 text-xs">{inv.teacherName || '-'}</td>
                      <td className="py-4 text-white/60 text-xs">{t(`months.${MONTH_KEYS[inv.month - 1]}`)}</td>
                      <td className="py-4 text-white/60 text-xs">{inv.year}</td>
                      <td className="py-4 text-white/60 text-xs">{fmtDate(inv.dueDate)}</td>
                      <td className="py-4 font-medium text-white/90">{fmtMoney(inv.amount)}</td>
                      <td className="py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium uppercase tracking-wider border ${STATUS_BADGE[inv.status]}`}>
                          <Icon className="w-3 h-3" />
                          {t(STATUS_LABEL[inv.status])}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </motion.div>
  );
}
