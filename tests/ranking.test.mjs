import assert from 'node:assert/strict';
import { test } from 'node:test';
import { rankAirlines } from '../shared/ranking.ts';

test('ranks airlines by airborne count, highest first', () => {
  const airlines = [
    { id: 'ACA', name: 'Air Canada', count: 77 },
    { id: 'AAL', name: 'American Airlines', count: 447 },
    { id: 'BAW', name: 'British Airways', count: 85 },
  ];

  assert.deepEqual(rankAirlines(airlines).map(airline => airline.id), [
    'AAL', 'BAW', 'ACA',
  ]);
});

test('breaks count ties by stable identifier, independent of display name or incoming order', () => {
  const airlines = [
    { id: 'CPA', name: 'Cathay Pacific', count: 19 },
    { id: 'EIN', name: 'Aer Lingus', count: 19 },
    { id: 'ACA', name: 'Zulu name', count: 19 },
  ];
  const expected = ['ACA', 'CPA', 'EIN'];

  assert.deepEqual(rankAirlines(airlines).map(airline => airline.id), expected);
  assert.deepEqual(rankAirlines([...airlines].reverse()).map(airline => airline.id), expected);
});

test('returns a new array without changing the input array or airline objects', () => {
  const airlines = [
    { id: 'ACA', name: 'Air Canada', count: 77 },
    { id: 'AAL', name: 'American Airlines', count: 447 },
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
