/**
 * Tests for exam conflict detection (assets/js/lib/exam-conflicts.js).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectConflicts, groupByDaySlot, slotOrder } from '../assets/js/lib/exam-conflicts.js';

const exam = (code, day, slot) => ({ code, day, slot, section: '1' });

test('same day and same slot -> critical conflict', () => {
  const { critical, pressure } = detectConflicts([
    exam('CSE 3301', 2, 'T1'),
    exam('MAT 2101', 2, 'T1'),
  ]);
  assert.equal(critical.length, 1);
  assert.equal(critical[0].day, 2);
  assert.equal(critical[0].slot, 'T1');
  assert.equal(critical[0].exams.length, 2);
  assert.equal(pressure.length, 0);
});

test('same day and different slots -> pressure warning, no critical', () => {
  const { critical, pressure } = detectConflicts([
    exam('CSE 3301', 2, 'T1'),
    exam('CSE 3419', 2, 'T3'),
  ]);
  assert.equal(critical.length, 0);
  assert.equal(pressure.length, 1);
  assert.equal(pressure[0].day, 2);
  assert.equal(pressure[0].exams.length, 2);
});

test('a mixed day reports both the clash and the pressure', () => {
  const { critical, pressure } = detectConflicts([
    exam('CSE 3301', 3, 'T1'),
    exam('MAT 2101', 3, 'T1'),
    exam('CSE 3419', 3, 'T2'),
  ]);
  assert.equal(critical.length, 1);
  assert.equal(critical[0].exams.length, 2);
  assert.equal(pressure.length, 1);
  assert.equal(pressure[0].exams.length, 3);
});

test('exams on different days never conflict', () => {
  const { critical, pressure } = detectConflicts([
    exam('CSE 3301', 1, 'T1'),
    exam('CSE 3419', 2, 'T1'),
    exam('CSE 3503', 3, 'T1'),
  ]);
  assert.equal(critical.length, 0);
  assert.equal(pressure.length, 0);
});

test('empty selection produces no alerts', () => {
  const { critical, pressure } = detectConflicts([]);
  assert.equal(critical.length, 0);
  assert.equal(pressure.length, 0);
});

test('groupByDaySlot arranges exams for the grid', () => {
  const grid = groupByDaySlot([exam('A', 1, 'T1'), exam('B', 1, 'T3'), exam('C', 4, 'T2')]);
  assert.equal(grid.get(1).get('T1')[0].code, 'A');
  assert.equal(grid.get(1).get('T3')[0].code, 'B');
  assert.equal(grid.get(4).get('T2')[0].code, 'C');
  assert.equal(grid.get(2), undefined);
});

test('slotOrder keeps the base order and appends unknown slots', () => {
  assert.deepEqual(slotOrder([exam('A', 1, 'T4'), exam('B', 1, 'T1')]), ['T1', 'T2', 'T3', 'T4']);
});
