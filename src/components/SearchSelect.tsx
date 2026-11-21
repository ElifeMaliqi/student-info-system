'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';

export interface SearchSelectOption {
  value: string;
  label: string;
  /** Second line under the label (e.g. class, email). Also searched. */
  sublabel?: string;
}

/**
 * Text input that filters a list of options as you type; picking one sets `value`.
 * Matches every word typed against the label and sublabel (case-insensitive).
 */
export function SearchSelect({
  options,
  value,
  onChange,
  placeholder,
  emptyText = 'No matches',
}: {
  options: SearchSelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  emptyText?: string;
}) {
  const selected = options.find(o => o.value === value) ?? null;
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (words.length === 0) return options;
    return options.filter(o => {
      const hay = `${o.label} ${o.sublabel ?? ''}`.toLowerCase();
      return words.every(w => hay.includes(w));
    });
  }, [options, query]);

  useEffect(() => { setHighlight(0); }, [query]);

  // Close when clicking outside.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) { setOpen(false); setQuery(''); }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const pick = (opt: SearchSelectOption) => {
    onChange(opt.value);
    setQuery('');
    setOpen(false);
  };

  return (
    <div ref={wrapRef} className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
      <input
        type="text"
        value={open ? query : selected ? `${selected.label}${selected.sublabel ? ` – ${selected.sublabel}` : ''}` : ''}
        placeholder={placeholder}
        onFocus={() => { setOpen(true); setQuery(''); }}
        onChange={e => { setQuery(e.target.value); setOpen(true); }}
        onKeyDown={e => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setHighlight(h => Math.min(h + 1, filtered.length - 1)); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlight(h => Math.max(h - 1, 0)); }
          else if (e.key === 'Enter') { e.preventDefault(); if (open && filtered[highlight]) pick(filtered[highlight]); }
          else if (e.key === 'Escape') { setOpen(false); setQuery(''); (e.target as HTMLInputElement).blur(); }
        }}
        className="glass-input w-full pl-9 pr-9 py-2.5 rounded-xl text-sm text-white placeholder:text-white/30"
      />
      {selected && !open && (
        <button
          type="button"
          onClick={() => onChange('')}
          title="Clear"
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-white/30 hover:text-white hover:bg-white/10"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
      {open && (
        <div className="absolute z-20 mt-1 w-full max-h-60 overflow-y-auto rounded-xl border border-white/10 bg-[#141414] shadow-2xl py-1">
          {filtered.length === 0 ? (
            <div className="px-3 py-2.5 text-xs text-white/40">{emptyText}</div>
          ) : filtered.map((opt, i) => (
            <button
              type="button"
              key={opt.value}
              onMouseDown={e => e.preventDefault()}
              onClick={() => pick(opt)}
              onMouseEnter={() => setHighlight(i)}
              className={`w-full text-left px-3 py-2 transition-colors ${i === highlight ? 'bg-white/[0.07]' : ''} ${opt.value === value ? 'text-[#fc0ce4]' : 'text-white/90'}`}
            >
              <div className="text-sm truncate">{opt.label}</div>
              {opt.sublabel && <div className="text-[11px] text-white/40 truncate">{opt.sublabel}</div>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
