import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatSnapshotAge } from '../src/snapshot-age.ts';

const updatedAt = '2026-10-04T12:00:00Z';
const snapshotTime = Date.parse(updatedAt);

test('shows fresh snapshots and clock skew as just now', () => {
  assert.equal(formatSnapshotAge(updatedAt, snapshotTime - 60_000), 'just now');
  assert.equal(formatSnapshotAge(updatedAt, snapshotTime), 'just now');
  assert.equal(formatSnapshotAge(updatedAt, snapshotTime + 59_999), 'just now');
});

test('ages the same snapshot through minute, hour, and day boundaries', () => {
  for (const [minutes, expected] of [
    [1, '1 min ago'], [59, '59 min ago'], [60, '1 hr ago'],
    [1439, '23 hr ago'], [1440, '1 day ago'], [2880, '2 days ago'],
  ]) {
    assert.equal(formatSnapshotAge(updatedAt, snapshotTime + minutes * 60_000), expected);
  }
});
