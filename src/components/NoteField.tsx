'use client';

import React, { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertCircle } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { api } from '../services/api';

export interface NoteValue {
  text: string;
  isPrivate: boolean;
}

export const EMPTY_NOTE: NoteValue = { text: '', isPrivate: false };

/**
 * Saves the optional admin note for an action that already succeeded. Empty notes
 * are skipped. A failed note save never undoes or blocks the action itself.
 */
export async function saveNote(area: string, action: string, note: NoteValue | null | undefined) {
  if (!note || !note.text.trim()) return;
  try {
    await api.notes.create(area, action, note);
  } catch (err) {
    console.error('Failed to save note:', err);
  }
}

/** Collapsed "+ Add note" link that opens a textarea and the private checkbox. */
export function NoteField({ value, onChange }: { value: NoteValue; onChange: (v: NoteValue) => void }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(!!value.text);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs font-medium text-[#fc0ce4] hover:text-[#fc0ce4]/80 transition-colors"
      >
        {t('notes.add')}
      </button>
    );
  }

  return (
    <div className="space-y-2 text-left">
      <div className="flex items-center justify-between">
        <label className="text-[11px] font-semibold text-white/50 uppercase tracking-widest">{t('notes.label')}</label>
        <button
          type="button"
          onClick={() => { onChange(EMPTY_NOTE); setOpen(false); }}
          className="text-[11px] text-white/40 hover:text-white/70 transition-colors"
        >
          {t('notes.remove')}
        </button>
      </div>
      <textarea
        rows={3}
        placeholder={t('notes.placeholder')}
        value={value.text}
        onChange={e => onChange({ ...value, text: e.target.value })}
        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-[#fc0ce4]/40 focus:bg-[#fc0ce4]/5 transition-all resize-none"
      />
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={value.isPrivate}
          onChange={e => onChange({ ...value, isPrivate: e.target.checked })}
          className="w-4 h-4 rounded border-white/20 bg-white/5 text-[#fc0ce4] focus:ring-[#fc0ce4]/30 focus:ring-offset-0 cursor-pointer accent-[#fc0ce4]"
        />
        <span className="text-xs text-white/60">{t('notes.private')}</span>
      </label>
    </div>
  );
}

interface ConfirmOptions {
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  /** false hides the note box (e.g. when deleting a note itself). */
  withNote?: boolean;
}

/**
 * Styled replacement for window.confirm() with the optional note box.
 * `const note = await ask({...}); if (!note) return;` — resolves to the note
 * (possibly empty) when confirmed, or null when cancelled.
 */
export function useConfirm(): [React.ReactNode, (opts: ConfirmOptions) => Promise<NoteValue | null>] {
  const { t } = useLanguage();
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const [note, setNote] = useState<NoteValue>(EMPTY_NOTE);
  const resolver = useRef<((v: NoteValue | null) => void) | null>(null);

  const ask = (o: ConfirmOptions) => new Promise<NoteValue | null>(resolve => {
    resolver.current = resolve;
    setNote(EMPTY_NOTE);
    setOpts(o);
  });

  const close = (result: NoteValue | null) => {
    resolver.current?.(result);
    resolver.current = null;
    setOpts(null);
  };

  const danger = opts?.danger ?? true;

  const element = (
    <AnimatePresence>
      {opts && (
        <>
          <motion.div key="confirm-bg" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => close(null)} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70]" />
          <motion.div key="confirm-modal" initial={{ opacity: 0, scale: 0.96, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 12 }} transition={{ type: 'spring', damping: 28, stiffness: 340 }} className="fixed inset-0 z-[70] flex items-center justify-center p-4 pointer-events-none">
            <div className="w-full max-w-sm bg-[#0f0f0f] border border-white/10 rounded-2xl shadow-2xl pointer-events-auto" onClick={e => e.stopPropagation()}>
              <div className="px-5 py-5 text-center space-y-3">
                <div className={`mx-auto w-12 h-12 rounded-xl flex items-center justify-center border ${danger ? 'bg-red-500/10 border-red-500/20' : 'bg-[#fc0ce4]/10 border-[#fc0ce4]/20'}`}>
                  <AlertCircle className={`w-6 h-6 ${danger ? 'text-red-400' : 'text-[#fc0ce4]'}`} />
                </div>
                <h2 className="text-sm font-bold text-white">{opts.title}</h2>
                <div className="text-[13px] text-white/50">{opts.message}</div>
                {opts.withNote !== false && <NoteField value={note} onChange={setNote} />}
              </div>
              <div className="px-5 py-4 border-t border-white/8 flex gap-3">
                <button onClick={() => close(null)} className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 text-sm font-medium hover:bg-white/5 transition-colors">{t('common.cancel')}</button>
                <button
                  onClick={() => close(note)}
                  className={danger
                    ? 'flex-1 bg-red-500/20 border border-red-500/30 text-red-400 px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-red-500/30 transition-all'
                    : 'flex-1 bg-gradient-to-r from-[#fc0ce4] to-[#949ce4] text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition-all'}
                >
                  {opts.confirmLabel || t('notes.confirm')}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );

  return [element, ask];
}
