/**
 * Tests for the GPA / CGPA / retake engine (assets/js/lib/cgpa.js).
 *
 * NOTE on two of the reference example values: the reference site quotes
 * 3.29 and 3.38 for the first two examples below, but those numbers come
 * from rounding each (grade point × credit) product to whole numbers
 * ((4 + 10 + 9) / 7 and (36 + 45) / 24). Exact arithmetic — which this
 * toolkit uses, per the "no rounding of intermediate values" rule — gives
 * 22.99 / 7 ≈ 3.2843 → 3.28 and 81.8 / 24 ≈ 3.4083 → 3.41. The tests pin
 * the exact values and document the difference.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcGpa, calcCgpa, computeUpdatedCgpa, letterToPoint } from '../assets/js/lib/cgpa.js';
import { round2 } from '../assets/js/lib/format.js';

/** Compare display-rounded values (2 decimals). */
function assertRounded(actual, expected, message) {
  assert.equal(round2(actual), expected, message);
}

test('letterToPoint maps every letter of the UIU scale', () => {
  assert.equal(letterToPoint('A'), 4.0);
  assert.equal(letterToPoint('a-'), 3.67);
  assert.equal(letterToPoint('B+'), 3.33);
  assert.equal(letterToPoint('F'), 0);
  assert.equal(letterToPoint('Z'), null);
});

test('GPA example: A(1cr), B+(3cr), B(3cr) -> 3.28 exact (reference shows 3.29)', () => {
  const gpa = calcGpa([
    { credits: 1, grade: 'A' },
    { credits: 3, grade: 'B+' },
    { credits: 3, grade: 'B' },
  ]);
  // Exact: (4.00x1 + 3.33x3 + 3.00x3) / 7 = 22.99 / 7 = 3.284285...
  assertRounded(gpa, 3.28, '22.99 / 7 rounds to 3.28');
  assert.ok(Math.abs(gpa - 3.29) < 0.01, 'within 0.01 of the reference-quoted 3.29');
});

test('CGPA example: 3.30 (11cr) + 3.50 (13cr) -> 3.41 exact (reference shows 3.38)', () => {
  const cgpa = calcCgpa([
    { gpa: 3.3, credits: 11 },
    { gpa: 3.5, credits: 13 },
  ]);
  // Exact: (3.30x11 + 3.50x13) / 24 = 81.8 / 24 = 3.40833...
  assertRounded(cgpa, 3.41, '81.8 / 24 rounds to 3.41');
});

test('retake example: 30cr @ 3.00, retake 3cr C->B+ -> 3.13', () => {
  const result = computeUpdatedCgpa({
    completedCredits: 30,
    currentCgpa: 3.0,
    newCourses: [],
    retakeCourses: [{ credits: 3, previousGrade: 'C', newGrade: 'B+' }],
  });
  // (90 - 2.00x3 + 3.33x3) / 30 = 93.99 / 30 = 3.133
  assertRounded(result.newCgpa, 3.13);
  // Retake credits must NOT be added to the completed total.
  assert.equal(result.totalCredits, 30);
  assert.ok(result.delta > 0);
});

test('new courses add credits and quality points', () => {
  const result = computeUpdatedCgpa({
    completedCredits: 30,
    currentCgpa: 3.0,
    newCourses: [{ credits: 3, grade: 'A' }],
    retakeCourses: [],
  });
  // (90 + 12) / 33 = 3.0909...
  assertRounded(result.newCgpa, 3.09);
  assert.equal(result.totalCredits, 33);
});

test('a first-trimester student (0 credits, 0 CGPA) gets the term GPA as CGPA', () => {
  const result = computeUpdatedCgpa({
    completedCredits: 0,
    currentCgpa: 0,
    newCourses: [
      { credits: 3, grade: 'A' },
      { credits: 3, grade: 'B' },
    ],
    retakeCourses: [],
  });
  assert.equal(result.newCgpa, result.termGpa);
  assert.equal(result.newCgpa, 3.5); // (4.00x3 + 3.00x3) / 6
  assert.equal(result.termCredits, 6);
});

test('a worse retake grade lowers the CGPA (negative improvement allowed)', () => {
  const result = computeUpdatedCgpa({
    completedCredits: 30,
    currentCgpa: 3.0,
    retakeCourses: [{ credits: 3, previousGrade: 'B', newGrade: 'C' }],
  });
  // (90 - 3.00x3 + 2.00x3) / 30 = 87 / 30 = 2.90
  assertRounded(result.newCgpa, 2.9);
  assert.ok(result.delta < 0);
});

test('retaking an F recovers the full quality points of the course', () => {
  const result = computeUpdatedCgpa({
    completedCredits: 30,
    currentCgpa: 3.0,
    retakeCourses: [{ credits: 3, previousGrade: 'F', newGrade: 'A' }],
  });
  // (90 - 0 + 12) / 30 = 3.40
  assertRounded(result.newCgpa, 3.4);
});

test('empty input is handled without throwing', () => {
  assert.equal(calcGpa([]), 0);
  assert.equal(calcCgpa([]), 0);
  const empty = computeUpdatedCgpa({ completedCredits: 0, currentCgpa: 0 });
  assert.equal(empty.newCgpa, 0);
  assert.equal(empty.totalCredits, 0);
});

test('invalid input throws with a clear message', () => {
  assert.throws(() => computeUpdatedCgpa({ completedCredits: -5, currentCgpa: 3 }), RangeError);
  assert.throws(() => computeUpdatedCgpa({ completedCredits: 10, currentCgpa: 4.5 }), RangeError);
  assert.throws(() => calcGpa([{ credits: 3, grade: 'Q' }]), TypeError);
  assert.throws(() => calcGpa([{ credits: 0, grade: 'A' }]), RangeError);
});
