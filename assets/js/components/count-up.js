/**
 * Animated number counter for result displays.
 * Animates only the text value with requestAnimationFrame; honors
 * prefers-reduced-motion by setting the value instantly.
 */

import { formatNumber } from '../lib/format.js';

const prefersReducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Ease-out cubic for a decelerating instrument feel. */
const easeOutCubic = (t) => 1 - (1 - t) ** 3;

/**
 * Count an element's text up/down to `target`.
 * @param {HTMLElement} el
 * @param {number} target
 * @param {{duration?: number, decimals?: number, grouping?: boolean,
 *          prefix?: string, suffix?: string}} [options]
 */
export function countUp(el, target, options = {}) {
  if (!el) return;
  const { duration = 850, decimals = 2, grouping = false, prefix = '', suffix = '' } = options;
  const format = (value) =>
    `${prefix}${formatNumber(value, { decimals, grouping })}${suffix}`;

  const from = Number(el.dataset.value ?? 0) || 0;
  el.dataset.value = String(target);

  if (prefersReducedMotion() || !Number.isFinite(target)) {
    el.textContent = format(target);
    return;
  }

  if (el._countRaf) cancelAnimationFrame(el._countRaf);

  const start = performance.now();
  const step = (now) => {
    const progress = Math.min(1, (now - start) / duration);
    const value = from + (target - from) * easeOutCubic(progress);
    el.textContent = format(value);
    if (progress < 1) {
      el._countRaf = requestAnimationFrame(step);
    } else {
      el.textContent = format(target);
      el._countRaf = null;
    }
  };
  el._countRaf = requestAnimationFrame(step);
}
