'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Megaphone, Plus, Calendar, Globe, GraduationCap, BookOpen,
  Users, Shield, Layers, Loader2, AlertCircle, X, Mail, MessageSquare,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useUser, useModulePermissions } from '../context/UserContext';
import { api } from '../services/api';
import { SlideOver } from '../components/SlideOver';
import type { Announcement, Role } from '../types';

type Priority = 'low' | 'medium' | 'high' | 'urgent';
type AudienceType = 'all' | 'students' | 'teachers' | 'admins' | 'program_specific' | 'class_specific';

const PRIORITY_CONFIG: Record<Priority, { label: string; badge: string; bar: string }> = {
  low:    { label: 'Low',    badge: 'bg-blue-500/10 border-blue-500/20 text-blue-400',     bar: 'bg-blue-500' },
  medium: { label: 'Medium', badge: 'bg-amber-500/10 border-amber-500/20 text-amber-400',  bar: 'bg-amber-500' },
  high:   { label: 'High',   badge: 'bg-orange-500/10 border-orange-500/20 text-orange-400', bar: 'bg-orange-500' },
  urgent: { label: 'Urgent', badge: 'bg-red-500/10 border-red-500/20 text-red-400',         bar: 'bg-red-500' },
};

const ADMIN_AUDIENCES: { value: AudienceType; label: string; Icon: React.ElementType }[] = [
  { value: 'all',              label: 'Everyone',     Icon: Globe },
  { value: 'students',         label: 'All Students', Icon: GraduationCap },
  { value: 'teachers',         label: 'All Teachers', Icon: BookOpen },
  { value: 'admins',           label: 'All Admins',   Icon: Shield },
  { value: 'program_specific', label: 'By Degree',    Icon: Layers },
  { value: 'class_specific',   label: 'By Class',     Icon: Users },
];

function audienceLabel(ann: Announcement) {
  if (ann.audience === 'all')              return 'Everyone';
  if (ann.audience === 'students')         return 'All Students';
  if (ann.audience === 'teachers')         return 'All Teachers';
  if (ann.audience === 'admins')           return 'All Admins';
  if (ann.audience === 'program_specific') return ann.program ? `Degree: ${ann.program}` : 'By Degree';
  if (ann.audience === 'class_specific')   return ann.className ? `Class: ${ann.className}` : 'By Class';
  return ann.audience;
}

const EMPTY_FORM = { title: '', content: '', priority: 'medium' as Priority, audience: '' as AudienceType | '', programId: '', classId: '', sendAsEmail: false, sendAsSms: false };
const PRIORITIES: Priority[] = ['low', 'medium', 'high', 'urgent'];

export default function Announcements({ role }: { role: Role }) {
  const { t } = useLanguage();
  const { user } = useUser();
  const { isOverridden: permOverridden, canCreate } = useModulePermissions('announcements');

  const [announcements, setAnnouncements]   = useState<Announcement[]>([]);
  const [loading, setLoading]               = useState(true);
  const [showCreate, setShowCreate]         = useState(false);
  const [selectedAnn, setSelectedAnn]       = useState<Announcement | null>(null);
  const [availableClasses, setAvailableClasses] = useState<{ id: string; title: string }[]>([]);
  const [availablePrograms, setAvailablePrograms] = useState<{ id: string; name: string }[]>([]);
  const [form, setForm]         = useState({ ...EMPTY_FORM });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => { if (user) void loadAnnouncements(); }, [user]);

  useEffect(() => {
    if (!showCreate || !user || role === 'student') return;
    setForm({ ...EMPTY_FORM, audience: role === 'teacher' ? 'class_specific' : '' });
    setSubmitError('');
    void api.announcements.getAvailableClasses(role, user.id).then(setAvailableClasses);
    if (role === 'admin') {
      void api.programs.getAll().then(progs => setAvailablePrograms(progs.map(p => ({ id: p.id, name: p.name }))));
    }
  }, [showCreate]);

  async function loadAnnouncements() {
    if (!user) return;
    setLoading(true);
    try {
      setAnnouncements(await api.announcements.getAll(role, user.id));
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.audience) { setSubmitError('Please select a target audience.'); return; }
    if (form.audience === 'class_specific' && !form.classId) { setSubmitError('Please select a class.'); return; }
    if (form.audience === 'program_specific' && !form.programId) { setSubmitError('Please select a degree.'); return; }
    setSubmitting(true);
    setSubmitError('');
    try {
      await api.announcements.create({
        title:     form.title,
        content:   form.content,
        priority:  form.priority,
        audience:  form.audience as AudienceType,
        programId: form.audience === 'program_specific' ? form.programId : undefined,
        classId:   form.audience === 'class_specific'   ? form.classId   : undefined,
        author: '',
      });

      const senderName = user ? `${user.firstName} ${user.lastName}` : 'Future Minds';
      const notifyParams = {
        title: form.title,
        content: form.content,
        audience: form.audience as AudienceType,
        programId: form.audience === 'program_specific' ? form.programId : undefined,
        classId: form.audience === 'class_specific' ? form.classId : undefined,
        senderName,
      };

      // Send email if checkbox is checked
      if (form.sendAsEmail) {
        try {
          await api.announcements.sendEmail(notifyParams);
        } catch (emailErr) {
          console.error('Email sending failed:', emailErr);
        }
      }

      // Send SMS if checkbox is checked
      if (form.sendAsSms) {
        try {
          await api.announcements.sendSms(notifyParams);
        } catch (smsErr) {
          console.error('SMS sending failed:', smsErr);
        }
      }

      setShowCreate(false);
      void loadAnnouncements();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to publish');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-medium tracking-tight mb-1">{t('announcements.title')}</h1>
            <p className="text-white/50 text-sm">{t('announcements.desc')}</p>
          </div>
          {role !== 'student' && (!permOverridden || canCreate) && (
            <button
              onClick={() => setShowCreate(true)}
              className="bg-gradient-to-r from-[#fc0ce4] to-[#949ce4] text-white px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 hover:opacity-90 transition-all shadow-[0_0_20px_rgba(252,12,228,0.2)] self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              {t('announcements.new')}
            </button>
          )}
        </div>

        {/* List */}
        {loading ? (
          <div className="flex items-center justify-center py-24 text-white/30">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : announcements.length === 0 ? (
          <div className="glass-card rounded-3xl p-16 flex flex-col items-center gap-3 text-white/30">
            <Megaphone className="w-8 h-8 opacity-40" />
            <p className="text-sm">No announcements yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {announcements.map(ann => {
              const pCfg = PRIORITY_CONFIG[ann.priority as Priority] ?? PRIORITY_CONFIG.medium;
              return (
                <div key={ann.id} onClick={() => setSelectedAnn(ann)} className="glass-card rounded-2xl overflow-hidden hover:bg-white/[0.02] transition-colors group flex cursor-pointer">
                  {/* Priority bar */}
                  <div className={`w-1 shrink-0 ${pCfg.bar}`} />
                  <div className="flex-1 p-5 min-w-0">
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center shrink-0 group-hover:bg-[#fc0ce4]/10 group-hover:border-[#fc0ce4]/20 transition-all">
                        <Megaphone className="w-5 h-5 text-white/40 group-hover:text-[#fc0ce4] transition-colors" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-1.5">
                          <h3 className="text-base font-semibold text-white/90 leading-snug">{ann.title}</h3>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[10px] font-semibold uppercase tracking-wider ${pCfg.badge}`}>
                              {pCfg.label}
                            </span>
                            <span className="flex items-center gap-1 text-xs text-white/30">
                              <Calendar className="w-3 h-3" />{ann.date}
                            </span>
                          </div>
                        </div>
                        <p className="text-sm text-white/55 leading-relaxed mb-3 line-clamp-2">{ann.content}</p>
                        <div className="flex flex-wrap items-center gap-3 text-xs">
                          <div className="flex items-center gap-2">
                            <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-[9px] font-bold text-white/70">
                              {ann.author.charAt(0)}
                            </div>
                            <span className="font-medium text-white/60">{ann.author}</span>
                            {ann.authorRole && (
                              <>
                                <span className="text-white/20">•</span>
                                <span className="text-white/35 capitalize">{ann.authorRole}</span>
                              </>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/5 border border-white/8 text-white/40">
                            <Users className="w-3 h-3" />
                            {audienceLabel(ann)}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </motion.div>

      {/* Announcement detail modal */}
      <AnimatePresence>
        {selectedAnn && (() => {
          const pCfg = PRIORITY_CONFIG[selectedAnn.priority as Priority] ?? PRIORITY_CONFIG.medium;
          return (
            <motion.div
              key="ann-detail-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedAnn(null)}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 16 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 16 }}
                transition={{ type: 'spring', stiffness: 300, damping: 28 }}
                onClick={e => e.stopPropagation()}
                className="glass-card rounded-3xl overflow-hidden w-full max-w-lg shadow-2xl"
              >
                {/* Priority bar + header */}
                <div className={`h-1 w-full ${pCfg.bar}`} />
                <div className="p-6 space-y-5">
                  {/* Title row */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[#fc0ce4]/10 border border-[#fc0ce4]/20 flex items-center justify-center shrink-0">
                        <Megaphone className="w-5 h-5 text-[#fc0ce4]" />
                      </div>
                      <div>
                        <h2 className="text-lg font-semibold text-white/95 leading-snug">{selectedAnn.title}</h2>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[10px] font-semibold uppercase tracking-wider ${pCfg.badge}`}>
                            {pCfg.label}
                          </span>
                          <span className="flex items-center gap-1 text-[11px] text-white/30">
                            <Calendar className="w-3 h-3" />{selectedAnn.date}
                          </span>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => setSelectedAnn(null)}
                      className="p-1.5 rounded-lg text-white/40 hover:text-white/80 hover:bg-white/10 transition-all shrink-0"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Meta row */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white/5 border border-white/8 rounded-xl p-3 space-y-1">
                      <p className="text-[10px] font-semibold text-white/35 uppercase tracking-widest">From</p>
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-[9px] font-bold text-white/70">
                          {selectedAnn.author.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white/85">{selectedAnn.author}</p>
                          {selectedAnn.authorRole && (
                            <p className="text-[11px] text-white/40 capitalize">{selectedAnn.authorRole}</p>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="bg-white/5 border border-white/8 rounded-xl p-3 space-y-1">
                      <p className="text-[10px] font-semibold text-white/35 uppercase tracking-widest">Directed To</p>
                      <div className="flex items-center gap-1.5">
                        <Users className="w-4 h-4 text-white/40" />
                        <p className="text-sm font-medium text-white/85">{audienceLabel(selectedAnn)}</p>
                      </div>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-semibold text-white/35 uppercase tracking-widest">Message</p>
                    <p className="text-sm text-white/70 leading-relaxed whitespace-pre-wrap">{selectedAnn.content}</p>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          );
        })()}
      </AnimatePresence>

      {/* Create SlideOver */}
      <SlideOver isOpen={showCreate} onClose={() => setShowCreate(false)} title={t('announcements.new')}>
        <form onSubmit={e => void handleSubmit(e)} className="space-y-6">

          {/* Title */}
          <div className="space-y-2">
            <label className="text-[11px] font-semibold text-white/50 uppercase tracking-widest">{t('announcements.msg_title')}</label>
            <input
              type="text" required
              placeholder="e.g. Important Update"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-[#fc0ce4]/40 focus:bg-[#fc0ce4]/5 transition-all"
            />
          </div>

          {/* Priority */}
          <div className="space-y-2">
            <label className="text-[11px] font-semibold text-white/50 uppercase tracking-widest">Priority</label>
            <div className="grid grid-cols-4 gap-2">
              {PRIORITIES.map(p => {
                const cfg = PRIORITY_CONFIG[p];
                return (
                  <button key={p} type="button"
                    onClick={() => setForm(f => ({ ...f, priority: p }))}
                    className={`py-2 rounded-xl border text-xs font-semibold transition-all ${form.priority === p ? cfg.badge : 'bg-white/5 border-white/10 text-white/40 hover:border-white/20'}`}
                  >
                    {cfg.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Audience */}
          <div className="space-y-2">
            <label className="text-[11px] font-semibold text-white/50 uppercase tracking-widest">{t('announcements.audience')}</label>
            {role === 'admin' ? (
              <div className="grid grid-cols-2 gap-2">
                {ADMIN_AUDIENCES.map(({ value, label, Icon }) => (
                  <button key={value} type="button"
                    onClick={() => setForm(f => ({ ...f, audience: value, classId: '', programId: '' }))}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-medium transition-all ${form.audience === value ? 'bg-[#fc0ce4]/10 border-[#fc0ce4]/30 text-[#fc0ce4]' : 'bg-white/5 border-white/10 text-white/50 hover:border-white/20 hover:text-white/80'}`}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    {label}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-white/40 bg-white/5 rounded-xl px-3 py-2.5 border border-white/8">
                Your announcement will be sent to a specific class.
              </p>
            )}
          </div>

          {/* Degree picker */}
          {form.audience === 'program_specific' && (
            <div className="space-y-2">
              <label className="text-[11px] font-semibold text-white/50 uppercase tracking-widest">Degree</label>
              <select
                value={form.programId}
                onChange={e => setForm(f => ({ ...f, programId: e.target.value }))}
                className="glass-select w-full px-4 py-2.5 rounded-xl text-sm"
              >
                <option value="">Select a degree…</option>
                {availablePrograms.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          )}

          {/* Class picker */}
          {(form.audience === 'class_specific' || role === 'teacher') && (
            <div className="space-y-2">
              <label className="text-[11px] font-semibold text-white/50 uppercase tracking-widest">Class</label>
              {availableClasses.length === 0 ? (
                <p className="text-xs text-white/30 bg-white/5 rounded-xl px-3 py-2.5 border border-white/8">No classes available.</p>
              ) : (
                <select
                  value={form.classId}
                  onChange={e => setForm(f => ({ ...f, classId: e.target.value }))}
                  className="glass-select w-full px-4 py-2.5 rounded-xl text-sm"
                >
                  <option value="">Select a class…</option>
                  {availableClasses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                </select>
              )}
            </div>
          )}

          {/* Message */}
          <div className="space-y-2">
            <label className="text-[11px] font-semibold text-white/50 uppercase tracking-widest">{t('announcements.message')}</label>
            <textarea
              required rows={5}
              placeholder="Write your announcement here…"
              value={form.content}
              onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-[#fc0ce4]/40 focus:bg-[#fc0ce4]/5 transition-all resize-none"
            />
          </div>

          {/* Notification channels */}
          {role !== 'student' && (
            <div className="space-y-2">
              <label className="text-[11px] font-semibold text-white/50 uppercase tracking-widest">Also notify via</label>
              <label className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10 cursor-pointer hover:bg-white/[0.07] transition-colors group">
                <input
                  type="checkbox"
                  checked={form.sendAsEmail}
                  onChange={e => setForm(f => ({ ...f, sendAsEmail: e.target.checked }))}
                  className="w-4 h-4 rounded border-white/20 bg-white/5 text-[#fc0ce4] focus:ring-[#fc0ce4]/30 focus:ring-offset-0 cursor-pointer accent-[#fc0ce4]"
                />
                <Mail className={`w-4 h-4 shrink-0 transition-colors ${form.sendAsEmail ? 'text-[#fc0ce4]' : 'text-white/40 group-hover:text-white/60'}`} />
                <div>
                  <p className={`text-sm font-medium transition-colors ${form.sendAsEmail ? 'text-white' : 'text-white/60'}`}>Send as email</p>
                  <p className="text-[11px] text-white/35">Send via email to the selected audience</p>
                </div>
              </label>
              <label className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10 cursor-pointer hover:bg-white/[0.07] transition-colors group">
                <input
                  type="checkbox"
                  checked={form.sendAsSms}
                  onChange={e => setForm(f => ({ ...f, sendAsSms: e.target.checked }))}
                  className="w-4 h-4 rounded border-white/20 bg-white/5 text-[#fc0ce4] focus:ring-[#fc0ce4]/30 focus:ring-offset-0 cursor-pointer accent-[#fc0ce4]"
                />
                <MessageSquare className={`w-4 h-4 shrink-0 transition-colors ${form.sendAsSms ? 'text-[#fc0ce4]' : 'text-white/40 group-hover:text-white/60'}`} />
                <div>
                  <p className={`text-sm font-medium transition-colors ${form.sendAsSms ? 'text-white' : 'text-white/60'}`}>Send as SMS</p>
                  <p className="text-[11px] text-white/35">Send via SMS to recipients with phone numbers</p>
                </div>
              </label>
            </div>
          )}

          {submitError && (
            <p className="flex items-center gap-2 text-xs text-red-400">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              {submitError}
            </p>
          )}

          <button
            type="submit" disabled={submitting}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-[#fc0ce4] to-[#949ce4] text-white py-3 rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-all shadow-[0_0_20px_rgba(252,12,228,0.15)]"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {t('announcements.publish')}
          </button>
        </form>
      </SlideOver>
    </>
  );
}

