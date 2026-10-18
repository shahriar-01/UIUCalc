/**
 * Tests for the tuition-fee engine (assets/js/lib/fees.js).
 * Amounts follow the illustrative example from the project brief:
 * 12 new credits × 5,000 BDT + 6,500 trimester fee.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeFeeBreakdown } from '../assets/js/lib/fees.js';
import { FEE_RULES } from '../assets/js/config/fees.js';

const BASE = {
  newCredits: 12,
  retakeFirstCredits: 0,
  retakeLaterCredits: 0,
  fydpCredits: 0,
  perCreditFee: 5000,
  trimesterFee: 6500,
  lateRegistration: false,
};

test('no waiver: gross 66,500, 1st installment 26,600, net equals gross', () => {
  const b = computeFeeBreakdown(BASE);
  assert.equal(b.gross, 66500);
  assert.equal(b.net, 66500);
  assert.equal(b.installments[0].amount, 26600); // 40% of gross
  assert.equal(b.discounts.total, 0);
});

test('25% waiver: deduction 15,000 and net payable 51,500', () => {
  const b = computeFeeBreakdown({ ...BASE, waiverRate: 0.25 });
  assert.equal(b.discounts.regularTotal, 15000);
  assert.equal(b.net, 51500);
  // The deduction is adjusted in the 2nd/3rd installments: 1st stays 40% of gross.
  assert.equal(b.installments[0].amount, 26600);
  // Sum of installments always equals the net payable.
  const sum = b.installments.reduce((total, inst) => total + inst.amount, 0);
  assert.ok(Math.abs(sum - b.net) < 1e-9);
});

test('scholarship covers at most 13 credits; the rest follow the waiver rate', () => {
  // 15 new credits with a 100% scholarship and no waiver: 13 credits covered.
  const b = computeFeeBreakdown({ ...BASE, newCredits: 15, scholarshipRate: 1 });
  assert.equal(b.discounts.regularTotal, 13 * 5000);
  assert.equal(b.gross, 15 * 5000 + 6500);
  assert.equal(b.net, b.gross - 65000);
  // A huge discount cannot push the payable below zero.
  assert.ok(b.net >= 0);
});

test('the higher of waiver and scholarship applies', () => {
  const b = computeFeeBreakdown({ ...BASE, waiverRate: 0.5, scholarshipRate: 0.25 });
  assert.equal(b.discounts.regularTotal, 0.5 * 60000);
  const c = computeFeeBreakdown({ ...BASE, waiverRate: 0, scholarshipRate: 0.5 });
  assert.equal(c.discounts.regularTotal, 0.5 * 60000);
});

test('first-time retakes get the configurable 50% waiver', () => {
  const b = computeFeeBreakdown({ ...BASE, retakeFirstCredits: 3 });
  assert.equal(b.tuition.retakeFirst, 15000);
  assert.equal(b.discounts.retakeFirst, FEE_RULES.retakeFirstWaiver * 15000);
  assert.equal(b.gross, 60000 + 15000 + 6500);
});

test('2nd-or-later retakes pay full tuition with no discount', () => {
  const b = computeFeeBreakdown({ ...BASE, retakeLaterCredits: 3 });
  assert.equal(b.tuition.retakeLater, 15000);
  assert.equal(b.discounts.total, 0);
  assert.equal(b.net, b.gross);
});

test('FYDP credits are never reduced by waivers', () => {
  const b = computeFeeBreakdown({ ...BASE, fydpCredits: 3, waiverRate: 0.5 });
  assert.equal(b.tuition.fydp, 15000);
  // Waiver applies to the 12 NEW credits only: 0.5 x 60,000 = 30,000.
  assert.equal(b.discounts.regularTotal, 30000);
  assert.equal(b.net, 66500 + 15000 - 30000);
});

test('special waivers stack on top of the regular discount', () => {
  const b = computeFeeBreakdown({
    ...BASE,
    waiverRate: 0.25,
    specialWaivers: { sibling: true, ethnic: true },
  });
  // 25% regular + 20% + 25% special = 70% of new tuition.
  assert.equal(b.discounts.regularTotal, 0.25 * 60000);
  assert.equal(b.discounts.special, 0.45 * 60000);
  assert.equal(b.net, 66500 - 0.7 * 60000);
});

test('from batch 251 the special waivers are not stackable (highest wins)', () => {
  const b = computeFeeBreakdown({
    ...BASE,
    specialWaivers: { sibling: true, ethnic: true },
    batch251OrLater: true,
  });
  assert.equal(b.discounts.special, 0.25 * 60000);
});

test('late registration adds the flat 500 fine', () => {
  const b = computeFeeBreakdown({ ...BASE, lateRegistration: true });
  assert.equal(b.lateFee, 500);
  assert.equal(b.gross, 67000);
});

test('a 100% scholarship overflows into the first installment without going negative', () => {
  const b = computeFeeBreakdown({ ...BASE, scholarshipRate: 1 });
  // Net payable equals the fixed fees only (like the reference's 6.5k example).
  assert.equal(b.net, 6500);
  const sum = b.installments.reduce((total, inst) => total + inst.amount, 0);
  assert.ok(Math.abs(sum - b.net) < 1e-9);
  assert.ok(b.installments.every((inst) => inst.amount >= 0));
});

test('applying the discount in the first installment shifts the adjustment earlier', () => {
  const b = computeFeeBreakdown({ ...BASE, waiverRate: 0.25, applyDiscountFirst: true });
  // 1st installment: 40% of gross minus the 15,000 discount, floored at 0.
  assert.equal(b.installments[0].amount, 26600 - 15000);
  assert.equal(b.installments[1].amount, 19950);
  assert.equal(b.installments[2].amount, 19950);
});
