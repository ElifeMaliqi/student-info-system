import { useState, useEffect, useMemo } from 'react';
import { motion } from 'motion/react';
import { Search, Loader2, ClipboardList, CheckCircle, XCircle, Filter } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { api } from '../services/api';
import type { GradeTable } from '../types';

export default function AdminGrades() {
  const { t } = useLanguage();
  const [tables, setTables] = useState<GradeTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterTeacher, setFilterTeacher] = useState('');
  const [filterDegree, setFilterDegree] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    api.gradeTables.getAllAdmin()
      .then(setTables)
      .catch(() => setTables([]))
      .finally(() => setLoading(false));
  }, []);

  const teachers = useMemo(() => {
    const set = new Map<string, string>();
    tables.forEach(t => set.set(t.teacherId, t.teacherName));
    return Array.from(set.entries()).map(([id, name]) => ({ id, name }));
  }, [tables]);

  const degrees = useMemo(() => {
    const set = new Set<string>();
    tables.forEach(t => { if (t.degree) set.add(t.degree); });
    return Array.from(set).sort();
  }, [tables]);

  const filtered = useMemo(() => {
    let result = tables;
    if (filterTeacher) result = result.filter(t => t.teacherId === filterTeacher);
    if (filterDegree) result = result.filter(t => t.degree === filterDegree);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(t =>
        t.name.toLowerCase().includes(q) ||
        t.className.toLowerCase().includes(q) ||
        t.teacherName.toLowerCase().includes(q)
      );
    }
    return result;
  }, [tables, filterTeacher, filterDegree, search]);

  const stats = useMemo(() => {
    const allEntries = filtered.flatMap(t => t.entries);
    const graded = allEntries.filter(e => e.passed != null);
    return {
      tables: filtered.length,
      students: allEntries.length,
      graded: graded.length,
      passed: graded.filter(e => e.passed === true).length,
      failed: graded.filter(e => e.passed === false).length,
    };
  }, [filtered]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div>
        <h1 className="font-display text-3xl font-medium tracking-tight mb-1">{t('nav.grades')}</h1>
        <p className="text-white/50 text-sm">All grade tables across teachers and classes.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <div className="glass-card p-4 rounded-2xl text-center">
          <div className="text-2xl font-display font-medium">{stats.tables}</div>
          <div className="text-[11px] text-white/40 uppercase tracking-wider mt-1">Tables</div>
        </div>
        <div className="glass-card p-4 rounded-2xl text-center">
          <div className="text-2xl font-display font-medium">{stats.students}</div>
          <div className="text-[11px] text-white/40 uppercase tracking-wider mt-1">Students</div>
        </div>
        <div className="glass-card p-4 rounded-2xl text-center">
          <div className="text-2xl font-display font-medium">{stats.graded}</div>
          <div className="text-[11px] text-white/40 uppercase tracking-wider mt-1">Graded</div>
        </div>
        <div className="glass-card p-4 rounded-2xl text-center">
          <div className="text-2xl font-display font-medium text-emerald-400">{stats.passed}</div>
          <div className="text-[11px] text-white/40 uppercase tracking-wider mt-1">Passed</div>
        </div>
        <div className="glass-card p-4 rounded-2xl text-center">
          <div className="text-2xl font-display font-medium text-red-400">{stats.failed}</div>
          <div className="text-[11px] text-white/40 uppercase tracking-wider mt-1">Failed</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative group flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 group-focus-within:text-[#fc0ce4] transition-colors" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search tables, classes, teachers..."
            className="w-full bg-white/5 border border-white/5 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#fc0ce4]/40 focus:bg-[#fc0ce4]/5 transition-all"
          />
        </div>
        {teachers.length > 1 && (
          <select
            value={filterTeacher}
            onChange={e => setFilterTeacher(e.target.value)}
            className="glass-select px-4 py-2.5 rounded-xl text-sm"
          >
            <option value="">All teachers</option>
            {teachers.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        )}
        {degrees.length > 0 && (
          <select
            value={filterDegree}
            onChange={e => setFilterDegree(e.target.value)}
            className="glass-select px-4 py-2.5 rounded-xl text-sm"
          >
            <option value="">All degrees</option>
            {degrees.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        )}
        {(filterTeacher || filterDegree || search) && (
          <button
            onClick={() => { setFilterTeacher(''); setFilterDegree(''); setSearch(''); }}
            className="text-xs text-[#fc0ce4] hover:underline"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className="glass-card rounded-3xl p-12 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-white/40" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-card rounded-3xl p-12 text-center">
          <ClipboardList className="w-12 h-12 text-white/20 mx-auto mb-4" />
          <p className="text-white/40 text-sm">{search || filterTeacher || filterDegree ? 'No grade tables match your filters.' : 'No grade tables created yet.'}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map(table => {
            const graded = table.entries.filter(e => e.passed != null).length;
            const total = table.entries.length;
            const passed = table.entries.filter(e => e.passed === true).length;
            const failed = table.entries.filter(e => e.passed === false).length;
            const isExpanded = expandedId === table.id;

            return (
              <div key={table.id} className="glass-card rounded-2xl overflow-hidden">
                <button
                  onClick={() => setExpandedId(isExpanded ? null : table.id)}
                  className="w-full p-5 flex items-start justify-between gap-4 text-left hover:bg-white/[0.02] transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <h3 className="font-display font-medium text-base text-white/90">{table.name}</h3>
                    <p className="text-xs text-white/40 mt-1">
                      {table.className} · {table.teacherName}{table.degree ? ` · ${table.degree}` : ''} · {table.createdAt}
                    </p>
                  </div>
                  <div className="flex items-center gap-4 text-xs shrink-0">
                    <span className="text-white/50"><span className="text-white font-medium">{graded}</span>/{total} graded</span>
                    {passed > 0 && <span className="text-emerald-400 flex items-center gap-1"><CheckCircle className="w-3 h-3" />{passed}</span>}
                    {failed > 0 && <span className="text-red-400 flex items-center gap-1"><XCircle className="w-3 h-3" />{failed}</span>}
                  </div>
                </button>

                {isExpanded && table.entries.length > 0 && (
                  <div className="border-t border-white/5 px-5 pb-4">
                    <table className="w-full text-left text-sm mt-3">
                      <thead>
                        <tr className="text-[11px] uppercase tracking-widest text-white/30 border-b border-white/5">
                          <th className="pb-2 font-medium">Student</th>
                          <th className="pb-2 font-medium">Result</th>
                          <th className="pb-2 font-medium">Note</th>
                          <th className="pb-2 font-medium text-right">Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {table.entries.map(entry => (
                          <tr key={entry.id} className="border-b border-white/5 last:border-0">
                            <td className="py-2.5">
                              <div className="flex items-center gap-2">
                                <img src={entry.avatar} alt="" className="w-6 h-6 rounded-full border border-white/10" referrerPolicy="no-referrer" />
                                <span className="text-white/80">{entry.studentName}</span>
                              </div>
                            </td>
                            <td className="py-2.5">
                              {entry.passed === true && (
                                <span className="inline-flex items-center gap-1 text-emerald-400 text-xs font-medium">
                                  <CheckCircle className="w-3 h-3" /> Passed · {entry.totalPoints} pts
                                </span>
                              )}
                              {entry.passed === false && (
                                <span className="inline-flex items-center gap-1 text-red-400 text-xs font-medium">
                                  <XCircle className="w-3 h-3" /> Failed · {entry.totalPoints} pts
                                </span>
                              )}
                              {entry.passed == null && (
                                <span className="text-white/25 text-xs">Not graded</span>
                              )}
                            </td>
                            <td className="py-2.5 text-white/50 text-xs max-w-[140px] truncate" title={entry.note || ''}>
                              {entry.note || <span className="text-white/20">—</span>}
                            </td>
                            <td className="py-2.5 text-right text-white/40 text-xs">{entry.gradedAt || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
