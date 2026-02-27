import { useState, useEffect, ReactNode, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  LayoutDashboard, Users, CalendarCheck, CreditCard,
  Settings, Bell, Search, Plus, LogOut, Menu, X,
  Globe, Moon, Sun, ChevronDown, Megaphone, BookOpen, HelpCircle, UserPlus
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { CommandPalette } from '../components/CommandPalette';
import { SlideOver } from '../components/SlideOver';
import { playPopSound } from '../utils/sound';
import { User } from '../types';

interface AdminLayoutProps {
  children: ReactNode;
  onLogout: () => void;
  role: 'admin' | 'teacher' | 'student';
  setRole: (role: 'admin' | 'teacher' | 'student') => void;
  currentUser: User | null;
}

export default function AdminLayout({ children, onLogout, role, setRole, currentUser }: AdminLayoutProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isFaqOpen, setIsFaqOpen] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const scrollRef = useRef<HTMLDivElement>(null);
  const { language, setLanguage, t } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();
  
  const activeTab = location.pathname.substring(1) || 'dashboard';

  // Close mobile menu and scroll to top when tab changes
  useEffect(() => {
    setIsMobileMenuOpen(false);
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [activeTab]);

  useEffect(() => {
    if (theme === 'light') {
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
    }
  }, [theme]);

  const adminNavItems = [
    { id: 'dashboard', label: t('nav.dashboard'), icon: LayoutDashboard },
    { id: 'students', label: t('nav.students'), icon: Users },
    { id: 'programs', label: t('nav.programs'), icon: BookOpen },
    { id: 'registrations', label: 'Registrations', icon: UserPlus },
    { id: 'attendance', label: t('nav.attendance'), icon: CalendarCheck },
    { id: 'finance', label: t('nav.finance'), icon: CreditCard },
    { id: 'announcements', label: t('nav.announcements'), icon: Megaphone },
  ];

  const teacherNavItems = [
    { id: 'dashboard', label: t('nav.dashboard'), icon: LayoutDashboard },
    { id: 'quizzes', label: t('nav.quizzes'), icon: CalendarCheck },
    { id: 'students', label: t('nav.my_students'), icon: Users },
    { id: 'announcements', label: t('nav.announcements'), icon: Megaphone },
  ];

  const studentNavItems = [
    { id: 'dashboard', label: t('nav.my_portal'), icon: LayoutDashboard },
    { id: 'grades', label: t('nav.grades'), icon: CalendarCheck },
    { id: 'invoices', label: t('nav.invoices'), icon: CreditCard },
    { id: 'announcements', label: t('nav.announcements'), icon: Megaphone },
  ];

  const navItems = role === 'admin' ? adminNavItems : role === 'teacher' ? teacherNavItems : studentNavItems;

  const SidebarContent = () => (
    <>
      <div className="h-20 flex items-center px-6 border-b border-white/5 shrink-0">
        <img 
          src="https://futureminds.io/assets/imgs/logo/site-logo-white-2.png" 
          alt="Future Minds Logo" 
          className="h-8 object-contain"
          referrerPolicy="no-referrer"
        />
      </div>

      <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto custom-scrollbar">
        <div className="text-[10px] font-semibold text-white/30 uppercase tracking-widest mb-4 px-2">{t('nav.main_menu')}</div>
        
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => navigate(`/${item.id}`)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 ${
              activeTab === item.id 
                ? 'bg-gradient-to-r from-[#fc0ce4]/10 to-[#949ce4]/10 text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)] border border-[#fc0ce4]/20' 
                : 'text-white/50 hover:text-white hover:bg-white/5 border border-transparent'
            }`}
          >
            <item.icon className={`w-4 h-4 ${activeTab === item.id ? 'text-[#fc0ce4]' : 'text-white/40'}`} />
            {item.label}
          </button>
        ))}

        {role === 'admin' && (
          <>
            <div className="text-[10px] font-semibold text-white/30 uppercase tracking-widest mt-8 mb-4 px-2">{t('nav.system')}</div>
            <button 
              onClick={() => navigate('/settings')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 ${
                activeTab === 'settings' 
                  ? 'bg-gradient-to-r from-[#fc0ce4]/10 to-[#949ce4]/10 text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)] border border-[#fc0ce4]/20' 
                  : 'text-white/50 hover:text-white hover:bg-white/5 border border-transparent'
              }`}
            >
              <Settings className={`w-4 h-4 ${activeTab === 'settings' ? 'text-[#fc0ce4]' : 'text-white/40'}`} />
              {t('nav.settings')}
            </button>
          </>
        )}
      </nav>

      <div className="p-4 border-t border-white/5 shrink-0">
        {/* Mobile Toggles */}
        <div className="flex lg:hidden items-center justify-between mb-4 px-2">
          <button 
            onClick={() => setLanguage(language === 'EN' ? 'AL' : 'EN')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all ${
              theme === 'dark' 
                ? 'bg-white/5 border-white/10 text-white/70 hover:text-white hover:bg-white/10' 
                : 'bg-white border-gray-200 text-gray-600 hover:text-gray-900 shadow-sm'
            }`}
          >
            <Globe className="w-4 h-4" />
            <span className="text-xs font-bold">{language}</span>
          </button>
          <button 
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className={`w-9 h-9 rounded-full ${theme === 'dark' ? 'bg-white/5 border-white/5 text-white/60 hover:text-white hover:bg-white/10' : 'bg-gray-100 border-gray-200 text-gray-500 hover:text-gray-900 hover:bg-gray-200'} border flex items-center justify-center transition-all`}
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>

        <div className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition-colors cursor-pointer group">
          <img src="https://picsum.photos/seed/admin/100/100" alt="User" className="w-9 h-9 rounded-full border border-white/10" referrerPolicy="no-referrer" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-white truncate group-hover:text-[#fc0ce4] transition-colors">
              {role === 'admin' ? 'Sarah Connor' : role === 'teacher' ? 'Prof. Alan Turing' : 'Elena Rodriguez'}
            </div>
            <div className="text-[11px] text-white/40 truncate capitalize">{t(`role.${role}`)}</div>
          </div>
          <button onClick={(e) => { e.stopPropagation(); onLogout(); }} className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white/40 hover:text-white" title={t('nav.logout')}>
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div className={`flex h-screen w-full ${theme === 'dark' ? 'bg-[#050505] text-white' : 'bg-[#f8f9fa] text-gray-900'} overflow-hidden font-sans selection:bg-[#fc0ce4]/30 relative transition-colors duration-500`}>
      
      {/* --- Animated Background Gradients --- */}
      {theme === 'dark' && (
        <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
          <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-[#fc0ce4]/10 blur-[120px] mix-blend-screen animate-blob" />
          <div className="absolute top-[20%] right-[-10%] w-[40%] h-[40%] rounded-full bg-[#949ce4]/10 blur-[120px] mix-blend-screen animate-blob animation-delay-2000" />
          <div className="absolute bottom-[-20%] left-[20%] w-[50%] h-[50%] rounded-full bg-[#1e277a]/20 blur-[120px] mix-blend-screen animate-blob animation-delay-4000" />
        </div>
      )}
      {theme === 'light' && (
        <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
          <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-[#fc0ce4]/5 blur-[120px] mix-blend-multiply animate-blob" />
          <div className="absolute top-[20%] right-[-10%] w-[40%] h-[40%] rounded-full bg-[#949ce4]/5 blur-[120px] mix-blend-multiply animate-blob animation-delay-2000" />
        </div>
      )}

      {/* --- Desktop Sidebar --- */}
      <aside className={`hidden lg:flex w-64 h-full border-r ${theme === 'dark' ? 'border-white/5 bg-[#0a0a0a]/80' : 'border-gray-200 bg-white/90'} backdrop-blur-md z-20 flex-col transition-colors duration-500`}>
        <SidebarContent />
      </aside>

      {/* --- Mobile Sidebar Overlay --- */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div 
            key="mobile-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsMobileMenuOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
        {isMobileMenuOpen && (
          <motion.aside 
            key="mobile-sidebar"
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className={`fixed inset-y-0 left-0 w-72 border-r ${theme === 'dark' ? 'border-white/5 bg-[#0a0a0a]' : 'border-gray-200 bg-white'} z-50 flex flex-col lg:hidden shadow-2xl`}
          >
            <SidebarContent />
          </motion.aside>
        )}
      </AnimatePresence>

      {/* --- Main Content --- */}
      <main className="flex-1 flex flex-col h-full z-10 overflow-hidden relative">
        
        {/* Header */}
        <header className={`h-20 flex items-center justify-between px-4 lg:px-8 border-b ${theme === 'dark' ? 'border-white/5' : 'border-gray-200'} transition-all duration-300 z-30 ${isScrolled ? (theme === 'dark' ? 'bg-[#0a0a0a]/90 backdrop-blur-md' : 'bg-white/90 backdrop-blur-md') : 'bg-transparent'}`}>
          
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsMobileMenuOpen(true)}
              className={`lg:hidden p-2 -ml-2 ${theme === 'dark' ? 'text-white/60 hover:text-white hover:bg-white/10' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'} rounded-xl transition-colors`}
            >
              <Menu className="w-6 h-6" />
            </button>

            <div className="hidden md:block relative w-96 group">
              <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${theme === 'dark' ? 'text-white/30' : 'text-gray-400'} group-focus-within:text-[#fc0ce4] transition-colors`} />
              <input 
                type="text" 
                placeholder={`${t('header.search')} (Press Cmd+K)`} 
                className={`w-full ${theme === 'dark' ? 'bg-white/5 border-white/5 text-white placeholder:text-white/30' : 'bg-gray-100 border-gray-200 text-gray-900 placeholder:text-gray-400'} border rounded-full py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-[#fc0ce4]/40 focus:bg-[#fc0ce4]/5 focus:shadow-[0_0_15px_rgba(252,12,228,0.1)] transition-all`}
              />
            </div>
          </div>
          
          <div className="flex items-center gap-2 lg:gap-4">
            <button 
              onClick={() => { playPopSound(); setIsFaqOpen(true); }}
              className={`w-10 h-10 rounded-full ${theme === 'dark' ? 'bg-white/5 border-white/5 text-white/60 hover:text-white hover:bg-white/10' : 'bg-gray-100 border-gray-200 text-gray-500 hover:text-gray-900 hover:bg-gray-200'} border flex items-center justify-center transition-all`}
              title="Help & FAQ"
            >
              <HelpCircle className="w-4 h-4" />
            </button>

            {/* Language Toggle - Desktop Only */}
            <button 
              onClick={() => setLanguage(language === 'EN' ? 'AL' : 'EN')}
              className={`hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all ${
                theme === 'dark' 
                  ? 'bg-white/5 border-white/10 text-white/70 hover:text-white hover:bg-white/10' 
                  : 'bg-white border-gray-200 text-gray-600 hover:text-gray-900 shadow-sm'
              }`}
              title="Change Language"
            >
              <Globe className="w-4 h-4" />
              <span className="text-xs font-bold">{language}</span>
            </button>

            {/* Theme Toggle - Desktop Only */}
            <button 
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className={`hidden lg:flex w-10 h-10 rounded-full ${theme === 'dark' ? 'bg-white/5 border-white/5 text-white/60 hover:text-white hover:bg-white/10' : 'bg-gray-100 border-gray-200 text-gray-500 hover:text-gray-900 hover:bg-gray-200'} border items-center justify-center transition-all`}
              title="Toggle Theme"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            <button className={`w-10 h-10 rounded-full ${theme === 'dark' ? 'bg-white/5 border-white/5 text-white/60 hover:text-[#fc0ce4] hover:bg-[#fc0ce4]/10 hover:border-[#fc0ce4]/20' : 'bg-gray-100 border-gray-200 text-gray-500 hover:text-[#fc0ce4] hover:bg-[#fc0ce4]/10 hover:border-[#fc0ce4]/20'} border flex items-center justify-center transition-all relative`}>
              <Bell className="w-4 h-4" />
              <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-[#fc0ce4] rounded-full border-2 border-[#050505]"></span>
            </button>
            
            {role === 'admin' && (
              <button className="bg-gradient-to-r from-[#fc0ce4] to-[#949ce4] text-white px-4 py-2 rounded-full text-sm font-semibold flex items-center gap-2 hover:opacity-90 transition-all shadow-[0_0_20px_rgba(252,12,228,0.2)]">
                <Plus className="w-4 h-4 hidden sm:block" />
                <span className="hidden sm:block">{t('header.new_enrollment')}</span>
                <span className="sm:hidden">{t('header.new')}</span>
              </button>
            )}
          </div>
        </header>

        {/* Scrollable Area */}
        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-4 lg:p-8 custom-scrollbar"
          onScroll={(e) => setIsScrolled((e.target as HTMLDivElement).scrollTop > 10)}
        >
          <div className="max-w-6xl mx-auto">
            {children}
          </div>
        </div>
      </main>

      <CommandPalette />

      <SlideOver isOpen={isFaqOpen} onClose={() => setIsFaqOpen(false)} title="Help & FAQ">
        <div className="space-y-6">
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-white">How do I search quickly?</h3>
            <p className="text-sm text-white/50 leading-relaxed">Press <kbd className="bg-white/10 px-1 rounded text-white/70">Cmd</kbd> + <kbd className="bg-white/10 px-1 rounded text-white/70">K</kbd> (or Ctrl+K on Windows) anywhere in the app to open the Command Palette. You can jump to any page instantly.</p>
          </div>
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-white">How do I view a student's full profile?</h3>
            <p className="text-sm text-white/50 leading-relaxed">Click on any student row in the Students table to open their quick-view panel. From there, you can click "View Full Profile" to see all their details.</p>
          </div>
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-white">Can I export data?</h3>
            <p className="text-sm text-white/50 leading-relaxed">Yes! Look for the "Export" button on the Students, Finance, and Attendance pages to download a CSV or PDF report.</p>
          </div>
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-white">How do I select multiple students?</h3>
            <p className="text-sm text-white/50 leading-relaxed">Use the checkboxes on the left side of the Students table to select multiple records for bulk actions.</p>
          </div>
        </div>
      </SlideOver>
    </div>
  );
}
