import assert from 'node:assert/strict';
import console from 'node:console';
import { mkdtempSync, readFileSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { createOperatorDirectory, operatorDetails, NAME_REFRESH_MS, MISSING_NAME_REFRESH_MS,
  LOOKUP_COOLDOWN_MS, LOOKUP_WINDOW_MS, MAX_LOOKUP_ATTEMPTS, MAX_LOOKUPS_PER_REFRESH, LOOKUP_SPACING_MS } from '../backend/operator-directory.ts';
import { createRankingService } from '../backend/server.ts';

const start = Date.parse('2026-10-04T12:00:00Z');
const day = 24 * 60 * 60 * 1000;
const snapshot = { updatedAt: new Date(start).toISOString(), isStale: false,
  airlines: [{ id: 'FIN', name: 'Old SkyLink label', country: 'Old country', count: 1, aircraftTypes: [{ name: 'A320', count: 1 }] }] };
const details = { name: 'Finnair', country: 'Finland', iata: 'AY', icao: 'FIN' };
const missing = { name: null, country: null, iata: null, icao: null };
const record = (name = 'Finnair', country = 'Finland', iata = 'AY') => ({ icao: 'FIN', name, country, iata });
const response = () => new globalThis.Response(JSON.stringify({ response: [record()] }));
function setup(t) {
  const dir = mkdtempSync(join(tmpdir(), 'operator-cache-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  t.mock.method(console, 'error', () => {});
  return join(dir, 'names.json');
}
function save(path, names = {}, attempts = [], cooldownUntil = 0) {
  writeFileSync(path, JSON.stringify({ source: 'adsbdb', names, attempts, cooldownUntil }));
}
const read = path => JSON.parse(readFileSync(path, 'utf8'));
const directoryAt = (path, now = () => start) => createOperatorDirectory(path, now, async () => {});

test('resolves exact ICAO matches and duplicate agreement without using active flags', () => {
  assert.deepEqual(operatorDetails({ response: [record(), record()] }, 'FIN'), details);
  assert.deepEqual(operatorDetails({ response: [record('Old'), { ...record(), active: 'Y' }] }, 'FIN'), missing);
  assert.deepEqual(operatorDetails({ response: [] }, 'FIN'), missing);
  assert.throws(() => operatorDetails({ response: [{ ...record(), icao: 'AAL' }] }, 'FIN'));
  assert.throws(() => operatorDetails([record()], 'FIN'));
  assert.throws(() => operatorDetails({ response: [{}] }, 'FIN'));
  assert.throws(() => operatorDetails({ response: [{ ...record(), name: '' }] }, 'FIN'));
});

test('missing and conflicting countries and IATA codes remain unavailable', () => {
  assert.deepEqual(operatorDetails({ response: [record('Finnair', ' Finland ', 'AY')] }, 'FIN'), details);
  assert.deepEqual(operatorDetails({ response: [record(), record('Finnair', 'Sweden', 'ZZ')] }, 'FIN'),
    { ...details, country: null, iata: null });
  for (const value of [undefined, null, '', '   ', 123]) {
    assert.deepEqual(operatorDetails({ response: [{ ...record(), country: value, iata: value }] }, 'FIN'),
      { ...details, country: null, iata: null });
  }
  assert.deepEqual(operatorDetails({ response: [record('Finnair', 'Finland', '5F')] }, 'FIN'), { ...details, iata: '5F' });
  assert.equal(operatorDetails({ response: [record('Finnair', 'Finland', 'TOOLONG')] }, 'FIN').iata, null);
});

test('migration archives paid history, discards SkyLink labels, and starts a separate ADSBDB budget once', async t => {
  const path = setup(t);
  const legacy = { names: { FIN: { name: 'Old label', country: 'Old country', checkedAt: new Date(start).toISOString() } },
    attempts: [start], cooldownUntil: start + LOOKUP_COOLDOWN_MS };
  writeFileSync(path, JSON.stringify(legacy));
  const fetch = t.mock.method(globalThis, 'fetch', async () => response());
  const directory = await directoryAt(path);
  assert.deepEqual(read(path).legacySkylink, { attempts: legacy.attempts, cooldownUntil: legacy.cooldownUntil });
  assert.deepEqual(read(path).names, {});
  assert.deepEqual(read(path).attempts, []);
  assert.equal(directory.apply(snapshot).airlines[0].name, 'FIN');
  assert.equal(directory.apply(snapshot).airlines[0].country, null);
  assert.equal(directory.apply(snapshot).airlines[0].icao, null);
  await directory.refresh(['FIN']);
  const saved = read(path);
  const restarted = await directoryAt(path);
  await restarted.refresh(['FIN']);
  assert.deepEqual(read(path), saved);
  assert.equal(fetch.mock.callCount(), 1);
  assert.deepEqual(saved.legacySkylink.attempts, [start]);
});

test('calls only ADSBDB without credentials and persists all metadata across restarts', async t => {
  const path = setup(t);
  let clock = start;
  const fetch = t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, 'https://api.adsbdb.com/v0/airline/FIN');
    assert.equal(options.headers, undefined);
    assert.equal(options.redirect, 'error');
    return response();
  });
  let directory = await directoryAt(path, () => clock);
  await directory.refresh(['FIN', 'FIN', 'bad']);
  directory = await directoryAt(path, () => clock);
  const airline = directory.apply(snapshot).airlines[0];
  for (const field of ['name', 'country', 'iata', 'icao']) assert.equal(airline[field], details[field]);
  clock += NAME_REFRESH_MS - 1;
  await directory.refresh(['FIN']);
  assert.equal(fetch.mock.callCount(), 1);
  clock++;
  await directory.refresh(['FIN']);
  assert.equal(fetch.mock.callCount(), 2);
});

test('known records with missing optional fields retain the 30-day TTL', async t => {
  const path = setup(t); let clock = start;
  const fetch = t.mock.method(globalThis, 'fetch', async () => new globalThis.Response(JSON.stringify({ response: [record('Finnair', null, null)] })));
  const directory = await directoryAt(path, () => clock);
  await directory.refresh(['FIN']);
  clock += MISSING_NAME_REFRESH_MS;
  await directory.refresh(['FIN']);
  assert.equal(fetch.mock.callCount(), 1);
  assert.equal(directory.apply(snapshot).airlines[0].iata, null);
});

test('404, empty results and ambiguous names are cached and retried exactly after seven days', async t => {
  for (const result of [new globalThis.Response('', { status: 404 }),
    new globalThis.Response('{"response":[]}'),
    new globalThis.Response(JSON.stringify({ response: [record('One'), record('Two')] }))]) {
    const path = setup(t); let clock = start;
    const fetch = t.mock.method(globalThis, 'fetch', async () => result.clone());
    const directory = await directoryAt(path, () => clock);
    await directory.refresh(['FIN']);
    assert.equal(directory.apply(snapshot).airlines[0].name, 'FIN');
    assert.equal(directory.apply(snapshot).airlines[0].iata, null);
    clock += MISSING_NAME_REFRESH_MS - 1;
    await directory.refresh(['FIN']);
    assert.equal(fetch.mock.callCount(), 1);
    clock++;
    await directory.refresh(['FIN']);
    assert.equal(fetch.mock.callCount(), 2);
  }
});

test('reserves attempts before requests and enforces the 5,000-attempt rolling cap across restarts', async t => {
  const path = setup(t); let clock = start;
  assert.equal(MAX_LOOKUP_ATTEMPTS, 5000);
  assert.equal(LOOKUP_WINDOW_MS, 32 * day);
  save(path, {}, Array(MAX_LOOKUP_ATTEMPTS - 1).fill(start - LOOKUP_SPACING_MS));
  const fetch = t.mock.method(globalThis, 'fetch', async () => {
    assert.equal(read(path).attempts.at(-1), clock);
    assert.equal(read(path).cooldownUntil, clock + LOOKUP_COOLDOWN_MS);
    return response();
  });
  await (await directoryAt(path, () => clock)).refresh(['FIN', 'AAL']);
  clock = start - LOOKUP_SPACING_MS + LOOKUP_WINDOW_MS - 1;
  await (await directoryAt(path, () => clock)).refresh(['AAL']);
  assert.equal(fetch.mock.callCount(), 1);
  clock++;
  await (await directoryAt(path, () => clock)).refresh(['FIN']);
  assert.equal(fetch.mock.callCount(), 2);
});

test('limits each batch to 100, spaces requests by a second, and preserves pacing across restarts', async t => {
  const path = setup(t); let clock = start;
  const times = [];
  t.mock.method(globalThis, 'fetch', async () => {
    times.push(clock);
    return new globalThis.Response('', { status: 404 });
  });
  const wait = async ms => { clock += ms; };
  const prefixes = Array.from({ length: 101 }, (_, index) => `A${String.fromCharCode(65 + Math.floor(index / 26))}${String.fromCharCode(65 + index % 26)}`);
  await (await createOperatorDirectory(path, () => clock, wait)).refresh(prefixes);
  assert.equal(MAX_LOOKUPS_PER_REFRESH, 100);
  assert.equal(times.length, 100);
  await (await createOperatorDirectory(path, () => clock, wait)).refresh([prefixes[100]]);
  assert.equal(times.length, 101);
  for (let index = 1; index < times.length; index++) assert.equal(times[index] - times[index - 1], 1000);
});

test('pacing also covers variable storage and network delays', async t => {
  setup(t);
  let clock = start;
  let saved = null;
  let writes = 0;
  const store = {
    read: async () => saved,
    write: async value => {
      writes++;
      clock += writes === 1 ? 2000 : 100;
      saved = globalThis.structuredClone(value);
    },
  };
  const times = [];
  t.mock.method(globalThis, 'fetch', async () => {
    times.push(clock);
    clock += 100;
    return new globalThis.Response('', { status: 404 });
  });
  const wait = async ms => { clock += ms; };
  await (await createOperatorDirectory(store, () => clock, wait)).refresh(['FIN', 'AAL']);
  await (await createOperatorDirectory(store, () => clock, wait)).refresh(['DAL']);
  assert.equal(times.length, 3);
  for (let index = 1; index < times.length; index++) assert.ok(times[index] - times[index - 1] >= LOOKUP_SPACING_MS);
});

test('provider and network failures preserve ADSBDB details and pause the whole batch across restarts', async t => {
  for (const status of [429, 500, 'network', 'malformed']) {
    const path = setup(t); let clock = start;
    const entry = { ...details, checkedAt: new Date(start - NAME_REFRESH_MS).toISOString() };
    save(path, { FIN: entry });
    const fetch = t.mock.method(globalThis, 'fetch', async () => {
      if (status === 'network') throw new Error('offline');
      if (status === 'malformed') return new globalThis.Response('{}');
      return new globalThis.Response('', { status });
    });
    await (await directoryAt(path, () => clock)).refresh(['FIN', 'AAL']);
    assert.equal(fetch.mock.callCount(), 1);
    assert.deepEqual(read(path).names.FIN, entry);
    assert.equal(read(path).attempts.length, 1);
    clock += LOOKUP_COOLDOWN_MS - 1;
    await (await directoryAt(path, () => clock)).refresh(['FIN']);
    assert.equal(fetch.mock.callCount(), 1);
    clock++;
    await (await directoryAt(path, () => clock)).refresh(['FIN']);
    assert.equal(fetch.mock.callCount(), 2);
  }
});

test('invalid state and failed reservations or migrations disable requests', async t => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => response());
  for (const data of ['null', '{', '{}', '{"source":"other","names":{},"attempts":[],"cooldownUntil":0}',
    '{"source":"adsbdb","names":{},"attempts":["bad"],"cooldownUntil":0}']) {
    const path = setup(t); writeFileSync(path, data);
    const directory = await directoryAt(path);
    assert.equal(directory.isAvailable(), false);
    await directory.refresh(['FIN']);
  }
  for (const isLegacy of [false, true]) {
    const path = setup(t);
    if (isLegacy) writeFileSync(path, '{"names":{},"attempts":[1],"cooldownUntil":0}');
    mkdirSync(path + '.tmp');
    const directory = await directoryAt(path);
    await directory.refresh(['FIN']);
    assert.equal(directory.isAvailable(), false);
  }
  assert.equal(fetch.mock.callCount(), 0);
});

test('overlapping work is shared and reads add no calls or timestamp changes', async t => {
  const path = setup(t); let resolve; let notify;
  const started = new Promise(done => { notify = done; });
  const fetch = t.mock.method(globalThis, 'fetch', () => { notify(); return new Promise(done => { resolve = done; }); });
  const directory = await directoryAt(path);
  const service = createRankingService(async () => snapshot, () => start, async next => {
    await directory.refresh(next.airlines.map(row => row.id)); return directory.apply(next);
  });
  const first = service.refresh(); assert.strictEqual(service.refresh(), first);
  await started;
  const pending = directory.refresh(['FIN']); assert.strictEqual(directory.refresh(['FIN']), pending);
  for (let index = 0; index < 10; index++) service.read();
  assert.equal(fetch.mock.callCount(), 1);
  await (await directoryAt(path)).refresh(['FIN']);
  assert.equal(fetch.mock.callCount(), 1);
  resolve(response()); await first;
  assert.equal(service.read().airlines[0].iata, 'AY');
  assert.equal(service.read().updatedAt, snapshot.updatedAt);
});

test('a failed result write retains the reserved attempt and stops further calls', async t => {
  const path = setup(t);
  const fetch = t.mock.method(globalThis, 'fetch', async () => { mkdirSync(path + '.tmp'); return response(); });
  const directory = await directoryAt(path);
  await directory.refresh(['FIN', 'AAL']); await directory.refresh(['AAL']);
  assert.equal(fetch.mock.callCount(), 1);
  assert.equal(read(path).attempts.length, 1);
  assert.equal(read(path).cooldownUntil, start + LOOKUP_COOLDOWN_MS);
});

test('deadline checks stop requests and pacing before reserving another attempt', async t => {
  const path = setup(t); let clock = start;
  const fetch = t.mock.method(globalThis, 'fetch', async () => { clock += 10000; return response(); });
  await (await directoryAt(path, () => clock)).refresh(['FIN', 'AAL'], start + 25000);
  assert.equal(fetch.mock.callCount(), 1);
  assert.equal(read(path).attempts.length, 1);
  save(path, {}, [clock]);
  let waits = 0;
  const directory = await createOperatorDirectory(path, () => clock, async () => { waits++; });
  await directory.refresh(['FIN'], clock + 15500);
  assert.equal(waits, 0);
  assert.equal(fetch.mock.callCount(), 1);
});
