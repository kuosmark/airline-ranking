import assert from 'node:assert/strict';
import { test } from 'node:test';
import { startVisiblePolling } from '../src/visible-polling.ts';

test('polls only visible tabs, resumes immediately, prevents overlap and cleans up', async t => {
  t.mock.timers.enable({ apis: ['setInterval'] });
  const page = new globalThis.EventTarget();
  page.hidden = true;
  let calls = 0;
  let finish;
  const stop = startVisiblePolling(page, () => {
    calls++;
    return new Promise(resolve => { finish = resolve; });
  });
  const visibility = isHidden => {
    page.hidden = isHidden;
    page.dispatchEvent(new globalThis.Event('visibilitychange'));
  };
  t.mock.timers.tick(120_000);
  assert.equal(calls, 0);
  visibility(false);
  assert.equal(calls, 1);
  t.mock.timers.tick(60_000);
  assert.equal(calls, 1);
  finish();
  await Promise.resolve();
  t.mock.timers.tick(60_000);
  assert.equal(calls, 2);
  visibility(true);
  finish();
  await Promise.resolve();
  t.mock.timers.tick(180_000);
  assert.equal(calls, 2);
  visibility(false);
  assert.equal(calls, 3);
  stop();
  finish();
  await Promise.resolve();
  visibility(true);
  visibility(false);
  t.mock.timers.tick(120_000);
  assert.equal(calls, 3);
});
