/**
 * Exam Conflict Tracker page.
 * Loads /data/exam-schedule.json, filters by school → program, lets the
 * student pick courses/sections, then flags:
 *   - Critical conflict: same day + same slot (red, alert-octagon icon)
 *   - Pressure warning: multiple exams on the same day (amber, triangle)
 * Alerts are icon + text (never color alone) and mirrored on the grid.
 */

import '/assets/js/main.js';
import { detectConflicts, groupByDaySlot, slotOrder } from '../lib/exam-conflicts.js';
import { toast } from '../components/toast.js';

const DATA_URL = '/data/exam-schedule.json';

const state = {
  data: null, // parsed schedule JSON
  school: '',
  program: '',
  query: '',
  selected: new Set(), // exam indexes into state.data.exams
};

const el = {};

function cacheElements() {
  ['school-select', 'program-select', 'course-search', 'course-list', 'selected-chips', 'selected-count',
    'conflict-cards', 'schedule-scroll', 'tracker-loading', 'tracker-error', 'tracker-content',
    'tracker-reset', 'tracker-retry', 'grid-title',
    'no-central-exam-section', 'no-central-exam-tbody', 'no-central-count'].forEach((id) => {
    el[id] = document.getElementById(id);
  });
}

/* ---- Data loading ---- */

async function loadSchedule() {
  el['tracker-loading'].hidden = false;
  el['tracker-error'].hidden = true;
  el['tracker-content'].hidden = true;

  try {
    const response = await fetch(DATA_URL);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (!Array.isArray(data.exams) || !Array.isArray(data.schools) || !Array.isArray(data.programs)) {
      throw new Error('Unexpected data shape');
    }
    state.data = data;
    state.selected.clear();
    renderFilters();
    el['tracker-loading'].hidden = true;
    el['tracker-content'].hidden = false;
    renderAll();
  } catch {
    el['tracker-loading'].hidden = true;
    el['tracker-error'].hidden = false;
  }
}

/* ---- Filters & course picker ---- */

function renderFilters() {
  const { schools, programs } = state.data;

  el['school-select'].innerHTML =
    '<option value="">All schools</option>' +
    schools.map((school) => `<option value="${school.code}">${school.name} (${school.code})</option>`).join('');
  el['school-select'].value = state.school;

  renderProgramSelect(programs);
  renderCourseList();
}

function renderProgramSelect() {
  const { programs } = state.data;
  const visible = state.school ? programs.filter((program) => program.school === state.school) : programs;

  el['program-select'].innerHTML =
    '<option value="">All programs</option>' +
    visible.map((program) => `<option value="${program.code}">${program.name}</option>`).join('');
  if (state.program && !visible.some((program) => program.code === state.program)) state.program = '';
  el['program-select'].value = state.program;
}

function allCourses() {
  const exams = state.data?.exams ?? [];
  const noCentral = (state.data?.noCentralExams ?? []).map((c) => ({ ...c, isNoCentral: true }));
  return [...exams, ...noCentral];
}

function visibleExams() {
  const items = allCourses();
  return items.filter((exam) => {
    if (state.school && exam.school !== state.school) return false;
    if (state.program && exam.program !== state.program) return false;
    if (state.query) {
      const haystack = `${exam.code} ${exam.title}`.toLowerCase();
      if (!haystack.includes(state.query.toLowerCase())) return false;
    }
    return true;
  });
}

function examId(exam) {
  if (exam.isNoCentral) {
    return `${exam.code} · no-central`;
  }
  return `${exam.code} · D${exam.day} | ${exam.slot}`;
}

function renderCourseList() {
  const exams = visibleExams();
  if (exams.length === 0) {
    el['course-list'].innerHTML = '<p class="picker__none">No courses match — adjust the filters or search.</p>';
    return;
  }
  el['course-list'].innerHTML = exams
    .map((exam) => {
      const id = examId(exam);
      const sectionBadge = exam.isNoCentral
        ? '<span class="picker__option-section" style="background:var(--surface);color:var(--muted)">No central exam</span>'
        : `<span class="picker__option-section">D${exam.day} | ${exam.slot}</span>`;
      return `
        <label class="picker__option">
          <input type="checkbox" data-exam-id="${id}" ${state.selected.has(id) ? 'checked' : ''}>
          <span class="picker__option-code">${exam.code}</span>
          <span class="picker__option-title">${exam.title}</span>
          ${sectionBadge}
        </label>`;
    })
    .join('');
}

function renderChips() {
  const chips = [...state.selected].map((id) => {
    const parts = id.split(' · ');
    const code = parts[0] ?? '';
    const daySlot = parts[1] === 'no-central' ? 'No central exam' : (parts[1] ?? '');
    return `
      <span class="chip">
        ${code}<small>${daySlot}</small>
        <button type="button" data-remove-chip="${id}" aria-label="Remove ${code}">
          <svg class="icon" aria-hidden="true"><use href="/assets/icons/sprite.svg#close"/></svg>
        </button>
      </span>`;
  });
  el['selected-chips'].innerHTML = chips.join('');
  el['selected-count'].textContent = `${state.selected.size} selected`;
}

function renderNoCentralExams() {
  const section = el['no-central-exam-section'];
  const tbody = el['no-central-exam-tbody'];
  const count = el['no-central-count'];
  if (!section || !tbody) return;

  const noCentralList = state.data?.noCentralExams ?? [];
  const selectedNoCentral = noCentralList.filter((item) => state.selected.has(`${item.code} · no-central`));

  if (selectedNoCentral.length === 0) {
    section.hidden = true;
    tbody.innerHTML = '';
    return;
  }

  section.hidden = false;
  if (count) {
    count.textContent = `${selectedNoCentral.length} selected`;
  }

  tbody.innerHTML = selectedNoCentral
    .map(
      (c) => `
      <tr>
        <td><strong>${c.code}</strong></td>
        <td>${c.title}</td>
        <td><span class="chip chip--flat" style="color:var(--muted)">No central examination</span></td>
      </tr>`,
    )
    .join('');
}

/* ---- Conflict + grid rendering ---- */

function dayLabel(day) {
  return `Day ${day}`;
}

function renderAlertCards() {
  const allSelected = allCourses().filter((exam) => state.selected.has(examId(exam)));
  const scheduledExams = allSelected.filter((exam) => exam.day && exam.slot && !exam.isNoCentral);
  const { critical, pressure } = detectConflicts(scheduledExams);
  const slots = state.data.meta?.slots ?? {};

  const cards = [];

  if (state.selected.size === 0) {
    cards.push(`
      <div class="alert-card alert-card--warn" style="background:var(--surface);border-color:var(--border);color:var(--text-2)">
        <svg class="icon" aria-hidden="true"><use href="/assets/icons/sprite.svg#info"/></svg>
        <div>
          <p class="alert-card__title">Pick your courses</p>
          <p class="alert-card__body">Select the courses and sections you plan to take — clashes and heavy days show up here instantly.</p>
        </div>
      </div>`);
  } else if (critical.length === 0 && pressure.length === 0) {
    cards.push(`
      <div class="alert-card alert-card--ok">
        <svg class="icon" aria-hidden="true"><use href="/assets/icons/sprite.svg#check-circle"/></svg>
        <div>
          <p class="alert-card__title">No conflicts detected</p>
          <p class="alert-card__body">Your ${state.selected.size} selected course${state.selected.size === 1 ? '' : 's'} don't clash. Still a heavy load? Watch the warnings as you add more.</p>
        </div>
      </div>`);
  }

  for (const clash of critical) {
    cards.push(`
      <div class="alert-card alert-card--critical">
        <svg class="icon" aria-hidden="true"><use href="/assets/icons/sprite.svg#alert-octagon"/></svg>
        <div>
          <p class="alert-card__title">Critical conflict — ${dayLabel(clash.day)}, slot ${clash.slot}${slots[clash.slot] ? ` (${slots[clash.slot]})` : ''}</p>
          <p class="alert-card__body">Two exams run at the exact same time. You cannot take these together — plan a retake or change a section.</p>
          <ul class="alert-card__list">
            ${clash.exams.map((exam) => `<li><strong>${exam.code}</strong> <span>D${exam.day} | ${exam.slot}</span><span>${exam.title}</span></li>`).join('')}
          </ul>
        </div>
      </div>`);
  }

  for (const heavyDay of pressure) {
    cards.push(`
      <div class="alert-card alert-card--warn">
        <svg class="icon" aria-hidden="true"><use href="/assets/icons/sprite.svg#alert-triangle"/></svg>
        <div>
          <p class="alert-card__title">Pressure warning — ${heavyDay.exams.length} exams on ${dayLabel(heavyDay.day)}</p>
          <p class="alert-card__body">${heavyDay.exams.length} exams land on the same day in different slots. Allowed, but plan your revision.</p>
          <ul class="alert-card__list">
            ${heavyDay.exams.map((exam) => `<li><strong>${exam.code}</strong> <span>D${exam.day} | ${exam.slot}</span><span>${exam.title}</span></li>`).join('')}
          </ul>
        </div>
      </div>`);
  }

  el['conflict-cards'].innerHTML = cards.join('');
}

function renderGrid() {
  const selectedExams = (state.data?.exams ?? []).filter((exam) => state.selected.has(examId(exam)));
  const grid = groupByDaySlot(selectedExams);
  const { critical, pressure } = detectConflicts(selectedExams);

  const criticalCells = new Set(critical.map((clash) => `${clash.day}|${clash.slot}`));
  const pressureDays = new Set(pressure.map((heavyDay) => heavyDay.day));
  const slots = slotOrder(selectedExams);
  const slotTimes = state.data.meta?.slots ?? {};
  const maxDay = Math.max(7, ...selectedExams.map((exam) => exam.day));

  const head = `
    <tr>
      <th scope="col">Day</th>
      ${slots.map((slot) => `<th scope="col">Slot ${slot}<small>${slotTimes[slot] ?? ''}</small></th>`).join('')}
    </tr>`;

  const body = Array.from({ length: maxDay }, (_, index) => index + 1)
    .map((day) => {
      const pressured = pressureDays.has(day);
      const cells = slots
        .map((slot) => {
          const exams = grid.get(day)?.get(slot) ?? [];
          const isCritical = criticalCells.has(`${day}|${slot}`);
          const classes = isCritical ? ' class="is-critical"' : '';
          const content = exams.length
            ? exams
                .map((exam) => {
                  const icon = isCritical ? 'alert-octagon' : pressured ? 'alert-triangle' : 'clock';
                  const tone = isCritical ? 'exam-pill--critical' : pressured ? 'exam-pill--pressure' : '';
                  return `
                    <div class="exam-pill ${tone}" title="${exam.title} · Slot ${slot}">
                      <svg class="icon" aria-hidden="true"><use href="/assets/icons/sprite.svg#${icon}"/></svg>
                      <span><strong>${exam.code}</strong><small>${exam.title}</small></span>
                    </div>`;
                })
                .join('')
            : '<span class="visually-hidden">No exam</span>';
          return `<td${classes}>${content}</td>`;
        })
        .join('');
      const dayTone = pressured ? ' style="color:var(--warn-accent)"' : '';
      const dayIcon = pressured
        ? '<svg class="icon" width="13" height="13" aria-label="Heavy exam day" role="img" style="display:inline;vertical-align:-2px"><use href="/assets/icons/sprite.svg#alert-triangle"/></svg> '
        : '';
      return `<tr><td${dayTone}>${dayIcon}${dayLabel(day)}</td>${cells}</tr>`;
    })
    .join('');

  const empty = selectedExams.length === 0
    ? '<p class="picker__none" style="padding:var(--space-5)">Nothing on the grid yet — select courses above to place them on the schedule.</p>'
    : '';

  el['schedule-scroll'].innerHTML = `
    <table class="schedule" aria-labelledby="grid-title">
      <thead>${head}</thead>
      <tbody>${body}</tbody>
    </table>${empty}`;
}

function renderAll() {
  renderCourseList();
  renderChips();
  renderAlertCards();
  renderGrid();
  renderNoCentralExams();
}

/* ---- Events ---- */

function wireEvents() {
  el['school-select'].addEventListener('change', () => {
    state.school = el['school-select'].value;
    renderProgramSelect();
    renderCourseList();
    renderNoCentralExams();
  });

  el['program-select'].addEventListener('change', () => {
    state.program = el['program-select'].value;
    renderCourseList();
    renderNoCentralExams();
  });

  el['course-search'].addEventListener('input', () => {
    state.query = el['course-search'].value.trim();
    renderCourseList();
    renderNoCentralExams();
  });

  el['course-list'].addEventListener('change', (event) => {
    const checkbox = event.target.closest('input[data-exam-id]');
    if (!checkbox) return;
    if (checkbox.checked) state.selected.add(checkbox.dataset.examId);
    else state.selected.delete(checkbox.dataset.examId);
    renderChips();
    renderAlertCards();
    renderGrid();
    renderNoCentralExams();
  });

  el['selected-chips'].addEventListener('click', (event) => {
    const button = event.target.closest('[data-remove-chip]');
    if (!button) return;
    state.selected.delete(button.dataset.removeChip);
    renderAll();
  });

  el['tracker-reset'].addEventListener('click', () => {
    state.school = '';
    state.program = '';
    state.query = '';
    state.selected.clear();
    el['course-search'].value = '';
    renderFilters();
    renderAll();
    toast('Tracker reset.');
  });

  el['tracker-retry'].addEventListener('click', loadSchedule);
}

/* ---- Boot ---- */

function init() {
  cacheElements();
  wireEvents();
  loadSchedule();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
