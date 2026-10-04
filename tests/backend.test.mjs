import assert from 'node:assert/strict';
import console from 'node:console';
import { once } from 'node:events';
import process from 'node:process';
import { test } from 'node:test';
import { countAircraft, fetchSnapshot, REFRESH_INTERVAL_MS } from '../backend/skylink.ts';
import { createRankingServer, createRankingService } from '../backend/server.ts';

const time = '2026-10-04T12:00:00Z';
const now = Date.parse(time);
const aircraft = (fields = {}) => ({ icao24: '000001', callsign: 'AAL123', is_on_ground: false, last_seen: time, ...fields });
const payload = (records, timestamp = time) => ({ aircraft: records, total_count: records.length, timestamp });
const count = (snapshot, id) => snapshot.airlines.find(airline => airline.id === id)?.count ?? 0;

test('counts all observed operators separately, including cargo and regional operators', () => {
  const callsigns = ['UAL123', 'UAL456', 'FDX123', 'ENY123', 'WMT456', 'ZZZ789', ' fin12a '];
  const records = callsigns.map((callsign, i) => aircraft({ icao24: i.toString(16).padStart(6, '0'), callsign }));
  const snapshot = countAircraft(payload(records), now);
  assert.deepEqual(snapshot.airlines.map(row => row.id), ['UAL', 'ENY', 'FDX', 'FIN', 'WMT', 'ZZZ']);
  assert.equal(count(snapshot, 'UAL'), 2);
  assert.ok(snapshot.airlines.every(row => row.name === row.id && row.count > 0));
});

test('excludes registrations and invalid callsign formats', () => {
  const records = [
    aircraft({ callsign: 'XABAR', registration: 'xa-bar' }),
    aircraft({ callsign: 'N12345' }),
    aircraft({ callsign: 'FIN' }),
    aircraft({ callsign: 'FIN 123' }),
    aircraft({ callsign: 'FIN12345' }),
    aircraft({ callsign: null }),
    aircraft({ callsign: 'ABCDEF', registration: 'DIFFERENT' }),
    aircraft({ callsign: 'FIN12AB' }),
  ].map((record, i) => ({ ...record, icao24: i.toString(16).padStart(6, '0') }));
  const snapshot = countAircraft(payload(records), now);
  assert.deepEqual(snapshot.airlines.map(row => row.id), ['ABC', 'FIN']);
});

test('selects the top 100 by count with stable prefix ties and no zero rows', () => {
  const records = Array.from({ length: 105 }, (_, i) => aircraft({
    icao24: i.toString(16).padStart(6, '0'),
    callsign: `A${String.fromCharCode(65 + Math.floor(i / 26))}${String.fromCharCode(65 + i % 26)}1`,
  }));
  records.push(aircraft({ icao24: 'ffffff', callsign: records[104].callsign }));
  const forward = countAircraft(payload(records), now);
  const reverse = countAircraft(payload([...records].reverse()), now);
  assert.deepEqual(forward, reverse);
  assert.equal(forward.airlines.length, 100);
  assert.equal(forward.airlines[0].id, 'AEA');
  assert.equal(forward.airlines[0].count, 2);
  assert.equal(forward.airlines[99].id, 'ADU');
});

test('counts only an explicit airborne flag, without inferring it from altitude', () => {
  const records = [false, true, null, undefined, 'false'].map((isOnGround, i) => aircraft({
    icao24: i.toString(16).padStart(6, '0'), is_on_ground: isOnGround, altitude: 35000,
  }));
  assert.equal(count(countAircraft(payload(records), now), 'AAL'), 1);
});

test('includes observations up to five minutes old and excludes older or future ones', () => {
  const records = ['11:55:00Z', '11:54:59Z', '12:00:01Z'].map((suffix, i) => aircraft({
    icao24: i.toString(16).padStart(6, '0'), last_seen: `2026-10-04T${suffix}`,
  }));
  assert.equal(count(countAircraft(payload(records), now), 'AAL'), 1);
});

test('deduplicates hex identifiers and uses the newest observation regardless of order', () => {
  const older = aircraft({ icao24: 'ABC123', last_seen: '2026-10-04T11:59:00Z' });
  const newer = aircraft({ icao24: 'abc123', is_on_ground: true });
  for (const records of [[older, newer], [newer, older]]) {
    assert.equal(count(countAircraft(payload(records), now), 'AAL'), 0);
  }
  assert.equal(count(countAircraft(payload([older, older]), now), 'AAL'), 1);
});

test('does not count conflicting same-time ground and airborne observations', () => {
  const flying = aircraft();
  const grounded = aircraft({ is_on_ground: true });
  for (const records of [[flying, grounded], [grounded, flying]]) {
    assert.equal(count(countAircraft(payload(records), now), 'AAL'), 0);
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
    assert.equal(count(snapshot, 'AAL'), 2);
  } finally {
    if (originalZone === undefined) { delete process.env.TZ; }
    else { process.env.TZ = originalZone; }
  }
});

test('groups verified type labels, preserves variants and unfamiliar labels, and accounts for unknown types', () => {
  const types = ['B738', ' Boeing  B738 ', 'THE BOEING COMPANY B738', 'Boeing 737-800',
    'Airbus A320', 'a20n', 'Boeing 737-8', 'B38M', 'New model 123', ' new  MODEL 123 ',
    null, undefined, '', '   ', 42];
  const records = types.map((aircraft_type, i) => aircraft({ icao24: i.toString(16).padStart(6, '0'), aircraft_type }));
  const snapshot = countAircraft(payload(records), now);
  const airline = snapshot.airlines.find(item => item.id === 'AAL');
  assert.equal(airline.count, types.length);
  assert.deepEqual(airline.aircraftTypes, [
    { name: 'Unknown type', count: 5 },
    { name: 'Boeing 737-800', count: 4 },
    { name: 'Boeing 737 MAX 8', count: 2 },
    { name: 'NEW MODEL 123', count: 2 },
    { name: 'Airbus A320', count: 1 },
    { name: 'Airbus A320neo', count: 1 },
  ]);
  for (const row of snapshot.airlines) {
    assert.equal(row.aircraftTypes.reduce((total, type) => total + type.count, 0), row.count);
    if (row.count === 0) { assert.deepEqual(row.aircraftTypes, []); }
  }
});

test('uses only the newest eligible observation for both the type breakdown and airline total', () => {
  const older = aircraft({ aircraft_type: 'A320', last_seen: '2026-10-04T11:59:00Z' });
  const newer = aircraft({ aircraft_type: 'A359' });
  const excluded = [
    aircraft({ icao24: '000002', aircraft_type: 'B738', is_on_ground: true }),
    aircraft({ icao24: '000003', aircraft_type: 'B738', last_seen: '2026-10-04T11:54:59Z' }),
    aircraft({ icao24: '000004', aircraft_type: 'B738', last_seen: '2026-10-04T12:00:01Z' }),
    aircraft({ icao24: '000005', aircraft_type: 'B738', callsign: 'ENY123' }),
    aircraft({ icao24: '000006', aircraft_type: 'B738', callsign: 'AAL' }),
    aircraft({ icao24: '000007', aircraft_type: 'B738', callsign: 'FIN123' }),
  ];
  for (const records of [[older, newer], [newer, older]]) {
    const snapshot = countAircraft(payload([...records, ...excluded]), now);
    assert.deepEqual(snapshot.airlines.find(item => item.id === 'AAL').aircraftTypes,
      [{ name: 'Airbus A350-900', count: 1 }]);
    assert.deepEqual(snapshot.airlines.find(item => item.id === 'FIN').aircraftTypes,
      [{ name: 'Boeing 737-800', count: 1 }]);
    assert.equal(count(snapshot, 'AAL'), 1);
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
  assert.equal(count(await fetchSnapshot('test-key'), 'AAL'), 1);
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
    assert.equal(count(await response.json(), 'AAL'), 1);
  }
  assert.equal(calls, 2);
  assert.equal((await globalThis.fetch(url + '/unknown')).status, 404);
  const rejected = await globalThis.fetch(url, { method: 'POST' });
  assert.equal(rejected.status, 405);
  assert.equal(rejected.headers.get('allow'), 'GET');
});

test('uses the newest registration and callsign together before classifying an operator', () => {
  const older = aircraft({ callsign: 'XABAR', registration: 'OTHER', last_seen: '2026-10-04T11:59:00Z' });
  const newer = aircraft({ callsign: 'XABAR', registration: 'XA-BAR' });
  for (const records of [[older, newer], [newer, older]]) {
    assert.deepEqual(countAircraft(payload(records), now).airlines, []);
  }
});
