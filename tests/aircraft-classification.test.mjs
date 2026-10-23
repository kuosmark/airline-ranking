import assert from 'node:assert/strict';
import { test } from 'node:test';
import { aircraftCategory, aircraftEngines } from '../src/aircraft-classification.ts';

test('aircraft metadata describes propulsion and pluralizes engine counts', () => {
  assert.equal(aircraftCategory('L2J'), 'Landplane');
  assert.equal(aircraftEngines('L2J'), '2 jet engines');
  assert.equal(aircraftEngines('L1P'), '1 piston engine');
  assert.equal(aircraftEngines('L2T'), '2 turboprop engines');
  assert.equal(aircraftEngines('H2T'), '2 turboshaft engines');
  assert.equal(aircraftCategory('R6E'), 'Tiltrotor');
  assert.equal(aircraftEngines('R6E'), '6 electric engines');
});

test('missing and ambiguous metadata remains unavailable', () => {
  for (const code of [undefined, '', 'L0T', 'L1M', 'L2?', '-0-', 'X2T']) {
    assert.equal(aircraftEngines(code), 'Unavailable');
  }
  assert.equal(aircraftCategory(undefined), 'Unavailable');
  assert.equal(aircraftCategory('X2J'), 'Unavailable');
});
