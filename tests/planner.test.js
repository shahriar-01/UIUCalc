/**
 * Tests for the target-CGPA planner mathematics (assets/js/lib/planner.js).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  requiredGpa,
  planOutcome,
  suggestGradeMix,
  whatIf,
  plannedMultipleTrimesters,
  plannedUntilGraduation,
} from '../assets/js/lib/planner.js';
import { round2 } from '../assets/js/lib/format.js';

/** Assert two numbers agree to within floating-point noise. */
function assertClose(actual, expected, epsilon = 1e-9) {
  assert.ok(Math.abs(actual - expected) < epsilon, `expected ${actual} ≈ ${expected}`);
}

test('planner example: 60cr @ 3.20, 15 planned credits, target 3.30 -> 3.70', () => {
  const required = requiredGpa({
    completedCredits: 60,
    currentCgpa: 3.2,
    plannedCredits: 15,
    targetCgpa: 3.3,
  });
  // (3.30x75 - 3.20x60) / 15 = 55.5 / 15
  assertClose(required, 3.7);
  assert.equal(round2(required), 3.7);
});

test('planner example: same plan with target 3.50 -> 4.70 (unreachable)', () => {
  const required = requiredGpa({
    completedCredits: 60,
    currentCgpa: 3.2,
    plannedCredits: 15,
    targetCgpa: 3.5,
  });
  assertClose(required, 4.7);

  const outcome = planOutcome({
    completedCredits: 60,
    currentCgpa: 3.2,
    plannedCredits: 15,
    targetCgpa: 3.5,
  });
  assert.equal(outcome.status, 'unreachable');
  assert.ok(outcome.requiredGpa > 4);
});

test('a target low enough to be safe is already secured (required <= 0)', () => {
  // 60cr @ 3.40 + 15 planned credits: any average above 0 keeps CGPA >= 2.5.
  const outcome = planOutcome({
    completedCredits: 60,
    currentCgpa: 3.4,
    plannedCredits: 15,
    targetCgpa: 2.5,
  });
  // (2.50x75 - 3.40x60) / 15 = -16.5 / 15
  assert.equal(outcome.status, 'secured');
  assert.ok(outcome.requiredGpa <= 0);
});

test('a reachable plan reports status, mix and explanation', () => {
  const outcome = planOutcome({
    completedCredits: 60,
    currentCgpa: 3.2,
    plannedCredits: 15,
    targetCgpa: 3.3,
  });
  assert.equal(outcome.status, 'reachable');
  assert.ok(outcome.requiredGpa > 0 && outcome.requiredGpa <= 4);
  assert.ok(outcome.gradeMix.text.length > 0);
  assert.ok(outcome.explanation.includes('15'));
});

test('suggestGradeMix brackets the requirement between adjacent grades', () => {
  // 3.70 sits between A- (3.67) and A (4.00), closer to A-.
  assert.equal(suggestGradeMix(3.7).primary, 'A-');
  assert.equal(suggestGradeMix(3.7).secondary, 'A');
  // 3.29 sits between B (3.00) and B+ (3.33), closer to B+.
  assert.equal(suggestGradeMix(3.29).primary, 'B+');
  // Exactly 4.00 demands straight A.
  assert.equal(suggestGradeMix(4).text, 'Straight A — every course at 4.00');
  assert.equal(suggestGradeMix(0), null);
});

test('whatIf blends scenario GPA into the CGPA', () => {
  const { cgpa, delta } = whatIf({
    completedCredits: 60,
    currentCgpa: 3.2,
    scenarioCredits: 15,
    expectedGpa: 3.5,
  });
  // (3.20x60 + 3.50x15) / 75 = 244.5 / 75 = 3.26
  assert.equal(round2(cgpa), 3.26);
  assert.ok(delta > 0);
});

test('whatIf rejects GPA values outside 0..4', () => {
  assert.throws(
    () => whatIf({ completedCredits: 10, currentCgpa: 3, scenarioCredits: 6, expectedGpa: 4.5 }),
    RangeError,
  );
});

test('planned-credit helpers compose the trimester plans', () => {
  assert.equal(plannedMultipleTrimesters(3, 14), 42);
  assert.equal(plannedUntilGraduation(150, 60), 90);
  assert.throws(() => plannedUntilGraduation(60, 60), RangeError);
  assert.throws(
    () => requiredGpa({ completedCredits: 10, currentCgpa: 3, plannedCredits: 0, targetCgpa: 3.5 }),
    RangeError,
  );
});
