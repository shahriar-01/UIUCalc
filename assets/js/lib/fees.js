/**
 * Pure tuition-fee mathematics. Reads every rule from config/fees.js.
 *
 * Core rules implemented here:
 *  - Gross fee = (total credits × per-credit rate) + trimester fee (+ late fee).
 *  - FYDP/thesis credits and 2nd-or-later retakes pay full tuition with
 *    no waiver or scholarship.
 *  - Regular waiver/scholarship applies only to the tuition of NEW credits;
 *    the higher of the two applies; a scholarship covers at most
 *    `scholarshipMaxCredits` credits (the rest fall back to the waiver rate).
 *  - Special waivers (sibling/spouse, ethnic/tribal, disability) stack on top,
 *    capped so total regular+special never exceeds the new-credit tuition.
 *  - Installments split the GROSS fee 40/30/30; waiver adjustments land in
 *    the 2nd and 3rd installments (or the 1st when explicitly enabled).
 *    Because discounts are capped at new-credit tuition, FYDP fees are never
 *    reduced by waiver adjustments.
 */

import { FEE_RULES } from '../config/fees.js';

function num(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function rate(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(1, Math.max(0, parsed)) : 0;
}

/**
 * @param {object} input
 * @param {number} input.newCredits           brand-new credit hours
 * @param {number} [input.retakeFirstCredits] retake credits (1st time)
 * @param {number} [input.retakeLaterCredits] retake credits (2nd time or more)
 * @param {number} [input.fydpCredits]        FYDP / thesis / project credits
 * @param {number} input.perCreditFee
 * @param {number} input.trimesterFee
 * @param {boolean} [input.lateRegistration]
 * @param {number} [input.waiverRate]         0 | 0.25 | 0.5
 * @param {number} [input.scholarshipRate]    0 | 0.25 | 0.5 | 1
 * @param {boolean} [input.applyDiscountFirst]
 * @param {object} [input.specialWaivers]     { sibling, ethnic, disability }
 * @param {boolean} [input.batch251OrLater]
 * @returns {object} full itemized breakdown
 */
export function computeFeeBreakdown(input = {}) {
  const perCredit = num(input.perCreditFee, FEE_RULES.defaults.perCreditFee);
  const trimesterFee = num(input.trimesterFee, FEE_RULES.defaults.trimesterFee);
  const newCredits = num(input.newCredits);
  const retakeFirstCredits = num(input.retakeFirstCredits);
  const retakeLaterCredits = num(input.retakeLaterCredits);
  const fydpCredits = num(input.fydpCredits);

  // ---- Tuition components -------------------------------------------------
  const tuitionNew = newCredits * perCredit;
  const tuitionRetakeFirst = retakeFirstCredits * perCredit;
  const tuitionRetakeLater = retakeLaterCredits * perCredit;
  const tuitionFydp = fydpCredits * perCredit;
  const lateFee = input.lateRegistration ? FEE_RULES.lateFee : 0;

  const gross =
    tuitionNew + tuitionRetakeFirst + tuitionRetakeLater + tuitionFydp + trimesterFee + lateFee;

  // ---- Regular discount: higher of waiver and (capped) scholarship --------
  const waiverRate = rate(input.waiverRate);
  const scholarshipRate = rate(input.scholarshipRate);
  const scholarshipCredits = Math.min(newCredits, FEE_RULES.scholarshipMaxCredits);
  const overCapCredits = Math.max(0, newCredits - FEE_RULES.scholarshipMaxCredits);

  const waiverAmount = waiverRate * newCredits * perCredit;
  // Scholarship covers the first `scholarshipMaxCredits` new credits; any
  // additional credits follow the waiver rate.
  const scholarshipAmount = (scholarshipRate * scholarshipCredits + waiverRate * overCapCredits) * perCredit;
  const regularAmount = Math.max(waiverAmount, scholarshipAmount);

  // ---- Special discounts (stackable, unless batch >= specialStackBatch) ---
  const special = input.specialWaivers ?? {};
  const selected = [];
  if (special.sibling) selected.push(FEE_RULES.specialWaivers.sibling);
  if (special.ethnic) selected.push(FEE_RULES.specialWaivers.ethnic);
  if (special.disability) {
    const dVal = typeof special.disability === 'number' ? special.disability : Number(special.disability);
    if (dVal > 0) selected.push(dVal);
  }

  let specialRate = 0;
  if (selected.length > 0) {
    specialRate = input.batch251OrLater
      ? Math.max(...selected) // batch 251+: not stackable, keep the highest
      : Math.min(selected.reduce((sum, r) => sum + r, 0), 1);
  }
  const specialAmountRaw = specialRate * tuitionNew;

  // Waivers only ever touch NEW-credit tuition: cap regular + special there.
  const cappedRegularSpecial = Math.min(regularAmount + specialAmountRaw, tuitionNew);
  const specialAmount = Math.min(specialAmountRaw, cappedRegularSpecial);
  const regularApplied = cappedRegularSpecial - specialAmount;
  // Only the higher of waiver / scholarship applies — attribute the applied
  // regular discount to whichever rate won.
  const scholarshipWins = scholarshipAmount > waiverAmount;

  // ---- First-time retake discount (configurable, see config/fees.js) -----
  const retakeFirstDiscount = FEE_RULES.retakeFirstWaiver * tuitionRetakeFirst;

  const totalDiscount = cappedRegularSpecial + retakeFirstDiscount;
  const net = gross - totalDiscount;

  // ---- Installments: 40/30/30 of the GROSS fee ----------------------------
  const [p1, p2, p3] = FEE_RULES.installmentSplit;
  const share1 = gross * p1;
  const share2 = gross * p2;
  const share3 = gross * p3;

  let remaining = totalDiscount;
  let inst1 = share1;
  let inst2 = share2;
  let inst3 = share3;

  if (input.applyDiscountFirst) {
    inst1 = Math.max(0, share1 - remaining);
    remaining = Math.max(0, remaining - share1);
  }

  const applied2 = Math.min(remaining, share2);
  inst2 = share2 - applied2;
  remaining -= applied2;

  const applied3 = Math.min(remaining, share3);
  inst3 = share3 - applied3;
  remaining -= applied3;

  // If a very large discount outran the 2nd/3rd shares, the overflow
  // reduces the 1st installment so the parts always sum to the net payable.
  if (remaining > 0) inst1 = Math.max(0, inst1 - remaining);

  return {
    tuition: { new: tuitionNew, retakeFirst: tuitionRetakeFirst, retakeLater: tuitionRetakeLater, fydp: tuitionFydp },
    trimesterFee,
    lateFee,
    gross,
    discounts: {
      waiver: scholarshipWins ? 0 : regularApplied,
      scholarship: scholarshipWins ? regularApplied : 0,
      regularTotal: regularApplied,
      special: specialAmount,
      specialRate,
      retakeFirst: retakeFirstDiscount,
      total: totalDiscount,
    },
    net,
    installments: [
      { label: '1st installment', percent: p1, amount: inst1 },
      { label: '2nd installment', percent: p2, amount: inst2 },
      { label: '3rd installment', percent: p3, amount: inst3 },
    ],
    totals: { newCredits, retakeFirstCredits, retakeLaterCredits, fydpCredits, perCredit, trimesterFee },
  };
}


