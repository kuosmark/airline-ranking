import assert from 'node:assert/strict';
import console from 'node:console';
import { once } from 'node:events';
import process from 'node:process';
import { test } from 'node:test';
import { airlines } from '../backend/airlines.ts';
import { countAircraft, fetchSnapshot, REFRESH_INTERVAL_MS } from '../backend/skylink.ts';
import { createRankingServer, createRankingService } from '../backend/server.ts';

const time = '2026-10-04T12:00:00Z';
const now = Date.parse(time);
const aircraft = (fields = {}) => ({ icao24: '000001', callsign: 'AAL123', is_on_ground: false, last_seen: time, ...fields });
const payload = (records, timestamp = time) => ({ aircraft: records, total_count: records.length, timestamp });
const count = (snapshot, id) => snapshot.airlines.find(airline => airline.id === id)?.count;

test('defines 100 airlines with unique identifiers and ICAO prefixes', () => {
  assert.equal(airlines.length, 100);
  assert.equal(new Set(airlines.map(airline => airline.id)).size, 100);
  assert.equal(new Set(airlines.map(airline => airline.prefix)).size, 100);
  assert.ok(airlines.every(airline => airline.name.trim() && /^[A-Z]{3}$/.test(airline.prefix)));
});

test('retains the original ten airlines and normalizes callsign whitespace and case', () => {
  const prefixes = ['ACA', 'KAL', 'BAW', 'IBE', 'EIN', 'CPA', 'AAL', 'DAL', 'AFR', 'KLM'];
  const records = prefixes.map((prefix, i) => aircraft({ icao24: i.toString(16).padStart(6, '0'), callsign: ` ${prefix.toLowerCase()}12A ` }));
  const snapshot = countAircraft(payload(records), now);

  const ids = ['air-canada', 'korean-air', 'british-airways', 'iberia', 'aer-lingus', 'cathay-pacific',
    'american-airlines', 'delta-air-lines', 'air-france', 'klm'];
  assert.equal(snapshot.airlines.length, 100);
  assert.ok(ids.every(id => count(snapshot, id) === 1));
  assert.ok(snapshot.airlines.filter(airline => !ids.includes(airline.id)).every(airline => airline.count === 0));
  assert.equal(snapshot.updatedAt, time.replace('00Z', '00.000Z'));
  assert.equal(snapshot.isStale, false);
});

test('counts new airlines separately and does not combine other operators under the same brand', () => {
  const callsigns = ['UAL123', 'UAL456', 'FIN789', 'WZZ123', 'WMT456', 'EZY123', 'EJU456', 'LAN123', 'TAM456', 'HXA123', 'GES456'];
  const records = callsigns.map((callsign, i) => aircraft({ icao24: i.toString(16).padStart(6, '0'), callsign }));
  const snapshot = countAircraft(payload(records), now);

  assert.equal(count(snapshot, 'united-airlines'), 2);
  assert.equal(count(snapshot, 'finnair'), 1);
  assert.equal(count(snapshot, 'wizz-air-hungary'), 1);
  assert.equal(count(snapshot, 'wizz-air-malta'), 1);
  assert.equal(count(snapshot, 'easyjet-uk'), 1);
  assert.equal(count(snapshot, 'latam-airlines-chile'), 1);
  assert.equal(count(snapshot, 'china-express-airlines'), 1);
  assert.equal(snapshot.airlines.reduce((total, airline) => total + airline.count, 0), 8);
});

test('excludes unlisted operators, missing callsigns, and partial or malformed prefix matches', () => {
  const callsigns = ['ENY123', null, undefined, '', 'AAL', 'XAAL123', 'AAL 123', 'N12345'];
  const records = callsigns.map((callsign, i) => aircraft({ icao24: i.toString(16).padStart(6, '0'), callsign, airline: 'American Airlines' }));
  const snapshot = countAircraft(payload(records), now);

  assert.equal(snapshot.airlines.length, 100);
  assert.ok(snapshot.airlines.every(airline => airline.count === 0));
});

test('counts only an explicit airborne flag, without inferring it from altitude', () => {
  const records = [false, true, null, undefined, 'false'].map((isOnGround, i) => aircraft({
    icao24: i.toString(16).padStart(6, '0'), is_on_ground: isOnGround, altitude: 35000,
  }));
  assert.equal(count(countAircraft(payload(records), now), 'american-airlines'), 1);
});

test('includes observations up to five minutes old and excludes older or future ones', () => {
  const records = ['11:55:00Z', '11:54:59Z', '12:00:01Z'].map((suffix, i) => aircraft({
    icao24: i.toString(16).padStart(6, '0'), last_seen: `2026-10-04T${suffix}`,
  }));
  assert.equal(count(countAircraft(payload(records), now), 'american-airlines'), 1);
});

test('deduplicates hex identifiers and uses the newest observation regardless of order', () => {
  const older = aircraft({ icao24: 'ABC123', last_seen: '2026-10-04T11:59:00Z' });
  const newer = aircraft({ icao24: 'abc123', is_on_ground: true });
  for (const records of [[older, newer], [newer, older]]) {
    assert.equal(count(countAircraft(payload(records), now), 'american-airlines'), 0);
  }
  assert.equal(count(countAircraft(payload([older, older]), now), 'american-airlines'), 1);
});

test('does not count conflicting same-time ground and airborne observations', () => {
  const flying = aircraft();
  const grounded = aircraft({ is_on_ground: true });
  for (const records of [[flying, grounded], [grounded, flying]]) {
    assert.equal(count(countAircraft(payload(records), now), 'american-airlines'), 0);
  }
});

test('treats timezone-less provider timestamps as UTC and honors explicit offsets', () => {
  const originalZone = process.env.TZ;
  process.env.TZ = 'America/Los_Angeles';
  try {
    const snapshot = countAircraft(payload([
      aircraft({ last_seen: '2026-10-04T12:00:00.000000' }),
      aircraft({ icao24: '000002', last_seen: '2026-10-04T14:00:00+02:00' }),
    ], '2026-10-04T12:00:00.000000'), now);
    assert.equal(snapshot.updatedAt, '2026-10-04T12:00:00.000Z');
    assert.equal(count(snapshot, 'american-airlines'), 2);
  } finally {
    if (originalZone === undefined) { delete process.env.TZ; }
    else { process.env.TZ = originalZone; }
  }
});

test('rejects malformed or incomplete global responses instead of publishing zero counts', () => {
  const invalid = [null, {}, payload([]), { ...payload([aircraft()]), total_count: 2 },
    payload([aircraft()], 'invalid'), payload([aircraft({ icao24: 'not-hex' })]),
    payload([aircraft({ last_seen: null })]), payload([null])];
  for (const value of invalid) {
    assert.throws(() => countAircraft(value, now));
  }
});

test('rejects stale global snapshots and implausibly future snapshot timestamps', () => {
  assert.throws(() => countAircraft(payload([aircraft()]), now + 300_001), /not current/);
  assert.throws(() => countAircraft(payload([aircraft()]), now - 60_001), /not current/);
});

test('requests one global snapshot with header authentication and a bounded timeout', async t => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls++;
    assert.equal(url, 'https://data.skylinkapi.com/v3.1/adsb/aircraft');
    assert.deepEqual(options.headers, { 'x-api-key': 'test-key' });
    assert.equal(options.redirect, 'error');
    assert.ok(options.signal instanceof globalThis.AbortSignal);
    return new globalThis.Response(JSON.stringify(payload([aircraft({ last_seen: new Date().toISOString() })], new Date().toISOString())));
  });
  assert.equal(count(await fetchSnapshot('test-key'), 'american-airlines'), 1);
  assert.equal(calls, 1);
});

test('rejects provider errors without exposing the response body or retrying', async t => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => { calls++; return new globalThis.Response('private upstream detail', { status: 429 }); });
  await assert.rejects(fetchSnapshot('test-key'), { message: 'SkyLink request failed (429)' });
  assert.equal(calls, 1);
});

test('coalesces overlapping refreshes and keeps reads independent of provider calls', async () => {
  let resolve;
  let calls = 0;
  const service = createRankingService(() => { calls++; return new Promise(done => { resolve = done; }); }, () => now);
  assert.equal(service.read(), null);
  const first = service.refresh();
  const second = service.refresh();
  assert.strictEqual(first, second);
  assert.equal(service.read(), null);
  resolve(countAircraft(payload([aircraft()]), now));
  await first;
  for (let i = 0; i < 10; i++) { assert.equal(service.read().isStale, false); }
  assert.equal(calls, 1);
});

test('preserves the last successful snapshot on failure and recovers on the next refresh', async t => {
  t.mock.method(console, 'error', () => {});
  let isUnavailable = false;
  const original = countAircraft(payload([aircraft()]), now);
  const service = createRankingService(() => isUnavailable ? Promise.reject(new Error('unavailable')) : Promise.resolve(original), () => now);
  await service.refresh();
  isUnavailable = true;
  await service.refresh();
  assert.deepEqual(service.read(), { ...original, isStale: true });
  isUnavailable = false;
  await service.refresh();
  assert.deepEqual(service.read(), original);
});

test('marks an expired cached snapshot stale and rejects snapshots moving backwards', async t => {
  t.mock.method(console, 'error', () => {});
  let clock = now;
  let value = countAircraft(payload([aircraft()]), now);
  const service = createRankingService(() => Promise.resolve(value), () => clock);
  await service.refresh();
  clock += REFRESH_INTERVAL_MS + 30_001;
  assert.equal(service.read().isStale, true);
  value = { ...value, updatedAt: '2026-10-04T11:59:00Z' };
  await service.refresh();
  assert.equal(service.read().updatedAt, '2026-10-04T12:00:00.000Z');
  assert.equal(service.read().isStale, true);
});

test('serves cached rankings, returns 503 before success, and rejects other routes and methods', async t => {
  t.mock.method(console, 'error', () => {});
  let calls = 0;
  let isUnavailable = true;
  const service = createRankingService(() => {
    calls++;
    return isUnavailable ? Promise.reject(new Error('offline')) : Promise.resolve(countAircraft(payload([aircraft()]), now));
  }, () => now);
  const server = createRankingServer(service);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve, reject) => { server.close(error => error ? reject(error) : resolve()); }));
  const url = `http://127.0.0.1:${server.address().port}/api/ranking`;

  await service.refresh();
  assert.equal((await globalThis.fetch(url)).status, 503);
  isUnavailable = false;
  await service.refresh();
  for (let i = 0; i < 3; i++) {
    const response = await globalThis.fetch(url);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(count(await response.json(), 'american-airlines'), 1);
  }
  assert.equal(calls, 2);
  assert.equal((await globalThis.fetch(url + '/unknown')).status, 404);
  const rejected = await globalThis.fetch(url, { method: 'POST' });
  assert.equal(rejected.status, 405);
  assert.equal(rejected.headers.get('allow'), 'GET');
});
