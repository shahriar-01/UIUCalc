/**
 * Tuition Fee Calculator page: credit hours, fee rates, discounts and
 * extras → gross fee, itemized deductions, net payable and the
 * 40/30/30 installment plan. Rules live in config/fees.js + lib/fees.js.
 */

import '/assets/js/main.js';
import { computeFeeBreakdown } from '../lib/fees.js';
import { formatBDT, formatCredits } from '../lib/format.js';
import { numberField, attachError, clearError } from '../lib/validate.js';
import { getItem, setItem, removeItem } from '../lib/storage.js';
import { countUp } from '../components/count-up.js';
import { toast } from '../components/toast.js';

const STORE_KEY = 'fee-tool';

const FIELDS = [
  'fee-new-credits', 'fee-retake1', 'fee-retake2', 'fydp-toggle', 'fydp-credits',
  'per-credit-fee', 'trimester-fee', 'waiver-select', 'scholarship-select', 'apply-first-toggle',
  'batch251-toggle', 'sibling-select', 'ethnic-select', 'disability-select', 'late-toggle',
];

const DEFAULTS = {
  'fee-new-credits': '12',
  'fee-retake1': '0',
  'fee-retake2': '0',
  'fydp-toggle': false,
  'fydp-credits': '3',
  'per-credit-fee': '5500',
  'trimester-fee': '6500',
  'waiver-select': '0',
  'scholarship-select': '0',
  'apply-first-toggle': false,
  'batch251-toggle': false,
  'sibling-select': '0',
  'ethnic-select': '0',
  'disability-select': '0',
  'late-toggle': false,
};

const el = {};
let lastBreakdown = null;

function cacheElements() {
  for (const id of FIELDS) el[id] = document.getElementById(id);
  for (const id of ['fee-calc', 'fee-reset', 'fee-net', 'fee-gross', 'fee-breakdown', 'fee-deductions', 'fee-installments', 'copy-summary', 'fee-empty', 'fee-filled', 'batch251-notice', 'batch251-notice-text']) {
    el[id] = document.getElementById(id);
  }
}

function readInputValue(id) {
  const node = el[id];
  if (node.type === 'checkbox') return node.checked;
  return node.value;
}

function applyState(values) {
  for (const id of FIELDS) {
    const node = el[id];
    if (!(id in values)) continue;
    if (node.type === 'checkbox') node.checked = Boolean(values[id]);
    else if (values[id] !== '' && values[id] !== null && values[id] !== undefined) node.value = String(values[id]);
  }
  syncFydpField();
}

function persistState() {
  const values = {};
  for (const id of FIELDS) values[id] = readInputValue(id);
  setItem(STORE_KEY, values);
}

function restoreState() {
  const saved = getItem(STORE_KEY, null);
  applyState(saved && typeof saved === 'object' ? saved : DEFAULTS);
}

function syncFydpField() {
  el['fydp-credits'].disabled = !el['fydp-toggle'].checked;
}

/* ---- Validation ---- */

function validate() {
  let firstInvalid = null;
  const checks = [
    ['fee-new-credits', { min: 0, max: 60, label: 'New credit hours' }],
    ['fee-retake1', { min: 0, max: 60, required: false, label: 'Retake credits (1st time)' }],
    ['fee-retake2', { min: 0, max: 60, required: false, label: 'Retake credits (2nd+ time)' }],
    ['fydp-credits', { min: 0, max: 30, required: false, label: 'FYDP credits' }],
    ['per-credit-fee', { min: 0, max: 100000, label: 'Per credit fee' }],
    ['trimester-fee', { min: 0, max: 100000, label: 'Trimester fee' }],
  ];

  const values = {};
  for (const [id, rules] of checks) {
    clearError(el[id]);
    if (el[id].disabled) {
      values[id] = 0;
      continue;
    }
    const result = numberField(el[id].value, rules);
    if (!result.ok) {
      attachError(el[id], result.message);
      firstInvalid ??= el[id];
    } else {
      values[id] = result.value ?? 0;
    }
  }

  if (firstInvalid) {
    firstInvalid.focus();
    return null;
  }
  return values;
}

/* ---- Breakdown rendering ---- */

function row(label, value, { strong = false, deduction = false, muted = false } = {}) {
  const classes = ['result-row'];
  if (strong) classes.push('result-row--total');
  if (deduction) classes.push('result-row--deduction');
  return `
    <div class="${classes.join(' ')}"${muted ? ' style="opacity:.75"' : ''}>
      <dt>${label}</dt><dd>${value}</dd>
    </div>`;
}

function renderBreakdown(b) {
  const t = b.totals;
  const creditsLine = (credits) => `(${formatCredits(credits)} cr × ${formatBDT(t.perCredit)})`;

  const tuitionRows = [
    t.newCredits > 0 ? row(`Tuition — new credits ${creditsLine(t.newCredits)}`, formatBDT(b.tuition.new)) : '',
    t.retakeFirstCredits > 0
      ? row(`Retake tuition, 1st time ${creditsLine(t.retakeFirstCredits)} <small style="color:var(--muted)">· 50% discount applies</small>`, formatBDT(b.tuition.retakeFirst))
      : '',
    t.retakeLaterCredits > 0
      ? row(`Retake tuition, 2nd+ time ${creditsLine(t.retakeLaterCredits)} <small style="color:var(--muted)">· full rate</small>`, formatBDT(b.tuition.retakeLater))
      : '',
    t.fydpCredits > 0
      ? row(`FYDP / thesis tuition ${creditsLine(t.fydpCredits)} <small style="color:var(--muted)">· no waiver</small>`, formatBDT(b.tuition.fydp))
      : '',
    row('Trimester fee <small style="color:var(--muted)">· fixed</small>', formatBDT(b.trimesterFee)),
    b.lateFee > 0 ? row('Late registration fine', formatBDT(b.lateFee)) : '',
    row('<strong>Gross fee</strong>', `<strong>${formatBDT(b.gross)}</strong>`, { strong: true }),
  ].filter(Boolean);

  el['fee-gross'].textContent = formatBDT(b.gross);
  el['fee-breakdown'].innerHTML = tuitionRows.join('');

  const d = b.discounts;
  const deductionRows = [
    d.waiver > 0 ? row(`Waiver deduction`, `− ${formatBDT(d.waiver)}`, { deduction: true }) : '',
    d.scholarship > 0 ? row(`Scholarship deduction`, `− ${formatBDT(d.scholarship)}`, { deduction: true }) : '',
    d.special > 0 ? row(`Special waivers (${Math.round(d.specialRate * 100)}%)`, `− ${formatBDT(d.special)}`, { deduction: true }) : '',
    d.retakeFirst > 0 ? row('First-time retake discount (50%)', `− ${formatBDT(d.retakeFirst)}`, { deduction: true }) : '',
    d.total > 0
      ? row('<strong>Total deductions</strong>', `<strong>− ${formatBDT(d.total)}</strong>`, { strong: true })
      : `<p class="panel__meta" style="grid-column:1/-1">No deductions apply to this setup.</p>`,
    row('<strong style="color:var(--accent);font-size:1.05rem;">Final Payable Amount</strong>', `<strong style="color:var(--accent);font-size:1.2rem;">${formatBDT(b.net)}</strong>`, { strong: true }),
  ].filter(Boolean);

  el['fee-deductions'].innerHTML = deductionRows.join('');

  el['fee-installments'].innerHTML = b.installments
    .map(
      (installment) => row(
        `${installment.label} <small style="color:var(--muted)">· ${Math.round(installment.percent * 100)}% of gross</small>`,
        formatBDT(installment.amount),
      ),
    )
    .join('');

  updateBatch251Notice();
}

function updateBatch251Notice() {
  const isBatch251 = el['batch251-toggle'].checked;
  const noticeEl = el['batch251-notice'];
  const textEl = el['batch251-notice-text'];
  if (!noticeEl || !textEl) return;

  if (!isBatch251) {
    noticeEl.hidden = true;
    return;
  }

  const siblingVal = Number(el['sibling-select'].value);
  const ethnicVal = Number(el['ethnic-select'].value);
  const disVal = Number(el['disability-select'].value);

  const selectedList = [];
  if (siblingVal > 0) selectedList.push({ label: 'Sibling/Spouse Waiver', percent: Math.round(siblingVal * 100), rate: siblingVal });
  if (ethnicVal > 0) selectedList.push({ label: 'Ethnic/Tribal Waiver', percent: Math.round(ethnicVal * 100), rate: ethnicVal });
  if (disVal > 0) selectedList.push({ label: 'Disability Waiver', percent: Math.round(disVal * 100), rate: disVal });

  if (selectedList.length === 0) {
    noticeEl.hidden = true;
    return;
  }

  selectedList.sort((a, b) => b.rate - a.rate);
  const applied = selectedList[0];
  const notApplied = selectedList.slice(1);

  if (notApplied.length > 0) {
    textEl.innerHTML = `<div><strong>Batch 251+ Policy Applied:</strong> Only the highest discount (<strong>${applied.label}: ${applied.percent}%</strong>) is applied.</div><div style="margin-top:4px;color:var(--text-2);">The following are <strong>NOT</strong> applied: ${notApplied.map((item) => `${item.label} (${item.percent}%)`).join(', ')}</div>`;
  } else {
    textEl.innerHTML = `<div><strong>Batch 251+ Policy Applied:</strong> Only the highest discount applies. Discount applied: <strong>${applied.label}: ${applied.percent}%</strong>.</div>`;
  }
  noticeEl.hidden = false;
}

function summaryText(b) {
  const lines = [
    'UIU Calculator — tuition fee estimate',
    `Gross fee: ${formatBDT(b.gross)}`,
  ];
  const d = b.discounts;
  if (d.waiver > 0) lines.push(`Waiver deduction: −${formatBDT(d.waiver)}`);
  if (d.scholarship > 0) lines.push(`Scholarship deduction: −${formatBDT(d.scholarship)}`);
  if (d.special > 0) lines.push(`Special waivers: −${formatBDT(d.special)}`);
  if (d.retakeFirst > 0) lines.push(`First-time retake discount: −${formatBDT(d.retakeFirst)}`);
  lines.push(`Net payable: ${formatBDT(b.net)}`);
  lines.push(...b.installments.map((installment) => `${installment.label}: ${formatBDT(installment.amount)}`));
  lines.push('Estimates only — confirm final amounts with the university accounts office.');
  return lines.join('\n');
}

/* ---- Actions ---- */

function calculate() {
  const values = validate();
  if (!values) return;
  persistState();

  lastBreakdown = computeFeeBreakdown({
    newCredits: values['fee-new-credits'],
    retakeFirstCredits: values['fee-retake1'],
    retakeLaterCredits: values['fee-retake2'],
    fydpCredits: el['fydp-toggle'].checked ? values['fydp-credits'] : 0,
    perCreditFee: values['per-credit-fee'],
    trimesterFee: values['trimester-fee'],
    lateRegistration: el['late-toggle'].checked,
    waiverRate: Number(el['waiver-select'].value),
    scholarshipRate: Number(el['scholarship-select'].value),
    applyDiscountFirst: el['apply-first-toggle'].checked,
    specialWaivers: {
      sibling: Number(el['sibling-select'].value) > 0,
      ethnic: Number(el['ethnic-select'].value) > 0,
      disability: Number(el['disability-select'].value),
    },
    batch251OrLater: el['batch251-toggle'].checked,
  });

  el['fee-empty'].hidden = true;
  el['fee-filled'].hidden = false;

  countUp(el['fee-net'], lastBreakdown.net, {
    decimals: 0,
    grouping: true,
    prefix: '৳',
    duration: 950,
  });
  renderBreakdown(lastBreakdown);
}

function reset() {
  removeItem(STORE_KEY);
  applyState(DEFAULTS);
  lastBreakdown = null;
  el['fee-empty'].hidden = false;
  el['fee-filled'].hidden = true;
  if (el['batch251-notice']) el['batch251-notice'].hidden = true;
  FIELDS.forEach((id) => clearError(el[id]));
  toast('Fee calculator reset.');
}

async function copySummary() {
  if (!lastBreakdown) return;
  const text = summaryText(lastBreakdown);
  try {
    await navigator.clipboard.writeText(text);
    toast('Summary copied to clipboard.', { type: 'success' });
  } catch {
    // Clipboard API can be unavailable (permissions / http) — fall back.
    const helper = document.createElement('textarea');
    helper.value = text;
    document.body.append(helper);
    helper.select();
    const ok = document.execCommand('copy');
    helper.remove();
    toast(ok ? 'Summary copied to clipboard.' : 'Copy failed — select the breakdown manually.', {
      type: ok ? 'success' : 'error',
    });
  }
}

/* ---- Boot ---- */

function init() {
  cacheElements();
  restoreState();

  el['fydp-toggle'].addEventListener('change', () => {
    syncFydpField();
    persistState();
  });
  el['fee-calc'].addEventListener('click', calculate);
  el['fee-reset'].addEventListener('click', reset);
  el['copy-summary'].addEventListener('click', copySummary);
  ['batch251-toggle', 'sibling-select', 'ethnic-select', 'disability-select'].forEach((id) => {
    el[id].addEventListener('change', () => {
      updateBatch251Notice();
      if (lastBreakdown) calculate();
    });
  });
  FIELDS.forEach((id) => {
    el[id].addEventListener('input', () => clearError(el[id]));
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
