/**
 * Topbar: breadcrumb (derived from the URL), theme toggle and the
 * per-tool "How to use" dialog. Injected into #header-root.
 */

import { initThemeToggle } from './theme.js';

/** Human labels for breadcrumb segments. */
const SEGMENT_LABELS = {
  calculator: 'Calculator',
  tools: 'Tools',
  cgpa: 'CGPA Calculator',
  'tuition-fee': 'Tuition Fee',
  'cgpa-planner': 'Target CGPA Planner',
  'exam-conflict-tracker': 'Exam Conflict Tracker',
  changelog: 'Changelog',
};

/** Pages that are never linked as intermediates (no index page exists). */
const UNLINKED_SEGMENTS = new Set(['calculator', 'tools']);

function buildCrumbs(pathname) {
  const crumbs = [{ label: 'Home', href: '/' }];
  const segments = pathname.toLowerCase().replace(/\/index\.html$/, '').split('/').filter(Boolean);
  let acc = '';
  segments.forEach((segment, index) => {
    acc += `/${segment}`;
    const isLast = index === segments.length - 1;
    crumbs.push({
      label: SEGMENT_LABELS[segment] ?? segment,
      href: isLast ? null : acc,
      unlinked: UNLINKED_SEGMENTS.has(segment),
    });
  });
  return crumbs;
}

function renderBreadcrumb(pathname) {
  const crumbs = buildCrumbs(pathname);
  return `
    <nav class="breadcrumb" aria-label="Breadcrumb">
      ${crumbs
        .map((crumb, index) => {
          const last = index === crumbs.length - 1;
          if (last || !crumb.href || crumb.unlinked) {
            return `<span class="breadcrumb__item" ${last ? 'aria-current="page"' : ''}>${crumb.label}</span>`;
          }
          return `<a class="breadcrumb__item" href="${crumb.href}">${crumb.label}</a>`;
        })
        .join('<svg class="icon breadcrumb__sep" width="14" height="14" aria-hidden="true"><use href="/assets/icons/sprite.svg#chevron-right"/></svg>')}
    </nav>`;
}

/** Create the help <dialog> from the page's #help-content template. */
function ensureHelpDialog() {
  const template = document.getElementById('help-content');
  if (!template) return null;

  let dialog = document.getElementById('help-dialog');
  if (!dialog) {
    dialog = document.createElement('dialog');
    dialog.id = 'help-dialog';
    dialog.className = 'dialog';
    dialog.innerHTML = `
      <div class="dialog__panel">
        <header class="dialog__head">
          <h2 class="dialog__title">How to use</h2>
          <button type="button" class="icon-btn" data-dialog-close aria-label="Close help">
            <svg class="icon" aria-hidden="true"><use href="/assets/icons/sprite.svg#close"/></svg>
          </button>
        </header>
        <div class="dialog__body scroll-area"></div>
      </div>`;
    dialog.querySelector('.dialog__body').append(template.content.cloneNode(true));
    document.body.append(dialog);

    // Close on the X button or when clicking the backdrop.
    dialog.addEventListener('click', (event) => {
      if (event.target.closest('[data-dialog-close]') || event.target === dialog) dialog.close();
    });
  }
  return dialog;
}

/** Build and inject the topbar into #header-root. */
export function renderHeader() {
  const mount = document.getElementById('header-root');
  if (!mount) return;

  const helpDialog = ensureHelpDialog();

  mount.innerHTML = `
    <header class="topbar">
      <button type="button" class="icon-btn topbar__menu" data-drawer-toggle aria-label="Open menu">
        <svg class="icon" aria-hidden="true"><use href="/assets/icons/sprite.svg#menu"/></svg>
      </button>
      ${renderBreadcrumb(window.location.pathname)}
      <div class="topbar__spacer"></div>
      <div class="topbar__actions">
        ${
          helpDialog
            ? `<button type="button" class="icon-btn" data-help-open aria-label="How to use this tool" aria-haspopup="dialog">
                 <svg class="icon" aria-hidden="true"><use href="/assets/icons/sprite.svg#help"/></svg>
               </button>`
            : ''
        }
        <button type="button" class="icon-btn" data-theme-toggle aria-label="Toggle theme"></button>
      </div>
    </header>`;

  initThemeToggle(mount.querySelector('[data-theme-toggle]'));

  const helpButton = mount.querySelector('[data-help-open]');
  helpButton?.addEventListener('click', () => helpDialog?.showModal());
}
