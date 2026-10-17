/**
 * Landing page: theme toggle, profile dialog (name stored locally and
 * prefilled from the previous input), personalized greeting, and the
 * staggered hero entrance.
 */

import '/assets/js/main.js';
import { initThemeToggle } from '../components/theme.js';
import { toast } from '../components/toast.js';
import { getUserName, saveUserName, timeGreeting } from '../main.js';

/**
 * Greeting line under the title. Hidden entirely when no name is saved
 * so the page stays minimal for anonymous visitors.
 */
function renderGreeting() {
  const greeting = document.getElementById('hero-greeting');
  if (!greeting) return;
  const name = getUserName();
  if (!name) {
    greeting.hidden = true;
    greeting.textContent = '';
    return;
  }
  greeting.innerHTML = `${timeGreeting()}, <span class="accent"></span>`;
  greeting.querySelector('.accent').textContent = name;
  greeting.hidden = false;
}

/**
 * Profile dialog: the icon button opens a short modal with a name box
 * and Save. The input is prefilled with the stored name, saving keeps
 * it in localStorage (uiucalc:student-name) across visits.
 */
function initProfileDialog() {
  const toggle = document.getElementById('profile-toggle');
  const dialog = document.getElementById('profile-dialog');
  const form = document.getElementById('profile-form');
  const input = document.getElementById('profile-name');
  if (!toggle || !dialog || !form || !input) return;

  toggle.addEventListener('click', () => {
    input.value = getUserName(); // remember the previous input
    dialog.showModal();
    input.focus();
    input.select();
  });

  dialog.querySelector('[data-profile-close]')?.addEventListener('click', () => dialog.close());

  // Click on the backdrop (outside the panel) closes, like Escape.
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const name = input.value.trim().slice(0, 40);
    saveUserName(name);
    renderGreeting();
    toast(name ? `Saved — hi, ${name}!` : 'Name cleared.', { type: 'success' });
    dialog.close();
  });
}

function init() {
  initThemeToggle(document.getElementById('hero-theme-toggle'));
  initProfileDialog();
  renderGreeting();

  // Stagger index for the hero entrance animation.
  document.querySelectorAll('[data-animate]').forEach((el, index) => {
    el.style.setProperty('--i', String(index));
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
