'use client';

import { useEffect, useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { ageFromDob } from '../utils/age';

type Props = {
  age: string;
  dateOfBirth: string;
  onChange: (value: { age: string; dateOfBirth: string }) => void;
  className: string;
  /** Open on the date of birth (dd/mm/yyyy) unless only an age is already saved. */
  dobFirst?: boolean;
};

// 'YYYY-MM-DD' -> 'dd/mm/yyyy' (anything else is shown as typed).
function isoToText(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

// Value passed up for the typed text: 'YYYY-MM-DD' for a real date, '' when empty,
// else the raw text so the form's validation rejects it instead of silently dropping it.
function textToValue(text: string): string {
  if (!text) return '';
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text);
  if (!m) return text;
  const [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(y, mo - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) return text;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

// Keeps digits only and adds the slashes: 01022015 -> 01/02/2015.
function maskDob(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

// Age as a number, with the option to give the exact date of birth instead.
export function AgeInput({ age, dateOfBirth, onChange, className, dobFirst }: Props) {
  const { t } = useLanguage();
  const [useDob, setUseDob] = useState(!!dateOfBirth || (!!dobFirst && !age));
  const [dobText, setDobText] = useState(isoToText(dateOfBirth));
  const dobAge = ageFromDob(dateOfBirth);

  // Follow outside changes (form reset / another student loaded).
  useEffect(() => {
    if (dateOfBirth !== textToValue(dobText)) setDobText(isoToText(dateOfBirth));
  }, [dateOfBirth]);

  const toggle = () => {
    // Switching back to a plain age drops the date so the typed age is what's saved.
    if (useDob) onChange({ age: dobAge != null ? String(dobAge) : age, dateOfBirth: '' });
    setUseDob(!useDob);
  };

  return (
    <div>
      {useDob ? (
        <input
          type="text"
          inputMode="numeric"
          placeholder="dd/mm/yyyy"
          value={dobText}
          onChange={e => {
            const text = maskDob(e.target.value);
            setDobText(text);
            onChange({ age, dateOfBirth: textToValue(text) });
          }}
          className={className}
        />
      ) : (
        <input
          type="number"
          min={1}
          max={120}
          step={1}
          value={age}
          onChange={e => onChange({ age: e.target.value, dateOfBirth })}
          placeholder={t('age.placeholder')}
          className={className}
        />
      )}
      <div className="flex items-center justify-between gap-2 mt-1 ml-1">
        <button type="button" onClick={toggle} className="text-[11px] text-[#fc0ce4]/80 hover:text-[#fc0ce4] transition-colors">
          {useDob ? t('age.use_age') : t('age.use_dob')}
        </button>
        {useDob && dobAge != null && (
          <span className="text-[11px] text-white/40">{t('age.label')}: {dobAge}</span>
        )}
      </div>
    </div>
  );
}
