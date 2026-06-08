'use client';

import { useState, useEffect, ReactNode, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import {
  LayoutDashboard, Users, CalendarCheck, CreditCard,
  Settings, Bell, Search, Plus, LogOut, Menu, X,
  Globe, Moon, Sun, Megaphone, BookOpen, HelpCircle, UserPlus, CalendarDays, ClipboardList,
  ShieldCheck, UserCog, GraduationCap, ChevronRight, Loader2, AlertCircle
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
  role: 'admin' | 'teacher' | 'student' | 'superadmin';
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
  const pathname = usePathname();
  const router = useRouter();

  // New Enrollment modal
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [enrollStep, setEnrollStep] = useState<'pick' | 'teacher' | 'admin'>('pick');
  const [staffForm, setStaffForm] = useState({ firstName: '', lastName: '', email: '', password: 'FMA#2026' });
  const [staffSaving, setStaffSaving] = useState(false);
  const [staffError, setStaffError] = useState('');
  const [staffSuccess, setStaffSuccess] = useState('');

  const openEnrollModal = () => {
    setEnrollStep('pick');
    setStaffForm({ firstName: '', lastName: '', email: '', password: 'FMA#2026' });
    setStaffError('');
    setStaffSuccess('');
    setEnrollOpen(true);
  };

  const handleStaffCreate = async (accountRole: 'teacher' | 'admin') => {
    const { firstName, lastName, email, password } = staffForm;
    if (!firstName.trim() || !lastName.trim() || !email.includes('@') || !password) {
      setStaffError('All fields are required and email must be valid.');
      return;
    }
    setStaffSaving(true);
    setStaffError('');
    try {
      await api.users.create(email.trim().toLowerCase(), firstName.trim(), lastName.trim(), accountRole, password);
      setStaffSuccess(`${accountRole === 'teacher' ? 'Teacher' : 'Admin'} account created. Temporary password: ${password}`);
    } catch (e: any) {
      setStaffError(e.message || 'Failed to create account.');
    } finally {
      setStaffSaving(false);
    }
  };
  
  const activePath = pathname ?? '';
  const activeTab = activePath.split('/').filter(Boolean)[0] || 'dashboard';

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

  // Module → nav item (used to add extra nav items granted by system role)
  const MODULE_NAV: Record<string, { id: string; label: string; icon: any }> = {
    programs:      { id: 'programs',      label: t('nav.programs'),      icon: BookOpen },
    classes:       { id: 'classes',       label: 'Classes',              icon: BookOpen },
    announcements: { id: 'announcements', label: t('nav.announcements'), icon: Megaphone },
    grades:        { id: 'grades',        label: t('nav.grades'),        icon: ClipboardList },
    finance:       { id: 'finance',       label: t('nav.finance'),       icon: CreditCard },
    analytics:     { id: 'analytics',     label: 'Analytics',            icon: LayoutDashboard },
    users:         { id: 'students',      label: t('nav.students'),      icon: Users },
    attendance:    { id: 'attendance',    label: t('nav.attendance'),    icon: CalendarCheck },
    registrations: { id: 'registrations', label: t('nav.registrations'), icon: UserPlus },
    calendar:      { id: 'calendar',      label: t('nav.calendar'),      icon: CalendarDays },
    invoices:      { id: 'invoices',      label: t('nav.invoices'),      icon: CreditCard },
  };

  // Nav item id → system-role module name (for restricting base nav by system role)
  const NAV_TO_MODULE: Record<string, string> = {
    programs:      'programs',
    classes:       'classes',
    grading:       'grades',
    grades:        'grades',
    announcements: 'announcements',
    students:      'users',
    analytics:     'analytics',
    finance:       'finance',
    attendance:    'attendance',
    registrations: 'registrations',
    calendar:      'calendar',
    invoices:      'invoices',
    ...(role === 'admin' ? { settings: 'settings' } : {}),
  };

  const baseNavItems = (role === 'admin' || role === 'superadmin') ? adminNavItems : role === 'teacher' ? teacherNavItems : studentNavItems;

  // Build a permission map from the user's system role (module → actions[])
  // Only include entries with actual actions — empty arrays mean "no data", not "restricted"
  const rolePermMap = user?.systemRole?.permissions
    ? new Map(
        (user.systemRole.permissions as Array<{ module: string; actions: string[] }>)
          .filter(p => p.actions.length > 0)
          .map(p => [p.module, p.actions])
      )
    : null;

  // Returns false if the system role explicitly restricts a nav item's module (actions[] has no 'read').
  // Items whose nav id has no module mapping are always allowed (not managed by system roles).
  const isNavAllowed = (navId: string): boolean => {
    if (!rolePermMap) return true;
    const mod = NAV_TO_MODULE[navId];
    if (!mod) return true;
    const actions = rolePermMap.get(mod);
    if (actions === undefined) return true; // module not in role record → no override
    if (actions.includes('deactivate')) return false;
    return true; // any other actions (read/create/update/delete) = access granted
  };

  // Apply system role restrictions to base nav (all roles except superadmin)
  const filteredBaseNavItems = rolePermMap && role !== 'superadmin'
    ? baseNavItems.filter(item => isNavAllowed(item.id))
    : baseNavItems;

  // Modules already covered by the filtered base nav (e.g. teacher's 'grading' covers the 'grades' module)
  const coveredModules = new Set(
    filteredBaseNavItems.map(b => NAV_TO_MODULE[b.id]).filter(Boolean)
  );

  // For non-superadmin: add extra nav items granted by system role that aren't already in base nav
  const extraNavItems = role !== 'superadmin' && rolePermMap
    ? (user!.systemRole!.permissions as Array<{ module: string; actions: string[] }>)
        .filter(p => !p.actions.includes('deactivate') && p.actions.length > 0 && !coveredModules.has(p.module))
        .map(p => MODULE_NAV[p.module])
        .filter((item): item is NonNullable<typeof item> =>
          !!item && !filteredBaseNavItems.some(b => b.id === item.id)
        )
    : [];

  const navItems = [...filteredBaseNavItems, ...extraNavItems];
  const adminSystemItems = [
    { id: 'settings', label: t('nav.settings'), icon: Settings, path: '/settings' },
  ];
  const superadminSystemItems = [
    { id: 'analytics', label: 'Analytics', icon: LayoutDashboard, path: '/analytics' },
    { id: 'roles', label: t('nav.roles'), icon: ShieldCheck, path: '/superadmin/roles' },
    { id: 'users', label: t('nav.users'), icon: UserCog, path: '/superadmin/users' },
    { id: 'settings', label: t('nav.settings'), icon: Settings, path: '/settings' },
  ];
  const isNavActive = (item: { id: string; path?: string }) =>
    item.path ? activePath === item.path || activePath.startsWith(`${item.path}/`) : activeTab === item.id;

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
        
        {navItems.map((item) => {
          const active = isNavActive(item);
          return (
            <button
              key={item.id}
              onClick={() => router.push(`/${item.id}`)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 ${
                active
                  ? 'bg-gradient-to-r from-[#fc0ce4]/10 to-[#949ce4]/10 text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)] border border-[#fc0ce4]/20'
                  : 'text-white/50 hover:text-white hover:bg-white/5 border border-transparent'
              }`}
            >
              <item.icon className={`w-4 h-4 ${active ? 'text-[#fc0ce4]' : 'text-white/40'}`} />
              {item.label}
            </button>
          );
        })}

        {(role === 'admin' || role === 'superadmin') && (
          <>
            <div className="text-[10px] font-semibold text-white/30 uppercase tracking-widest mt-8 mb-4 px-2">{t('nav.system')}</div>
            {(role === 'superadmin' ? superadminSystemItems : adminSystemItems.filter(item => isNavAllowed(item.id))).map((item) => {
              const active = isNavActive(item);
              return (
                <button
                  key={item.id}
                  onClick={() => router.push(item.path)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 ${
                    active
                      ? 'bg-gradient-to-r from-[#fc0ce4]/10 to-[#949ce4]/10 text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)] border border-[#fc0ce4]/20'
                      : 'text-white/50 hover:text-white hover:bg-white/5 border border-transparent'
                  }`}
                >
                  <item.icon className={`w-4 h-4 ${active ? 'text-[#fc0ce4]' : 'text-white/40'}`} />
                  {item.label}
                </button>
              );
            })}
          </>
        )}
        {role !== 'admin' && role !== 'superadmin' && (
          <button
            onClick={() => router.push('/settings')}
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
                              onClick={() => { setIsNotifOpen(false); router.push('/announcements'); }}
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
                      onClick={() => { setIsNotifOpen(false); router.push('/announcements'); }}
                      className={`w-full py-3 text-xs font-medium text-[#fc0ce4] hover:text-[#fc0ce4]/80 transition-colors border-t ${theme === 'dark' ? 'border-white/10' : 'border-gray-100'}`}
                    >
                      {t('layout.view_all_announcements')}
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            
            {(role === 'admin' || role === 'superadmin') && (
              <button
                onClick={openEnrollModal}
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

      {/* New Enrollment Modal */}
      <AnimatePresence>
        {enrollOpen && (
          <motion.div
            key="enroll-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={(e) => { if (e.target === e.currentTarget) { setEnrollOpen(false); } }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              transition={{ duration: 0.18 }}
              className="glass-card rounded-3xl w-full max-w-md"
            >
              {/* Header */}
              <div className="p-6 border-b border-white/10 flex items-center justify-between">
                <div>
                  <h2 className="font-display text-2xl font-medium">New Account</h2>
                  {enrollStep !== 'pick' && (
                    <button
                      onClick={() => { setEnrollStep('pick'); setStaffError(''); setStaffSuccess(''); }}
                      className="text-xs text-white/40 hover:text-white mt-0.5 flex items-center gap-1 transition-colors"
                    >
                      ← Back
                    </button>
                  )}
                </div>
                <button onClick={() => setEnrollOpen(false)} className="p-2 text-white/40 hover:text-white hover:bg-white/5 rounded-xl transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6">
                {/* Step 1: Pick type */}
                {enrollStep === 'pick' && (
                  <div className="space-y-3">
                    <p className="text-sm text-white/50 mb-5">Select the type of account to create.</p>
                    {/* Student */}
                    <button
                      onClick={() => { setEnrollOpen(false); router.push('/students?enroll=1'); }}
                      className="w-full flex items-center gap-4 p-4 rounded-2xl border border-white/10 hover:border-[#fc0ce4]/30 hover:bg-[#fc0ce4]/5 transition-all group text-left"
                    >
                      <div className="w-10 h-10 rounded-xl bg-[#fc0ce4]/10 border border-[#fc0ce4]/20 flex items-center justify-center shrink-0 group-hover:bg-[#fc0ce4]/20 transition-colors">
                        <GraduationCap className="w-5 h-5 text-[#fc0ce4]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-white">Student</div>
                        <div className="text-xs text-white/40 mt-0.5">Enroll a student with program & class</div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-white/30 group-hover:text-white/60 transition-colors" />
                    </button>
                    {/* Teacher */}
                    <button
                      onClick={() => setEnrollStep('teacher')}
                      className="w-full flex items-center gap-4 p-4 rounded-2xl border border-white/10 hover:border-[#949ce4]/30 hover:bg-[#949ce4]/5 transition-all group text-left"
                    >
                      <div className="w-10 h-10 rounded-xl bg-[#949ce4]/10 border border-[#949ce4]/20 flex items-center justify-center shrink-0 group-hover:bg-[#949ce4]/20 transition-colors">
                        <Users className="w-5 h-5 text-[#949ce4]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-white">Teacher</div>
                        <div className="text-xs text-white/40 mt-0.5">Create a teacher account</div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-white/30 group-hover:text-white/60 transition-colors" />
                    </button>
                    {/* Admin */}
                    <button
                      onClick={() => setEnrollStep('admin')}
                      className="w-full flex items-center gap-4 p-4 rounded-2xl border border-white/10 hover:border-white/20 hover:bg-white/5 transition-all group text-left"
                    >
                      <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0 group-hover:bg-white/10 transition-colors">
                        <ShieldCheck className="w-5 h-5 text-white/60" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-white">Admin</div>
                        <div className="text-xs text-white/40 mt-0.5">Create an admin account</div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-white/30 group-hover:text-white/60 transition-colors" />
                    </button>
                  </div>
                )}

                {/* Step 2: Teacher / Admin form */}
                {(enrollStep === 'teacher' || enrollStep === 'admin') && (
                  <div className="space-y-4">
                    {staffSuccess ? (
                      <div className="flex flex-col items-center py-6 text-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                          <UserPlus className="w-6 h-6 text-emerald-400" />
                        </div>
                        <p className="text-sm text-emerald-300 font-medium">{staffSuccess}</p>
                        <div className="flex gap-3 mt-2">
                          <button
                            onClick={() => { setStaffSuccess(''); setStaffForm({ firstName: '', lastName: '', email: '', password: 'FMA#2026' }); }}
                            className="px-4 py-2 rounded-xl border border-white/10 text-sm font-medium hover:bg-white/5 transition-colors"
                          >
                            Create Another
                          </button>
                          <button
                            onClick={() => setEnrollOpen(false)}
                            className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#fc0ce4] to-[#949ce4] text-white text-sm font-semibold hover:opacity-90 transition-all"
                          >
                            Done
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {staffError && (
                          <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm">
                            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                            <span>{staffError}</span>
                          </div>
                        )}
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <label className="text-[11px] font-semibold text-white/50 uppercase tracking-widest">First Name *</label>
                            <input
                              type="text"
                              value={staffForm.firstName}
                              onChange={e => setStaffForm(f => ({ ...f, firstName: e.target.value }))}
                              className="glass-input w-full px-3 py-2.5 rounded-xl text-sm text-white"
                              placeholder="Jane"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[11px] font-semibold text-white/50 uppercase tracking-widest">Last Name *</label>
                            <input
                              type="text"
                              value={staffForm.lastName}
                              onChange={e => setStaffForm(f => ({ ...f, lastName: e.target.value }))}
                              className="glass-input w-full px-3 py-2.5 rounded-xl text-sm text-white"
                              placeholder="Doe"
                            />
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-semibold text-white/50 uppercase tracking-widest">Email *</label>
                          <input
                            type="email"
                            value={staffForm.email}
                            onChange={e => setStaffForm(f => ({ ...f, email: e.target.value }))}
                            className="glass-input w-full px-3 py-2.5 rounded-xl text-sm text-white"
                            placeholder="jane@example.com"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-semibold text-white/50 uppercase tracking-widest">Temporary Password *</label>
                          <input
                            type="text"
                            value={staffForm.password}
                            onChange={e => setStaffForm(f => ({ ...f, password: e.target.value }))}
                            className="glass-input w-full px-3 py-2.5 rounded-xl text-sm text-white font-mono"
                          />
                          <p className="text-[11px] text-white/35">User will be prompted to change on first login.</p>
                        </div>
                        <button
                          onClick={() => handleStaffCreate(enrollStep)}
                          disabled={staffSaving}
                          className="w-full mt-2 flex items-center justify-center gap-2 bg-gradient-to-r from-[#fc0ce4] to-[#949ce4] text-white px-4 py-3 rounded-xl text-sm font-semibold hover:opacity-90 transition-all disabled:opacity-50"
                        >
                          {staffSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                          {staffSaving ? 'Creating...' : `Create ${enrollStep === 'teacher' ? 'Teacher' : 'Admin'}`}
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
