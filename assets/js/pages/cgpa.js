/**
 * CGPA Calculator page: current academic status + new/retake course
 * lists → live updated CGPA with animated result display.
 * State (inputs + course lists) persists to localStorage.
 */

import '/assets/js/main.js';
import { computeUpdatedCgpa, letterToPoint } from '../lib/cgpa.js';
import { CREDIT_OPTIONS, DEFAULT_CREDIT, GRADE_SCALE, formatPoint, gradeOptionLabel } from '../config/grading.js';
import { formatCredits, formatGpa, signedDelta } from '../lib/format.js';
import { numberField, attachError, clearError } from '../lib/validate.js';
import { getItem, setItem, removeItem } from '../lib/storage.js';
import { countUp } from '../components/count-up.js';
import { toast } from '../components/toast.js';
import { initTabs, renderGradeTable, animateEnter, animateRemove } from '../main.js';

const STORE_KEY = 'cgpa-tool';

const state = {
  completedCredits: '',
  currentCgpa: '',
  newCourses: [], // { credits, grade }
  retakes: [], // { credits, previousGrade, newGrade }
};

const el = {};

function cacheElements() {
  for (const id of [
    'completed-credits', 'current-cgpa', 'new-credit', 'new-grade', 'add-course', 'new-courses-body', 'new-count',
    'retake-credit', 'retake-prev', 'retake-new', 'add-retake', 'retake-courses-body', 'retake-count',
    'cgpa-calc', 'cgpa-reset', 'result-cgpa', 'result-delta', 'result-term', 'result-total', 'result-summary',
    'result-new-courses', 'result-retake-courses', 'result-qp', 'result-prev',
    'result-empty', 'result-filled', 'edit-course-dialog', 'edit-course-form', 'edit-course-type',
    'edit-course-index', 'edit-course-title', 'edit-course-credit', 'edit-course-grade',
    'edit-retake-prev', 'edit-retake-new', 'edit-new-grade-group', 'edit-retake-prev-group', 'edit-retake-new-group',
  ]) {
    el[id] = document.getElementById(id);
  }
}

/* ---- Options ---- */

function fillSelect(select, options) {
  select.innerHTML = options.map((option) => `<option value="${option.value}">${option.label}</option>`).join('');
}

function creditOptions() {
  return CREDIT_OPTIONS.map((credit) => ({
    value: String(credit),
    label: `${credit.toFixed(1)} ${credit === DEFAULT_CREDIT ? 'credits' : 'credits'}`,
  }));
}

function gradeOptions() {
  return GRADE_SCALE.filter((grade) => grade.point > 0).map((grade) => ({
    value: grade.letter,
    label: gradeOptionLabel(grade.letter),
  }));
}

/* ---- Persistence ---- */

function persist() {
  setItem(STORE_KEY, state);
}

function restore() {
  const saved = getItem(STORE_KEY, null);
  if (!saved || typeof saved !== 'object') return;
  state.completedCredits = typeof saved.completedCredits === 'string' ? saved.completedCredits : '';
  state.currentCgpa = typeof saved.currentCgpa === 'string' ? saved.currentCgpa : '';
  state.newCourses = Array.isArray(saved.newCourses) ? saved.newCourses.filter(validCourse) : [];
  state.retakes = Array.isArray(saved.retakes) ? saved.retakes.filter(validRetake) : [];
}

function validCourse(course) {
  return course && Number(course.credits) > 0 && letterToPoint(course.grade) !== null;
}

function validRetake(retake) {
  return (
    retake && Number(retake.credits) > 0 && letterToPoint(retake.previousGrade) !== null && letterToPoint(retake.newGrade) !== null
  );
}

/* ---- Rendering ---- */

function renderNewTable() {
  const body = el['new-courses-body'];
  if (state.newCourses.length === 0) {
    body.innerHTML = '<tr><td class="table__empty" colspan="4">No courses added yet — add your first course above.</td></tr>';
  } else {
    body.innerHTML = state.newCourses
      .map(
        (course, index) => `
        <tr data-index="${index}">
          <td class="num" data-label="Credit">${Number(course.credits).toFixed(1)}</td>
          <td data-label="Grade">${gradeOptionLabel(course.grade)}</td>
          <td class="num" data-label="Points">${formatPoint(letterToPoint(course.grade) * course.credits)}</td>
          <td class="table__action" data-label="Action">
            <button type="button" class="icon-btn" data-edit-new="${index}" aria-label="Edit course ${index + 1}">
              <svg class="icon" aria-hidden="true"><use href="/assets/icons/sprite.svg#pencil"/></svg>
            </button>
            <button type="button" class="icon-btn icon-btn--danger" data-remove-new="${index}" aria-label="Remove course ${index + 1}">
              <svg class="icon" aria-hidden="true"><use href="/assets/icons/sprite.svg#trash"/></svg>
            </button>
          </td>
        </tr>`,
      )
      .join('');
  }
  el['new-count'].textContent = courseSummary(state.newCourses);
}

function renderRetakeTable() {
  const body = el['retake-courses-body'];
  if (state.retakes.length === 0) {
    body.innerHTML = '<tr><td class="table__empty" colspan="5">No retake courses added yet.</td></tr>';
  } else {
    body.innerHTML = state.retakes
      .map((retake, index) => {
        const previous = letterToPoint(retake.previousGrade);
        const next = letterToPoint(retake.newGrade);
        const improvement = next - previous;
        const tone = improvement > 0 ? 'chip--up' : improvement < 0 ? 'chip--down' : 'chip--flat';
        return `
        <tr data-index="${index}">
          <td class="num" data-label="Credit">${Number(retake.credits).toFixed(1)}</td>
          <td data-label="Previous">${gradeOptionLabel(retake.previousGrade)}</td>
          <td data-label="New">${gradeOptionLabel(retake.newGrade)}</td>
          <td data-label="Improvement"><span class="chip ${tone}">${signedDelta(improvement)}</span></td>
          <td class="table__action" data-label="Action">
            <button type="button" class="icon-btn" data-edit-retake="${index}" aria-label="Edit retake ${index + 1}">
              <svg class="icon" aria-hidden="true"><use href="/assets/icons/sprite.svg#pencil"/></svg>
            </button>
            <button type="button" class="icon-btn icon-btn--danger" data-remove-retake="${index}" aria-label="Remove retake ${index + 1}">
              <svg class="icon" aria-hidden="true"><use href="/assets/icons/sprite.svg#trash"/></svg>
            </button>
          </td>
        </tr>`;
      })
      .join('');
  }
  el['retake-count'].textContent = courseSummary(state.retakes);
}

function courseSummary(courses) {
  if (courses.length === 0) return '0 courses';
  const credits = courses.reduce((sum, course) => sum + Number(course.credits), 0);
  return `${courses.length} ${courses.length === 1 ? 'course' : 'courses'} · ${formatCredits(credits)} cr`;
}

function setDeltaChip(delta) {
  const chip = el['result-delta'];
  const rounded = Number(delta.toFixed(2));
  const tone = rounded > 0 ? 'chip--up' : rounded < 0 ? 'chip--down' : 'chip--flat';
  const icon = rounded > 0 ? 'trend-up' : rounded < 0 ? 'trend-down' : 'check';
  chip.className = `chip ${tone}`;
  chip.innerHTML = `<svg class="chip__icon" aria-hidden="true"><use href="/assets/icons/sprite.svg#${icon}"/></svg><span>${signedDelta(
    delta,
  )} vs current</span>`;
}

function showResultEmpty(message) {
  el['result-empty'].hidden = false;
  el['result-filled'].hidden = true;
  if (el['result-cgpa']) {
    el['result-cgpa'].textContent = '0.00';
    delete el['result-cgpa'].dataset.value;
  }
  if (el['result-delta']) {
    el['result-delta'].className = 'chip';
    el['result-delta'].innerHTML = '<span>Enter your status to begin</span>';
  }
  if (el['result-summary']) {
    el['result-summary'].textContent = '';
  }
  if (message && el['result-empty'].querySelector('p')) {
    el['result-empty'].querySelector('p').textContent = message;
  }
}

/* ---- Actions ---- */

function addCourse() {
  const credits = Number(el['new-credit'].value);
  const grade = el['new-grade'].value;
  if (!credits || letterToPoint(grade) === null) return;
  state.newCourses.push({ credits, grade });
  persist();
  renderNewTable();
  const row = el['new-courses-body'].querySelector('tr:last-child');
  if (row && state.newCourses.length > 1) animateEnter(row);
}

function addRetake() {
  const credits = Number(el['retake-credit'].value);
  const previousGrade = el['retake-prev'].value;
  const newGrade = el['retake-new'].value;
  if (!credits || letterToPoint(previousGrade) === null || letterToPoint(newGrade) === null) return;
  state.retakes.push({ credits, previousGrade, newGrade });
  persist();
  renderRetakeTable();
  const row = el['retake-courses-body'].querySelector('tr:last-child');
  if (row && state.retakes.length > 1) animateEnter(row);
}

function removeCourse(list, index, renderTable, rowEl) {
  if (!list[index]) return;
  list.splice(index, 1);
  persist();
  animateRemove(rowEl);
  // Re-render after the exit animation so indexes stay truthful.
  window.setTimeout(renderTable, 200);
}

function openEditDialog(type, index) {
  const dialog = el['edit-course-dialog'];
  if (!dialog) return;

  el['edit-course-type'].value = type;
  el['edit-course-index'].value = String(index);

  if (type === 'new') {
    const course = state.newCourses[index];
    if (!course) return;
    el['edit-course-title'].textContent = `Edit Course #${index + 1}`;
    el['edit-course-credit'].value = String(course.credits);
    el['edit-course-grade'].value = course.grade;
    el['edit-new-grade-group'].hidden = false;
    el['edit-retake-prev-group'].hidden = true;
    el['edit-retake-new-group'].hidden = true;
  } else {
    const retake = state.retakes[index];
    if (!retake) return;
    el['edit-course-title'].textContent = `Edit Retake Course #${index + 1}`;
    el['edit-course-credit'].value = String(retake.credits);
    el['edit-retake-prev'].value = retake.previousGrade;
    el['edit-retake-new'].value = retake.newGrade;
    el['edit-new-grade-group'].hidden = true;
    el['edit-retake-prev-group'].hidden = false;
    el['edit-retake-new-group'].hidden = false;
  }

  dialog.showModal();
}

function saveCourseEdit(event) {
  event.preventDefault();
  const type = el['edit-course-type'].value;
  const index = Number(el['edit-course-index'].value);
  const credits = Number(el['edit-course-credit'].value);

  if (type === 'new') {
    const grade = el['edit-course-grade'].value;
    state.newCourses[index] = { credits, grade };
    renderNewTable();
  } else {
    const previousGrade = el['edit-retake-prev'].value;
    const newGrade = el['edit-retake-new'].value;
    state.retakes[index] = { credits, previousGrade, newGrade };
    renderRetakeTable();
  }

  persist();
  el['edit-course-dialog'].close();
  toast('Course updated.');

  if (!el['result-filled'].hidden) {
    calculate({ quiet: true });
  }
}

function validateStatus() {
  let firstInvalid = null;

  const credits = numberField(el['completed-credits'].value, { min: 0, max: 250, label: 'Completed credits' });
  clearError(el['completed-credits']);
  if (!credits.ok) {
    attachError(el['completed-credits'], credits.message);
    firstInvalid ??= el['completed-credits'];
  }

  const cgpa = numberField(el['current-cgpa'].value, { min: 0, max: 4, label: 'Current CGPA' });
  clearError(el['current-cgpa']);
  if (!cgpa.ok) {
    attachError(el['current-cgpa'], cgpa.message);
    firstInvalid ??= el['current-cgpa'];
  }

  if (credits.ok && cgpa.ok && state.newCourses.length === 0 && state.retakes.length === 0) {
    firstInvalid ??= false;
    toast('Add at least one course before calculating.', { type: 'error' });
  }

  if (firstInvalid) firstInvalid?.focus?.();
  return {
    ok: credits.ok && cgpa.ok && (state.newCourses.length > 0 || state.retakes.length > 0),
    completedCredits: credits.value ?? 0,
    currentCgpa: cgpa.value ?? 0,
  };
}

function calculate({ quiet = false } = {}) {
  const status = validateStatus();
  if (!status.ok) return;

  state.completedCredits = el['completed-credits'].value;
  state.currentCgpa = el['current-cgpa'].value;
  persist();

  try {
    const result = computeUpdatedCgpa({
      completedCredits: status.completedCredits,
      currentCgpa: status.currentCgpa,
      newCourses: state.newCourses,
      retakeCourses: state.retakes,
    });

    el['result-empty'].hidden = true;
    el['result-filled'].hidden = false;

    countUp(el['result-cgpa'], result.newCgpa, { decimals: 2 });
    setDeltaChip(result.delta);
    el['result-term'].textContent = result.termCredits > 0 ? formatGpa(result.termGpa) : '—';
    el['result-total'].textContent = formatCredits(result.totalCredits);

    if (el['result-new-courses']) {
      const newCount = state.newCourses.length;
      el['result-new-courses'].textContent = newCount > 0 ? `${newCount} (${formatCredits(result.termCredits)} cr)` : '0 (0.0 cr)';
    }
    if (el['result-retake-courses']) {
      const retakeCount = state.retakes.length;
      const retakeCr = state.retakes.reduce((sum, r) => sum + Number(r.credits || 0), 0);
      el['result-retake-courses'].textContent = retakeCount > 0 ? `${retakeCount} (${formatCredits(retakeCr)} cr)` : '0 (0.0 cr)';
    }
    if (el['result-qp']) {
      el['result-qp'].textContent = result.qualityPoints.toFixed(2);
    }
    if (el['result-prev']) {
      el['result-prev'].textContent = `${formatGpa(status.currentCgpa)} (${formatCredits(status.completedCredits)} cr)`;
    }

    el['result-summary'].textContent =
      `New CGPA ${formatGpa(result.newCgpa)}, ${result.delta >= 0 ? 'up' : 'down'} ` +
      `${formatGpa(Math.abs(result.delta))} from ${formatGpa(status.currentCgpa)}. ` +
      `Term GPA ${result.termCredits > 0 ? formatGpa(result.termGpa) : 'n/a'} across ${formatCredits(result.termCredits)} credits. ` +
      `Total credits after update: ${formatCredits(result.totalCredits)}.`;
  } catch (error) {
    if (!quiet) {
      toast(error.message || 'Could not calculate — check your inputs.', { type: 'error' });
    }
  }
}

function reset() {
  state.completedCredits = '';
  state.currentCgpa = '';
  state.newCourses = [];
  state.retakes = [];
  removeItem(STORE_KEY);
  el['completed-credits'].value = '';
  el['current-cgpa'].value = '';
  clearError(el['completed-credits']);
  clearError(el['current-cgpa']);
  renderNewTable();
  renderRetakeTable();
  showResultEmpty();
  toast('Calculator reset.');
}

/* ---- Boot ---- */

function init() {
  cacheElements();
  restore();

  fillSelect(el['new-credit'], creditOptions());
  fillSelect(el['retake-credit'], creditOptions());
  fillSelect(el['new-grade'], gradeOptions());
  fillSelect(el['retake-prev'], gradeOptions());
  fillSelect(el['retake-new'], gradeOptions());
  el['new-credit'].value = String(DEFAULT_CREDIT);
  el['retake-credit'].value = String(DEFAULT_CREDIT);
  el['retake-prev'].value = 'C';
  el['retake-new'].value = 'A';

  el['completed-credits'].value = state.completedCredits;
  el['current-cgpa'].value = state.currentCgpa;
  renderNewTable();
  renderRetakeTable();

  initTabs(document.getElementById('cgpa-tabs'));

  el['add-course'].addEventListener('click', addCourse);
  el['add-retake'].addEventListener('click', addRetake);
  el['cgpa-calc'].addEventListener('click', calculate);
  el['cgpa-reset'].addEventListener('click', reset);

  fillSelect(el['edit-course-credit'], creditOptions());
  fillSelect(el['edit-course-grade'], gradeOptions());
  fillSelect(el['edit-retake-prev'], gradeOptions());
  fillSelect(el['edit-retake-new'], gradeOptions());

  el['edit-course-form'].addEventListener('submit', saveCourseEdit);
  el['edit-course-dialog'].addEventListener('click', (event) => {
    if (event.target.closest('[data-edit-close]') || event.target === el['edit-course-dialog']) {
      el['edit-course-dialog'].close();
    }
  });

  // Row editing and removal via delegation (rows are re-rendered).
  el['new-courses-body'].addEventListener('click', (event) => {
    const editBtn = event.target.closest('[data-edit-new]');
    if (editBtn) {
      openEditDialog('new', Number(editBtn.dataset.editNew));
      return;
    }
    const button = event.target.closest('[data-remove-new]');
    if (!button) return;
    removeCourse(state.newCourses, Number(button.dataset.removeNew), renderNewTable, button.closest('tr'));
  });
  el['retake-courses-body'].addEventListener('click', (event) => {
    const editBtn = event.target.closest('[data-edit-retake]');
    if (editBtn) {
      openEditDialog('retake', Number(editBtn.dataset.editRetake));
      return;
    }
    const button = event.target.closest('[data-remove-retake]');
    if (!button) return;
    removeCourse(state.retakes, Number(button.dataset.removeRetake), renderRetakeTable, button.closest('tr'));
  });

  // Inline validation clears as the user edits.
  ['completed-credits', 'current-cgpa'].forEach((id) => {
    el[id].addEventListener('input', () => clearError(el[id]));
  });

  renderGradeTable(document.getElementById('grade-table'));
  showResultEmpty();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
