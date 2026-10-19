import { compactSnapshot } from '../shared/snapshot-wire.ts';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';
import { createOperatorDirectory } from './operator-directory.ts';
import { refreshScheduledRanking } from './scheduled-refresh.ts';
import { s3Store } from './s3-storage.ts';
import { fetchSnapshot } from './skylink.ts';

const s3 = new S3Client({ maxAttempts: 1, requestHandler: { connectionTimeout: 3_000, requestTimeout: 5_000, throwOnRequestTimeout: true } });
const ssm = new SSMClient({ maxAttempts: 1, requestHandler: { connectionTimeout: 3_000, requestTimeout: 5_000, throwOnRequestTimeout: true } });

function setting(name: string): string {
  const value = process.env[name];
  if (!value) { throw new Error(`Missing setting: ${name}`); }
  return value;
}

export async function handler(event: { scheduledAt: string }, context: { getRemainingTimeInMillis(): number }): Promise<void> {
  let stage = 'Reading configuration';
  try {
    const deadline = Date.now() + context.getRemainingTimeInMillis() - 10_000;
    const stateBucket = setting('STATE_BUCKET');
    const websiteBucket = setting('WEBSITE_BUCKET');
    const parameterName = setting('SKYLINK_KEY_PARAMETER');
    stage = 'Reading API key';
    const parameter = await ssm.send(new GetParameterCommand({ Name: parameterName, WithDecryption: true }), { abortSignal: AbortSignal.timeout(5_000) });
    const apiKey = parameter.Parameter?.Value;
    if (!apiKey) { throw new Error('SkyLink key is unavailable'); }
    stage = 'Loading operator cache';
    const directory = await createOperatorDirectory(s3Store(s3, stateBucket, 'operator-names.json'));
    stage = directory.isAvailable() ? 'Refreshing ranking' : 'Loading operator cache';
    await refreshScheduledRanking({
      state: s3Store(s3, stateBucket, 'refresh-state.json'), directory,
      scheduledAt: event.scheduledAt, deadline,
      fetchSnapshot: async () => {
        stage = 'Fetching SkyLink snapshot';
        const snapshot = await fetchSnapshot(apiKey);
        stage = 'Refreshing ranking';
        return snapshot;
      },
      publish: async snapshot => {
        stage = 'Publishing ranking';
        for (const [key, body] of [
          ['api/ranking', JSON.stringify(snapshot)],
          ['api/ranking-v2', JSON.stringify(compactSnapshot(snapshot))],
        ]) {
          await s3.send(new PutObjectCommand({
            Bucket: websiteBucket, Key: key, Body: body,
            ContentType: 'application/json', CacheControl: 'public, max-age=30',
          }), { abortSignal: AbortSignal.timeout(5_000) });
        }
        stage = 'Refreshing ranking';
      },
    });
  } catch (error) {
    // Provider payloads and credentials must never reach logs or asynchronous failure records.
    const name = error instanceof Error ? error.name : '';
    let category = 'unknown';
    if (['AbortError', 'TimeoutError', 'RequestTimeout'].includes(name)) { category = 'timeout'; }
    else if (['AccessDenied', 'AccessDeniedException'].includes(name)) { category = 'access denied'; }
    else if (['PreconditionFailed', 'ConditionalRequestConflict'].includes(name)) { category = 'conflicting write'; }
    // eslint-disable-next-line preserve-caught-error -- Attaching the original cause would expose unsanitized errors in Lambda logs.
    throw new Error(`${stage} failed. Category: ${category}.`);
  }
}
