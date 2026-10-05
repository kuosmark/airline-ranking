import assert from 'node:assert/strict';
import console from 'node:console';
import process from 'node:process';
import { test } from 'node:test';
import { S3Client } from '@aws-sdk/client-s3';
import { SSMClient } from '@aws-sdk/client-ssm';
import { handler } from '../backend/lambda.ts';

const secret = 'test-secret-must-not-appear';

function setup(t, failure) {
  for (const name of ['STATE_BUCKET', 'WEBSITE_BUCKET', 'SKYLINK_KEY_PARAMETER']) {
    const previous = process.env[name];
    process.env[name] = name.toLowerCase();
    t.after(() => {
      if (previous === undefined) delete process.env[name];
      else process.env[name] = previous;
    });
  }
  const logs = [];
  t.mock.method(console, 'error', (...args) => logs.push(args.join(' ')));
  t.mock.method(SSMClient.prototype, 'send', async () => {
    if (failure === 'key') throw new Error(secret);
    return { Parameter: { Value: secret } };
  });
  let publications = 0;
  t.mock.method(S3Client.prototype, 'send', async command => {
    const { Key, Body } = command.input;
    if (Key === 'operator-names.json' && ['cache', 'recovery-cache'].includes(failure)) throw new Error(secret);
    if (Key === 'refresh-state.json' && failure === 'state') throw new Error(secret);
    if (Key === 'api/ranking') {
      publications++;
      if (failure === 'publish') throw new Error(secret);
    }
    if (Body !== undefined) {
      if (failure === 'after-publish' && Key === 'refresh-state.json' && publications > 0) throw new Error(secret);
      return { ETag: 'saved' };
    }
    const savedSnapshot = { updatedAt: new Date().toISOString(), isStale: false, airlines: [] };
    const refreshState = failure === 'recovery-cache'
      ? { lastAttemptSlot: Math.floor(Date.now() / 900_000), snapshot: savedSnapshot }
      : { lastAttemptSlot: null, snapshot: null };
    const value = Key === 'operator-names.json'
      ? { names: {}, attempts: [], cooldownUntil: 0 }
      : refreshState;
    return { ETag: 'initial', Body: { transformToString: async () => JSON.stringify(value) } };
  });
  t.mock.method(globalThis, 'fetch', async () => {
    if (failure === 'snapshot') throw new Error(secret);
    const timestamp = new Date().toISOString();
    return new globalThis.Response(JSON.stringify({ timestamp, total_count: 1,
      aircraft: [{ icao24: 'abcdef', callsign: '', is_on_ground: false, last_seen: timestamp }] }));
  });
  return logs;
}

for (const [failure, expected] of [
  ['configuration', 'Reading configuration failed.'],
  ['key', 'Reading API key failed.'],
  ['cache', 'Loading operator cache failed.'],
  ['state', 'Refreshing ranking failed.'],
  ['snapshot', 'Fetching SkyLink snapshot failed.'],
  ['publish', 'Publishing ranking failed.'],
  ['after-publish', 'Refreshing ranking failed.'],
]) {
  test(`reports ${failure} failures without exposing underlying errors`, async t => {
    const logs = setup(t, failure);
    if (failure === 'configuration') delete process.env['STATE_BUCKET'];
    await assert.rejects(
      handler({ scheduledAt: new Date().toISOString() }, { getRemainingTimeInMillis: () => 120_000 }),
      error => {
        assert.equal(error.message, expected);
        assert.equal(error.cause, undefined);
        assert.equal(error.stack.includes(secret), false);
        return true;
      },
    );
    assert.equal(logs.join('\n').includes(secret), false);
  });
}

test('successful Lambda refresh still completes with stage diagnostics enabled', async t => {
  const logs = setup(t);
  await handler({ scheduledAt: new Date().toISOString() }, { getRemainingTimeInMillis: () => 120_000 });
  assert.deepEqual(logs, []);
});


test('duplicate delivery can republish saved ranking when the operator cache is unavailable', async t => {
  setup(t, 'recovery-cache');
  await handler({ scheduledAt: new Date().toISOString() }, { getRemainingTimeInMillis: () => 120_000 });
  const publications = S3Client.prototype.send.mock.calls.filter(call => call.arguments[0].input.Key === 'api/ranking');
  assert.equal(publications.length, 1);
  assert.deepEqual(JSON.parse(publications[0].arguments[0].input.Body).airlines, []);
  assert.equal(globalThis.fetch.mock.callCount(), 0);
});
