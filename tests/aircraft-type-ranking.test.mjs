import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveAircraftType } from '../backend/aircraft-types.ts';
import { countAircraft } from '../backend/skylink.ts';
import { compareRanks } from '../shared/ranking.ts';
import { isSnapshot } from '../shared/snapshot-validation.ts';
import { filterOperators } from '../src/operator-search.ts';

const updatedAt = '2026-10-04T12:00:00Z';
const now = Date.parse(updatedAt);
function snapshot(records) {
  const aircraft = records.map((record, index) => ({
    icao24: index.toString(16).padStart(6, '0'), callsign: 'FIN123',
    is_on_ground: false, last_seen: updatedAt, latitude: 60, longitude: 25,
    aircraft_type: 'B738', ...record,
  }));
  return countAircraft({ aircraft, total_count: aircraft.length, timestamp: updatedAt }, now);
}

test('resolves FAA codes and verified model aliases without guessing unfamiliar or generic types', () => {
  for (const label of ['B738', ' THE BOEING COMPANY  b738 ', 'Boeing 737-800']) {
    assert.deepEqual(resolveAircraftType(label), { id: 'B738', name: 'Boeing 737-800' });
  }
  assert.equal(resolveAircraftType('BOEING 737-8').id, 'B38M');
  assert.equal(resolveAircraftType('BOEING 737-9').id, 'B39M');
  assert.equal(resolveAircraftType('SCHEMPP-HIRTH DUOD').id, 'DUOD');
  for (const label of [null, '', 42, 'BOEING 737-UNKNOWN', 'ZZZZ', 'GLID', 'BALL', 'ULAC']) {
    assert.equal(resolveAircraftType(label), null);
  }
});

test('both rankings count the same eligible aircraft, including unknown operators and missing positions', () => {
  const result = snapshot([
    {}, { aircraft_type: 'Boeing B738', callsign: 'AAL12' },
    { aircraft_type: 'Boeing 737-800', callsign: 'N123AB', registration: 'N123AB', latitude: null },
    { aircraft_type: 'A320', callsign: '' },
    { aircraft_type: 'Unverified model', callsign: 'AAL13' },
    { aircraft_type: null, callsign: '' },
    { aircraft_type: 'A320', is_on_ground: true },
    { aircraft_type: 'A320', last_seen: '2026-10-04T11:54:59Z' },
    { aircraft_type: 'A320', last_seen: '2026-10-04T12:00:01Z' },
  ]);
  assert.equal(isSnapshot(result), true);
  assert.equal(result.airborneCount, 6);
  assert.deepEqual(result.aircraftTypeRankings.map(row => [row.id, row.count]), [['B738', 3], ['A320', 1]]);
  const boeing = result.aircraftTypeRankings[0];
  assert.deepEqual(boeing.operators, [{ id: null, count: 1 }, { id: 'AAL', count: 1 }, { id: 'FIN', count: 1 }]);
  assert.equal(boeing.positions.length, 2);
  assert.equal(result.unknownAircraftType.count, 2);
  assert.equal(result.unknownAircraftType.positions.length, 2);
  assert.equal(result.aircraftTypeRankings.reduce((total, row) => total + row.count, result.unknownAircraftType.count), result.airborneCount);
});

test('newest observations decide the aircraft type and ties favour ground observations', () => {
  const records = [
    { icao24: 'abcdef', aircraft_type: 'B738', last_seen: '2026-10-04T11:59:00Z' },
    { icao24: 'abcdef', aircraft_type: 'A320' },
    { icao24: '123abc', aircraft_type: 'B738' },
    { icao24: '123abc', aircraft_type: 'B738', is_on_ground: true },
  ];
  const forward = snapshot(records);
  assert.deepEqual(forward, snapshot([...records].reverse()));
  assert.deepEqual(forward.aircraftTypeRankings.map(row => [row.id, row.count]), [['A320', 1]]);
});

test('type rank changes use ICAO identities independently of operator ranks and display names', () => {
  const previous = snapshot([{}, {}, { aircraft_type: 'A320' }]);
  const next = snapshot([{}, { aircraft_type: 'A320' }, { aircraft_type: 'A320' }, { aircraft_type: 'C172' }]);
  next.aircraftTypeRankings[0].name = 'Updated display name';
  const compared = compareRanks(next, previous);
  assert.deepEqual(compared.aircraftTypeRankings.map(row => [row.id, row.rankChange]), [['A320', 1], ['B738', -1], ['C172', 'new']]);
  assert.equal(compared.airlines[0].rankChange, 0);
  const legacy = { ...previous, aircraftTypeRankings: undefined, unknownAircraftType: undefined };
  assert.ok(compareRanks(next, legacy).aircraftTypeRankings.every(row => row.rankChange === undefined));
  assert.ok(compareRanks(next, null).aircraftTypeRankings.every(row => row.rankChange === undefined));
});

test('rejects partial, malformed or inconsistent type rankings while accepting old snapshots', () => {
  const valid = snapshot([{}, { aircraft_type: null }]);
  const type = valid.aircraftTypeRankings[0];
  assert.equal(isSnapshot(valid), true);
  for (const change of [
    { aircraftTypeRankings: undefined }, { unknownAircraftType: undefined },
    { aircraftTypeRankings: null }, { aircraftTypeRankings: [type, type] },
    { aircraftTypeRankings: [{ ...type, id: 'TOOLONG' }] },
    { aircraftTypeRankings: [{ ...type, name: null }] },
    { aircraftTypeRankings: [{ ...type, rankChange: 'up' }] },
    { aircraftTypeRankings: [{ ...type, operators: [] }] },
    { aircraftTypeRankings: [{ ...type, operators: [{ id: 'bad', count: 1 }] }] },
    { aircraftTypeRankings: [{ ...type, positions: [{ ...type.positions[0], latitude: 91 }] }] },
    { unknownAircraftType: { ...valid.unknownAircraftType, count: 2 } },
  ]) {
    assert.equal(isSnapshot({ ...valid, ...change }), false);
  }
  assert.equal(isSnapshot({ ...valid, aircraftTypeRankings: undefined, unknownAircraftType: undefined }), true);
});

test('type search matches names and codes and retains original ranks', () => {
  const rows = snapshot([{}, {}, { aircraft_type: 'A320' }]).aircraftTypeRankings;
  assert.deepEqual(filterOperators(rows, ' a320 ').map(row => row.rank), [2]);
  assert.deepEqual(filterOperators(rows, 'Boeing').map(row => row.airline.id), ['B738']);
  assert.equal(filterOperators(rows, 'Finland').length, 0);
});
