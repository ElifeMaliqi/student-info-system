'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Users, Presentation, BookOpen, GraduationCap, X, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '../context/LanguageContext';
import { api } from '../services/api';

type PageItem = { id: string; label: string; icon: any; path: string };

type ResultItem = { key: string; name: string; sub?: string; icon: any; path: string };

type SearchData = {
  students: ResultItem[];
  teachers: ResultItem[];
  programs: ResultItem[];
  classes: ResultItem[];
};

type Props = {
  role: 'admin' | 'teacher' | 'student' | 'superadmin';
  userId?: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  pages: PageItem[];
};

const EMPTY_DATA: SearchData = { students: [], teachers: [], programs: [], classes: [] };
const MAX_PER_GROUP = 6;

export function CommandPalette({ role, userId, isOpen, onOpenChange, pages }: Props) {
  const [search, setSearch] = useState('');
  const [data, setData] = useState<SearchData>(EMPTY_DATA);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { t } = useLanguage();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        onOpenChange(!isOpen);
      }
      if (e.key === 'Escape') {
        onOpenChange(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onOpenChange]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setSearch('');
    }
  }, [isOpen]);

  const pageKey = pages.map(p => p.id).join(',');

  // Load searchable records each time the palette opens (only for pages the user can access)
  useEffect(() => {
    if (!isOpen) return;
    const allowed = new Set(pageKey.split(','));
    let cancelled = false;
    setLoading(true);

    const load = async (): Promise<SearchData> => {
      const next: SearchData = { students: [], teachers: [], programs: [], classes: [] };

      if (role === 'admin' || role === 'superadmin') {
        const [students, teachers, programs, classes] = await Promise.all([
          allowed.has('students') ? api.teacher.getStudentsWithDetails().catch(() => []) : Promise.resolve([]),
          allowed.has('teachers') ? api.users.getTeacherOverview().catch(() => []) : Promise.resolve([]),
          allowed.has('programs') ? api.programs.getAll().catch(() => []) : Promise.resolve([]),
          allowed.has('classes') ? api.classes.getAll().catch(() => []) : Promise.resolve([]),
        ]);
        next.students = students.map(s => ({ key: `s-${s.id}`, name: s.name, sub: s.email, icon: Users, path: `/students/${s.id}` }));
        next.teachers = teachers.map(tc => ({ key: `t-${tc.id}`, name: tc.name, sub: tc.email, icon: Presentation, path: `/teachers/${tc.id}` }));
        next.programs = programs.map(p => ({ key: `p-${p.id}`, name: p.name, icon: BookOpen, path: '/programs' }));
        next.classes = classes.map(c => ({ key: `c-${c.id}`, name: c.title, sub: c.programName, icon: GraduationCap, path: '/classes' }));
      } else if (role === 'teacher' && userId) {
        const [rows, classes] = await Promise.all([
          allowed.has('students') ? api.teacher.getClassStudents(userId).catch(() => []) : Promise.resolve([] as Awaited<ReturnType<typeof api.teacher.getClassStudents>>),
          allowed.has('classes') ? api.teacher.getMyClasses(userId).catch(() => []) : Promise.resolve([] as Awaited<ReturnType<typeof api.teacher.getMyClasses>>),
        ]);
        const seen = new Set<string>();
        next.students = rows
          .filter(r => !seen.has(r.studentId) && seen.add(r.studentId))
          .map(r => ({ key: `s-${r.studentId}`, name: r.studentName, sub: r.email, icon: Users, path: `/students/${r.studentId}` }));
        next.classes = classes.map(c => ({ key: `c-${c.id}`, name: c.title, sub: c.programName, icon: GraduationCap, path: '/classes' }));
      }

      return next;
    };

    load()
      .then(d => { if (!cancelled) setData(d); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [isOpen, role, userId, pageKey]);

  const q = search.trim().toLowerCase();
  const matches = (item: ResultItem) =>
    item.name.toLowerCase().includes(q) || (item.sub ?? '').toLowerCase().includes(q);

  const pageItems: ResultItem[] = pages.map(p => ({ key: `page-${p.id}`, name: p.label, icon: p.icon, path: p.path }));

  const groups: { label: string; items: ResultItem[] }[] = [
    { label: t('cmd.quick_actions'), items: q ? pageItems.filter(matches) : pageItems },
    ...(q
      ? [
          { label: role === 'teacher' ? t('nav.my_students') : t('nav.students'), items: data.students.filter(matches).slice(0, MAX_PER_GROUP) },
          { label: t('nav.teachers'), items: data.teachers.filter(matches).slice(0, MAX_PER_GROUP) },
          { label: t('nav.programs'), items: data.programs.filter(matches).slice(0, MAX_PER_GROUP) },
          { label: role === 'teacher' ? t('nav.my_classes') : t('nav.classes'), items: data.classes.filter(matches).slice(0, MAX_PER_GROUP) },
        ]
      : []),
  ].filter(g => g.items.length > 0);

  const flatResults = groups.flatMap(g => g.items);

  useEffect(() => { setActiveIndex(0); }, [search]);

  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${activeIndex}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  const handleSelect = (path: string) => {
    router.push(path);
    onOpenChange(false);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(i => Math.min(i + 1, flatResults.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      const item = flatResults[activeIndex];
      if (item) handleSelect(item.path);
    }
  };

  let runningIndex = 0;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => onOpenChange(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ duration: 0.2 }}
            className="fixed top-[15%] left-1/2 -translate-x-1/2 w-full max-w-xl bg-[#141414] border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden"
          >
            <div className="flex items-center px-4 py-4 border-b border-white/10">
              <Search className="w-5 h-5 text-white/40" />
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={handleInputKeyDown}
                placeholder={t('cmd.placeholder')}
                className="flex-1 bg-transparent border-none text-white px-4 focus:outline-none placeholder:text-white/30"
              />
              {loading && <Loader2 className="w-4 h-4 text-white/40 animate-spin mr-2" />}
              <button onClick={() => onOpenChange(false)} className="p-1 text-white/40 hover:text-white transition-colors rounded-lg hover:bg-white/10">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div ref={listRef} className="max-h-[60vh] overflow-y-auto p-2 custom-scrollbar">
              {flatResults.length > 0 ? (
                <div className="space-y-1">
                  {groups.map((group) => (
                    <div key={group.label} className="space-y-1">
                      <div className="px-3 py-2 text-xs font-semibold text-white/30 uppercase tracking-widest">
                        {group.label}
                      </div>
                      {group.items.map((item) => {
                        const index = runningIndex++;
                        const active = index === activeIndex;
                        return (
                          <button
                            key={item.key}
                            data-index={index}
                            onClick={() => handleSelect(item.path)}
                            onMouseEnter={() => setActiveIndex(index)}
                            className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left group transition-colors ${active ? 'bg-white/5' : 'hover:bg-white/5'}`}
                          >
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${active ? 'bg-[#fc0ce4]/20' : 'bg-white/5 group-hover:bg-[#fc0ce4]/20'}`}>
                              <item.icon className={`w-4 h-4 ${active ? 'text-[#fc0ce4]' : 'text-white/50 group-hover:text-[#fc0ce4]'}`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className={`text-sm font-medium truncate ${active ? 'text-white' : 'text-white/80 group-hover:text-white'}`}>{item.name}</div>
                              {item.sub && <div className="text-xs text-white/40 truncate">{item.sub}</div>}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center text-white/40 text-sm">
                  {loading ? t('layout.loading') : `${t('cmd.no_results')} "${search}"`}
                </div>
              )}
            </div>

            <div className="bg-white/5 px-4 py-3 border-t border-white/10 flex items-center justify-between text-xs text-white/40">
              <span>Use <kbd className="bg-white/10 px-1.5 py-0.5 rounded text-white/60 font-sans">↑</kbd> <kbd className="bg-white/10 px-1.5 py-0.5 rounded text-white/60 font-sans">↓</kbd> {t('cmd.navigate')}</span>
              <span><kbd className="bg-white/10 px-1.5 py-0.5 rounded text-white/60 font-sans">esc</kbd> {t('cmd.close')}</span>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
