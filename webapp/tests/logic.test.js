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
