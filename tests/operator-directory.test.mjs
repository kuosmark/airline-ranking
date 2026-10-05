import assert from 'node:assert/strict';
import console from 'node:console';
import { mkdtempSync, readFileSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { createOperatorDirectory, operatorDetails, NAME_REFRESH_MS, MISSING_NAME_REFRESH_MS,
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
  return new globalThis.Response(JSON.stringify([{ icao: 'FIN', name, country: 'Finland', active: 'Y' }]));
}

test('resolves matching names, duplicate agreement, active preference and ambiguity', () => {
  const row = (name, active = 'Y') => ({ icao: 'FIN', name, active });
  assert.deepEqual(operatorDetails([row('Finnair'), row('Finnair', 'N')], 'FIN'), { name: 'Finnair', country: null });
  assert.deepEqual(operatorDetails([row('Old', 'N'), row('Finnair')], 'FIN'), { name: 'Finnair', country: null });
  assert.deepEqual(operatorDetails([row('One'), row('Two')], 'FIN'), { name: null, country: null });
  assert.deepEqual(operatorDetails([row('Old', 'N')], 'FIN'), { name: 'Old', country: null });
  assert.deepEqual(operatorDetails([], 'FIN'), { name: null, country: null });
  assert.throws(() => operatorDetails([{ icao: 'OTHER', name: 'Wrong' }], 'FIN'));
  assert.throws(() => operatorDetails({}, 'FIN'));
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
  let directory = await createOperatorDirectory('test', path, () => clock);
  await directory.refresh(['FIN', 'FIN']);
  assert.equal(directory.apply(snapshot).airlines[0].name, 'Finnair');
  assert.equal(directory.apply(snapshot).airlines[0].country, 'Finland');
  directory = await createOperatorDirectory('test', path, () => clock);
  assert.equal(directory.apply(snapshot).airlines[0].country, 'Finland');
  clock += NAME_REFRESH_MS - 1;
  await directory.refresh(['FIN']);
  assert.equal(calls, 1);
  clock++;
  await directory.refresh(['FIN']);
  assert.equal(calls, 2);
});

test('uses countries from the resolved operator and omits missing or conflicting values', () => {
  const row = (name, country, active = 'Y') => ({ icao: 'FIN', name, country, active });
  assert.deepEqual(operatorDetails([row('Old', 'Sweden', 'N'), row('Finnair', ' Finland ')], 'FIN'),
    { name: 'Finnair', country: 'Finland' });
  assert.deepEqual(operatorDetails([row('Finnair', 'Sweden', 'N'), row('Finnair', 'Finland')], 'FIN'),
    { name: 'Finnair', country: 'Finland' });
  assert.deepEqual(operatorDetails([row('Finnair', 'Finland'), row('Finnair', 'Sweden')], 'FIN'),
    { name: 'Finnair', country: null });
  assert.deepEqual(operatorDetails([row('One', 'Finland'), row('Two', 'Finland')], 'FIN'),
    { name: null, country: null });
  for (const country of [undefined, null, '', '   ', 123]) {
    assert.deepEqual(operatorDetails([row('Finnair', country)], 'FIN'), { name: 'Finnair', country: null });
  }
});

test('legacy caches keep their budget, cooldown and expiry without early country lookups', async t => {
  const path = setup(t);
  let clock = start;
  const saved = { names: { FIN: { name: 'Finnair', checkedAt: new Date(start).toISOString() } },
    attempts: [start], cooldownUntil: start + LOOKUP_COOLDOWN_MS };
  writeFileSync(path, JSON.stringify(saved));
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => { calls++; return response(); });
  const directory = await createOperatorDirectory('test', path, () => clock);
  await directory.refresh(['FIN', 'AAL']);
  assert.equal(calls, 0);
  assert.equal(directory.apply(snapshot).airlines[0].country, null);
  clock += NAME_REFRESH_MS - 1;
  await directory.refresh(['FIN']);
  assert.equal(calls, 0);
  assert.deepEqual(JSON.parse(readFileSync(path, 'utf8')), saved);
  clock++;
  await directory.refresh(['FIN']);
  assert.equal(calls, 1);
  assert.equal(directory.apply(snapshot).airlines[0].country, 'Finland');
});

test('missing country keeps the successful name TTL and refresh failures preserve country', async t => {
  const path = setup(t);
  let clock = start;
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    calls++;
    if (calls === 1) return new globalThis.Response(JSON.stringify([{ icao: 'FIN', name: 'Finnair' }]));
    if (calls === 2) return response();
    return new globalThis.Response('', { status: 500 });
  });
  const directory = await createOperatorDirectory('test', path, () => clock);
  await directory.refresh(['FIN']);
  clock += MISSING_NAME_REFRESH_MS;
  await directory.refresh(['FIN']);
  assert.equal(calls, 1);
  assert.equal(directory.apply(snapshot).airlines[0].country, null);
  clock = start + NAME_REFRESH_MS;
  await directory.refresh(['FIN']);
  assert.equal(directory.apply(snapshot).airlines[0].country, 'Finland');
  clock += NAME_REFRESH_MS;
  await directory.refresh(['FIN']);
  assert.equal(calls, 3);
  assert.equal(directory.apply(snapshot).airlines[0].country, 'Finland');
  assert.equal(JSON.parse(readFileSync(path, 'utf8')).names.FIN.country, 'Finland');
});

test('caches both 404 and empty results and retries at seven days', async t => {
  for (const status of [200, 404]) {
    const path = setup(t);
    let clock = start;
    let calls = 0;
    t.mock.method(globalThis, 'fetch', async () => { calls++; return new globalThis.Response('[]', { status }); });
    const directory = await createOperatorDirectory('test', path, () => clock);
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
  await (await createOperatorDirectory('test', path, () => clock)).refresh(['FIN', 'AAL']);
  assert.equal(calls, 1);
  clock += LOOKUP_WINDOW_MS - 1;
  await (await createOperatorDirectory('test', path, () => clock)).refresh(['AAL']);
  assert.equal(calls, 1);
  clock++;
  await (await createOperatorDirectory('test', path, () => clock)).refresh(['FIN']);
  assert.equal(calls, 2);
});

test('failures consume budget, preserve names and stop the batch with persistent cooldown', async t => {
  for (const status of [401, 403, 429, 500]) {
    const path = setup(t);
    let clock = start;
    writeFileSync(path, JSON.stringify({ names: { FIN: { name: 'Finnair', checkedAt: new Date(start - NAME_REFRESH_MS).toISOString() } }, attempts: [], cooldownUntil: 0 }));
    let calls = 0;
    t.mock.method(globalThis, 'fetch', async () => { calls++; return new globalThis.Response('', { status }); });
    const directory = await createOperatorDirectory('test', path, () => clock);
    await directory.refresh(['FIN', 'AAL']);
    assert.equal(calls, 1);
    assert.equal(directory.apply(snapshot).airlines[0].name, 'Finnair');
    const saved = JSON.parse(readFileSync(path, 'utf8'));
    assert.equal(saved.attempts.length, 1);
    assert.equal(saved.names.FIN.checkedAt, new Date(start - NAME_REFRESH_MS).toISOString());
    clock += LOOKUP_COOLDOWN_MS - 1;
    const restarted = await createOperatorDirectory('test', path, () => clock);
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
    await (await createOperatorDirectory('test', path, () => start)).refresh(['FIN']);
    const saved = JSON.parse(readFileSync(path, 'utf8'));
    assert.deepEqual(saved.names, {});
    assert.equal(saved.attempts.length, 1);
    assert.equal(saved.cooldownUntil, start + LOOKUP_COOLDOWN_MS);
  }
});

test('corrupt caches and write failures disable lookups without spending quota', async t => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => { calls++; return response(); });
  for (const data of ['null', '{', '{}', '{"names":{},"attempts":["bad"],"cooldownUntil":0}']) {
    const path = setup(t);
    writeFileSync(path, data);
    const directory = await createOperatorDirectory('test', path, () => start);
    await directory.refresh(['FIN']);
    assert.equal(directory.apply(snapshot).airlines[0].name, 'FIN');
  }
  const path = setup(t);
  mkdirSync(path + '.tmp');
  await (await createOperatorDirectory('test', path, () => start)).refresh(['FIN']);
  assert.equal(calls, 0);
});

test('overlapping refreshes share work and HTTP reads do not trigger directory requests', async t => {
  const path = setup(t);
  let resolve;
  let calls = 0;
  let notifyStarted;
  const started = new Promise(done => { notifyStarted = done; });
  t.mock.method(globalThis, 'fetch', () => {
    calls++;
    notifyStarted();
    return new Promise(done => { resolve = done; });
  });
  const directory = await createOperatorDirectory('test', path, () => start);
  const service = createRankingService(async () => snapshot, () => start, async next => {
    await directory.refresh(next.airlines.map(row => row.id));
    return directory.apply(next);
  });
  const first = service.refresh();
  assert.strictEqual(service.refresh(), first);
  await started;
  const directoryPending = directory.refresh(['FIN']);
  assert.strictEqual(directory.refresh(['FIN']), directoryPending);
  for (let i = 0; i < 10; i++) assert.equal(service.read().airlines[0].name, 'FIN');
  assert.equal(calls, 1);
  resolve(response());
  await first;
  assert.equal(service.read().airlines[0].name, 'Finnair');
  assert.equal(service.read().airlines[0].country, 'Finland');
  assert.equal(service.read().updatedAt, snapshot.updatedAt);
});

test('a restart during an outstanding request respects the saved cooldown', async t => {
  const path = setup(t);
  let calls = 0;
  let resolve;
  let notifyStarted;
  const started = new Promise(done => { notifyStarted = done; });
  t.mock.method(globalThis, 'fetch', () => {
    calls++;
    notifyStarted();
    return new Promise(done => { resolve = done; });
  });
  const directory = await createOperatorDirectory('test', path, () => start);
  const pending = directory.refresh(['FIN']);
  await started;
  await (await createOperatorDirectory('test', path, () => start)).refresh(['FIN']);
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
  const directory = await createOperatorDirectory('test', path, () => start);
  await directory.refresh(['FIN', 'AAL']);
  await directory.refresh(['AAL']);
  assert.equal(calls, 1);
  const saved = JSON.parse(readFileSync(path, 'utf8'));
  assert.equal(saved.attempts.length, 1);
  assert.equal(saved.cooldownUntil, start + LOOKUP_COOLDOWN_MS);
});


test('a deadline stops the batch before reserving another paid lookup', async t => {
  const path = setup(t);
  let clock = start;
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    calls++;
    clock += 10_000;
    return response();
  });
  const directory = await createOperatorDirectory('test', path, () => clock);
  await directory.refresh(['FIN', 'AAL'], start + 25_000);
  assert.equal(calls, 1);
  assert.equal(JSON.parse(readFileSync(path, 'utf8')).attempts.length, 1);
  assert.equal(directory.isAvailable(), true);
});
