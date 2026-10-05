import assert from 'node:assert/strict';
import { test } from 'node:test';
import { refreshScheduledRanking } from '../backend/scheduled-refresh.ts';
import { s3Store } from '../backend/s3-storage.ts';
import { REFRESH_INTERVAL_MS } from '../backend/skylink.ts';

const start = Date.parse('2026-10-05T12:00:00Z');
const snapshot = (time, entries) => ({ updatedAt: new Date(time).toISOString(), isStale: false,
  airlines: entries.map(([id, count]) => ({ id, name: id, count, aircraftTypes: [{ name: 'A320', count }] })) });
function setup() {
  let saved = { lastAttemptSlot: null, snapshot: null };
  let clock = start;
  let data = snapshot(start, [['AAA', 10], ['BBB', 5]]);
  let calls = 0;
  const published = [];
  const store = { async read() { return globalThis.structuredClone(saved); }, async write(value) { saved = globalThis.structuredClone(value); } };
  const directory = { isAvailable: () => true, apply: value => value, async refresh() {} };
  const options = { state: store, directory, scheduledAt: new Date(clock).toISOString(), deadline: clock + 120000,
    now: () => clock, fetchSnapshot: async () => {
      assert.equal(saved.lastAttemptSlot, Math.floor(clock / REFRESH_INTERVAL_MS));
      calls++; return data;
    }, publish: async value => { published.push(globalThis.structuredClone(value)); } };
  return { options, store, published, calls: () => calls, saved: () => saved,
    advance(entries) { clock += REFRESH_INTERVAL_MS; data = snapshot(clock, entries);
      options.scheduledAt = new Date(clock).toISOString(); options.deadline = clock + 120000; } };
}

test('reserves before fetching, skips duplicate slots and compares persisted snapshots after restart', async () => {
  const h = setup();
  await refreshScheduledRanking(h.options);
  assert.equal(h.calls(), 1);
  await refreshScheduledRanking({ ...h.options });
  assert.equal(h.calls(), 1);
  h.advance([['AAA', 10], ['BBB', 20]]);
  await refreshScheduledRanking({ ...h.options });
  assert.deepEqual(h.saved().snapshot.airlines.map(a => [a.id, a.rankChange]), [['BBB', 1], ['AAA', -1]]);
  assert.equal(h.calls(), 2);
});

test('missing, corrupt or unreadable state and failed reservations prevent provider calls', async () => {
  for (const state of [null, {}, { lastAttemptSlot: 'wrong', snapshot: null },
    { lastAttemptSlot: 1, snapshot: { airlines: [] } }]) {
    const h = setup(); h.store.read = async () => state;
    await assert.rejects(refreshScheduledRanking(h.options)); assert.equal(h.calls(), 0);
  }
  for (const method of ['read', 'write']) {
    const h = setup(); h.store[method] = async () => { throw new Error('Storage unavailable'); };
    await assert.rejects(refreshScheduledRanking(h.options)); assert.equal(h.calls(), 0);
  }
  const h = setup(); h.options.directory.isAvailable = () => false;
  await assert.rejects(refreshScheduledRanking(h.options)); assert.equal(h.calls(), 0);
});

test('failed fetch consumes the slot and leaves the previous ranking intact', async () => {
  const h = setup(); await refreshScheduledRanking(h.options);
  const before = h.saved().snapshot;
  h.advance([['AAA', 12]]);
  h.options.fetchSnapshot = async () => { throw new Error('Provider failure'); };
  await assert.rejects(refreshScheduledRanking(h.options));
  assert.deepEqual(h.saved().snapshot, before);
  await refreshScheduledRanking(h.options); // Would throw if the duplicate contacted the provider.
});

test('publication failure recovers from saved state without another provider call', async () => {
  const h = setup(); const publish = h.options.publish;
  h.options.publish = async () => { throw new Error('Publication failed'); };
  await assert.rejects(refreshScheduledRanking(h.options));
  h.options.publish = publish;
  await refreshScheduledRanking(h.options);
  assert.equal(h.calls(), 1); assert.equal(h.published.length, 1);
});

test('repeated timestamps keep the comparison baseline and older snapshots are rejected', async () => {
  const h = setup(); await refreshScheduledRanking(h.options);
  h.advance([['BBB', 20], ['AAA', 10]]); await refreshScheduledRanking(h.options);
  const before = h.saved().snapshot;
  h.advance([['AAA', 50]]);
  h.options.fetchSnapshot = async () => snapshot(start + REFRESH_INTERVAL_MS, [['AAA', 50]]);
  await refreshScheduledRanking(h.options);
  assert.deepEqual(h.saved().snapshot, before);
  h.advance([['AAA', 60]]);
  h.options.fetchSnapshot = async () => snapshot(start, [['AAA', 60]]);
  await assert.rejects(refreshScheduledRanking(h.options));
  assert.deepEqual(h.saved().snapshot, before);
});

test('invalid, future and expired events and insufficient execution time make no provider calls', async () => {
  for (const scheduledAt of ['bad', new Date(start - REFRESH_INTERVAL_MS).toISOString(), new Date(start + 60001).toISOString()]) {
    const h = setup(); h.options.scheduledAt = scheduledAt;
    await assert.rejects(refreshScheduledRanking(h.options)); assert.equal(h.calls(), 0);
  }
  const h = setup(); h.options.deadline = start + 30000;
  await assert.rejects(refreshScheduledRanking(h.options)); assert.equal(h.calls(), 0);
});

test('S3 requires existing readable state and writes with the version just read', async () => {
  const commands = [];
  const client = { async send(command) {
    commands.push(command.input);
    if (commands.length === 1) return { ETag: 'v1', Body: { transformToString: async () => '{"names":{}}' } };
    return { ETag: 'v2' };
  } };
  const store = s3Store(client, 'private-state', 'cache.json');
  await assert.rejects(store.write({}), /Read existing/);
  assert.deepEqual(await store.read(), { names: {} });
  await store.write({ names: {} }); await store.write({ names: {} });
  assert.equal(commands[1].IfMatch, 'v1'); assert.equal(commands[2].IfMatch, 'v2');
  const missing = s3Store({ send: async () => { throw new Error('NoSuchKey'); } }, 'state', 'cache');
  await assert.rejects(missing.read()); await assert.rejects(missing.write({}));
});

test('a conflicting S3 reservation cannot spend a snapshot request', async () => {
  const h = setup(); h.options.state = s3Store({ async send(command) {
    if (command.input.Body) throw new Error('PreconditionFailed');
    return { ETag: 'v1', Body: { transformToString: async () => JSON.stringify(h.saved()) } };
  } }, 'state', 'refresh-state.json');
  await assert.rejects(refreshScheduledRanking(h.options)); assert.equal(h.calls(), 0);
});
