import assert from 'node:assert/strict';
import { test } from 'node:test';
import { availableAircraftCategories } from '../src/aircraft-classification.ts';

test('offers only known categories from airborne types', () => {
  const types = [{ classification: 'L2J', count: 5 }, { classification: 'L1P', count: 2 },
    { classification: 'H2T', count: 1 }, { classification: 'S1P', count: 0 }];
  assert.deepEqual([...availableAircraftCategories(types)], ['Landplane', 'Helicopter']);
  assert.deepEqual([...availableAircraftCategories([{ count: 1 }, { classification: 'X2J', count: 1 }])], []);
});

test('retains a selected category when a later snapshot no longer contains it', () => {
  assert.deepEqual([...availableAircraftCategories([], 'Helicopter')], ['Helicopter']);
  assert.deepEqual([...availableAircraftCategories([])], []);
});
