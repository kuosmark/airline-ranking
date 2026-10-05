import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

export interface JsonStore {
  read(): Promise<unknown>;
  write(value: unknown): Promise<void>;
}

export function fileStore(path: string): JsonStore {
  return {
    async read(): Promise<unknown> {
      try { return JSON.parse(await readFile(path, 'utf8')) as unknown; }
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
