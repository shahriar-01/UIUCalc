/**
 * Toast notifications. One root container, aria-live announcements,
 * auto-dismiss with an exit animation. Types carry an icon + text so
 * state is never communicated by color alone.
 */

import { clamp } from '../lib/format.js';

let root = null;

function ensureRoot() {
  if (root && root.isConnected) return root;
  root = document.createElement('div');
  root.className = 'toast-root';
  root.setAttribute('role', 'status');
  root.setAttribute('aria-live', 'polite');
  document.body.append(root);
  return root;
}

/**
 * Show a toast.
 * @param {string} message
 * @param {{type?: 'info'|'success'|'error', duration?: number}} [options]
 */
export function toast(message, { type = 'info', duration = 3200 } = {}) {
  const container = ensureRoot();
  const el = document.createElement('div');
  el.className = `toast toast--${type}`;
  const iconId = type === 'success' ? 'check-circle' : type === 'error' ? 'alert-octagon' : 'info';
  el.innerHTML = `
    <svg class="icon" aria-hidden="true"><use href="/assets/icons/sprite.svg#${iconId}"/></svg>
    <span></span>`;
  el.querySelector('span').textContent = message;
  container.append(el);

  const dismiss = () => {
    if (!el.isConnected) return;
    el.classList.add('toast--out');
    el.addEventListener('animationend', () => el.remove(), { once: true });
  };

  const timer = window.setTimeout(dismiss, clamp(duration, 1200, 8000));
  el.addEventListener('click', () => {
    window.clearTimeout(timer);
    dismiss();
  });
  return el;
}

/** Convenience wrappers. */
export const toastSuccess = (message, options) => toast(message, { ...options, type: 'success' });
export const toastError = (message, options) => toast(message, { ...options, type: 'error' });
