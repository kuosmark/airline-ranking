import assert from 'node:assert/strict';
import console from 'node:console';
import { test } from 'node:test';
import { createRankingService } from '../backend/server.ts';

const start = Date.parse('2026-10-04T12:00:00Z');
const makeSnapshot = (minute, entries) => ({
  updatedAt: new Date(start + minute * 60000).toISOString(), isStale: false,
  airlines: entries.map(([id, count]) => ({ id, name: id, count, aircraftTypes: [] })),
});
const changes = service => Object.fromEntries(service.read().airlines.map(row => [row.id, row.rankChange]));

test('first snapshot and restarted service have no indicators', async () => {
  const data = makeSnapshot(0, [['AAA', 10], ['BBB', 5]]);
  for (let i = 0; i < 2; i++) {
    const service = createRankingService(async () => data, () => start);
    await service.refresh();
    assert.deepEqual(changes(service), { AAA: undefined, BBB: undefined });
  }
});

test('compares positions, including unchanged ranks, entrants, and stable prefix ties', async () => {
  let data = makeSnapshot(0, [['BBB', 20], ['AAA', 30], ['CCC', 10], ['DDD', 5]]);
  const service = createRankingService(async () => data, () => start);
  await service.refresh();
  data = makeSnapshot(15, [['EEE', 2], ['CCC', 10], ['AAA', 25], ['BBB', 25]]);
  await service.refresh();
  assert.deepEqual(changes(service), { AAA: 0, BBB: 0, CCC: 0, EEE: 'new' });
  data = makeSnapshot(30, [['AAA', 25], ['CCC', 10], ['BBB', 26], ['DDD', 3]]);
  await service.refresh();
  assert.deepEqual(changes(service), { BBB: 1, AAA: -1, CCC: 0, DDD: 'new' });
  data = makeSnapshot(45, [['AAA', 25], ['CCC', 10], ['BBB', 26], ['DDD', 3]]);
  await service.refresh();
  assert.ok(Object.values(changes(service)).every(value => value === 0));
});

test('name enrichment and repeated timestamps preserve movement and the comparison baseline', async () => {
  let data = makeSnapshot(0, [['AAA', 10], ['BBB', 5]]);
  const service = createRankingService(async () => data, () => start, async next => ({
    ...next, airlines: next.airlines.map(row => ({ ...row, name: 'Name ' + row.id })),
  }));
  await service.refresh();
  data = makeSnapshot(15, [['AAA', 10], ['BBB', 15]]);
  await service.refresh();
  assert.deepEqual(changes(service), { BBB: 1, AAA: -1 });
  assert.equal(service.read().airlines[0].name, 'Name BBB');
  data = makeSnapshot(15, [['AAA', 100], ['BBB', 15]]);
  await service.refresh();
  for (let i = 0; i < 3; i++) {
    assert.deepEqual(changes(service), { BBB: 1, AAA: -1 });
    assert.equal(service.read().airlines.find(row => row.id === 'AAA').count, 10);
  }
  data = makeSnapshot(30, [['AAA', 20], ['BBB', 15]]);
  await service.refresh();
  assert.deepEqual(changes(service), { AAA: 1, BBB: -1 });
});

test('failures and older snapshots keep movement; recovery compares with the last successful snapshot', async t => {
  t.mock.method(console, 'error', () => {});
  let data = makeSnapshot(0, [['AAA', 10], ['BBB', 5]]);
  let isFailed = false;
  const service = createRankingService(async () => {
    if (isFailed) throw new Error('offline');
    return data;
  }, () => start);
  await service.refresh();
  data = makeSnapshot(15, [['AAA', 10], ['BBB', 15]]);
  await service.refresh();
  isFailed = true;
  await service.refresh();
  assert.equal(service.read().isStale, true);
  assert.deepEqual(changes(service), { BBB: 1, AAA: -1 });
  isFailed = false;
  data = makeSnapshot(0, [['AAA', 100]]);
  await service.refresh();
  assert.equal(service.read().isStale, true);
  assert.deepEqual(changes(service), { BBB: 1, AAA: -1 });
  data = makeSnapshot(45, [['AAA', 20], ['BBB', 15]]);
  await service.refresh();
  assert.equal(service.read().isStale, false);
  assert.deepEqual(changes(service), { AAA: 1, BBB: -1 });
});

test('reports exact movement across the full top-100 ranking', async () => {
  const entries = Array.from({ length: 100 }, (_, index) => [`OP${index}`, 100 - index]);
  let data = makeSnapshot(0, entries);
  const service = createRankingService(async () => data, () => start);
  await service.refresh();
  data = makeSnapshot(15, entries.map(([id], index) => [id, index + 1]));
  await service.refresh();
  const result = changes(service);
  assert.equal(result.OP99, 99);
  assert.equal(result.OP0, -99);
  assert.equal(result.OP51, 3);
  assert.equal(result.OP48, -3);
});
