'use client';

import { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { ageFromDob } from '../utils/age';

type Props = {
  age: string;
  dateOfBirth: string;
  onChange: (value: { age: string; dateOfBirth: string }) => void;
  className: string;
};

// Age as a number, with the option to give the exact date of birth instead.
export function AgeInput({ age, dateOfBirth, onChange, className }: Props) {
  const { t } = useLanguage();
  const [useDob, setUseDob] = useState(!!dateOfBirth);
  const dobAge = ageFromDob(dateOfBirth);
  const today = new Date().toISOString().slice(0, 10);

  const toggle = () => {
    // Switching back to a plain age drops the date so the typed age is what's saved.
    if (useDob) onChange({ age: dobAge != null ? String(dobAge) : age, dateOfBirth: '' });
    setUseDob(!useDob);
  };

  return (
    <div>
      {useDob ? (
        <input
          type="date"
          value={dateOfBirth}
          max={today}
          onChange={e => onChange({ age, dateOfBirth: e.target.value })}
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
