/**
 * Light/dark theme logic. The inline boot snippet in each page's <head>
 * applies the stored/system theme before first paint to avoid a flash;
 * this module owns the canonical get/set/toggle behavior afterwards.
 */

import { getItem, setItem } from '../lib/storage.js';

export const THEMES = ['light', 'dark'];

/** Stored preference or null when following the system. */
export function getStoredTheme() {
  const stored = getItem('theme', null);
  return THEMES.includes(stored) ? stored : null;
}

export function systemTheme() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/** Theme currently applied to <html>. */
export function appliedTheme() {
  const current = document.documentElement.dataset.theme;
  return THEMES.includes(current) ? current : systemTheme();
}

function updateMeta(theme) {
  let meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'theme-color';
    document.head.append(meta);
  }
  meta.content = theme === 'dark' ? '#0b0b0c' : '#fafaf8';
}

/** Apply a theme to <html>; persists by default. */
export function applyTheme(theme, { persist = true } = {}) {
  const next = THEMES.includes(theme) ? theme : systemTheme();
  document.documentElement.dataset.theme = next;
  updateMeta(next);
  if (persist) setItem('theme', next);
  document.dispatchEvent(new CustomEvent('uiu:theme-change', { detail: { theme: next } }));
  return next;
}

/** Toggle between light and dark, returning the new theme. */
export function toggleTheme() {
  return applyTheme(appliedTheme() === 'dark' ? 'light' : 'dark');
}

/** Wire a toggle button: swaps the icon and keeps aria state honest. */
export function initThemeToggle(button) {
  if (!button) return;
  const render = () => {
    const theme = appliedTheme();
    button.setAttribute('aria-pressed', String(theme === 'dark'));
    button.setAttribute('aria-label', theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
    button.innerHTML = `<svg class="icon" aria-hidden="true"><use href="/assets/icons/sprite.svg#${
      theme === 'dark' ? 'sun' : 'moon'
    }"/></svg>`;
  };
  render();
  button.addEventListener('click', () => {
    toggleTheme();
    render();
  });
  // Keep the icon in sync if something else changes the theme.
  document.addEventListener('uiu:theme-change', render);
}
