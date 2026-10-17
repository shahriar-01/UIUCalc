/**
 * Collapsible sidebar.
 * Desktop/tablet: pinned rail that collapses to icons (state remembered).
 * Mobile (<768px): slide-in drawer opened from the topbar menu button.
 * Active item derives from location.pathname (trailing-slash safe).
 */

import { getItem, setItem } from '../lib/storage.js';

const COLLAPSE_KEY = 'sidebar-collapsed';

/** Sidebar destinations. `match` is a pathname prefix used for the active state. */
const NAV_ITEMS = [
  { label: 'Home', href: '/', icon: 'home', match: /^\/$/ },
  { label: 'CGPA Calculator', href: '/calculator/cgpa/', icon: 'calculator', match: /^\/calculator\/cgpa\/?$/ },
  { label: 'Tuition Fee', href: '/calculator/tuition-fee/', icon: 'receipt', match: /^\/calculator\/tuition-fee\/?$/ },
  { label: 'CGPA Planner', href: '/calculator/cgpa-planner/', icon: 'target', match: /^\/calculator\/cgpa-planner\/?$/ },
  { label: 'Exam Conflict Tracker', href: '/tools/exam-conflict-tracker/', icon: 'calendar-alert', match: /^\/tools\/exam-conflict-tracker\/?$/ },
  { label: 'Changelog', href: '/changelog/', icon: 'history', match: /^\/changelog\/?$/ },
];

/** Normalize a pathname for comparison: lowercase, no trailing index.html, forced trailing slash. */
function normalizePathname(pathname) {
  let path = pathname.toLowerCase();
  path = path.replace(/\/index\.html$/, '/');
  if (!path.endsWith('/') && !path.endsWith('.html')) path += '/';
  return path;
}

export function isCollapsed() {
  return document.body.classList.contains('sidebar-collapsed');
}

export function setCollapsed(collapsed, { persist = true } = {}) {
  document.body.classList.toggle('sidebar-collapsed', collapsed);
  document.body.classList.remove('drawer-open');
  if (persist) setItem(COLLAPSE_KEY, collapsed);
}

export function openDrawer() {
  document.body.classList.add('drawer-open');
  document.querySelectorAll('[data-drawer-toggle]').forEach((btn) => btn.setAttribute('aria-expanded', 'true'));
}

export function closeDrawer() {
  document.body.classList.remove('drawer-open');
  document.querySelectorAll('[data-drawer-toggle]').forEach((btn) => btn.setAttribute('aria-expanded', 'false'));
}

/** Build and inject the sidebar into #sidebar-root. */
export function renderSidebar() {
  const mount = document.getElementById('sidebar-root');
  if (!mount) return;

  const path = normalizePathname(window.location.pathname);
  const links = NAV_ITEMS.map((item) => {
    const active = item.match.test(path);
    return `
      <li>
        <a class="sidebar__link" href="${item.href}" data-tip="${item.label}"
           ${active ? 'aria-current="page"' : ''}>
          <svg class="sidebar__icon" aria-hidden="true"><use href="/assets/icons/sprite.svg#${item.icon}"/></svg>
          <span class="sidebar__label">${item.label}</span>
        </a>
      </li>`;
  }).join('');

  mount.innerHTML = `
    <aside class="sidebar" id="sidebar" aria-label="Primary navigation">
      <a class="sidebar__brand" href="/" aria-label="UIU Calculator home">
        <img class="logo logo--light" src="/assets/images/logo-light.png" alt="" width="36" height="35"><img class="logo logo--dark" src="/assets/images/logo-dark.png" alt="" width="36" height="35">
        <span class="sidebar__brand-text">UIU<span style="color: #ff4d00;">Calc</span><small>Student toolkit</small></span>
      </a>
      <nav class="sidebar__nav scroll-area" aria-label="Tools">
        <ul>${links}</ul>
      </nav>
      <div class="sidebar__foot">
        <button type="button" class="sidebar__collapse" data-sidebar-toggle
                aria-expanded="${!isCollapsed()}" aria-controls="sidebar">
          <svg class="icon" aria-hidden="true"><use href="/assets/icons/sprite.svg#chevron-left"/></svg>
          <span class="sidebar__collapse-text">Collapse</span>
        </button>
        <p class="sidebar__foot-note">© UIU student toolkit </p>
      </div>
    </aside>
    <div class="sidebar-backdrop" data-drawer-close aria-hidden="true"></div>`;

  const collapseButton = mount.querySelector('[data-sidebar-toggle]');
  const collapseLabel = collapseButton.querySelector('.sidebar__collapse-text');

  const reflectCollapsed = () => {
    const collapsed = isCollapsed();
    collapseButton.setAttribute('aria-expanded', String(!collapsed));
    collapseLabel.textContent = collapsed ? 'Expand' : 'Collapse';
  };

  // A remembered choice wins; otherwise tablets start as an icon rail.
  // Re-evaluated whenever the viewport crosses the tablet range.
  const tablet = window.matchMedia('(min-width: 768px) and (max-width: 1023px)');
  const applyLayoutDefault = () => {
    const stored = getItem(COLLAPSE_KEY);
    document.body.classList.toggle('sidebar-collapsed', typeof stored === 'boolean' ? stored : tablet.matches);
    reflectCollapsed();
  };
  applyLayoutDefault();
  tablet.addEventListener('change', applyLayoutDefault);

  // Never leave the mobile drawer open when the viewport changes size.
  window.matchMedia('(max-width: 767px)').addEventListener('change', closeDrawer);

  collapseButton.addEventListener('click', () => {
    setCollapsed(!isCollapsed());
    reflectCollapsed();
  });

  // Menu button (in the topbar) opens the drawer on mobile.
  document.addEventListener('click', (event) => {
    const toggle = event.target.closest('[data-drawer-toggle]');
    if (toggle) {
      if (document.body.classList.contains('drawer-open')) {
        closeDrawer();
      } else {
        openDrawer();
      }
      return;
    }

    const closer = event.target.closest('[data-drawer-close]');
    if (closer) closeDrawer();

    // Navigating from the drawer should close it.
    const link = event.target.closest('.sidebar__link');
    if (link) closeDrawer();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeDrawer();
  });

  // Move focus into the drawer for keyboard users when it opens.
  new MutationObserver(() => {
    if (document.body.classList.contains('drawer-open')) {
      mount.querySelector('.sidebar__link')?.focus({ preventScroll: true });
    }
  }).observe(document.body, { attributes: true, attributeFilter: ['class'] });
}
