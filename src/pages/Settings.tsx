import { useState } from 'react';
import { motion } from 'motion/react';
import { Save, Shield, Database, Bell, User, Building, Globe, Lock } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

export default function Settings({ role }: { role: 'admin' | 'teacher' | 'student' }) {
  const [activeSection, setActiveSection] = useState('general');
  const { t } = useLanguage();

  const adminSections = [
    { id: 'general', label: t('settings.general'), icon: Building },
    { id: 'security', label: t('settings.security'), icon: Shield },
    { id: 'notifications', label: t('settings.notifications'), icon: Bell },
    { id: 'data', label: t('settings.data'), icon: Database },
  ];

  const userSections = [
    { id: 'general', label: t('settings.profile'), icon: User },
    { id: 'security', label: t('settings.security'), icon: Shield },
    { id: 'notifications', label: t('settings.notifications'), icon: Bell },
  ];

  const sections = role === 'admin' ? adminSections : userSections;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-medium tracking-tight mb-1">{role === 'admin' ? t('settings.title') : t('settings.profile')}</h1>
          <p className="text-white/50 text-sm">{role === 'admin' ? t('settings.desc') : 'Manage your personal information and preferences.'}</p>
        </div>
        <button className="bg-gradient-to-r from-[#fc0ce4] to-[#949ce4] text-white px-6 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 hover:opacity-90 transition-all shadow-[0_0_20px_rgba(252,12,228,0.2)] self-start sm:self-auto">
          <Save className="w-4 h-4" />
          {t('settings.save')}
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Settings Navigation */}
        <div className="w-full lg:w-64 shrink-0">
          <div className="glass-card rounded-2xl p-2 flex lg:flex-col gap-1 overflow-x-auto">
            {sections.map((section) => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-300 whitespace-nowrap ${
                  activeSection === section.id 
                    ? 'bg-gradient-to-r from-[#fc0ce4]/10 to-[#949ce4]/10 text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)] border border-[#fc0ce4]/20' 
                    : 'text-white/50 hover:text-white hover:bg-white/5 border border-transparent'
                }`}
              >
                <section.icon className={`w-4 h-4 ${activeSection === section.id ? 'text-[#fc0ce4]' : 'text-white/40'}`} />
                {section.label}
              </button>
            ))}
          </div>
        </div>

        {/* Settings Content */}
        <div className="flex-1 space-y-6">
          {activeSection === 'general' && role === 'admin' && (
            <div className="glass-card rounded-3xl p-6 lg:p-8 space-y-8">
              <div>
                <h2 className="font-display text-xl font-medium mb-4">{t('settings.inst_profile')}</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[11px] font-semibold text-white/60 uppercase tracking-widest ml-1">{t('settings.inst_name')}</label>
                    <input type="text" className="glass-input w-full px-4 py-3 rounded-xl text-sm text-white placeholder:text-white/20" defaultValue="Future Minds Academy" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[11px] font-semibold text-white/60 uppercase tracking-widest ml-1">{t('settings.contact_email')}</label>
                    <input type="email" className="glass-input w-full px-4 py-3 rounded-xl text-sm text-white placeholder:text-white/20" defaultValue="admin@futureminds.edu" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[11px] font-semibold text-white/60 uppercase tracking-widest ml-1">{t('settings.phone')}</label>
                    <input type="tel" className="glass-input w-full px-4 py-3 rounded-xl text-sm text-white placeholder:text-white/20" defaultValue="+1 (555) 123-4567" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[11px] font-semibold text-white/60 uppercase tracking-widest ml-1">{t('settings.timezone')}</label>
                    <select className="glass-select w-full px-4 py-3 rounded-xl text-sm appearance-none">
                      <option>Pacific Time (PT)</option>
                      <option>Eastern Time (ET)</option>
                      <option>Central European Time (CET)</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t border-white/5">
                <h2 className="font-display text-xl font-medium mb-4">{t('settings.branding')}</h2>
                <div className="flex items-center gap-6">
                  <div className="w-24 h-24 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
                    <img src="https://futureminds.io/assets/imgs/logo/site-logo-white-2.png" alt="Logo" className="w-16 object-contain" referrerPolicy="no-referrer" />
                  </div>
                  <div className="space-y-2">
                    <button className="px-4 py-2 rounded-xl border border-white/10 text-sm font-medium hover:bg-white/5 transition-colors">
                      {t('settings.change_logo')}
                    </button>
                    <p className="text-[11px] text-white/40">Recommended size: 512x512px (PNG or SVG)</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'general' && role !== 'admin' && (
            <div className="glass-card rounded-3xl p-6 lg:p-8 space-y-8">
              <div>
                <h2 className="font-display text-xl font-medium mb-4">{t('settings.profile')}</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[11px] font-semibold text-white/60 uppercase tracking-widest ml-1">{t('students.first_name')}</label>
                    <input type="text" className="glass-input w-full px-4 py-3 rounded-xl text-sm text-white placeholder:text-white/20" defaultValue={role === 'teacher' ? 'Alan' : 'John'} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[11px] font-semibold text-white/60 uppercase tracking-widest ml-1">{t('students.last_name')}</label>
                    <input type="text" className="glass-input w-full px-4 py-3 rounded-xl text-sm text-white placeholder:text-white/20" defaultValue={role === 'teacher' ? 'Turing' : 'Doe'} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[11px] font-semibold text-white/60 uppercase tracking-widest ml-1">{t('students.email')}</label>
                    <input type="email" className="glass-input w-full px-4 py-3 rounded-xl text-sm text-white placeholder:text-white/20" defaultValue={role === 'teacher' ? 'alan@futureminds.io' : 'john@student.futureminds.io'} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[11px] font-semibold text-white/60 uppercase tracking-widest ml-1">{t('students.phone')}</label>
                    <input type="tel" className="glass-input w-full px-4 py-3 rounded-xl text-sm text-white placeholder:text-white/20" defaultValue="+383 44 123 456" />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-[11px] font-semibold text-white/60 uppercase tracking-widest ml-1">{t('settings.avatar')}</label>
                    <div className="flex items-center gap-4">
                      <img src={`https://picsum.photos/seed/${role}/100/100`} alt="Avatar" className="w-12 h-12 rounded-full border border-white/10" referrerPolicy="no-referrer" />
                      <input type="url" className="glass-input flex-1 px-4 py-3 rounded-xl text-sm text-white placeholder:text-white/20" placeholder="https://..." defaultValue={`https://picsum.photos/seed/${role}/100/100`} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'security' && (
            <div className="glass-card rounded-3xl p-6 lg:p-8 space-y-8">
              <div>
                <h2 className="font-display text-xl font-medium mb-4">Access Control</h2>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-[#fc0ce4]/10 flex items-center justify-center border border-[#fc0ce4]/20">
                        <Lock className="w-5 h-5 text-[#fc0ce4]" />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-white/90">Two-Factor Authentication (2FA)</div>
                        <div className="text-xs text-white/40 mt-0.5">Require 2FA for all staff accounts</div>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" defaultChecked />
                      <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#fc0ce4]"></div>
                    </label>
                  </div>
                  
                  <div className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/5">
                        <Globe className="w-5 h-5 text-white/60" />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-white/90">IP Whitelisting</div>
                        <div className="text-xs text-white/40 mt-0.5">Restrict admin access to specific IP addresses</div>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" />
                      <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#fc0ce4]"></div>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Placeholders for other sections */}
          {(activeSection === 'notifications' || activeSection === 'data') && (
            <div className="glass-card rounded-3xl p-6 lg:p-12 flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center border border-white/5 mb-4">
                {activeSection === 'notifications' ? <Bell className="w-8 h-8 text-white/30" /> : <Database className="w-8 h-8 text-white/30" />}
              </div>
              <h2 className="font-display text-xl font-medium mb-2">Configuration Options</h2>
              <p className="text-white/40 text-sm max-w-md">
                These settings are currently being configured for your tenant. They will be available in the next system update.
              </p>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
