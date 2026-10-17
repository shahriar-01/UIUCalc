/**
 * Pure target-CGPA planning mathematics.
 *
 * required GPA = (Target × (Completed + Planned) − Current × Completed) / Planned
 */

import { GRADE_SCALE } from '../config/grading.js';

export const MAX_GPA = 4;

/**
 * Grade point average needed across `plannedCredits` credits to reach
 * `targetCgpa`. Throws when plannedCredits is not a positive number
 * (with zero planned credits the question is meaningless).
 */
export function requiredGpa({ completedCredits, currentCgpa, plannedCredits, targetCgpa }) {
  const completed = Number(completedCredits);
  const current = Number(currentCgpa);
  const planned = Number(plannedCredits);
  const target = Number(targetCgpa);
  for (const [name, value] of [[completedCredits, completed], [currentCgpa, current], [targetCgpa, target]]) {
    if (!Number.isFinite(value)) throw new TypeError(`${name} must be a finite number.`);
  }
  if (!Number.isFinite(planned) || planned <= 0) {
    throw new RangeError('plannedCredits must be a positive number.');
  }
  return (target * (completed + planned) - current * completed) / planned;
}

/** Clamp helper for result CGPAs. */
function bounded(value) {
  return Math.min(MAX_GPA, Math.max(0, value));
}

/**
 * Full plan outcome: status + required GPA + a suggested grade mix.
 * status: 'secured' (required ≤ 0), 'unreachable' (required > 4.00)
 * or 'reachable'.
 */
export function planOutcome({ completedCredits, currentCgpa, plannedCredits, targetCgpa }) {
  const required = requiredGpa({ completedCredits, currentCgpa, plannedCredits, targetCgpa });
  if (required <= 0) {
    return {
      status: 'secured',
      requiredGpa: required,
      gradeMix: null,
      explanation:
        'Your target CGPA is already secured. Keep performing at or above your current level to protect it.',
    };
  }
  if (required > MAX_GPA) {
    return {
      status: 'unreachable',
      requiredGpa: required,
      gradeMix: null,
      explanation:
        'This target cannot be reached within the chosen plan. Add more planned credits, or aim for a slightly lower target CGPA.',
    };
  }
  const mix = suggestGradeMix(required);
  return {
    status: 'reachable',
    requiredGpa: required,
    gradeMix: mix,
    explanation: `You need a ${mix.text} across ${plannedCredits} planned credits to reach your target.`,
  };
}

/**
 * Closest letter-grade mix for a required GPA, e.g. 3.70 ->
 * "Mostly A- with some A". Deterministic, derived from GRADE_SCALE.
 */
export function suggestGradeMix(requiredGpaValue) {
  const required = Number(requiredGpaValue);
  if (!Number.isFinite(required) || required <= 0) return null;
  if (required >= MAX_GPA) {
    return { primary: 'A', secondary: 'A', text: 'Straight A — every course at 4.00' };
  }
  if (required < 1) {
    return { primary: 'D', secondary: 'D+', text: 'any passing grade (D or better)' };
  }

  // Grades worth points, best first; F is never part of a suggestion.
  const grades = GRADE_SCALE.filter((g) => g.point > 0).sort((a, b) => b.point - a.point);

  const exact = grades.find((g) => Math.abs(g.point - required) < 1e-9);
  if (exact) {
    return { primary: exact.letter, secondary: exact.letter, text: `sustained ${exact.letter} (${exact.point.toFixed(2)})` };
  }

  // Find the two adjacent grades that bracket the requirement.
  for (let i = 0; i < grades.length - 1; i += 1) {
    const high = grades[i];
    const low = grades[i + 1];
    if (required > low.point && required < high.point) {
      const share = (required - low.point) / (high.point - low.point);
      const primary = share < 0.5 ? low : high;
      const secondary = share < 0.5 ? high : low;
      return { primary: primary.letter, secondary: secondary.letter, text: `mostly ${primary.letter} with some ${secondary.letter}` };
    }
  }
  return null;
}

/**
 * What-if: CGPA after `scenarioCredits` credits at `expectedGpa`.
 * Returns the resulting CGPA and its delta from the current one.
 */
export function whatIf({ completedCredits, currentCgpa, scenarioCredits, expectedGpa }) {
  const completed = Number(completedCredits);
  const current = Number(currentCgpa);
  const credits = Number(scenarioCredits);
  const gpa = Number(expectedGpa);
  if (!Number.isFinite(credits) || credits <= 0) {
    throw new RangeError('scenarioCredits must be a positive number.');
  }
  if (!Number.isFinite(gpa) || gpa < 0 || gpa > MAX_GPA) {
    throw new RangeError('expectedGpa must be between 0 and 4.00.');
  }
  const cgpa = bounded((current * completed + gpa * credits) / (completed + credits));
  return { cgpa, delta: cgpa - current };
}

/** Planned credits when the student names them directly. */
export function plannedNextTrimester(credits) {
  const planned = Number(credits);
  if (!Number.isFinite(planned) || planned <= 0) throw new RangeError('Credits must be a positive number.');
  return planned;
}

/** Planned credits across a number of trimesters of a fixed size. */
export function plannedMultipleTrimesters(trimesterCount, creditsPerTrimester) {
  const terms = Number(trimesterCount);
  const perTerm = Number(creditsPerTrimester);
  if (!Number.isFinite(terms) || terms <= 0) throw new RangeError('Number of trimesters must be positive.');
  if (!Number.isFinite(perTerm) || perTerm <= 0) throw new RangeError('Credits per trimester must be positive.');
  return terms * perTerm;
}

/** Planned credits left until graduation: degree total minus completed. */
export function plannedUntilGraduation(totalDegreeCredits, completedCredits) {
  const total = Number(totalDegreeCredits);
  const completed = Number(completedCredits);
  if (!Number.isFinite(total) || total <= 0) throw new RangeError('Total degree credits must be positive.');
  if (!Number.isFinite(completed) || completed < 0) throw new RangeError('Completed credits must be non-negative.');
  const remaining = total - completed;
  if (remaining <= 0) throw new RangeError('Completed credits already reach the degree total.');
  return remaining;
}
