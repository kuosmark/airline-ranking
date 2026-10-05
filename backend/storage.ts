import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

export interface JsonStore {
  read(): Promise<unknown>;
  write(value: unknown): Promise<void>;
}

export function fileStore(path: string): JsonStore {
  return {
    async read(): Promise<unknown> {
      try {
        const value: unknown = JSON.parse(await readFile(path, 'utf8'));
        if (value === null) { throw new Error('Invalid stored state'); }
        return value;
      }
      catch (error) {
        if (error instanceof Error && 'code' in error && error.code === 'ENOENT') { return null; }
        throw error;
      }
    },
    async write(value: unknown): Promise<void> {
      await mkdir(dirname(path), { recursive: true });
      await writeFile(`${path}.tmp`, JSON.stringify(value, null, 2) + '\n', { mode: 0o600 });
      await rename(`${path}.tmp`, path);
    },
  };
}
