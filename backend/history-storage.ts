import { PutObjectCommand, type S3Client } from '@aws-sdk/client-s3';
import { gzip } from 'node:zlib';
import { promisify } from 'node:util';
import { isHistoryRecord, type HistoryRecord } from './history.ts';

const compress = promisify(gzip);
export async function writeHistory(client: S3Client, bucket: string, record: HistoryRecord): Promise<void> {
  if (!isHistoryRecord(record)) { throw new Error('Invalid historical counts'); }
  const key = `history/counts/v1/${record.observedAt.slice(0, 10)}/${record.observedAt}.json.gz`;
  const body = await compress(JSON.stringify(record));
  try {
    await client.send(new PutObjectCommand({
      Bucket: bucket, Key: key, Body: body, ContentType: 'application/json', ContentEncoding: 'gzip',
      IfNoneMatch: '*',
    }), { abortSignal: AbortSignal.timeout(5_000) });
  } catch (error) {
    // The first observation wins, including after an uncertain successful write.
    if (error instanceof Error && error.name === 'PreconditionFailed') { return; }
    throw error;
  }
}
