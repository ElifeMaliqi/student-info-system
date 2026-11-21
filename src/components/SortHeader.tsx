'use client';

import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';

export type SortDir = 'asc' | 'desc';

/** Arrow for a sortable column: up/down shows the active direction, ↕ = not sorted by it. */
export function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <ArrowUpDown className="w-3 h-3 opacity-40" />;
  return dir === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />;
}

/** Clickable table header label with a sort arrow. */
export function SortHeader({
  label,
  active,
  dir,
  onClick,
}: {
  label: string;
  active: boolean;
  dir: SortDir;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={active ? (dir === 'asc' ? 'Ascending' : 'Descending') : 'Sort'}
      className={`inline-flex items-center gap-1 uppercase tracking-widest transition-colors ${active ? 'text-[#fc0ce4]' : 'hover:text-white'}`}
    >
      {label}
      <SortIcon active={active} dir={dir} />
    </button>
  );
}
