// Run with: npm test   (uses Node's built-in test runner and type stripping)
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { addMonths, nextDueDate } from '../src/lib/dates.ts';
import { parseIngredientLines } from '../src/lib/ingredients.ts';

const day = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};

test('one-off tasks keep their due date', () => {
  assert.equal(nextDueDate('2026-11-10', 'none', day('2026-11-15')), '2026-11-10');
});

test('weekly task completed on time moves one week', () => {
  assert.equal(nextDueDate('2026-11-15', 'weekly', day('2026-11-15')), '2026-11-22');
});

test('overdue daily task jumps past today', () => {
  assert.equal(nextDueDate('2026-11-01', 'daily', day('2026-11-15')), '2026-11-16');
});

test('overdue weekly task stays on the same weekday', () => {
  // Nov 1 2026 is a Sunday; next Sunday after Nov 15 (also Sunday) is Nov 22.
  assert.equal(nextDueDate('2026-11-01', 'weekly', day('2026-11-15')), '2026-11-22');
});

test('biweekly', () => {
  assert.equal(nextDueDate('2026-11-15', 'biweekly', day('2026-11-15')), '2026-11-29');
});

test('monthly clamps to end of month', () => {
  assert.equal(nextDueDate('2027-01-31', 'monthly', day('2027-01-31')), '2027-02-28');
  assert.equal(addMonths(day('2026-03-31'), 1).getDate(), 30);
});

test('recurring task without a due date starts from today', () => {
  assert.equal(nextDueDate(null, 'daily', day('2026-11-15')), '2026-11-16');
});

test('parses pasted ingredient lines', () => {
  assert.deepEqual(parseIngredientLines('2 cups rice\n- 1 lb chicken thighs\n3 cloves garlic\nsalt\n1 1/2 tbsp olive oil\n2 eggs'), [
    { quantity: '2 cups', name: 'rice' },
    { quantity: '1 lb', name: 'chicken thighs' },
    { quantity: '3 cloves', name: 'garlic' },
    { quantity: '', name: 'salt' },
    { quantity: '1 1/2 tbsp', name: 'olive oil' },
    { quantity: '2', name: 'eggs' },
  ]);
});
