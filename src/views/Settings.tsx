'use client';

import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Save, Database, User, Building, Lock, CheckCircle, AlertCircle, Loader2, Download, Phone, MapPin, Clock, Upload, MessageSquare } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useUser } from '../context/UserContext';
import { supabase } from '../lib/supabase';
import { exportCsv } from '../utils/csv';

interface AppSettings {
  id: string;
  institution_name: string;
  contact_email: string;
  phone: string;
  secondary_phone: string;
  address: string;
  open_hours: string;
  timezone: string;
  logo_url: string;
}

export default function Settings({ role }: { role: 'admin' | 'teacher' | 'student' | 'superadmin' }) {
  const isAdminRole = role === 'admin' || role === 'superadmin';
  const [activeSection, setActiveSection] = useState('profile');
  const { t } = useLanguage();
  const { user, setUser } = useUser();

  // Admin platform settings
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);
  const [platEmail, setPlatEmail] = useState('');
  const [platPhone, setPlatPhone] = useState('');
  const [platPhone2, setPlatPhone2] = useState('');
  const [platAddress, setPlatAddress] = useState('');
  const [platHours, setPlatHours] = useState('');
  const [instName, setInstName] = useState('');
  const [instTimezone, setInstTimezone] = useState('CET');
  const [instLogo, setInstLogo] = useState('');

  // Profile fields (all roles)
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');

  // Password reset
  const [pwResetLoading, setPwResetLoading] = useState(false);
  const [pwResetSent, setPwResetSent] = useState(false);

  // SMS templates
  interface SmsTemplate { type: string; label: string; sms_body: string; variables: string[]; }
  const [smsTemplates, setSmsTemplates] = useState<SmsTemplate[]>([]);
  const [editedBodies, setEditedBodies] = useState<Record<string, string>>({});
  const [savingTemplate, setSavingTemplate] = useState('');

  // UI state
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [exporting, setExporting] = useState('');
  const [uploading, setUploading] = useState(false);

  // --- Sidebar sections ---
  const adminSections = [
    { id: 'profile', label: t('settings.profile'), icon: User },
    { id: 'platform', label: t('settings.platform'), icon: Building },
    { id: 'messages', label: t('settings.messages'), icon: MessageSquare },
    { id: 'data', label: t('settings.data'), icon: Database },
  ];

  const userSections = [
    { id: 'profile', label: t('settings.profile'), icon: User },
  ];

  const sections = isAdminRole ? adminSections : userSections;

  // Load data
  useEffect(() => {
    if (isAdminRole) {
      supabase.from('message_templates').select('type, label, sms_body, variables').order('type').then(({ data }) => {
        if (data) {
          setSmsTemplates(data as SmsTemplate[]);
          const bodies: Record<string, string> = {};
          data.forEach((t: SmsTemplate) => { bodies[t.type] = t.sms_body; });
          setEditedBodies(bodies);
        }
      });

      supabase.from('app_settings').select('*').limit(1).single().then(({ data }) => {
        if (data) {
          setAppSettings(data);
          setInstName(data.institution_name);
          setPlatEmail(data.contact_email);
          setPlatPhone(data.phone);
          setPlatPhone2(data.secondary_phone || '');
          setPlatAddress(data.address || '');
          setPlatHours(data.open_hours || '');
          setInstTimezone(data.timezone);
          setInstLogo(data.logo_url || '');
        }
      });
    }

    if (user) {
      supabase.from('profiles').select('first_name, last_name, phone, avatar_url').eq('id', user.id).single().then(({ data }) => {
        if (data) {
          setFirstName(data.first_name || '');
          setLastName(data.last_name || '');
          setPhone(data.phone || '');
          setAvatarUrl(data.avatar_url || '');
        }
      });
    }
  }, [role, user]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    const maxSize = 2 * 1024 * 1024; // 2 MB
    if (file.size > maxSize) {
      showToast('error', t('settings.file_too_large'));
      return;
    }

    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowed.includes(file.type)) {
      showToast('error', t('settings.file_type'));
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
      const path = `${user.id}/avatar.${ext}`;

      const { data: upData, error: upErr } = await supabase.storage.from('avatars').upload(path, file, {
        upsert: true,
        contentType: file.type,
      });
      if (upErr) throw upErr;

      const publicUrl = ((upData as { publicUrl?: string })?.publicUrl || path) + '?t=' + Date.now();

      // Save to profile
      await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', user.id);
      setAvatarUrl(publicUrl);
      setUser({ ...user, avatar: publicUrl });
      showToast('success', t('settings.upload_success'));
    } catch (err: any) {
      showToast('error', err.message || t('settings.upload_failed'));
    } finally {
      setUploading(false);
      e.target.value = ''; // reset input
    }
  };

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  };

  const handleRequestPasswordReset = async () => {
    if (!user) return;
    setPwResetLoading(true);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('fma_sis_token') : null;
      const res = await fetch('/api/auth/request-password-reset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error?.message || 'Failed to send reset link.');
      setPwResetSent(true);
    } catch (err: any) {
      showToast('error', err.message || 'Failed to send reset link.');
    } finally {
      setPwResetLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (activeSection === 'profile') {
        // Save profile + optional password
        const { error } = await supabase.from('profiles').update({
          first_name: firstName,
          last_name: lastName,
          phone: phone,
          avatar_url: avatarUrl || null,
        }).eq('id', user!.id);
        if (error) throw error;
        setUser({ ...user!, firstName, lastName, avatar: avatarUrl || user!.avatar });

        showToast('success', t('settings.profile_saved'));
      } else if (activeSection === 'platform' && appSettings) {
        const { error } = await supabase.from('app_settings').update({
          institution_name: instName,
          contact_email: platEmail,
          phone: platPhone,
          secondary_phone: platPhone2,
          address: platAddress,
          open_hours: platHours,
          timezone: instTimezone,
          logo_url: instLogo,
          updated_at: new Date().toISOString(),
        }).eq('id', appSettings.id);
        if (error) throw error;
        showToast('success', t('settings.platform_saved'));
      }
    } catch (err: any) {
      showToast('error', err.message || t('settings.save_failed'));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveTemplate = async (type: string) => {
    setSavingTemplate(type);
    try {
      const { error } = await supabase
        .from('message_templates')
        .update({ sms_body: editedBodies[type] })
        .eq('type', type);
      if (error) throw error;
      setSmsTemplates(prev => prev.map(t => t.type === type ? { ...t, sms_body: editedBodies[type] } : t));
      showToast('success', t('settings.template_saved'));
    } catch (err: any) {
      showToast('error', err.message || t('settings.save_failed'));
    } finally {
      setSavingTemplate('');
    }
  };

  const handleExport = async (table: string) => {
    setExporting(table);
    try {
      const { data, error } = await supabase.from(table).select('*');
      if (error) throw error;
      if (!data || data.length === 0) {
        showToast('error', t('settings.no_data_found'));
        return;
      }
      const headers = Object.keys(data[0]);
      exportCsv({
        filename: `${table}_export`,
        headers,
        rows: data.map(row => headers.map(h => row[h])),
      });
      showToast('success', t('settings.exported'));
    } catch (err: any) {
      showToast('error', err.message || t('settings.export_failed'));
    } finally {
      setExporting('');
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Toast */}
      {toast && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-5 py-3 rounded-2xl border shadow-xl backdrop-blur-xl ${
            toast.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
              : 'bg-red-500/10 border-red-500/20 text-red-300'
          }`}
        >
          {toast.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          <span className="text-sm font-medium">{toast.message}</span>
        </motion.div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-medium tracking-tight mb-1">{isAdminRole ? t('settings.title') : t('settings.profile')}</h1>
          <p className="text-white/50 text-sm">{isAdminRole ? t('settings.desc') : t('settings.profile_desc')}</p>
        </div>
        {activeSection !== 'data' && (
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-gradient-to-r from-[#fc0ce4] to-[#949ce4] text-white px-6 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 hover:opacity-90 transition-all shadow-[0_0_20px_rgba(252,12,228,0.2)] self-start sm:self-auto disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {t('settings.save')}
          </button>
        )}
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

          {/* ===== PROFILE SECTION (all roles) ===== */}
          {activeSection === 'profile' && (
            <>
              <div className="glass-card rounded-3xl p-6 lg:p-8 space-y-8">
                <div>
                  <h2 className="font-display text-xl font-medium mb-4">
                    <User className="w-5 h-5 inline-block mr-2 text-[#fc0ce4]" />
                    {t('settings.profile')}
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Email — read-only */}
                    <div className="space-y-2">
                      <label className="text-[11px] font-semibold text-white/60 uppercase tracking-widest ml-1">{t('settings.email_username')}</label>
                      <input type="email" className="glass-input w-full px-4 py-3 rounded-xl text-sm text-white/50 cursor-not-allowed" value={user?.email || ''} disabled />
                    </div>
                    {/* Phone */}
                    <div className="space-y-2">
                      <label className="text-[11px] font-semibold text-white/60 uppercase tracking-widest ml-1">{t('students.phone')}</label>
                      <input type="tel" className="glass-input w-full px-4 py-3 rounded-xl text-sm text-white placeholder:text-white/20" value={phone} onChange={e => setPhone(e.target.value)} />
                    </div>
                    {/* First Name */}
                    <div className="space-y-2">
                      <label className="text-[11px] font-semibold text-white/60 uppercase tracking-widest ml-1">{t('students.first_name')}</label>
                      <input type="text" className="glass-input w-full px-4 py-3 rounded-xl text-sm text-white placeholder:text-white/20" value={firstName} onChange={e => setFirstName(e.target.value)} />
                    </div>
                    {/* Last Name */}
                    <div className="space-y-2">
                      <label className="text-[11px] font-semibold text-white/60 uppercase tracking-widest ml-1">{t('students.last_name')}</label>
                      <input type="text" className="glass-input w-full px-4 py-3 rounded-xl text-sm text-white placeholder:text-white/20" value={lastName} onChange={e => setLastName(e.target.value)} />
                    </div>
                    {/* Avatar */}
                    <div className="space-y-2 md:col-span-2">
                      <label className="text-[11px] font-semibold text-white/60 uppercase tracking-widest ml-1">{t('settings.avatar')}</label>
                      <div className="flex items-center gap-4">
                        <img src={avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.id || role}`} alt="Avatar" className="w-12 h-12 rounded-full border border-white/10" referrerPolicy="no-referrer" />
                        <label className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/10 text-sm font-medium hover:bg-white/5 transition-colors cursor-pointer">
                          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                          {uploading ? t('settings.uploading') : t('settings.upload_photo')}
                          <input type="file" accept="image/jpeg,image/png,image/gif,image/webp" className="hidden" onChange={handleAvatarUpload} disabled={uploading} />
                        </label>
                        <span className="text-[11px] text-white/40">{t('settings.file_hints')}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Password card */}
              <div className="glass-card rounded-3xl p-6 lg:p-8 space-y-6">
                <h2 className="font-display text-xl font-medium">
                  <Lock className="w-5 h-5 inline-block mr-2 text-[#fc0ce4]" />
                  {t('settings.change_password')}
                </h2>
                {pwResetSent ? (
                  <div className="flex items-start gap-3 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                    <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-emerald-400">Reset link sent</p>
                      <p className="text-xs text-white/50 mt-1">Check your email for a password reset link. The link expires in 1 hour.</p>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-white/50">A password reset link will be sent to your registered email address. The link expires in 1 hour.</p>
                    <button
                      onClick={handleRequestPasswordReset}
                      disabled={pwResetLoading}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/10 text-sm font-medium hover:bg-white/5 transition-colors disabled:opacity-50"
                    >
                      {pwResetLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                      {pwResetLoading ? 'Sending…' : 'Send Password Reset Link'}
                    </button>
                  </>
                )}
              </div>
            </>
          )}

          {/* ===== PLATFORM SETTINGS (admin only) ===== */}
          {activeSection === 'platform' && isAdminRole && (
            <>
              {/* Contact Info */}
              <div className="glass-card rounded-3xl p-6 lg:p-8 space-y-8">
                <div>
                  <h2 className="font-display text-xl font-medium mb-4">
                    <Building className="w-5 h-5 inline-block mr-2 text-[#fc0ce4]" />
                    {t('settings.inst_profile')}
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[11px] font-semibold text-white/60 uppercase tracking-widest ml-1">{t('settings.inst_name')}</label>
                      <input type="text" className="glass-input w-full px-4 py-3 rounded-xl text-sm text-white placeholder:text-white/20" value={instName} onChange={e => setInstName(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[11px] font-semibold text-white/60 uppercase tracking-widest ml-1">{t('settings.timezone')}</label>
                      <select className="glass-select w-full px-4 py-3 rounded-xl text-sm appearance-none" value={instTimezone} onChange={e => setInstTimezone(e.target.value)}>
                        <option value="CET">Central European Time (CET)</option>
                        <option value="ET">Eastern Time (ET)</option>
                        <option value="PT">Pacific Time (PT)</option>
                        <option value="GMT">Greenwich Mean Time (GMT)</option>
                        <option value="EET">Eastern European Time (EET)</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Branding */}
                <div className="pt-6 border-t border-white/5">
                  <h2 className="font-display text-xl font-medium mb-4">{t('settings.branding')}</h2>
                  <div className="flex items-center gap-6">
                    <div className="w-24 h-24 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden">
                      {instLogo ? (
                        <img src={instLogo} alt="Logo" className="w-16 object-contain" referrerPolicy="no-referrer" />
                      ) : (
                        <Building className="w-8 h-8 text-white/30" />
                      )}
                    </div>
                    <div className="space-y-2 flex-1">
                    <label className="text-[11px] font-semibold text-white/60 uppercase tracking-widest ml-1">{t('settings.logo_url')}</label>
                      <input type="url" className="glass-input w-full px-4 py-3 rounded-xl text-sm text-white placeholder:text-white/20" placeholder="https://..." value={instLogo} onChange={e => setInstLogo(e.target.value)} />
                      <p className="text-[11px] text-white/40">{t('settings.logo_hint')}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Contact Details */}
              <div className="glass-card rounded-3xl p-6 lg:p-8 space-y-6">
                <h2 className="font-display text-xl font-medium">
                  <Phone className="w-5 h-5 inline-block mr-2 text-[#fc0ce4]" />
                  {t('settings.contact_info')}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[11px] font-semibold text-white/60 uppercase tracking-widest ml-1">{t('settings.contact_email')}</label>
                    <input type="email" className="glass-input w-full px-4 py-3 rounded-xl text-sm text-white placeholder:text-white/20" value={platEmail} onChange={e => setPlatEmail(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[11px] font-semibold text-white/60 uppercase tracking-widest ml-1">{t('settings.primary_phone')}</label>
                    <input type="tel" className="glass-input w-full px-4 py-3 rounded-xl text-sm text-white placeholder:text-white/20" value={platPhone} onChange={e => setPlatPhone(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[11px] font-semibold text-white/60 uppercase tracking-widest ml-1">{t('settings.secondary_phone')}</label>
                    <input type="tel" className="glass-input w-full px-4 py-3 rounded-xl text-sm text-white placeholder:text-white/20" placeholder="Optional" value={platPhone2} onChange={e => setPlatPhone2(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[11px] font-semibold text-white/60 uppercase tracking-widest ml-1">
                      <Clock className="w-3 h-3 inline-block mr-1" />
                      {t('settings.open_hours')}
                    </label>
                    <input type="text" className="glass-input w-full px-4 py-3 rounded-xl text-sm text-white placeholder:text-white/20" placeholder="Mon–Fri 08:00–17:00" value={platHours} onChange={e => setPlatHours(e.target.value)} />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-[11px] font-semibold text-white/60 uppercase tracking-widest ml-1">
                      <MapPin className="w-3 h-3 inline-block mr-1" />
                      {t('settings.address')}
                    </label>
                    <input type="text" className="glass-input w-full px-4 py-3 rounded-xl text-sm text-white placeholder:text-white/20" placeholder="Street, City, Country" value={platAddress} onChange={e => setPlatAddress(e.target.value)} />
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ===== MESSAGE TEMPLATES (admin only) ===== */}
          {activeSection === 'messages' && isAdminRole && (
            <div className="space-y-6">
              <div className="glass-card rounded-3xl p-6 lg:p-8">
                <h2 className="font-display text-xl font-medium mb-1">
                  <MessageSquare className="w-5 h-5 inline-block mr-2 text-[#fc0ce4]" />
                  {t('settings.sms_templates')}
                </h2>
                <p className="text-white/40 text-sm mb-6">{t('settings.messages_desc')}</p>

                {smsTemplates.length === 0 ? (
                  <div className="flex items-center justify-center py-10 text-white/30 text-sm">
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Loading templates…
                  </div>
                ) : (
                  <div className="space-y-8">
                    {smsTemplates.map(tpl => (
                      <div key={tpl.type} className="border border-white/8 rounded-2xl p-5 space-y-4 bg-white/[0.02]">
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <div className="text-sm font-semibold text-white">{tpl.label}</div>
                            <div className="text-[11px] text-white/30 mt-0.5 font-mono">{tpl.type}</div>
                          </div>
                          <button
                            onClick={() => handleSaveTemplate(tpl.type)}
                            disabled={!!savingTemplate || editedBodies[tpl.type] === tpl.sms_body}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#fc0ce4]/10 to-[#949ce4]/10 border border-[#fc0ce4]/20 text-[#fc0ce4] text-xs font-semibold hover:opacity-80 transition-all disabled:opacity-30"
                          >
                            {savingTemplate === tpl.type ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                            {t('settings.save')}
                          </button>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[11px] font-semibold text-white/60 uppercase tracking-widest ml-1">
                            SMS Body
                          </label>
                          <textarea
                            rows={8}
                            className="glass-input w-full px-4 py-3 rounded-xl text-sm text-white font-mono placeholder:text-white/20 resize-y leading-relaxed"
                            value={editedBodies[tpl.type] ?? tpl.sms_body}
                            onChange={e => setEditedBodies(prev => ({ ...prev, [tpl.type]: e.target.value }))}
                          />
                        </div>
                        {tpl.variables?.length > 0 && (
                          <div className="space-y-1.5">
                            <div className="text-[11px] font-semibold text-white/40 uppercase tracking-widest ml-1">
                              {t('settings.template_vars')}
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {tpl.variables.map((v: string) => (
                                <span key={v} className="inline-flex items-center px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-[11px] font-mono text-white/50">
                                  {`{{${v}}}`}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ===== DATA EXPORT (admin only) ===== */}
          {activeSection === 'data' && isAdminRole && (
            <div className="glass-card rounded-3xl p-6 lg:p-8 space-y-8">
              <div>
                <h2 className="font-display text-xl font-medium mb-2">
                  <Database className="w-5 h-5 inline-block mr-2 text-[#fc0ce4]" />
                  {t('settings.data_export')}
                </h2>
                <p className="text-white/40 text-sm mb-6">{t('settings.data_export_desc')}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    { table: 'profiles', label: t('settings.export_profiles') },
                    { table: 'registration_applications', label: t('settings.export_enrollments') },
                    { table: 'attendance', label: t('settings.export_attendance') },
                    { table: 'invoices', label: t('settings.export_invoices') },
                    { table: 'grade_table_entries', label: t('settings.export_grades') },
                  ].map(item => (
                    <button
                      key={item.table}
                      onClick={() => handleExport(item.table)}
                      disabled={!!exporting}
                      className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors text-left disabled:opacity-50"
                    >
                      <div>
                        <div className="text-sm font-medium text-white/90">{item.label}</div>
                        <div className="text-xs text-white/40 mt-0.5">{item.table}.csv</div>
                      </div>
                      {exporting === item.table ? (
                        <Loader2 className="w-4 h-4 text-white/40 animate-spin" />
                      ) : (
                        <Download className="w-4 h-4 text-white/40" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
