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
  try {
    const deadline = Date.now() + context.getRemainingTimeInMillis() - 10_000;
    const stateBucket = setting('STATE_BUCKET');
    const websiteBucket = setting('WEBSITE_BUCKET');
    const parameter = await ssm.send(new GetParameterCommand({ Name: setting('SKYLINK_KEY_PARAMETER'), WithDecryption: true }));
    const apiKey = parameter.Parameter?.Value;
    if (!apiKey) { throw new Error('SkyLink key is unavailable'); }
    const directory = await createOperatorDirectory(apiKey, s3Store(s3, stateBucket, 'operator-names.json'));
    await refreshScheduledRanking({
      state: s3Store(s3, stateBucket, 'refresh-state.json'), directory,
      scheduledAt: event.scheduledAt, deadline,
      fetchSnapshot: () => fetchSnapshot(apiKey),
      publish: async snapshot => {
        await s3.send(new PutObjectCommand({
          Bucket: websiteBucket, Key: 'api/ranking', Body: JSON.stringify(snapshot),
          ContentType: 'application/json', CacheControl: 'public, max-age=30',
        }));
      },
    });
  } catch {
    // Provider payloads and credentials must never reach logs or asynchronous failure records.
    throw new Error('Scheduled ranking refresh failed; retained the last saved ranking.');
  }
}
