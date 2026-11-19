import assert from 'node:assert/strict';
import { test } from 'node:test';
import { googleCalLink, nextDue, parseIngredients, parseKey, planGroceries, remindAtFor, leftoverOptions, eventPeople } from '../src/logic.js';

test('repeating to-dos roll forward past today', () => {
  assert.equal(nextDue('2026-11-10', 'none', parseKey('2026-11-15')), '2026-11-10');
  assert.equal(nextDue('2026-11-15', 'weekly', parseKey('2026-11-15')), '2026-11-22');
  assert.equal(nextDue('2026-11-01', 'daily', parseKey('2026-11-15')), '2026-11-16');
  assert.equal(nextDue('2026-11-01', 'weekly', parseKey('2026-11-15')), '2026-11-22');
  assert.equal(nextDue('2026-11-15', 'biweekly', parseKey('2026-11-15')), '2026-11-29');
  assert.equal(nextDue('2027-01-31', 'monthly', parseKey('2027-01-31')), '2027-02-28');
  assert.equal(nextDue(null, 'daily', parseKey('2026-11-15')), '2026-11-16');
});

test('parses pasted ingredient lines', () => {
  assert.deepEqual(parseIngredients('2 cups rice\n- 1 lb chicken thighs\nsalt\n1 1/2 tbsp olive oil'), [
    { quantity: '2 cups', name: 'rice' },
    { quantity: '1 lb', name: 'chicken thighs' },
    { quantity: '', name: 'salt' },
    { quantity: '1 1/2 tbsp', name: 'olive oil' },
  ]);
});

test('merges recipe ingredients into the grocery list', () => {
  const shopping = [
    { id: 'a', name: 'Onion', quantity: '1', category: 'groceries', checked: false },
    { id: 'b', name: 'Milk', quantity: '', category: 'groceries', checked: true },
    { id: 'c', name: 'Onions', quantity: '', category: 'household', checked: false },
  ];
  const plan = planGroceries([
    { name: 'onions', quantity: '2' }, { name: 'Milk', quantity: '1 cup' },
    { name: 'Garlic', quantity: '2 cloves' }, { name: 'garlic', quantity: '1 clove' }, { name: ' ', quantity: '3' },
  ], shopping);
  assert.deepEqual(plan.updates, [{ id: 'a', quantity: '1 + 2' }]);
  assert.deepEqual(plan.additions, [{ name: 'Milk', quantity: '1 cup' }, { name: 'Garlic', quantity: '2 cloves + 1 clove' }]);
});

test('google calendar link', () => {
  const url = googleCalLink({ title: 'Dinner', start: Date.UTC(2026, 10, 20, 23), end: Date.UTC(2026, 10, 21, 0) });
  assert.match(url, /dates=20261120T230000Z%2F20261121T000000Z/);
});

test('reminder times', () => {
  const start = new Date(2026, 10, 20, 17, 0).getTime();
  assert.equal(remindAtFor({ start, allDay: false, reminderMinutes: 30 }), start - 30 * 60000);
  assert.equal(remindAtFor({ start, allDay: false, reminderMinutes: null }), null);
  const dayStart = new Date(2026, 10, 20).getTime();
  assert.equal(remindAtFor({ start: dayStart, allDay: true, reminderMinutes: 1440 }), new Date(2026, 10, 19, 9, 0).getTime());
});

test('leftover choices from the last few days', () => {
  const menu = [
    { date: '2026-11-19', meal: 'dinner', title: 'Tacos' },          // later the same day: not yet eaten
    { date: '2026-11-19', meal: 'breakfast', title: 'Pancakes' },
    { date: '2026-11-18', meal: 'dinner', title: 'Chili', recipeId: 'r1' },
    { date: '2026-11-17', meal: 'lunch', title: 'Leftovers: Chili' }, // duplicate of Chili
    { date: '2026-11-16', meal: 'dinner', title: 'Lasagna' },
    { date: '2026-11-10', meal: 'dinner', title: 'Too old' },
  ];
  const opts = leftoverOptions(menu, '2026-11-19', 'lunch');
  assert.deepEqual(opts.map((o) => o.title), ['Pancakes', 'Chili', 'Lasagna']);
  assert.equal(opts[1].recipeId, 'r1');
});

test('event people default to everyone', () => {
  assert.deepEqual(eventPeople({}, ['a', 'b']), ['a', 'b']);
  assert.deepEqual(eventPeople({ attendeeIds: ['b'] }, ['a', 'b']), ['b']);
  assert.deepEqual(eventPeople({ attendeeIds: ['gone'] }, ['a', 'b']), ['a', 'b']);
});

import { describeRule, firstDue, normalizeRule } from '../src/logic.js';
const T = (k) => parseKey(k);

test('weekly on chosen weekdays', () => {
  const r = { freq: 'weekly', interval: 1, weekdays: [1, 4] }; // Mon, Thu
  assert.equal(nextDue('2026-11-16', r, T('2026-11-16')), '2026-11-19'); // Mon -> Thu
  assert.equal(nextDue('2026-11-19', r, T('2026-11-19')), '2026-11-23'); // Thu -> next Mon
  assert.equal(firstDue('2026-11-20', r), '2026-11-23');                 // starts Fri -> Mon
  assert.equal(describeRule(r), 'Weekly on Mon, Thu');
});

test('every 2 weeks keeps the gap', () => {
  const r = { freq: 'weekly', interval: 2, weekdays: [2] }; // Tue
  assert.equal(nextDue('2026-11-17', r, T('2026-11-17')), '2026-12-01');
  assert.equal(describeRule(r), 'Every 2 weeks on Tue');
});

test('monthly on a day number, clamped, and last day', () => {
  assert.equal(nextDue('2026-01-31', { freq: 'monthly', interval: 1, monthMode: 'date', monthDay: 31 }, T('2026-01-31')), '2026-02-28');
  assert.equal(nextDue('2026-02-28', { freq: 'monthly', interval: 1, monthMode: 'date', monthDay: 31 }, T('2026-02-28')), '2026-03-31');
  assert.equal(nextDue('2026-11-30', { freq: 'monthly', interval: 1, monthMode: 'date', monthDay: -1 }, T('2026-11-30')), '2026-12-31');
  assert.equal(firstDue('2026-11-19', { freq: 'monthly', interval: 1, monthMode: 'date', monthDay: 1 }), '2026-12-01');
  assert.equal(describeRule({ freq: 'monthly', monthMode: 'date', monthDay: 22 }), 'Monthly on the 22nd');
});

test('monthly on a weekday of the month', () => {
  const second = { freq: 'monthly', interval: 1, monthMode: 'weekday', nth: 2, weekday: 2 }; // 2nd Tue
  assert.equal(firstDue('2026-11-01', second), '2026-11-10');
  assert.equal(nextDue('2026-11-10', second, T('2026-11-10')), '2026-12-08');
  const lastFri = { freq: 'monthly', interval: 3, monthMode: 'weekday', nth: -1, weekday: 5 };
  assert.equal(nextDue('2026-11-27', lastFri, T('2026-11-27')), '2027-02-26');
  assert.equal(describeRule(lastFri), 'Every 3 months on the last Friday');
});

test('yearly and every N days', () => {
  assert.equal(nextDue('2028-02-29', { freq: 'yearly', interval: 1 }, T('2028-02-29')), '2029-02-28');
  assert.equal(nextDue('2026-11-19', { freq: 'daily', interval: 3 }, T('2026-11-19')), '2026-11-22');
});

test('old saved rules still work', () => {
  assert.deepEqual(normalizeRule('biweekly', '2026-11-17'), { freq: 'weekly', interval: 2, weekdays: [2] });
  assert.equal(describeRule('weekly', '2026-11-19'), 'Weekly on Thu');
});

test('yearly from a start date', () => {
  const r = { freq: 'yearly', interval: 1, month: 2, day: 15 }; // Mar 15
  assert.equal(firstDue('2026-11-19', r), '2027-03-15');
  assert.equal(firstDue('2027-03-15', r), '2027-03-15');
  assert.equal(describeRule(r), 'Yearly on Mar 15');
});
