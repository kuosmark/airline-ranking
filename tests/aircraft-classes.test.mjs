import assert from 'node:assert/strict';
import { test } from 'node:test';
import { availableAircraftClasses, resolveAircraftClass } from '../src/aircraft-classes.ts';

test('offers only known categories from airborne types', () => {
  const types = [{ classification: 'L2J', count: 5 }, { classification: 'L1P', count: 2 },
    { classification: 'H2T', count: 1 }, { classification: 'S1P', count: 0 }];
  assert.deepEqual([...availableAircraftClasses(types)], ['jet', 'piston', 'helicopter']);
  assert.deepEqual([...availableAircraftClasses([{ count: 1 }, { classification: 'X2J', count: 1 }])], []);
});

test('retains a selected category when a later snapshot no longer contains it', () => {
  assert.deepEqual([...availableAircraftClasses([], 'helicopter')], ['helicopter']);
  assert.deepEqual([...availableAircraftClasses([])], []);
});

test('groups landplanes by propulsion regardless of engine count and preserves other categories', () => {
  const cases = { L1P: 'piston', L2P: 'piston', L1T: 'turboprop',
    L2T: 'turboprop', L1J: 'jet', L2J: 'jet', L3J: 'jet',
    L4J: 'jet', L4T: 'turboprop', L1E: 'electric', L0J: 'jet', L6J: 'jet', L8J: 'jet', L0T: 'turboprop', L1R: '',
    H2T: 'helicopter', H1P: 'helicopter', A2J: 'amphibian', S2P: 'seaplane', A2T: 'amphibian', G1P: 'gyrocopter',
    R2T: 'tiltrotor', W2T: '' };
  for (const [classification, id] of Object.entries(cases)) {
    assert.equal(resolveAircraftClass(classification).id, id);
  }
  assert.equal(resolveAircraftClass().id, '');
  assert.equal(resolveAircraftClass('X2J').id, '');
});

test('classes intentionally share exactly the same symbol objects', () => {
  for (const [first, second] of [['L1P', 'L2P'], ['L2T', 'L4T'], ['L2J', 'L8J'], ['S2P', 'A2T']]) {
    assert.equal(resolveAircraftClass(first).symbol, resolveAircraftClass(second).symbol);
  }
});

test('unsupported landplane propulsion keeps its metadata without creating another filter', () => {
  assert.equal(resolveAircraftClass('L1R').label, 'Landplane');
  assert.equal(resolveAircraftClass('L1R').id, '');
  assert.equal(resolveAircraftClass().label, 'Classification unavailable');
});
