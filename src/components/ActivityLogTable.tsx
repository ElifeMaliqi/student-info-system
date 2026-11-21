'use client';

import { useEffect, useState } from 'react';
import { History, Loader2, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { api } from '../services/api';
import type { ActivityLog } from '../types';

const ACTIVITY_BADGE: Record<ActivityLog['activity'], string> = {
  add: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  edit: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  delete: 'bg-red-500/10 text-red-400 border-red-500/20',
};

const fmtTimestamp = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

type Filters = { user: string; activity: string; from: string; to: string };
const NO_FILTERS: Filters = { user: '', activity: '', from: '', to: '' };

/** Settings > Logs (superadmin only): every admin/superadmin action, newest first. */
export function ActivityLogTable() {
  const { t } = useLanguage();
  const [rows, setRows] = useState<ActivityLog[]>([]);
  const [users, setUsers] = useState<string[]>([]);
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    api.logs.getPage({ page, ...filters })
      .then(res => {
        if (cancelled) return;
        setRows(res.rows);
        setTotal(res.total);
        setPageSize(res.pageSize);
        setUsers(res.users);
      })
      .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load logs'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [page, filters]);

  // Any filter change starts again from page 1.
  const setFilter = (key: keyof Filters, value: string) => {
    setFilters(f => ({ ...f, [key]: value }));
    setPage(1);
  };
  const hasFilters = Object.values(filters).some(Boolean);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const firstShown = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastShown = Math.min(page * pageSize, total);

  const dateInput = 'glass-input px-3 py-2 rounded-[0.625rem] text-xs text-white [color-scheme:dark]';

  return (
    <div className="glass-card rounded-3xl p-6 lg:p-8">
      <h2 className="font-display text-xl font-medium mb-2">
        <History className="w-5 h-5 inline-block mr-2 text-[#fc0ce4]" />
        {t('logs.title')}
      </h2>
      <p className="text-white/40 text-sm mb-5">{t('logs.desc')}</p>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        <select value={filters.user} onChange={e => setFilter('user', e.target.value)} className="glass-select select-auto select-compact">
          <option value="">{t('logs.all_users')}</option>
          {users.map(u => <option key={u} value={u}>{u}</option>)}
        </select>
        <select value={filters.activity} onChange={e => setFilter('activity', e.target.value)} className="glass-select select-auto select-compact">
          <option value="">{t('logs.all_actions')}</option>
          <option value="add">{t('logs.add')}</option>
          <option value="edit">{t('logs.edit')}</option>
          <option value="delete">{t('logs.delete')}</option>
        </select>
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-white/40">{t('logs.from')}</span>
          <input type="date" value={filters.from} max={filters.to || undefined} onChange={e => setFilter('from', e.target.value)} className={dateInput} />
          <span className="text-[11px] text-white/40">{t('logs.to')}</span>
          <input type="date" value={filters.to} min={filters.from || undefined} onChange={e => setFilter('to', e.target.value)} className={dateInput} />
        </div>
        {hasFilters && (
          <button onClick={() => { setFilters(NO_FILTERS); setPage(1); }} className="text-xs text-white/30 hover:text-white transition-colors px-1">
            {t('common.clear_all')}
          </button>
        )}
      </div>

      {error ? (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      ) : loading && rows.length === 0 ? (
        <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-white/40" /></div>
      ) : rows.length === 0 ? (
        <p className="text-white/40 text-sm py-8 text-center">{hasFilters ? t('logs.no_match') : t('logs.empty')}</p>
      ) : (
        <div className={`overflow-x-auto transition-opacity ${loading ? 'opacity-50' : ''}`}>
          <table className="w-full text-left border-collapse min-w-[640px]">
            <thead>
              <tr className="border-b border-white/5 text-[11px] uppercase tracking-widest text-white/30">
                <th className="pb-3 font-medium w-44">{t('logs.col_timestamp')}</th>
                <th className="pb-3 font-medium w-48">{t('logs.col_user')}</th>
                <th className="pb-3 font-medium">{t('logs.col_activity')}</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {rows.map(r => (
                <tr key={r.id} className="border-b border-white/5 align-top">
                  <td className="py-3 pr-4 text-white/60 text-xs whitespace-nowrap">{fmtTimestamp(r.createdAt)}</td>
                  <td className="py-3 pr-4">
                    <div className="text-white/90">{r.userName || '—'}</div>
                    <div className="text-[11px] text-white/40 capitalize">{r.userRole}</div>
                  </td>
                  <td className="py-3">
                    <div className="flex items-start gap-2">
                      <span className={`shrink-0 inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider border ${ACTIVITY_BADGE[r.activity]}`}>
                        {t(`logs.${r.activity}`)}
                      </span>
                      <span className="text-white/70">{r.description}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {!error && total > 0 && (
        <div className="flex items-center justify-between gap-3 pt-5">
          <span className="text-xs text-white/40">
            {t('logs.showing').replace('{from}', String(firstShown)).replace('{to}', String(lastShown)).replace('{total}', String(total))}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
              aria-label={t('logs.prev')}
              title={t('logs.prev')}
              className="p-2 rounded-lg border border-white/10 text-white/70 hover:bg-white/5 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs text-white/60 min-w-[5.5rem] text-center">
              {t('logs.page_of').replace('{page}', String(page)).replace('{pages}', String(totalPages))}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
              aria-label={t('logs.next')}
              title={t('logs.next')}
              className="p-2 rounded-lg border border-white/10 text-white/70 hover:bg-white/5 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
