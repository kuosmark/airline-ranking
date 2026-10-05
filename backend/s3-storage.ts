import { GetObjectCommand, PutObjectCommand, type S3Client } from '@aws-sdk/client-s3';
import type { JsonStore } from './storage.ts';

// One instance per invocation. Conditional writes reject concurrent or stale state updates.
export function s3Store(client: S3Client, bucket: string, key: string): JsonStore {
  let etag: string | undefined;
  return {
    async read(): Promise<unknown> {
      const response = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
      if (!response.Body) { throw new Error('State object has no body'); }
      const value: unknown = JSON.parse(await response.Body.transformToString());
      if (!response.ETag || value === null) { throw new Error('State object is invalid'); }
      etag = response.ETag;
      return value;
    },
    async write(value: unknown): Promise<void> {
      if (!etag) { throw new Error('Read existing state before writing'); }
      const response = await client.send(new PutObjectCommand({
        Bucket: bucket, Key: key, Body: JSON.stringify(value), ContentType: 'application/json', IfMatch: etag,
      }));
      if (!response.ETag) { throw new Error('State write was not confirmed'); }
      etag = response.ETag;
    },
  };
}
