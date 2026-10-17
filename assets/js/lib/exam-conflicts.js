/**
 * Pure exam-conflict detection for the Exam Conflict Tracker.
 *
 *  - Critical conflict: two (or more) selected exams share the same day
 *    AND the same time slot — the courses cannot be taken together.
 *  - Pressure warning: multiple selected exams on the same day in
 *    different slots — allowed, but heavy.
 */

/**
 * @param {Array<{day:number, slot:string, code:string, title?:string, section?:string}>} exams
 * @returns {{critical: Array<{day:number, slot:string, exams:Array}>,
 *            pressure: Array<{day:number, exams:Array}>}}
 */
export function detectConflicts(exams) {
  const byDaySlot = new Map();
  const byDay = new Map();

  for (const exam of exams ?? []) {
    const slotKey = `${exam.day}|${exam.slot}`;
    if (!byDaySlot.has(slotKey)) byDaySlot.set(slotKey, []);
    byDaySlot.get(slotKey).push(exam);

    if (!byDay.has(exam.day)) byDay.set(exam.day, []);
    byDay.get(exam.day).push(exam);
  }

  const critical = [];
  for (const [key, group] of byDaySlot) {
    if (group.length >= 2) {
      const [day, slot] = key.split('|');
      critical.push({ day: Number(day), slot, exams: group });
    }
  }
  critical.sort((a, b) => a.day - b.day || a.slot.localeCompare(b.slot));

  const pressure = [];
  for (const [day, group] of byDay) {
    const slots = new Set(group.map((e) => e.slot));
    if (group.length >= 2 && slots.size >= 2) {
      pressure.push({ day, exams: [...group].sort((a, b) => a.slot.localeCompare(b.slot)) });
    }
  }
  pressure.sort((a, b) => a.day - b.day);

  return { critical, pressure };
}

/**
 * Build a day → slot → exams map for rendering the schedule grid.
 * @returns {Map<number, Map<string, Array>>}
 */
export function groupByDaySlot(exams) {
  const grid = new Map();
  for (const exam of exams ?? []) {
    if (!grid.has(exam.day)) grid.set(exam.day, new Map());
    const slots = grid.get(exam.day);
    if (!slots.has(exam.slot)) slots.set(exam.slot, []);
    slots.get(exam.slot).push(exam);
  }
  return grid;
}

/** Slot codes a grid should always show, plus whatever the data uses. */
export function slotOrder(exams, base = ['T1', 'T2', 'T3']) {
  const seen = new Set(base);
  for (const exam of exams ?? []) seen.add(exam.slot);
  return [...seen].sort();
}
