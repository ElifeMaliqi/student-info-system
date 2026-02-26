import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Home, Users, CreditCard, Settings, User, BookOpen, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';

export function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { t } = useLanguage();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setSearch('');
    }
  }, [isOpen]);

  const actions = [
    { id: 'dash', name: 'Go to Dashboard', icon: Home, path: '/dashboard' },
    { id: 'students', name: 'Manage Students', icon: Users, path: '/students' },
    { id: 'finance', name: 'View Finance & Invoices', icon: CreditCard, path: '/finance' },
    { id: 'settings', name: 'System Settings', icon: Settings, path: '/settings' },
    { id: 'attendance', name: 'Record Attendance', icon: BookOpen, path: '/attendance' },
  ];

  const filteredActions = actions.filter(action => 
    action.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelect = (path: string) => {
    navigate(path);
    setIsOpen(false);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
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
                placeholder="Type a command or search..."
                className="flex-1 bg-transparent border-none text-white px-4 focus:outline-none placeholder:text-white/30"
              />
              <button onClick={() => setIsOpen(false)} className="p-1 text-white/40 hover:text-white transition-colors rounded-lg hover:bg-white/10">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="max-h-[60vh] overflow-y-auto p-2 custom-scrollbar">
              {filteredActions.length > 0 ? (
                <div className="space-y-1">
                  <div className="px-3 py-2 text-xs font-semibold text-white/30 uppercase tracking-widest">
                    Quick Actions
                  </div>
                  {filteredActions.map((action) => (
                    <button
                      key={action.id}
                      onClick={() => handleSelect(action.path)}
                      className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-white/5 text-left group transition-colors"
                    >
                      <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center group-hover:bg-[#fc0ce4]/20 group-hover:text-[#fc0ce4] transition-colors">
                        <action.icon className="w-4 h-4 text-white/50 group-hover:text-[#fc0ce4]" />
                      </div>
                      <span className="text-sm font-medium text-white/80 group-hover:text-white">{action.name}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center text-white/40 text-sm">
                  No results found for "{search}"
                </div>
              )}
            </div>
            
            <div className="bg-white/5 px-4 py-3 border-t border-white/10 flex items-center justify-between text-xs text-white/40">
              <span>Use <kbd className="bg-white/10 px-1.5 py-0.5 rounded text-white/60 font-sans">↑</kbd> <kbd className="bg-white/10 px-1.5 py-0.5 rounded text-white/60 font-sans">↓</kbd> to navigate</span>
              <span><kbd className="bg-white/10 px-1.5 py-0.5 rounded text-white/60 font-sans">esc</kbd> to close</span>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
