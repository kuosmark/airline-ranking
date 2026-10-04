import assert from 'node:assert/strict';
import console from 'node:console';
import { mkdtempSync, readFileSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { createOperatorDirectory, operatorName, NAME_REFRESH_MS, MISSING_NAME_REFRESH_MS,
  LOOKUP_COOLDOWN_MS, LOOKUP_WINDOW_MS, MAX_LOOKUP_ATTEMPTS } from '../backend/operator-directory.ts';
import { createRankingService } from '../backend/server.ts';

const start = Date.parse('2026-10-04T12:00:00Z');
const snapshot = { updatedAt: new Date(start).toISOString(), isStale: false,
  airlines: [{ id: 'FIN', name: 'FIN', count: 1, aircraftTypes: [{ name: 'A320', count: 1 }] }] };
function setup(t) {
  const dir = mkdtempSync(join(tmpdir(), 'operator-cache-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  t.mock.method(console, 'error', () => {});
  return join(dir, 'names.json');
}
function response(name = 'Finnair') {
  return new globalThis.Response(JSON.stringify([{ icao: 'FIN', name, active: 'Y' }]));
}

test('resolves matching names, duplicate agreement, active preference and ambiguity', () => {
  const row = (name, active = 'Y') => ({ icao: 'FIN', name, active });
  assert.equal(operatorName([row('Finnair'), row('Finnair', 'N')], 'FIN'), 'Finnair');
  assert.equal(operatorName([row('Old', 'N'), row('Finnair')], 'FIN'), 'Finnair');
  assert.equal(operatorName([row('One'), row('Two')], 'FIN'), null);
  assert.equal(operatorName([row('Old', 'N')], 'FIN'), 'Old');
  assert.equal(operatorName([], 'FIN'), null);
  assert.throws(() => operatorName([{ icao: 'OTHER', name: 'Wrong' }], 'FIN'));
  assert.throws(() => operatorName({}, 'FIN'));
});

test('persists names and refreshes exactly at the 30-day boundary', async t => {
  const path = setup(t);
  let clock = start;
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls++;
    assert.equal(url, 'https://data.skylinkapi.com/v3.1/airlines/search?icao=FIN');
    assert.equal(options.headers['x-api-key'], 'test');
    assert.equal(options.redirect, 'error');
    return response();
  });
  let directory = createOperatorDirectory('test', path, () => clock);
  await directory.refresh(['FIN', 'FIN']);
  assert.equal(directory.apply(snapshot).airlines[0].name, 'Finnair');
  directory = createOperatorDirectory('test', path, () => clock);
  clock += NAME_REFRESH_MS - 1;
  await directory.refresh(['FIN']);
  assert.equal(calls, 1);
  clock++;
  await directory.refresh(['FIN']);
  assert.equal(calls, 2);
});

test('caches both 404 and empty results and retries at seven days', async t => {
  for (const status of [200, 404]) {
    const path = setup(t);
    let clock = start;
    let calls = 0;
    t.mock.method(globalThis, 'fetch', async () => { calls++; return new globalThis.Response('[]', { status }); });
    const directory = createOperatorDirectory('test', path, () => clock);
    await directory.refresh(['FIN']);
    assert.equal(directory.apply(snapshot).airlines[0].name, 'FIN');
    clock += MISSING_NAME_REFRESH_MS - 1;
    await directory.refresh(['FIN']);
    assert.equal(calls, 1);
    clock++;
    await directory.refresh(['FIN']);
    assert.equal(calls, 2);
  }
});

test('persists the attempt before fetching and enforces the rolling cap across restarts', async t => {
  const path = setup(t);
  let clock = start;
  writeFileSync(path, JSON.stringify({ names: {}, attempts: Array(MAX_LOOKUP_ATTEMPTS - 1).fill(start), cooldownUntil: 0 }));
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    calls++;
    const saved = JSON.parse(readFileSync(path, 'utf8'));
    assert.equal(saved.attempts.at(-1), clock);
    assert.equal(saved.cooldownUntil, clock + LOOKUP_COOLDOWN_MS);
    return response();
  });
  await createOperatorDirectory('test', path, () => clock).refresh(['FIN', 'AAL']);
  assert.equal(calls, 1);
  clock += LOOKUP_WINDOW_MS - 1;
  await createOperatorDirectory('test', path, () => clock).refresh(['AAL']);
  assert.equal(calls, 1);
  clock++;
  await createOperatorDirectory('test', path, () => clock).refresh(['FIN']);
  assert.equal(calls, 2);
});

test('failures consume budget, preserve names and stop the batch with persistent cooldown', async t => {
  for (const status of [401, 403, 429, 500]) {
    const path = setup(t);
    let clock = start;
    writeFileSync(path, JSON.stringify({ names: { FIN: { name: 'Finnair', checkedAt: new Date(start - NAME_REFRESH_MS).toISOString() } }, attempts: [], cooldownUntil: 0 }));
    let calls = 0;
    t.mock.method(globalThis, 'fetch', async () => { calls++; return new globalThis.Response('', { status }); });
    const directory = createOperatorDirectory('test', path, () => clock);
    await directory.refresh(['FIN', 'AAL']);
    assert.equal(calls, 1);
    assert.equal(directory.apply(snapshot).airlines[0].name, 'Finnair');
    const saved = JSON.parse(readFileSync(path, 'utf8'));
    assert.equal(saved.attempts.length, 1);
    assert.equal(saved.names.FIN.checkedAt, new Date(start - NAME_REFRESH_MS).toISOString());
    clock += LOOKUP_COOLDOWN_MS - 1;
    const restarted = createOperatorDirectory('test', path, () => clock);
    await restarted.refresh(['FIN']);
    assert.equal(calls, 1);
    clock++;
    await restarted.refresh(['FIN']);
    assert.equal(calls, 2);
  }
});

test('network errors and malformed responses activate cooldown without negative caching', async t => {
  for (const isNetworkFailure of [true, false]) {
    const path = setup(t);
    t.mock.method(globalThis, 'fetch', async () => {
      if (isNetworkFailure) throw new Error('offline');
      return new globalThis.Response('{}');
    });
    await createOperatorDirectory('test', path, () => start).refresh(['FIN']);
    const saved = JSON.parse(readFileSync(path, 'utf8'));
    assert.deepEqual(saved.names, {});
    assert.equal(saved.attempts.length, 1);
    assert.equal(saved.cooldownUntil, start + LOOKUP_COOLDOWN_MS);
  }
});

test('corrupt caches and write failures disable lookups without spending quota', async t => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => { calls++; return response(); });
  for (const data of ['{', '{}', '{"names":{},"attempts":["bad"],"cooldownUntil":0}']) {
    const path = setup(t);
    writeFileSync(path, data);
    const directory = createOperatorDirectory('test', path, () => start);
    await directory.refresh(['FIN']);
    assert.equal(directory.apply(snapshot).airlines[0].name, 'FIN');
  }
  const path = setup(t);
  mkdirSync(path + '.tmp');
  await createOperatorDirectory('test', path, () => start).refresh(['FIN']);
  assert.equal(calls, 0);
});

test('overlapping refreshes share work and HTTP reads do not trigger directory requests', async t => {
  const path = setup(t);
  let resolve;
  let calls = 0;
  t.mock.method(globalThis, 'fetch', () => { calls++; return new Promise(done => { resolve = done; }); });
  const directory = createOperatorDirectory('test', path, () => start);
  const service = createRankingService(async () => snapshot, () => start, async next => {
    await directory.refresh(next.airlines.map(row => row.id));
    return directory.apply(next);
  });
  const first = service.refresh();
  assert.strictEqual(service.refresh(), first);
  await Promise.resolve();
  const directoryPending = directory.refresh(['FIN']);
  assert.strictEqual(directory.refresh(['FIN']), directoryPending);
  for (let i = 0; i < 10; i++) assert.equal(service.read().airlines[0].name, 'FIN');
  assert.equal(calls, 1);
  resolve(response());
  await first;
  assert.equal(service.read().airlines[0].name, 'Finnair');
  assert.equal(service.read().updatedAt, snapshot.updatedAt);
});

test('a restart during an outstanding request respects the saved cooldown', async t => {
  const path = setup(t);
  let calls = 0;
  let resolve;
  t.mock.method(globalThis, 'fetch', () => { calls++; return new Promise(done => { resolve = done; }); });
  const pending = createOperatorDirectory('test', path, () => start).refresh(['FIN']);
  await createOperatorDirectory('test', path, () => start).refresh(['FIN']);
  assert.equal(calls, 1);
  resolve(response());
  await pending;
});

test('a failed result write stops the batch with the paid attempt retained on disk', async t => {
  const path = setup(t);
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    calls++;
    mkdirSync(path + '.tmp');
    return response();
  });
  const directory = createOperatorDirectory('test', path, () => start);
  await directory.refresh(['FIN', 'AAL']);
  await directory.refresh(['AAL']);
  assert.equal(calls, 1);
  const saved = JSON.parse(readFileSync(path, 'utf8'));
  assert.equal(saved.attempts.length, 1);
  assert.equal(saved.cooldownUntil, start + LOOKUP_COOLDOWN_MS);
});
