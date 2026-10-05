// Age helpers shared by the forms (age or date of birth) and invoice pricing.

/** Whole years between a 'YYYY-MM-DD' date of birth and today; null if missing/invalid. */
export function ageFromDob(dob?: string | null, today = new Date()): number | null {
  if (!dob) return null;
  const [y, m, d] = dob.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return null;
  let age = today.getFullYear() - y;
  if (today.getMonth() + 1 < m || (today.getMonth() + 1 === m && today.getDate() < d)) age--;
  return age >= 0 ? age : null;
}

/** A date of birth wins over a stored age because it stays correct over time. */
export function effectiveAge(age?: number | string | null, dob?: string | null): number | null {
  const fromDob = ageFromDob(dob);
  if (fromDob != null) return fromDob;
  const n = age == null || age === '' ? NaN : Number(age);
  return Number.isFinite(n) ? n : null;
}

export type AgePrice = { minAge: number | null; maxAge: number | null; amount: number };

/** Monthly price for an age: first matching range, else the default. */
export function priceForAge(age: number | null, agePrices: AgePrice[], defaultAmount: number): number {
  if (age == null) return defaultAmount;
  const match = agePrices.find(r =>
    (r.minAge == null || age >= r.minAge) && (r.maxAge == null || age <= r.maxAge)
  );
  return match ? match.amount : defaultAmount;
}

/** Validates form input; returns an error message or '' when OK. Both empty is allowed. */
export function validateAgeInput(age: string, dob: string): string {
  if (dob) {
    if (ageFromDob(dob) == null) return 'Please enter a valid date of birth.';
    return '';
  }
  if (age === '') return '';
  const n = Number(age);
  if (!Number.isInteger(n) || n < 1 || n > 120) return 'Please enter a valid age.';
  return '';
}

/** DB values for a form's age / date of birth (age is derived when a date is given). */
export function ageFields(age: string, dob: string): { age: number | null; date_of_birth: string | null } {
  if (dob) return { age: ageFromDob(dob), date_of_birth: dob };
  return { age: age === '' ? null : Number(age), date_of_birth: null };
}
