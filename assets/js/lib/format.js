/**
 * Number, currency (BDT) and rounding helpers.
 * Display-only rounding lives here; calculations never round
 * intermediate values.
 */

/** Round to 2 decimals (used only when displaying GPA/CGPA). */
export function round2(value) {
  return Math.round(Number(value) * 100) / 100;
}

/** Format a number with fixed decimals and optional thousands grouping. */
export function formatNumber(value, { decimals = 2, grouping = false } = {}) {
  const num = Number(value);
  if (!Number.isFinite(num)) return '—';
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    useGrouping: grouping,
  }).format(num);
}

/** Format an amount as BDT, e.g. 66500 -> "৳66,500". */
export function formatBDT(value, { decimals = 0 } = {}) {
  const num = Number(value);
  if (!Number.isFinite(num)) return '—';
  return `৳${new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num)}`;
}

/** Format a GPA/CGPA rounded to 2 decimals, e.g. 3.2843 -> "3.28". */
export function formatGpa(value) {
  return formatNumber(round2(value), { decimals: 2 });
}

/** Signed delta, e.g. 0.12 -> "+0.12", -0.05 -> "-0.05". */
export function signedDelta(value, { decimals = 2 } = {}) {
  const num = Number(value);
  if (!Number.isFinite(num)) return '—';
  const sign = num > 0 ? '+' : num < 0 ? '−' : '';
  return sign + formatNumber(Math.abs(num), { decimals });
}

/** Clamp a number into [min, max]. */
export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number(value)));
}

/** Format a plain credit count, e.g. 10.5 -> "10.5". */
export function formatCredits(value) {
  return formatNumber(value, { decimals: Number.isInteger(Number(value)) ? 0 : 1 });
}
