/**
 * Pure GPA / CGPA / retake mathematics.
 * No DOM access — the browser pages and the Node tests share this module.
 *
 * Formulas
 * --------
 * GPA  = Σ(grade point × credit hours) / Σ(credit hours)
 * CGPA = Σ(trimester GPA × trimester credits) / Σ(trimester credits)
 *
 * Retake assumption (documented in the UI as well):
 *   A retake REPLACES the previous grade point of an already-counted
 *   credit. We subtract (previousPoint × credit) and add
 *   (newPoint × credit) to the quality-point total, and we do NOT add
 *   the retake's credit hours to the completed total again.
 */

import { letterToPoint } from '../config/grading.js';

export { letterToPoint };

/** Resolve a course's grade point from a letter or a raw point value. */
function pointOf(course) {
  if (course == null) throw new TypeError('Course entry is required.');
  const point = typeof course.grade === 'string'
    ? letterToPoint(course.grade)
    : Number(course.gradePoint);
  if (!Number.isFinite(point)) throw new TypeError(`Unknown grade: ${JSON.stringify(course.grade)}`);
  return point;
}

function creditOf(course) {
  const credits = Number(course.credits);
  if (!Number.isFinite(credits) || credits <= 0) {
    throw new RangeError(`Credit hours must be a positive number, got: ${course.credits}`);
  }
  return credits;
}

/**
 * Term GPA from a list of courses: [{ credits, grade | gradePoint }].
 * Returns 0 when no valid credits are supplied.
 */
export function calcGpa(courses) {
  let qualityPoints = 0;
  let credits = 0;
  for (const course of courses ?? []) {
    qualityPoints += pointOf(course) * creditOf(course);
    credits += creditOf(course);
  }
  return credits > 0 ? qualityPoints / credits : 0;
}

/**
 * CGPA from completed trimesters: [{ gpa, credits }].
 * Returns 0 when no credits are supplied.
 */
export function calcCgpa(trimesters) {
  let qualityPoints = 0;
  let credits = 0;
  for (const tri of trimesters ?? []) {
    const gpa = Number(tri.gpa);
    const triCredits = Number(tri.credits);
    if (!Number.isFinite(gpa) || !Number.isFinite(triCredits) || triCredits < 0) {
      throw new RangeError('Each trimester needs a numeric gpa and non-negative credits.');
    }
    qualityPoints += gpa * triCredits;
    credits += triCredits;
  }
  return credits > 0 ? qualityPoints / credits : 0;
}

/**
 * Updated CGPA after a new trimester, including retakes.
 *
 * @param {object} input
 * @param {number} input.completedCredits  credits already earned
 * @param {number} input.currentCgpa       current CGPA (0 when first trimester)
 * @param {Array}  input.newCourses        [{ credits, grade }]
 * @param {Array}  input.retakeCourses     [{ credits, previousGrade, newGrade }]
 * @returns {{ newCgpa, delta, totalCredits, termGpa, termCredits, qualityPoints }}
 */
export function computeUpdatedCgpa({
  completedCredits = 0,
  currentCgpa = 0,
  newCourses = [],
  retakeCourses = [],
} = {}) {
  const completed = Number(completedCredits);
  const current = Number(currentCgpa);
  if (!Number.isFinite(completed) || completed < 0) {
    throw new RangeError('Completed credits must be a non-negative number.');
  }
  if (!Number.isFinite(current) || current < 0 || current > 4) {
    throw new RangeError('Current CGPA must be between 0 and 4.00.');
  }

  // Quality points carried in from previous trimesters.
  let qualityPoints = completed * current;
  let credits = completed;

  // New courses add both quality points and credit hours.
  for (const course of newCourses ?? []) {
    qualityPoints += pointOf(course) * creditOf(course);
    credits += creditOf(course);
  }

  // Retakes swap the grade point on credits already counted.
  for (const retake of retakeCourses ?? []) {
    const previous = pointOf({ grade: retake.previousGrade });
    const next = pointOf({ grade: retake.newGrade });
    qualityPoints += (next - previous) * creditOf(retake);
  }

  const newCgpa = credits > 0 ? Math.min(4, Math.max(0, qualityPoints / credits)) : 0;

  const termCredits = (newCourses ?? []).reduce((sum, c) => sum + creditOf(c), 0);
  const termQuality = (newCourses ?? []).reduce((sum, c) => sum + pointOf(c) * creditOf(c), 0);

  return {
    newCgpa,
    delta: newCgpa - current,
    totalCredits: credits,
    termGpa: termCredits > 0 ? termQuality / termCredits : 0,
    termCredits,
    qualityPoints,
  };
}
