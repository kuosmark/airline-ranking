import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isSnapshot } from '../shared/snapshot-validation.ts';

const snapshot = {
  updatedAt: '2026-10-04T12:00:00Z', isStale: false,
  airlines: [{ id: 'FIN', name: 'Finnair', count: 1, aircraftTypes: [{ name: 'Airbus A320', count: 1 }] }],
};
const position = { id: 'abc123', callsign: 'FIN123', aircraftType: 'Airbus A320', latitude: 60, longitude: 25, altitudeFt: 0 };

test('accepts older snapshots without optional fields, empty rankings and current metadata and positions', () => {
  assert.equal(isSnapshot(snapshot), true);
  assert.equal(isSnapshot({ ...snapshot, airlines: [] }), true);
  for (const rankChange of [undefined, 'new', 0, -2]) {
    const airline = { ...snapshot.airlines[0], country: 'Finland', countryIso: 'FI', iata: 'AY', icao: 'FIN', rankChange, positions: [position] };
    assert.equal(isSnapshot({ ...snapshot, airlines: [airline] }), true);
    assert.equal(isSnapshot({ ...snapshot, airlines: [{ ...airline, country: null, countryIso: null, iata: null, icao: null }] }), true);
  }
});

test('rejects malformed response envelopes and fields used to render the ranking', () => {
  for (const value of [null, [], {}, { ...snapshot, updatedAt: 'invalid' },
    { ...snapshot, isStale: 'false' }, { ...snapshot, airlines: null }, { ...snapshot, airlines: {} }]) {
    assert.equal(isSnapshot(value), false);
  }
  const invalidFields = [
    { id: 'invalid' }, { name: null }, { count: '1' }, { count: -1 }, { count: 0.5 },
    { country: {} }, { countryIso: 42 }, { countryIso: 'Finland' }, { iata: 'TOOLONG' }, { icao: 'AAL' },
    { rankChange: 'up' }, { aircraftTypes: null }, { aircraftTypes: [{ name: null, count: 1 }] },
    { aircraftTypes: [{ name: 'Airbus A320', count: NaN }] },
  ];
  for (const fields of invalidFields) {
    assert.equal(isSnapshot({ ...snapshot, airlines: [{ ...snapshot.airlines[0], ...fields }] }), false);
  }
});

test('rejects invalid map positions while accepting omitted or finite altitude values', () => {
  for (const altitudeFt of [undefined, 0, -50, 35000]) {
    const aircraft = { ...position, altitudeFt };
    assert.equal(isSnapshot({ ...snapshot, airlines: [{ ...snapshot.airlines[0], positions: [aircraft] }] }), true);
  }
  for (const fields of [{ id: 'invalid' }, { latitude: 91 }, { longitude: -181 },
    { callsign: null }, { aircraftType: null }, { altitudeFt: '35000' }, { altitudeFt: Infinity }]) {
    const aircraft = { ...position, ...fields };
    assert.equal(isSnapshot({ ...snapshot, airlines: [{ ...snapshot.airlines[0], positions: [aircraft] }] }), false);
  }
  assert.equal(isSnapshot({ ...snapshot, airlines: [{ ...snapshot.airlines[0], positions: [position, position] }] }), false);
});
