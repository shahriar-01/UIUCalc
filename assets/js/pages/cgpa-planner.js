/**
 * Target CGPA Planner page: completed credits / current CGPA / target
 * plus four planning tabs (next trimester, multiple, until graduation,
 * what-if). Results render as reachable / secured / unreachable states
 * with a gauge and a suggested grade mix.
 */

import '/assets/js/main.js';
import {
  planOutcome,
  whatIf,
  plannedNextTrimester,
  plannedMultipleTrimesters,
  plannedUntilGraduation,
} from '../lib/planner.js';
import { formatCredits, formatGpa, signedDelta, clamp } from '../lib/format.js';
import { numberField, attachError, clearError } from '../lib/validate.js';
import { getItem, setItem, removeItem } from '../lib/storage.js';
import { countUp } from '../components/count-up.js';
import { toast } from '../components/toast.js';
import { initTabs, renderGradeTable } from '../main.js';

const STORE_KEY = 'planner-tool';

const STATUS_FIELDS = ['pl-completed', 'pl-current', 'pl-target'];
const TAB_FIELDS = ['pl-next-credits', 'pl-terms', 'pl-per-term', 'pl-degree-total', 'pl-whatif-credits', 'pl-whatif-gpa'];

const el = {};

function cacheElements() {
  [...STATUS_FIELDS, ...TAB_FIELDS].forEach((id) => {
    el[id] = document.getElementById(id);
  });
  ['planner-calc', 'planner-reset', 'planner-value', 'planner-delta', 'planner-headline', 'planner-mix',
    'planner-explain', 'gauge-fill', 'gauge-current-marker', 'gauge-target-marker', 'gauge-wrap',
    'planner-empty', 'planner-filled', 'planner-unreachable-note',
    'planner-projection-card', 'planner-scenarios-card',
    'planner-projection-graph', 'planner-projection-tbody', 'planner-scenarios-tbody'].forEach((id) => {
    el[id] = document.getElementById(id);
  });
}

/* ---- Persistence ---- */

function persist() {
  const values = {};
  [...STATUS_FIELDS, ...TAB_FIELDS].forEach((id) => {
    values[id] = el[id].value;
  });
  values.activeTab = tabs?.index ?? 0;
  setItem(STORE_KEY, values);
}

function restore() {
  const saved = getItem(STORE_KEY, null);
  if (!saved || typeof saved !== 'object') return;
  [...STATUS_FIELDS, ...TAB_FIELDS].forEach((id) => {
    if (typeof saved[id] === 'string') el[id].value = saved[id];
  });
  return saved;
}

/* ---- Validation ---- */

function validateStatus() {
  let firstInvalid = null;
  const results = {};

  const specs = [
    ['pl-completed', { min: 0, max: 250, label: 'Completed credits' }],
    ['pl-current', { min: 0, max: 4, label: 'Current CGPA' }],
    ['pl-target', { min: 0, max: 4, label: 'Target CGPA' }],
  ];
  for (const [id, spec] of specs) {
    clearError(el[id]);
    const result = numberField(el[id].value, spec);
    if (!result.ok) {
      attachError(el[id], result.message);
      firstInvalid ??= el[id];
    } else {
      results[id] = result.value;
    }
  }
  if (firstInvalid) {
    firstInvalid.focus();
    return null;
  }
  return results;
}

function validateField(id, spec) {
  clearError(el[id]);
  const result = numberField(el[id].value, spec);
  if (!result.ok) {
    attachError(el[id], result.message);
    el[id].focus();
    return null;
  }
  return result.value;
}

/* ---- Gauge ---- */

function renderGauge({ fill, current, target, warn = false }) {
  el['gauge-wrap'].hidden = false;
  const fillEl = el['gauge-fill'];
  fillEl.classList.toggle('gauge__fill--warn', warn);
  fillEl.style.width = `${clamp(fill * 100, 0, 100)}%`;
  el['gauge-current-marker'].style.left = `${clamp((current / 4) * 100, 0, 100)}%`;
  el['gauge-target-marker'].style.left = `${clamp((target / 4) * 100, 0, 100)}%`;
}

/* ---- Result states ---- */

function showEmpty(message) {
  el['planner-empty'].hidden = false;
  el['planner-filled'].hidden = true;
  if (el['planner-projection-card']) el['planner-projection-card'].hidden = true;
  if (el['planner-scenarios-card']) el['planner-scenarios-card'].hidden = true;
  if (message) el['planner-empty'].querySelector('p').textContent = message;
}

function renderReachable(outcome, status, plannedCredits) {
  el['planner-headline'].textContent = 'Required GPA next';
  countUp(el['planner-value'], outcome.requiredGpa, { decimals: 2 });
  el['planner-value'].style.color = '';
  el['planner-delta'].hidden = true;
  el['planner-unreachable-note'].hidden = true;
  el['planner-mix'].innerHTML = `Suggested mix: <strong>${outcome.gradeMix.text}</strong> — across ${formatCredits(
    plannedCredits,
  )} planned credits.`;
  el['planner-explain'].textContent = outcome.explanation;
  renderGauge({ fill: outcome.requiredGpa / 4, current: status['pl-current'], target: status['pl-target'] });
}

function renderSecured(outcome, status) {
  el['planner-headline'].textContent = 'Target secured';
  countUp(el['planner-value'], status['pl-target'], { decimals: 2 });
  el['planner-value'].style.color = 'var(--ok)';
  el['planner-delta'].hidden = true;
  el['planner-unreachable-note'].hidden = true;
  el['planner-mix'].innerHTML = 'Any average at or above <strong>0.00</strong> keeps this target.';
  el['planner-explain'].textContent = outcome.explanation;
  renderGauge({ fill: status['pl-target'] / 4, current: status['pl-current'], target: status['pl-target'] });
}

function renderUnreachable(outcome, status) {
  el['planner-headline'].textContent = 'Not reachable in this plan';
  countUp(el['planner-value'], outcome.requiredGpa, { decimals: 2 });
  el['planner-value'].style.color = 'var(--danger)';
  el['planner-delta'].hidden = true;
  el['planner-mix'].innerHTML = `Required GPA: <strong>${formatGpa(outcome.requiredGpa)}</strong> — above the 4.00 maximum.`;
  el['planner-explain'].textContent = outcome.explanation;
  el['planner-unreachable-note'].hidden = false;
  renderGauge({ fill: 1, current: status['pl-current'], target: status['pl-target'], warn: true });
}

function renderWhatIf(result, status, scenarioCredits) {
  el['planner-headline'].textContent = 'Projected CGPA';
  countUp(el['planner-value'], result.cgpa, { decimals: 2 });
  el['planner-value'].style.color = '';

  const rounded = Number(result.delta.toFixed(2));
  el['planner-delta'].hidden = false;
  el['planner-delta'].className = `chip ${rounded > 0 ? 'chip--up' : rounded < 0 ? 'chip--down' : 'chip--flat'}`;
  el['planner-delta'].innerHTML = `<span>${signedDelta(result.delta)} vs current</span>`;

  el['planner-unreachable-note'].hidden = true;
  el['planner-mix'].innerHTML =
    `A GPA of <strong>${formatGpa(el['pl-whatif-gpa'].value)}</strong> across ${formatCredits(scenarioCredits)} credits lands you here.`;
  el['planner-explain'].textContent =
    `This blends your ${formatCredits(status['pl-completed'])} completed credits at ${formatGpa(
      status['pl-current'],
    )} with the scenario. Try a different expected GPA to compare outcomes.`;
  renderGauge({ fill: result.cgpa / 4, current: status['pl-current'], target: status['pl-target'] });
}

function renderProjectionGraph(steps, target) {
  const container = el['planner-projection-graph'];
  if (!container) return;

  const w = 320;
  const h = 84;
  const padLeft = 32;
  const padRight = 48;
  const padTop = 16;
  const padBottom = 20;

  const allVals = steps.map((s) => s.projectedCgpa).concat(target);
  let minVal = Math.min(...allVals);
  let maxVal = Math.max(...allVals);
  if (minVal === maxVal) {
    minVal = Math.max(0, minVal - 0.5);
    maxVal = Math.min(4, maxVal + 0.5);
  }
  const valRange = maxVal - minVal || 1;

  const getX = (index) => padLeft + (index / (steps.length - 1 || 1)) * (w - padLeft - padRight);
  const getY = (val) => padTop + (1 - (val - minVal) / valRange) * (h - padTop - padBottom);

  const points = steps.map((s, idx) => ({ x: getX(idx), y: getY(s.projectedCgpa), val: s.projectedCgpa, label: s.label }));
  const pathD = points.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const areaD = `${pathD} L ${points[points.length - 1].x.toFixed(1)} ${(h - padBottom).toFixed(1)} L ${points[0].x.toFixed(1)} ${(h - padBottom).toFixed(1)} Z`;

  const targetY = getY(target);

  const svg = `
    <svg viewBox="0 0 ${w} ${h}" style="width:100%;height:auto;display:block;overflow:visible;">
      <defs>
        <linearGradient id="projGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="var(--accent)" stop-opacity="0.25"/>
          <stop offset="100%" stop-color="var(--accent)" stop-opacity="0.0"/>
        </linearGradient>
      </defs>
      <line x1="${padLeft}" y1="${targetY.toFixed(1)}" x2="${w - padRight}" y2="${targetY.toFixed(1)}" stroke="var(--ok)" stroke-dasharray="3,3" stroke-width="1.2" opacity="0.8" />
      <text x="${w - padRight + 3}" y="${(targetY + 3).toFixed(1)}" fill="var(--ok)" font-size="7.5" font-weight="600">Target ${target.toFixed(2)}</text>

      <path d="${areaD}" fill="url(#projGrad)"/>
      <path d="${pathD}" fill="none" stroke="var(--accent)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>

      ${points
        .map(
          (p) => `
        <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3" fill="var(--card)" stroke="var(--accent)" stroke-width="2">
          <title>${p.label}: ${p.val.toFixed(2)}</title>
        </circle>
        <text x="${p.x.toFixed(1)}" y="${(p.y - 5).toFixed(1)}" text-anchor="middle" font-size="8" font-weight="700" fill="var(--text)">${p.val.toFixed(2)}</text>
      `,
        )
        .join('')}

      <line x1="${padLeft}" y1="${h - padBottom}" x2="${w - padRight}" y2="${h - padBottom}" stroke="var(--border)" stroke-width="1"/>
    </svg>
  `;

  container.innerHTML = svg;
}

function renderScenariosTable(completed, current, target, plannedCredits) {
  const tbody = el['planner-scenarios-tbody'];
  if (!tbody) return;

  const SCENARIOS = [
    { grade: 'A (Exceptional)', gpa: 4.0 },
    { grade: 'A- (Excellent)', gpa: 3.67 },
    { grade: 'B+ (Very Good)', gpa: 3.33 },
    { grade: 'B (Good)', gpa: 3.0 },
    { grade: 'B- (Satisfactory)', gpa: 2.67 },
    { grade: 'C+ (Passing)', gpa: 2.33 },
    { grade: 'C (Passing)', gpa: 2.0 },
  ];

  const totalCredits = completed + plannedCredits;

  tbody.innerHTML = SCENARIOS.map((sc) => {
    const newQp = completed * current + sc.gpa * plannedCredits;
    const newCgpa = totalCredits > 0 ? Math.min(4, Math.max(0, newQp / totalCredits)) : sc.gpa;
    const diff = newCgpa - target;
    const tone = diff >= 0 ? 'chip--up' : 'chip--down';
    const sign = diff >= 0 ? '+' : '';
    return `
      <tr>
        <td><strong>${sc.grade}</strong></td>
        <td class="num">${sc.gpa.toFixed(2)}</td>
        <td class="num"><strong>${newCgpa.toFixed(2)}</strong></td>
        <td class="num"><span class="chip ${tone}">${sign}${diff.toFixed(2)}</span></td>
      </tr>
    `;
  }).join('');
}

function renderProjectionAndScenarios({ status, plannedCredits, tab, termCount = 1, perTermCredits = plannedCredits, requiredGpa = 0 }) {
  const completed = Number(status['pl-completed'] || 0);
  const current = Number(status['pl-current'] || 0);
  const target = Number(status['pl-target'] || 0);

  const steps = [
    {
      label: 'Current',
      credits: completed,
      termCredits: 0,
      termGpa: current,
      cumulativeCredits: completed,
      projectedCgpa: current,
    },
  ];

  const chunks = [];
  if (tab === 1) {
    for (let i = 1; i <= termCount; i++) {
      chunks.push({ label: `Trimester +${i}`, credits: perTermCredits });
    }
  } else if (tab === 2) {
    const remaining = plannedCredits;
    const count = Math.max(1, Math.ceil(remaining / 15));
    const base = Math.floor(remaining / count);
    const remainder = remaining % count;
    for (let i = 1; i <= count; i++) {
      const cr = i === count ? base + remainder : base;
      chunks.push({ label: `Trimester +${i}`, credits: cr });
    }
  } else {
    chunks.push({ label: 'Next Trimester', credits: plannedCredits });
  }

  let cumCr = completed;
  let cumQp = completed * current;
  const mathGpa = requiredGpa;

  for (const chunk of chunks) {
    cumCr += chunk.credits;
    cumQp += chunk.credits * mathGpa;
    const projCgpa = cumCr > 0 ? Math.min(4, Math.max(0, cumQp / cumCr)) : 0;
    steps.push({
      label: chunk.label,
      credits: chunk.credits,
      termCredits: chunk.credits,
      termGpa: requiredGpa,
      cumulativeCredits: cumCr,
      projectedCgpa: projCgpa,
    });
  }

  if (el['planner-projection-tbody']) {
    el['planner-projection-tbody'].innerHTML = steps
      .map(
        (s, idx) => `
      <tr>
        <td><strong>${s.label}</strong></td>
        <td class="num">${idx === 0 ? '—' : formatCredits(s.termCredits)}</td>
        <td class="num">${idx === 0 ? '—' : formatGpa(s.termGpa)}</td>
        <td class="num">${formatCredits(s.cumulativeCredits)}</td>
        <td class="num"><strong style="color:${s.projectedCgpa >= target ? 'var(--ok)' : 'var(--text)'}">${formatGpa(s.projectedCgpa)}</strong></td>
      </tr>
    `,
      )
      .join('');
  }

  renderProjectionGraph(steps, target);
  renderScenariosTable(completed, current, target, plannedCredits);
  if (el['planner-projection-card']) el['planner-projection-card'].hidden = false;
  if (el['planner-scenarios-card']) el['planner-scenarios-card'].hidden = false;
}

/* ---- Calculate ---- */

function calculate() {
  const status = validateStatus();
  if (!status) return;
  persist();

  const tab = tabs.index;
  const statusInput = {
    completedCredits: status['pl-completed'],
    currentCgpa: status['pl-current'],
    targetCgpa: status['pl-target'],
  };

  try {
    if (tab === 3) {
      // What-If Analysis
      const scenarioCredits = validateField('pl-whatif-credits', { min: 0.5, max: 60, label: 'Scenario credits' });
      const expectedGpa = validateField('pl-whatif-gpa', { min: 0, max: 4, label: 'Expected GPA' });
      if (scenarioCredits === null || expectedGpa === null) return;
      const result = whatIf({
        completedCredits: statusInput.completedCredits,
        currentCgpa: statusInput.currentCgpa,
        scenarioCredits,
        expectedGpa,
      });
      el['planner-empty'].hidden = true;
      el['planner-filled'].hidden = false;
      renderWhatIf(result, status, scenarioCredits);
      renderProjectionAndScenarios({
        status,
        plannedCredits: scenarioCredits,
        tab,
        termCount: 1,
        perTermCredits: scenarioCredits,
        requiredGpa: expectedGpa,
      });
      return;
    }

    let plannedCredits;
    let terms = 1;
    let perTerm = 0;
    if (tab === 0) {
      plannedCredits = validateField('pl-next-credits', { min: 0.5, max: 60, label: 'Credits next trimester' });
    } else if (tab === 1) {
      terms = validateField('pl-terms', { min: 1, max: 20, integer: true, label: 'Number of trimesters' });
      perTerm = validateField('pl-per-term', { min: 0.5, max: 60, label: 'Credits per trimester' });
      if (terms === null || perTerm === null) return;
      plannedCredits = plannedMultipleTrimesters(terms, perTerm);
    } else {
      const degreeTotal = validateField('pl-degree-total', { min: 1, max: 400, label: 'Total degree credits' });
      if (degreeTotal === null) return;
      plannedCredits = plannedUntilGraduation(degreeTotal, statusInput.completedCredits);
    }
    if (plannedCredits === null) return;

    const outcome = planOutcome({ ...statusInput, plannedCredits });
    el['planner-empty'].hidden = true;
    el['planner-filled'].hidden = false;

    if (outcome.status === 'secured') renderSecured(outcome, status);
    else if (outcome.status === 'unreachable') renderUnreachable(outcome, status);
    else renderReachable(outcome, status, plannedCredits);

    renderProjectionAndScenarios({
      status,
      plannedCredits,
      tab,
      termCount: terms,
      perTermCredits: perTerm || plannedCredits,
      requiredGpa: outcome.requiredGpa,
    });
  } catch (error) {
    toast(error.message || 'Could not calculate the plan — check your inputs.', { type: 'error' });
  }
}

function reset() {
  removeItem(STORE_KEY);
  [...STATUS_FIELDS, ...TAB_FIELDS].forEach((id) => {
    el[id].value = '';
    clearError(el[id]);
  });
  showEmpty();
  toast('Planner reset.');
}

/* ---- Boot ---- */

let tabs = null;

function init() {
  cacheElements();
  tabs = initTabs(document.getElementById('planner-tabs'));
  const savedTabIndex = restore()?.activeTab;
  if (Number.isInteger(savedTabIndex) && savedTabIndex >= 0 && savedTabIndex <= 3) {
    tabs.select(savedTabIndex);
  }

  el['planner-calc'].addEventListener('click', calculate);
  el['planner-reset'].addEventListener('click', reset);
  [...STATUS_FIELDS, ...TAB_FIELDS].forEach((id) => {
    el[id].addEventListener('input', () => clearError(el[id]));
  });

  renderGradeTable(document.getElementById('grade-table'));
  showEmpty();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
