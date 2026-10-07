import assert from 'node:assert/strict';
import { test } from 'node:test';
import { filterOperators } from '../src/operator-search.ts';

const airlines = [
  { id: 'AAL', name: 'American Airlines', count: 100, aircraftTypes: [] },
  { id: 'DAL', name: 'Delta Air Lines', count: 90, aircraftTypes: [] },
  { id: 'FIN', name: 'Finnair', count: 20, aircraftTypes: [] },
  { id: 'XYZ', name: 'XYZ', count: 10, aircraftTypes: [] },
];

test('matches names and prefixes without case sensitivity and ignores surrounding spaces', () => {
  assert.deepEqual(filterOperators(airlines, ' AIR ').map(row => row.airline.id), ['AAL', 'DAL', 'FIN']);
  assert.deepEqual(filterOperators(airlines, ' dAl '), [{ airline: airlines[1], rank: 2 }]);
  assert.deepEqual(filterOperators(airlines, 'xyz'), [{ airline: airlines[3], rank: 4 }]);
});

test('preserves leaderboard ranks and order when filtering without changing the source', () => {
  const original = airlines.map(airline => ({ ...airline, aircraftTypes: [...airline.aircraftTypes] }));
  assert.deepEqual(filterOperators(airlines, 'fin'), [{ airline: airlines[2], rank: 3 }]);
  assert.deepEqual(airlines, original);
  assert.deepEqual(filterOperators(airlines, '  ').map(row => row.rank), [1, 2, 3, 4]);
});

test('returns no rows for an unmatched query or an empty ranking', () => {
  assert.deepEqual(filterOperators(airlines, 'missing'), []);
  assert.deepEqual(filterOperators([], ''), []);
});

test('search finds operators beyond the initially displayed 100 and preserves their ranks', () => {
  const fullRanking = Array.from({ length: 150 }, (_, index) => ({
    id: `OP${index}`, name: `Operator ${index}`, count: 150 - index, aircraftTypes: [],
  }));
  assert.deepEqual(filterOperators(fullRanking, 'OP149'), [{ airline: fullRanking[149], rank: 150 }]);
});
