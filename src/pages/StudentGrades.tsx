import { useState, useEffect, useMemo } from 'react';
import { motion } from 'motion/react';
import { CheckCircle, XCircle, Loader2, ClipboardList, BookOpen, Award, Search, Download } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useUser } from '../context/UserContext';
import { api } from '../services/api';
import { exportCsv } from '../utils/csv';

interface GradeEntry {
  tableName: string;
  className: string;
  teacherName: string;
  totalPoints: number | null;
  passed: boolean | null;
  gradedAt: string | null;
  note: string | null;
}

export default function StudentGrades() {
  const { t } = useLanguage();
  const { user } = useUser();
  const [entries, setEntries] = useState<GradeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterClass, setFilterClass] = useState('');
  const [filterTeacher, setFilterTeacher] = useState('');
  const [filterResult, setFilterResult] = useState<'' | 'passed' | 'failed' | 'not_graded'>('');

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    api.gradeTables.getForStudent(user.id)
      .then(setEntries)
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, [user]);

  const stats = useMemo(() => {
    const graded = entries.filter(e => e.passed != null);
    const passed = graded.filter(e => e.passed === true).length;
    const failed = graded.filter(e => e.passed === false).length;
    return { total: entries.length, graded: graded.length, passed, failed };
  }, [entries]);

  const gradeFilterOptions = useMemo(() => {
    const classes = [...new Set(entries.map(e => e.className).filter(Boolean))].sort();
    const teachers = [...new Set(entries.map(e => e.teacherName).filter(Boolean))].sort();
    return { classes, teachers };
  }, [entries]);

  const filtered = useMemo(() => {
    let list = entries;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(e =>
        e.tableName.toLowerCase().includes(q) ||
        e.className.toLowerCase().includes(q) ||
        e.teacherName.toLowerCase().includes(q)
      );
    }
    if (filterClass) list = list.filter(e => e.className === filterClass);
    if (filterTeacher) list = list.filter(e => e.teacherName === filterTeacher);
    if (filterResult === 'passed') list = list.filter(e => e.passed === true);
    else if (filterResult === 'failed') list = list.filter(e => e.passed === false);
    else if (filterResult === 'not_graded') list = list.filter(e => e.passed == null);
    return list;
  }, [entries, search, filterClass, filterTeacher, filterResult]);

  const hasGradeFilters = !!search.trim() || !!filterClass || !!filterTeacher || !!filterResult;

  function handleExportGrades() {
    if (filtered.length === 0) return;
    exportCsv({
      filename: 'my_grades',
      headers: ['Grade Table', 'Class', 'Teacher', 'Result', 'Points', 'Note', 'Date'],
      rows: filtered.map(e => [
        e.tableName,
        e.className,
        e.teacherName,
        e.passed === true ? 'Passed' : e.passed === false ? 'Failed' : 'Not Graded',
        e.totalPoints ?? '',
        e.note || '',
        e.gradedAt || '',
      ]),
    });
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div>
        <h1 className="font-display text-3xl font-medium tracking-tight mb-1">{t('nav.grades')}</h1>
        <p className="text-white/50 text-sm">{t('student.grades_desc')}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-card p-5 rounded-2xl flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20">
            <BookOpen className="w-6 h-6 text-purple-400" />
          </div>
          <div>
            <div className="text-2xl font-display font-medium tracking-tight mb-0.5">{stats.total}</div>
            <div className="text-[11px] font-medium text-white/40 uppercase tracking-wider">{t('student.stat_grade_tables')}</div>
          </div>
        </div>
        <div className="glass-card p-5 rounded-2xl flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
            <Award className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <div className="text-2xl font-display font-medium tracking-tight mb-0.5">{stats.passed}</div>
            <div className="text-[11px] font-medium text-white/40 uppercase tracking-wider">{t('grades.stat_passed')}</div>
          </div>
        </div>
        <div className="glass-card p-5 rounded-2xl flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center border border-red-500/20">
            <XCircle className="w-6 h-6 text-red-400" />
          </div>
          <div>
            <div className="text-2xl font-display font-medium tracking-tight mb-0.5">{stats.failed}</div>
            <div className="text-[11px] font-medium text-white/40 uppercase tracking-wider">{t('grades.stat_failed')}</div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="glass-card rounded-3xl p-6 overflow-hidden flex flex-col">
        <div className="flex flex-col gap-4 mb-6 shrink-0">
          <div className="flex flex-col md:flex-row gap-4 justify-between">
            <div className="relative w-full md:w-96 group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 group-focus-within:text-[#fc0ce4] transition-colors" />
              <input type="text" placeholder={t('student.grades_search')} value={search} onChange={e => setSearch(e.target.value)} className="w-full bg-white/5 border border-white/5 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#fc0ce4]/40 focus:bg-[#fc0ce4]/5 focus:shadow-[0_0_15px_rgba(252,12,228,0.1)] transition-all" />
            </div>
            <button onClick={handleExportGrades} disabled={filtered.length === 0} className="px-4 py-2.5 rounded-xl border border-white/10 text-sm font-medium hover:bg-white/5 transition-colors flex items-center gap-2 disabled:opacity-30 self-start">
              <Download className="w-4 h-4" />
              {t('common.export_csv')}
            </button>
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            {([{ value: '', label: t('student.grade_filter_all') }, { value: 'passed', label: t('grades.pass') }, { value: 'failed', label: t('grades.fail') }, { value: 'not_graded', label: t('status.not_graded') }] as const).map(opt => (
              <button key={opt.value} onClick={() => setFilterResult(opt.value as any)} className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${filterResult === opt.value ? 'bg-[#fc0ce4]/15 border-[#fc0ce4]/30 text-[#fc0ce4]' : 'border-white/10 text-white/40 hover:bg-white/5 hover:text-white/60'}`}>
                {opt.label}
              </button>
            ))}

            <div className="w-px h-5 bg-white/10 mx-1" />

            <select value={filterClass} onChange={e => setFilterClass(e.target.value)} className="glass-select px-3 py-1.5 rounded-lg text-xs">
              <option value="">{t('student.grade_filter_all_classes')}</option>
              {gradeFilterOptions.classes.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={filterTeacher} onChange={e => setFilterTeacher(e.target.value)} className="glass-select px-3 py-1.5 rounded-lg text-xs">
              <option value="">{t('student.grade_filter_all_teachers')}</option>
              {gradeFilterOptions.teachers.map(t => <option key={t} value={t}>{t}</option>)}
            </select>

            {hasGradeFilters && (
              <button onClick={() => { setSearch(''); setFilterClass(''); setFilterTeacher(''); setFilterResult(''); }} className="text-xs text-white/30 hover:text-white transition-colors ml-1">
                Clear all
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto pb-4 custom-scrollbar flex-1 -mx-6 px-6">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-white/30">
              <Loader2 className="w-5 h-5 animate-spin mr-2" /> {t('student.grades_loading')}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-white/20">
              <ClipboardList className="w-10 h-10 mb-3" />
              <p className="text-sm">{hasGradeFilters ? t('student.grades_empty_filtered') : t('student.grades_empty')}</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="border-b border-white/5 text-[11px] uppercase tracking-widest text-white/30">
                  <th className="pb-3 font-medium">{t('student.stat_grade_tables')}</th>
                  <th className="pb-3 font-medium">{t('table.class')}</th>
                  <th className="pb-3 font-medium">{t('table.teacher')}</th>
                  <th className="pb-3 font-medium">{t('table.result')}</th>
                  <th className="pb-3 font-medium">{t('table.note')}</th>
                  <th className="pb-3 font-medium text-right">{t('table.date')}</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {filtered.map((entry, i) => (
                  <tr key={i} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors group">
                    <td className="py-4">
                      <div className="font-medium text-white/90 group-hover:text-white transition-colors">{entry.tableName}</div>
                    </td>
                    <td className="py-4 text-white/60">{entry.className}</td>
                    <td className="py-4 text-white/60">{entry.teacherName}</td>
                    <td className="py-4">
                      {entry.passed === true && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <CheckCircle className="w-3 h-3" /> {t('status.passed')}{entry.totalPoints != null ? ` · ${entry.totalPoints} pts` : ''}
                        </span>
                      )}
                      {entry.passed === false && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium uppercase tracking-wider bg-red-500/10 text-red-400 border border-red-500/20">
                          <XCircle className="w-3 h-3" /> {t('status.failed')}{entry.totalPoints != null ? ` · ${entry.totalPoints} pts` : ''}
                        </span>
                      )}
                      {entry.passed == null && (
                        <span className="text-white/30 text-xs">{t('status.not_graded')}</span>
                      )}
                    </td>
                    <td className="py-4 text-white/50 text-xs max-w-[160px] truncate" title={entry.note || ''}>
                      {entry.note || <span className="text-white/20">—</span>}
                    </td>
                    <td className="py-4 text-right text-white/40 text-xs">{entry.gradedAt || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </motion.div>
  );
}
