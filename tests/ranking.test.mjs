import assert from 'node:assert/strict';
import { test } from 'node:test';
import { rankAirlines } from '../src/sample-data.ts';

test('ranks airlines by airborne count, highest first', () => {
  const airlines = [
    { id: 'air-canada', name: 'Air Canada', count: 77 },
    { id: 'american', name: 'American Airlines', count: 447 },
    { id: 'british', name: 'British Airways', count: 85 },
  ];

  assert.deepEqual(rankAirlines(airlines).map(airline => airline.id), [
    'american', 'british', 'air-canada',
  ]);
});

test('breaks count ties alphabetically, regardless of incoming order', () => {
  const airlines = [
    { id: 'cathay', name: 'Cathay Pacific', count: 19 },
    { id: 'aer-lingus', name: 'Aer Lingus', count: 19 },
    { id: 'air-canada', name: 'Air Canada', count: 19 },
  ];
  const expected = ['aer-lingus', 'air-canada', 'cathay'];

  assert.deepEqual(rankAirlines(airlines).map(airline => airline.id), expected);
  assert.deepEqual(rankAirlines([...airlines].reverse()).map(airline => airline.id), expected);
});

test('retains airlines with zero aircraft and ranks them after positive counts', () => {
  const zero = { id: 'aer-lingus', name: 'Aer Lingus', count: 0 };
  const flying = { id: 'cathay', name: 'Cathay Pacific', count: 1 };

  assert.deepEqual(rankAirlines([zero, flying]), [flying, zero]);
});

test('returns a new array without changing the input array or airline objects', () => {
  const airlines = [
    { id: 'air-canada', name: 'Air Canada', count: 77 },
    { id: 'american', name: 'American Airlines', count: 447 },
  ];
  const original = airlines.map(airline => ({ ...airline }));
  const ranked = rankAirlines(airlines);

  assert.notStrictEqual(ranked, airlines);
  assert.deepEqual(airlines, original);
  assert.deepEqual(ranked, [original[1], original[0]]);
});

test('handles an empty ranking', () => {
  assert.deepEqual(rankAirlines([]), []);
});
