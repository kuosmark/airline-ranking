import assert from 'node:assert/strict';
import { test } from 'node:test';
import { filterOperators } from '../src/operator-search.ts';

const airlines = [
  { id: 'AAL', name: 'American Airlines', icao: 'AAL', iata: 'AA', country: 'United States', count: 100, aircraftTypes: [] },
  { id: 'DAL', name: 'Delta Air Lines', icao: 'DAL', iata: 'DL', country: 'United States', count: 90, aircraftTypes: [] },
  { id: 'FIN', name: 'Finnair', icao: 'FIN', iata: 'AY', country: 'Finland', count: 20, aircraftTypes: [] },
  { id: 'XYZ', name: 'XYZ', icao: null, iata: null, country: null, count: 10, aircraftTypes: [] },
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

test('matches IATA codes and countries while preserving leaderboard ranks', () => {
  assert.deepEqual(filterOperators(airlines, ' ay '), [{ airline: airlines[2], rank: 3 }]);
  assert.deepEqual(filterOperators(airlines, ' FINLAND '), [{ airline: airlines[2], rank: 3 }]);
  assert.deepEqual(filterOperators(airlines, 'united states').map(row => row.rank), [1, 2]);
});

test('searches directory ICAO independently and supports alphanumeric IATA codes', () => {
  const operator = { id: 'XYZ', name: 'Example', icao: 'ABC', iata: '5F', country: null, count: 1, aircraftTypes: [] };
  for (const query of ['abc', '5f', 'xyz']) {
    assert.deepEqual(filterOperators([operator], query), [{ airline: operator, rank: 1 }]);
  }
});

test('missing directory fields do not match placeholder labels or break prefix search', () => {
  assert.deepEqual(filterOperators(airlines, 'unavailable'), []);
  assert.deepEqual(filterOperators(airlines, 'null'), []);
  assert.deepEqual(filterOperators(airlines, 'xyz'), [{ airline: airlines[3], rank: 4 }]);
});
