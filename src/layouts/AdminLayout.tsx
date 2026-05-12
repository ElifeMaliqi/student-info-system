import { useState, useEffect, ReactNode, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  LayoutDashboard, Users, CalendarCheck, CreditCard,
  Settings, Bell, Search, Plus, LogOut, Menu, X,
  Globe, Moon, Sun, ChevronDown, Megaphone, BookOpen, HelpCircle, UserPlus, CalendarDays, ClipboardList
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useUser } from '../context/UserContext';
import { CommandPalette } from '../components/CommandPalette';
import { SlideOver } from '../components/SlideOver';
import { playPopSound } from '../utils/sound';
import { api } from '../services/api';
import type { Announcement } from '../types';

interface AdminLayoutProps {
  children: ReactNode;
  onLogout: () => void;
  role: 'admin' | 'teacher' | 'student';
}

export default function AdminLayout({ children, onLogout, role }: AdminLayoutProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isFaqOpen, setIsFaqOpen] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<Announcement[]>([]);
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifSeen, setNotifSeen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { language, setLanguage, t } = useLanguage();
  const { user } = useUser();
  const location = useLocation();
  const navigate = useNavigate();
  
  const activeTab = location.pathname.split('/').filter(Boolean)[0] || 'dashboard';

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

  // Load notifications (announcements for this user)
  useEffect(() => {
    if (!user) return;
    setNotifLoading(true);
    api.announcements.getAll(role, user.id)
      .then(data => setNotifications(data.slice(0, 20)))
      .catch(() => {})
      .finally(() => setNotifLoading(false));
  }, [role, user]);

  // Close notif panel on outside click
  useEffect(() => {
    if (!isNotifOpen) return;
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setIsNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isNotifOpen]);

  const adminNavItems = [
    { id: 'dashboard', label: t('nav.dashboard'), icon: LayoutDashboard },
    { id: 'students', label: t('nav.students'), icon: Users },
    { id: 'programs', label: t('nav.programs'), icon: BookOpen },
    { id: 'registrations', label: t('nav.registrations'), icon: UserPlus },
    { id: 'calendar', label: t('nav.calendar'), icon: CalendarDays },
    { id: 'attendance', label: t('nav.attendance'), icon: CalendarCheck },
    { id: 'grades', label: t('nav.grades'), icon: ClipboardList },
    { id: 'finance', label: t('nav.finance'), icon: CreditCard },
    { id: 'announcements', label: t('nav.announcements'), icon: Megaphone },
  ];

  const teacherNavItems = [
    { id: 'dashboard',     label: t('nav.dashboard'),     icon: LayoutDashboard },
    { id: 'classes',       label: t('nav.my_classes'),    icon: BookOpen        },
    { id: 'grading',       label: t('nav.grading'),       icon: ClipboardList   },
    { id: 'students',      label: t('nav.my_students'),   icon: Users           },
    { id: 'calendar',      label: t('nav.calendar'),      icon: CalendarDays    },
    { id: 'announcements', label: t('nav.announcements'), icon: Megaphone       },
  ];

  const studentNavItems = [
    { id: 'dashboard',     label: t('nav.my_portal'),      icon: LayoutDashboard },
    { id: 'grades',        label: t('nav.grades'),         icon: ClipboardList   },
    { id: 'attendance',    label: t('nav.attendance'),     icon: CalendarCheck   },
    { id: 'invoices',      label: t('nav.invoices'),       icon: CreditCard      },
    { id: 'calendar',      label: t('nav.calendar'),       icon: CalendarDays    },
    { id: 'announcements', label: t('nav.announcements'),  icon: Megaphone       },
  ];

  const navItems = role === 'admin' ? adminNavItems : role === 'teacher' ? teacherNavItems : studentNavItems;

  const SidebarContent = () => (
    <>
      <div className="h-20 flex items-center px-6 border-b border-white/5 shrink-0">
        <img 
          src="/logo/site-logo.png" 
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
        {role !== 'admin' && (
          <button 
            onClick={() => navigate('/settings')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 mt-4 ${
              activeTab === 'settings' 
                ? 'bg-gradient-to-r from-[#fc0ce4]/10 to-[#949ce4]/10 text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)] border border-[#fc0ce4]/20' 
                : 'text-white/50 hover:text-white hover:bg-white/5 border border-transparent'
            }`}
          >
            <Settings className={`w-4 h-4 ${activeTab === 'settings' ? 'text-[#fc0ce4]' : 'text-white/40'}`} />
            {t('nav.settings')}
          </button>
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
          <img
            src={user?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.id || role}`}
            alt="User"
            className="w-9 h-9 rounded-full border border-white/10"
            referrerPolicy="no-referrer"
          />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-white truncate group-hover:text-[#fc0ce4] transition-colors">
              {user ? `${user.firstName} ${user.lastName}` : role}
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
              title={t('layout.help_faq')}
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

            <div className="relative" ref={notifRef}>
              <button
                onClick={() => { playPopSound(); setIsNotifOpen(v => !v); setNotifSeen(true); }}
                className={`w-10 h-10 rounded-full ${theme === 'dark' ? 'bg-white/5 border-white/5 text-white/60 hover:text-[#fc0ce4] hover:bg-[#fc0ce4]/10 hover:border-[#fc0ce4]/20' : 'bg-gray-100 border-gray-200 text-gray-500 hover:text-[#fc0ce4] hover:bg-[#fc0ce4]/10 hover:border-[#fc0ce4]/20'} border flex items-center justify-center transition-all relative`}
                title={t('layout.notifications')}
              >
                <Bell className="w-4 h-4" />
                {!notifSeen && notifications.length > 0 && (
                  <span className="absolute top-2 right-2 w-2 h-2 bg-[#fc0ce4] rounded-full border-2 border-[#050505]" />
                )}
              </button>

              <AnimatePresence>
                {isNotifOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.96 }}
                    transition={{ duration: 0.15 }}
                    className={`absolute right-0 top-12 w-80 rounded-2xl border shadow-2xl z-50 overflow-hidden ${theme === 'dark' ? 'bg-[#0f0f0f] border-white/10' : 'bg-white border-gray-200'}`}
                  >
                    <div className={`px-4 py-3 border-b flex items-center justify-between ${theme === 'dark' ? 'border-white/10' : 'border-gray-100'}`}>
                      <span className="text-sm font-semibold">{t('layout.notifications')}</span>
                      <span className="text-[11px] text-white/40">{notifications.length} {t('layout.notifications').toLowerCase()}</span>
                    </div>
                    <div className="max-h-96 overflow-y-auto custom-scrollbar">
                      {notifLoading ? (
                        <div className="flex items-center justify-center py-10 text-white/30 text-sm gap-2">
                          <span className="w-4 h-4 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
                          {t('layout.loading')}
                        </div>
                      ) : notifications.length === 0 ? (
                        <div className="flex flex-col items-center py-10 text-white/30 gap-2">
                          <Bell className="w-6 h-6 opacity-40" />
                          <p className="text-sm">{t('layout.no_announcements')}</p>
                        </div>
                      ) : (
                        notifications.map(n => {
                          const priorityColor: Record<string, string> = {
                            urgent: 'bg-red-500',
                            high: 'bg-amber-500',
                            medium: 'bg-blue-500',
                            low: 'bg-white/20',
                          };
                          return (
                            <button
                              key={n.id}
                              onClick={() => { setIsNotifOpen(false); navigate('/announcements'); }}
                              className={`w-full text-left px-4 py-3 border-b transition-colors ${theme === 'dark' ? 'border-white/5 hover:bg-white/5' : 'border-gray-50 hover:bg-gray-50'}`}
                            >
                              <div className="flex items-start gap-3">
                                <span className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${priorityColor[n.priority] ?? 'bg-white/20'}`} />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate">{n.title}</p>
                                  <p className={`text-xs truncate mt-0.5 ${theme === 'dark' ? 'text-white/40' : 'text-gray-400'}`}>{n.content}</p>
                                  <p className={`text-[10px] mt-1 ${theme === 'dark' ? 'text-white/25' : 'text-gray-300'}`}>{n.date} · {n.author}</p>
                                </div>
                              </div>
                            </button>
                          );
                        })
                      )}
                    </div>
                    <button
                      onClick={() => { setIsNotifOpen(false); navigate('/announcements'); }}
                      className={`w-full py-3 text-xs font-medium text-[#fc0ce4] hover:text-[#fc0ce4]/80 transition-colors border-t ${theme === 'dark' ? 'border-white/10' : 'border-gray-100'}`}
                    >
                      {t('layout.view_all_announcements')}
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            
            {role === 'admin' && (
              <button
                onClick={() => navigate('/students?enroll=1')}
                className="bg-gradient-to-r from-[#fc0ce4] to-[#949ce4] text-white px-4 py-2 rounded-full text-sm font-semibold flex items-center gap-2 hover:opacity-90 transition-all shadow-[0_0_20px_rgba(252,12,228,0.2)]"
              >
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

      <CommandPalette role={role} />

      <SlideOver isOpen={isFaqOpen} onClose={() => setIsFaqOpen(false)} title={t('layout.help_faq')}>
        <div className="space-y-6">
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-white">{t('faq.search_q')}</h3>
            <p className="text-sm text-white/50 leading-relaxed">{t('faq.search_a')}</p>
          </div>
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-white">{t('faq.profile_q')}</h3>
            <p className="text-sm text-white/50 leading-relaxed">{t('faq.profile_a')}</p>
          </div>
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-white">{t('faq.export_q')}</h3>
            <p className="text-sm text-white/50 leading-relaxed">{t('faq.export_a')}</p>
          </div>
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-white">{t('faq.select_q')}</h3>
            <p className="text-sm text-white/50 leading-relaxed">{t('faq.select_a')}</p>
          </div>
        </div>
      </SlideOver>
    </div>
  );
}
