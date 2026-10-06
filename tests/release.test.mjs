import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { LambdaClient, GetFunctionConfigurationCommand, UpdateFunctionCodeCommand } from '@aws-sdk/client-lambda';
import { test } from 'node:test';
import { packageBackend, releaseBackend, validateFunctionArn } from '../infra/release.ts';

const functionArn = 'arn:aws:lambda:eu-north-1:123456789012:function:AirlineRanking-Refresh';
const code = Buffer.from('test package');
const configuration = { Runtime: 'nodejs22.x', Handler: 'index.handler', Architectures: ['arm64'],
  RevisionId: 'existing-revision', LastUpdateStatus: 'Successful' };

test('backend package contains a bundled index.handler without invoking the provider', async t => {
  const fetch = t.mock.method(globalThis, 'fetch', () => { throw new Error('No provider calls during packaging'); });
  const archive = await packageBackend();
  const contents = execFileSync('python3', ['-c',
    'import io, sys, zipfile; z = zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read())); print(z.namelist()); print(z.read("index.js").decode())'],
  { input: archive, maxBuffer: 10 * 1024 * 1024 }).toString();
  assert.ok(contents.startsWith("['index.js']"));
  assert.match(contents, /handler/);
  assert.match(contents, /GetParameterCommand/);
  assert.equal(fetch.mock.callCount(), 0);
});

test('release updates only code with a revision guard and verifies the deployed package', async t => {
  let isUpdated = false;
  const calls = [];
  t.mock.method(LambdaClient.prototype, 'send', async command => {
    calls.push(command);
    if (command instanceof UpdateFunctionCodeCommand) { isUpdated = true; return {}; }
    return { ...configuration, CodeSha256: isUpdated ? createHash('sha256').update(code).digest('base64') : 'old' };
  });
  await releaseBackend(code, functionArn);
  assert.ok(calls[0] instanceof GetFunctionConfigurationCommand);
  assert.ok(calls[1] instanceof UpdateFunctionCodeCommand);
  assert.deepEqual(calls[1].input, { FunctionName: functionArn, ZipFile: code, RevisionId: 'existing-revision' });
  assert.ok(calls.slice(2).every(command => command instanceof GetFunctionConfigurationCommand));
  assert.ok(calls.every(command => command.input.FunctionName === functionArn));
});

test('releases reject unreviewed runtime settings and overlapping updates before changing code', async t => {
  for (const changed of [{ Runtime: 'nodejs24.x' }, { Handler: 'other.handler' }, { Architectures: ['x86_64'] },
    { RevisionId: undefined }, { LastUpdateStatus: 'InProgress' }]) {
    const send = t.mock.method(LambdaClient.prototype, 'send', async () => ({ ...configuration, ...changed }));
    await assert.rejects(releaseBackend(code, functionArn), /configuration changed/);
    assert.equal(send.mock.callCount(), 1);
  }
});

test('revision conflicts stop a release without retrying the code update', async t => {
  const calls = [];
  t.mock.method(LambdaClient.prototype, 'send', async command => {
    calls.push(command);
    if (command instanceof UpdateFunctionCodeCommand) { throw new Error('PreconditionFailedException'); }
    return configuration;
  });
  await assert.rejects(releaseBackend(code, functionArn), /PreconditionFailed/);
  assert.equal(calls.length, 2);
});

test('a failed Lambda update or unexpected code hash stops the release', async t => {
  for (const released of [{ LastUpdateStatus: 'Failed' }, { CodeSha256: 'unexpected-code' }]) {
    let isUpdated = false;
    t.mock.method(LambdaClient.prototype, 'send', async command => {
      if (command instanceof UpdateFunctionCodeCommand) { isUpdated = true; return {}; }
      return { ...configuration, ...(isUpdated ? released : {}) };
    });
    await assert.rejects(releaseBackend(code, functionArn));
  }
});

test('qualified, wildcard and out-of-region Lambda targets are rejected without AWS requests', async t => {
  const send = t.mock.method(LambdaClient.prototype, 'send', async () => configuration);
  assert.equal(validateFunctionArn(functionArn), functionArn);
  for (const target of ['', '*', 'Refresh', `${functionArn}:alias`, functionArn.replace('eu-north-1', 'us-east-1')]) {
    await assert.rejects(releaseBackend(code, target), /ARN/);
  }
  assert.equal(send.mock.callCount(), 0);
});
