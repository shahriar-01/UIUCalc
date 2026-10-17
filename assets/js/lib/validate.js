/**
 * Input validation helpers.
 * Pure validators return { ok, value?, message? }; the DOM helpers add
 * inline error text and a gentle shake without ever relying on color
 * alone (an icon and text always accompany the highlight).
 */

import { clamp } from './format.js';

/** Parse a numeric input value; returns NaN for blanks/junk. */
export function parseNumber(value) {
  if (typeof value === 'string' && value.trim() === '') return NaN;
  return Number(value);
}

/**
 * Validate a numeric field.
 * @param {object} opts { min, max, required, integer, label }
 */
export function numberField(value, { min = -Infinity, max = Infinity, required = true, integer = false, label = 'This field' } = {}) {
  const parsed = parseNumber(value);
  if (Number.isNaN(parsed)) {
    return required
      ? { ok: false, message: `${label} is required.` }
      : { ok: true, value: null };
  }
  if (!Number.isFinite(parsed)) return { ok: false, message: `${label} must be a number.` };
  if (integer && !Number.isInteger(parsed)) return { ok: false, message: `${label} must be a whole number.` };
  if (parsed < min || parsed > max) {
    const maxText = Number.isFinite(max) ? ` and at most ${max}` : '';
    return { ok: false, message: `${label} must be at least ${min}${maxText}.` };
  }
  return { ok: true, value: parsed };
}

/** CGPA-shaped value in [0, 4]. */
export function isValidCgpa(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 4;
}

/** Clamp a CGPA-shaped value into [0, 4]. */
export function clampCgpa(value) {
  return clamp(Number(value), 0, 4);
}

/**
 * Mark a field as invalid: red border, inline message in the field's
 * [data-error] slot and a one-shot shake animation.
 * @param {HTMLElement} input
 * @param {string} message
 */
export function attachError(input, message) {
  if (!input) return;
  const field = input.closest('.field') ?? input.parentElement;
  if (!field) return;
  field.classList.add('field--error');
  input.setAttribute('aria-invalid', 'true');
  const slot = field.querySelector('[data-error]');
  if (slot) {
    slot.textContent = message;
    slot.hidden = false;
  }
  field.classList.remove('field--shake');
  // Restart the shake animation on repeated errors.
  void field.offsetWidth;
  field.classList.add('field--shake');
}

/** Clear the invalid state applied by attachError(). */
export function clearError(input) {
  if (!input) return;
  const field = input.closest('.field') ?? input.parentElement;
  if (!field) return;
  field.classList.remove('field--error', 'field--shake');
  input.removeAttribute('aria-invalid');
  const slot = field.querySelector('[data-error]');
  if (slot) {
    slot.textContent = '';
    slot.hidden = true;
  }
}
