'use client';

import { useState } from 'react';
import { motion } from 'motion/react';
import { X, UserX, Loader2, Check, AlertCircle, UserPlus, RotateCcw } from 'lucide-react';
import { api } from '../services/api';

export interface UnmatchedStudent {
  name: string;
  email?: string;
  phone?: string;
  /** 'archived' = exists but archived (offer to unarchive); otherwise treat as a
   *  brand-new student to add. */
  reason?: 'archived' | 'not_found';
  /** Set when reason === 'archived'. */
  studentId?: string;
}

interface Props {
  /** Students from the imported file that don't exist in the platform. */
  students: UnmatchedStudent[];
  /** What kind of import this is — shown in the copy. */
  context: 'attendance' | 'invoice';
  /** If set, newly created students are enrolled into this class (attendance). */
  classId?: string;
  /** Close without re-importing (matched rows are already saved). */
  onClose: () => void;
  /** Admin added ≥1 student and wants to pull their data in. Receives the names
   *  that were dismissed so the caller can skip them on the re-run. */
  onReimport: (dismissedNames: string[]) => void;
}

type RowState = {
  student: UnmatchedStudent;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  status: 'pending' | 'added' | 'dismissed';
  saving: boolean;
  error: string;
};

function splitName(name: string): { firstName: string; lastName: string } {
  const parts = name.trim().split(/\s+/);
  return { firstName: parts[0] || '', lastName: parts.slice(1).join(' ') };
}

export function UnmatchedStudentsModal({ students, context, classId, onClose, onReimport }: Props) {
  const [rows, setRows] = useState<RowState[]>(() =>
    students.map(s => {
      const { firstName, lastName } = splitName(s.name);
      return {
        student: s, firstName, lastName,
        email: s.email || '', phone: s.phone || '',
        status: 'pending' as const, saving: false, error: '',
      };
    })
  );
  const [expanded, setExpanded] = useState<number | null>(null);

  const addedCount = rows.filter(r => r.status === 'added').length;
  const pendingCount = rows.filter(r => r.status === 'pending').length;
  const dismissedNames = rows.filter(r => r.status === 'dismissed').map(r => r.student.name);

  function patch(idx: number, updates: Partial<RowState>) {
    setRows(rs => rs.map((r, i) => (i === idx ? { ...r, ...updates } : r)));
  }

  async function addStudent(idx: number) {
    const r = rows[idx];
    if (!r.firstName.trim() || !r.lastName.trim() || !r.email.includes('@')) {
      patch(idx, { error: 'First name, last name and a valid email are required.' });
      return;
    }
    patch(idx, { saving: true, error: '' });
    try {
      const email = r.email.trim().toLowerCase();
      const created = await api.users.create(email, r.firstName.trim(), r.lastName.trim(), 'student', 'FMA#2026');
      if (created?.id) {
        try {
          await api.teacher.updateStudentProfile(created.id, {
            firstName: r.firstName.trim(),
            lastName: r.lastName.trim(),
            email,
            phone: r.phone.trim() || undefined,
          });
        } catch { /* non-critical */ }
        if (classId) {
          try { await api.classes.enrollStudent(classId, created.id); } catch { /* non-critical */ }
        }
      }
      patch(idx, { saving: false, status: 'added' });
      setExpanded(null);
    } catch (e) {
      patch(idx, { saving: false, error: e instanceof Error ? e.message : 'Failed to add student' });
    }
  }

  async function unarchiveStudent(idx: number) {
    const r = rows[idx];
    if (!r.student.studentId) { patch(idx, { error: 'Missing student reference.' }); return; }
    patch(idx, { saving: true, error: '' });
    try {
      await api.finance.unarchiveStudent(r.student.studentId);
      patch(idx, { saving: false, status: 'added' });
    } catch (e) {
      patch(idx, { saving: false, error: e instanceof Error ? e.message : 'Failed to unarchive student' });
    }
  }

  return (
    <>
      <motion.div
        key="unmatched-bg"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]"
      />
      <motion.div
        key="unmatched-modal"
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        transition={{ type: 'spring', damping: 28, stiffness: 340 }}
        className="fixed inset-0 z-[60] flex items-center justify-center p-4 pointer-events-none"
      >
        <div onClick={e => e.stopPropagation()} className="w-full max-w-lg bg-[#0f0f0f] border border-white/10 rounded-2xl shadow-2xl pointer-events-auto flex flex-col max-h-[85vh]">
          <div className="flex items-start justify-between px-5 py-4 border-b border-white/8 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                <UserX className="w-4 h-4 text-amber-400" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white">Students not found</h2>
                <p className="text-[11px] text-white/40 mt-0.5">
                  These rows from the file don’t match a student in the platform. Add them or dismiss them.
                </p>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-lg text-white/40 hover:text-white transition-all shrink-0"><X className="w-4 h-4" /></button>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-2">
            {rows.map((r, idx) => {
              const isExpanded = expanded === idx;
              return (
                <div key={idx} className={`rounded-xl border transition-all ${
                  r.status === 'added' ? 'border-emerald-500/25 bg-emerald-500/[0.05]' :
                  r.status === 'dismissed' ? 'border-white/8 bg-white/[0.01] opacity-50' :
                  isExpanded ? 'border-[#949ce4]/40 bg-[#949ce4]/5' : 'border-white/8 bg-white/[0.02]'
                }`}>
                  <div className="flex items-center gap-3 px-3 py-2.5">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">
                        {r.student.name || <span className="text-white/30 italic">No name</span>}
                      </p>
                      {(r.student.email || r.student.phone) && (
                        <p className="text-[11px] text-white/35 truncate">{[r.student.email, r.student.phone].filter(Boolean).join(' · ')}</p>
                      )}
                    </div>
                    {r.status === 'added' ? (
                      <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400 shrink-0"><Check className="w-3.5 h-3.5" /> {r.student.reason === 'archived' ? 'Unarchived' : 'Added'}</span>
                    ) : r.status === 'dismissed' ? (
                      <span className="text-[11px] text-white/30 shrink-0">Dismissed</span>
                    ) : r.student.reason === 'archived' ? (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-500/20 text-amber-300/80">Archived</span>
                        <button
                          onClick={() => patch(idx, { status: 'dismissed' })}
                          className="px-2.5 py-1 rounded-lg text-xs font-medium border border-white/10 text-white/50 hover:text-white hover:bg-white/5 transition-colors"
                        >
                          Dismiss
                        </button>
                        <button
                          onClick={() => void unarchiveStudent(idx)}
                          disabled={r.saving}
                          className="px-2.5 py-1 rounded-lg text-xs font-medium border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10 transition-colors flex items-center gap-1 disabled:opacity-50"
                        >
                          {r.saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />} Unarchive
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-1.5 shrink-0">
                        <button
                          onClick={() => patch(idx, { status: 'dismissed' })}
                          className="px-2.5 py-1 rounded-lg text-xs font-medium border border-white/10 text-white/50 hover:text-white hover:bg-white/5 transition-colors"
                        >
                          Dismiss
                        </button>
                        <button
                          onClick={() => setExpanded(isExpanded ? null : idx)}
                          className="px-2.5 py-1 rounded-lg text-xs font-medium border border-[#fc0ce4]/30 text-[#fc0ce4] hover:bg-[#fc0ce4]/10 transition-colors flex items-center gap-1"
                        >
                          <UserPlus className="w-3 h-3" /> Add
                        </button>
                      </div>
                    )}
                  </div>
                  {r.error && r.student.reason === 'archived' && (
                    <p className="px-3 pb-2.5 -mt-1 text-red-400 text-xs flex items-center gap-1.5"><AlertCircle className="w-3.5 h-3.5 shrink-0" />{r.error}</p>
                  )}

                  {isExpanded && r.status === 'pending' && (
                    <div className="px-4 pb-4 pt-1 space-y-3 border-t border-white/8">
                      <p className="text-[11px] font-semibold text-white/35 uppercase tracking-widest pt-1">Fill in missing info</p>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] font-semibold uppercase tracking-widest mb-1 text-amber-400/70">First Name *</label>
                          <input value={r.firstName} onChange={e => patch(idx, { firstName: e.target.value })} className="glass-input w-full px-3 py-2 rounded-lg text-sm text-white" />
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold uppercase tracking-widest mb-1 text-amber-400/70">Last Name *</label>
                          <input value={r.lastName} onChange={e => patch(idx, { lastName: e.target.value })} className="glass-input w-full px-3 py-2 rounded-lg text-sm text-white" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold uppercase tracking-widest mb-1 text-amber-400/70">Email *</label>
                        <input type="email" value={r.email} onChange={e => patch(idx, { email: e.target.value })} className="glass-input w-full px-3 py-2 rounded-lg text-sm text-white" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold uppercase tracking-widest mb-1 text-white/40">Phone</label>
                        <input value={r.phone} onChange={e => patch(idx, { phone: e.target.value })} className="glass-input w-full px-3 py-2 rounded-lg text-sm text-white" />
                      </div>
                      {r.error && (
                        <div className="flex items-start gap-2 text-red-400 text-xs"><AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" /><span>{r.error}</span></div>
                      )}
                      <div className="flex gap-2 pt-1">
                        <button onClick={() => setExpanded(null)} className="flex-1 py-2 rounded-lg border border-white/10 text-sm text-white/50 hover:text-white hover:bg-white/5 transition-colors">Cancel</button>
                        <button
                          onClick={() => void addStudent(idx)}
                          disabled={r.saving}
                          className="flex-1 py-2 rounded-lg bg-gradient-to-r from-[#fc0ce4] to-[#949ce4] text-white text-sm font-semibold hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
                        >
                          {r.saving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…</> : 'Save & Add'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="px-5 py-4 border-t border-white/8 flex items-center justify-between gap-2 shrink-0">
            <p className="text-[11px] text-white/40">
              {addedCount > 0 && <>{addedCount} added · </>}{pendingCount} remaining
            </p>
            <div className="flex gap-2">
              <button onClick={onClose} className="px-4 py-2 rounded-xl border border-white/10 text-sm font-medium hover:bg-white/5 transition-colors">Close</button>
              {addedCount > 0 && (
                <button
                  onClick={() => onReimport(dismissedNames)}
                  className="px-4 py-2 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-sm font-medium hover:bg-emerald-500/30 transition-colors"
                >
                  Re-import ({addedCount})
                </button>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </>
  );
}
