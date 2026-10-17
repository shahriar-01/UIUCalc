/**
 * Shared bootstrap. Importing this module builds the page shell
 * (sidebar + topbar + footer) from body[data-shell]:
 *   'app'      → sidebar + topbar + footer (all tool pages, changelog)
 *   'landing'  → footer only (the landing hero carries its own chrome)
 *   'minimal'  → nothing injected (404)
 * It also owns: page enter/exit fades, tab groups, the shared name store,
 * animated row removal, and the grade reference table (render + exports).
 */

import './components/theme.js';
import { renderSidebar } from './components/sidebar.js';
import { renderHeader } from './components/header.js';
import { getItem, setItem } from './lib/storage.js';
import { GRADE_SCALE, formatPoint } from './config/grading.js';
import { toast } from './components/toast.js';

/* ------------------------------------------------------------------ */
/* Shell                                                               */
/* ------------------------------------------------------------------ */

function renderFooter() {
  const mount = document.getElementById('footer-root');
  if (!mount) return;
  mount.innerHTML = `
    <footer class="footer">
      <div class="footer__inner">
        <span>UIUCalc — All Rights Reserved © 2026 | Shahriar</span>
        <span><a href="/changelog/">What's new</a></span>
        <span><a href="https://github.com" rel="noopener noreferrer">Source &amp; license (MIT)</a></span>
      </div>
    </footer>`;
}

function initShell() {
  const shell = document.body.dataset.shell;

  if (shell === 'app') {
    renderSidebar();
    renderHeader();
    renderFooter();
  } else if (shell === 'landing') {
    renderFooter();
  }

  // Page-enter fade (CSS animation gated on .page-anim).
  requestAnimationFrame(() => document.body.classList.add('page-anim'));

  // Prefetch internal pages on hover/touch so navigation is instantaneous.
  const prefetched = new Set();
  const prefetch = (href) => {
    if (!href || prefetched.has(href)) return;
    try {
      const url = new URL(href, window.location.href);
      if (url.origin !== window.location.origin) return;
      prefetched.add(href);
      const prefetchLink = document.createElement('link');
      prefetchLink.rel = 'prefetch';
      prefetchLink.href = url.href;
      document.head.appendChild(prefetchLink);
    } catch (e) { /* ignore */ }
  };

  document.addEventListener('pointerenter', (event) => {
    const link = event.target?.closest?.('a[href]');
    if (link && link.target !== '_blank' && !link.hasAttribute('download')) {
      prefetch(link.href);
    }
  }, { passive: true, capture: true });

  // Short fade-out on internal navigation (140ms), skipped for
  // modified clicks, new tabs, downloads and reduced-motion users.
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  document.addEventListener('click', (event) => {
    if (reducedMotion.matches || event.defaultPrevented) return;
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    const link = event.target.closest('a[href]');
    if (!link || link.target === '_blank' || link.hasAttribute('download')) return;

    const url = new URL(link.href, window.location.href);
    if (url.origin !== window.location.origin || url.pathname === window.location.pathname) return;

    event.preventDefault();
    document.body.classList.add('page-exit');
    window.setTimeout(() => window.location.assign(url.href), 140);
  });
}

if (document.body?.dataset.shell) initShell();

/* ------------------------------------------------------------------ */
/* Tabs (accessible, arrow-key navigable)                              */
/* ------------------------------------------------------------------ */

/**
 * Wire a tablist. Tabs need role="tab", aria-controls and ids on both
 * the tab and its panel. Emits `tabs:change` with { id, index } on root.
 */
export function initTabs(root) {
  const tabs = [...root.querySelectorAll('[role="tab"]')];
  if (tabs.length === 0) return null;

  const panels = tabs.map((tab) => document.getElementById(tab.getAttribute('aria-controls')));

  const select = (index, { focus = false } = {}) => {
    tabs.forEach((tab, i) => {
      const active = i === index;
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
      if (panels[i]) panels[i].hidden = !active;
    });
    if (focus) tabs[index].focus();
    const tab = tabs[index];
    root.dispatchEvent(new CustomEvent('tabs:change', { detail: { id: tab.id, index } }));
  };

  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => select(index));
    tab.addEventListener('keydown', (event) => {
      const last = tabs.length - 1;
      let next = null;
      if (event.key === 'ArrowRight') next = index === last ? 0 : index + 1;
      if (event.key === 'ArrowLeft') next = index === 0 ? last : index - 1;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = last;
      if (next !== null) {
        event.preventDefault();
        select(next, { focus: true });
      }
    });
  });

  select(Math.max(0, tabs.findIndex((tab) => tab.getAttribute('aria-selected') === 'true')));

  return {
    get index() {
      return tabs.findIndex((tab) => tab.getAttribute('aria-selected') === 'true');
    },
    select,
  };
}

/* ------------------------------------------------------------------ */
/* Row add/remove animation                                            */
/* ------------------------------------------------------------------ */

/** Fade/slide a row in (add .row-enter after inserting). */
export function animateEnter(el) {
  el.classList.add('row-enter');
  el.addEventListener('animationend', () => el.classList.remove('row-enter'), { once: true });
}

/** Collapse/fade a row out, then remove it. */
export function animateRemove(el) {
  if (!el) return;
  el.classList.add('row-exit');
  el.addEventListener('animationend', () => el.remove(), { once: true });
  // Fallback if animations are disabled.
  window.setTimeout(() => el.remove(), 400);
}

/* ------------------------------------------------------------------ */
/* Student name (shared store + time-aware greeting)                   */
/* ------------------------------------------------------------------ */

const NAME_KEY = 'student-name';

export function getUserName() {
  const name = getItem(NAME_KEY, '');
  return typeof name === 'string' ? name.trim().slice(0, 40) : '';
}

export function saveUserName(name) {
  setItem(NAME_KEY, String(name ?? '').trim().slice(0, 40));
}

export function timeGreeting(date = new Date()) {
  const hour = date.getHours();
  if (hour < 5) return 'Up late';
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

/* ------------------------------------------------------------------ */
/* Grade reference table (render + Save as CSV / Save as Image)        */
/* ------------------------------------------------------------------ */

/**
 * Render the UIU grading scale into `container`.
 * @param {HTMLElement} container
 * @param {{actions?: boolean}} [options] include Save as Image / CSV buttons
 */
export function renderGradeTable(container, { actions = true } = {}) {
  if (!container) return;

  const rows = GRADE_SCALE.map(
    (grade) => `
      <tr>
        <td class="grade-letter">${grade.letter}</td>
        <td class="num">${formatPoint(grade.point)}</td>
        <td class="num">${grade.min} – ${grade.max}</td>
      </tr>`,
  ).join('');

  const inDetails = Boolean(container.closest('details') || container.tagName === 'DETAILS');

  if (inDetails) {
    container.innerHTML = `
      ${actions ? `
        <div class="topbar__actions" style="margin-bottom: var(--space-3); justify-content: flex-end; gap: var(--space-2);">
          <button type="button" class="btn btn--secondary btn--sm" data-grade-image>
            <svg class="icon" aria-hidden="true"><use href="/assets/icons/sprite.svg#image"/></svg>
            Save as Image
          </button>
          <button type="button" class="btn btn--secondary btn--sm" data-grade-csv>
            <svg class="icon" aria-hidden="true"><use href="/assets/icons/sprite.svg#download"/></svg>
            Save as CSV
          </button>
        </div>` : ''}
      <div class="table-scroll">
        <table class="table" aria-labelledby="grade-table-title">
          <thead>
            <tr><th scope="col">Letter grade</th><th scope="col">Grade point</th><th scope="col">Marks (%)</th></tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  } else {
    container.innerHTML = `
      <div class="panel__head">
        <h2 class="panel__title" id="grade-table-title">UIU grading system</h2>
        ${actions ? `
          <div class="topbar__actions">
            <button type="button" class="btn btn--secondary btn--sm" data-grade-image>
              <svg class="icon" aria-hidden="true"><use href="/assets/icons/sprite.svg#image"/></svg>
              Save as Image
            </button>
            <button type="button" class="btn btn--secondary btn--sm" data-grade-csv>
              <svg class="icon" aria-hidden="true"><use href="/assets/icons/sprite.svg#download"/></svg>
              Save as CSV
            </button>
          </div>` : ''}
      </div>
      <div class="table-scroll">
        <table class="table" aria-labelledby="grade-table-title">
          <thead>
            <tr><th scope="col">Letter grade</th><th scope="col">Grade point</th><th scope="col">Marks (%)</th></tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }

  if (actions) {
    container.querySelector('[data-grade-image]').addEventListener('click', downloadGradeImage);
    container.querySelector('[data-grade-csv]').addEventListener('click', () => {
      downloadFile('uiu-grading-system.csv', gradeCsv(), 'text/csv');
      toast('Grading system saved as CSV.', { type: 'success' });
    });
  }
}

/** CSV string of the grade scale. */
export function gradeCsv() {
  const lines = ['Letter Grade,Grade Point,Marks Min (%),Marks Max (%)'];
  for (const grade of GRADE_SCALE) lines.push(`${grade.letter},${formatPoint(grade.point)},${grade.min},${grade.max}`);
  return lines.join('\n');
}

/** Trigger a client-side file download. */
export function downloadFile(filename, content, type) {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

/**
 * Render the grade scale onto a crisp off-screen canvas (the dark
 * instrument look) and download it as a PNG — no external libraries.
 */
export function downloadGradeImage() {
  const width = 640;
  const rowHeight = 42;
  const headerHeight = 118;
  const height = headerHeight + GRADE_SCALE.length * rowHeight + 56;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    toast('Could not render the image in this browser.', { type: 'error' });
    return;
  }

  const displayFont = "'Space Grotesk', 'Trebuchet MS', sans-serif";
  const monoFont = "'IBM Plex Mono', Consolas, monospace";

  // Dark instrument panel.
  ctx.fillStyle = '#0b0b0c';
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  ctx.lineWidth = 1;
  for (let x = 40; x < width; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  ctx.fillStyle = '#f26b1d';
  ctx.fillRect(0, 0, 6, height);

  ctx.fillStyle = '#a8a29e';
  ctx.font = `500 13px ${monoFont}`;
  ctx.fillText('U I U   G R A D I N G   S Y S T E M', 44, 52);

  ctx.fillStyle = '#f5f5f4';
  ctx.font = `700 34px ${displayFont}`;
  ctx.fillText('Grade scale', 44, 92);

  // Column headers.
  ctx.fillStyle = '#78716c';
  ctx.font = `500 12px ${monoFont}`;
  ctx.fillText('LETTER', 44, headerHeight - 14);
  ctx.fillText('GRADE POINT', 220, headerHeight - 14);
  ctx.fillText('MARKS (%)', 420, headerHeight - 14);
  ctx.strokeStyle = 'rgba(255,255,255,0.14)';
  ctx.beginPath();
  ctx.moveTo(44, headerHeight - 4);
  ctx.lineTo(width - 44, headerHeight - 4);
  ctx.stroke();

  GRADE_SCALE.forEach((grade, index) => {
    const y = headerHeight + rowHeight * index + 28;
    ctx.fillStyle = '#ffb37a';
    ctx.font = `600 17px ${displayFont}`;
    ctx.fillText(grade.letter, 44, y);
    ctx.fillStyle = '#f5f5f4';
    ctx.font = `500 16px ${monoFont}`;
    ctx.fillText(formatPoint(grade.point), 220, y);
    ctx.fillStyle = '#a8a29e';
    ctx.fillText(`${grade.min} – ${grade.max}`, 420, y);
  });

  ctx.fillStyle = '#6e6a66';
  ctx.font = `400 12px ${monoFont}`;
  ctx.fillText('UIU Calculator · unofficial student toolkit', 44, height - 24);

  canvas.toBlob((blob) => {
    if (!blob) {
      toast('Could not export the image.', { type: 'error' });
      return;
    }
    downloadFile('uiu-grading-system.png', blob);
    toast('Grading system saved as image.', { type: 'success' });
  }, 'image/png');
}
