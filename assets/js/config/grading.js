/**
 * UIU grading scale and credit rules.
 * Single source of truth for every calculator on the site.
 * Edit here when the university changes the scale — the UI, the
 * grade table and all calculations follow automatically.
 */

/** Letter grade → grade point → marks range (UIU A–F scale). */
export const GRADE_SCALE = [
  { letter: 'A',  point: 4.0, min: 90, max: 100 },
  { letter: 'A-', point: 3.67, min: 86, max: 89 },
  { letter: 'B+', point: 3.33, min: 82, max: 85 },
  { letter: 'B',  point: 3.0, min: 78, max: 81 },
  { letter: 'B-', point: 2.67, min: 74, max: 77 },
  { letter: 'C+', point: 2.33, min: 70, max: 73 },
  { letter: 'C',  point: 2.0, min: 66, max: 69 },
  { letter: 'C-', point: 1.67, min: 62, max: 65 },
  { letter: 'D+', point: 1.33, min: 58, max: 61 },
  { letter: 'D',  point: 1.0, min: 55, max: 57 },
  { letter: 'F',  point: 0.0, min: 0,  max: 54 },
];

/** Highest grade point on the scale. */
export const MAX_GRADE_POINT = 4;

/** Credit values UIU courses may carry (in credit hours). */
export const CREDIT_OPTIONS = [1, 1.5, 2, 3, 4];

/** Pre-selected credit in the add-course forms. */
export const DEFAULT_CREDIT = 3;

/** Format a grade point for display, e.g. 3.33 -> "3.33". */
export function formatPoint(point) {
  return Number(point).toFixed(2);
}

/** Label used in grade <option>s, e.g. "B+ (3.33)". */
export function gradeOptionLabel(letter) {
  return `${letter} (${formatPoint(letterToPoint(letter))})`;
}

/** Look up the raw point for a letter (null when unknown). */
export function letterToPoint(letter) {
  const found = GRADE_SCALE.find((g) => g.letter === String(letter).trim().toUpperCase());
  return found ? found.point : null;
}
