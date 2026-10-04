import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { Snapshot } from '../shared/ranking.ts';

const DAY_MS = 24 * 60 * 60 * 1000;
export const NAME_REFRESH_MS = 30 * DAY_MS;
export const MISSING_NAME_REFRESH_MS = 7 * DAY_MS;
export const LOOKUP_COOLDOWN_MS = DAY_MS;
export const LOOKUP_WINDOW_MS = 30 * DAY_MS;
export const MAX_LOOKUP_ATTEMPTS = 1000;

interface Entry { name: string | null; checkedAt: string }
interface Cache {
  names: Record<string, Entry | undefined>;
  attempts: number[];
  cooldownUntil: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isTimestamp(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function isCache(value: unknown): value is Cache {
  if (!isRecord(value) || !isRecord(value['names']) || !Array.isArray(value['attempts']) ||
      !value['attempts'].every(isTimestamp) || !isTimestamp(value['cooldownUntil'])) { return false; }
  return Object.entries(value['names']).every(([prefix, entry]) =>
    /^[A-Z]{3}$/.test(prefix) && isRecord(entry) &&
    (entry['name'] === null || (typeof entry['name'] === 'string' && entry['name'].trim().length > 0)) &&
    typeof entry['checkedAt'] === 'string' && Number.isFinite(Date.parse(entry['checkedAt'])));
}

export function operatorName(payload: unknown, prefix: string): string | null {
  if (!Array.isArray(payload)) { throw new Error('Invalid directory response'); }
  const matches = payload.filter((entry: unknown): entry is Record<string, unknown> =>
    isRecord(entry) && entry['icao'] === prefix && typeof entry['name'] === 'string' && entry['name'].trim().length > 0);
  if (payload.length > 0 && matches.length === 0) { throw new Error('Invalid directory match'); }
  const names = new Set(matches.map(entry => (entry['name'] as string).trim()));
  if (names.size === 1) { return [...names][0]; }
  const activeNames = new Set(matches.filter(entry => entry['active'] === 'Y').map(entry => (entry['name'] as string).trim()));
  return activeNames.size === 1 ? [...activeNames][0] : null;
}

export function createOperatorDirectory(apiKey: string, path: string, now = Date.now) {
  let cache: Cache = { names: {}, attempts: [], cooldownUntil: 0 };
  let isDisabled = false;
  let pending: Promise<void> | undefined;
  try {
    const saved: unknown = JSON.parse(readFileSync(path, 'utf8'));
    if (!isCache(saved)) { throw new Error('Invalid operator cache'); }
    cache = saved;
  } catch (error) {
    if (!isRecord(error) || error['code'] !== 'ENOENT') {
      isDisabled = true;
      console.error('Operator cache could not be read; directory lookups are disabled.');
    }
  }

  function save(): boolean {
    try {
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(`${path}.tmp`, JSON.stringify(cache, null, 2) + '\n', { mode: 0o600 });
      renameSync(`${path}.tmp`, path);
      return true;
    } catch {
      isDisabled = true;
      console.error('Operator cache could not be saved; directory lookups are disabled.');
      return false;
    }
  }

  async function lookupNames(prefixes: string[]): Promise<void> {
    for (const prefix of new Set(prefixes)) {
      const time = now();
      if (isDisabled || time < cache.cooldownUntil) { return; }
      if (!/^[A-Z]{3}$/.test(prefix)) { continue; }
      const entry = cache.names[prefix];
      const refreshAfter = entry?.name === null ? MISSING_NAME_REFRESH_MS : NAME_REFRESH_MS;
      if (entry && time - Date.parse(entry.checkedAt) < refreshAfter) { continue; }
      cache.attempts = cache.attempts.filter(attempt => time - attempt < LOOKUP_WINDOW_MS);
      if (cache.attempts.length >= MAX_LOOKUP_ATTEMPTS) { return; }

      // Reserve the attempt and a crash-safe cooldown before contacting the provider.
      cache.attempts.push(time);
      cache.cooldownUntil = time + LOOKUP_COOLDOWN_MS;
      if (!save()) { return; }
      try {
        const response = await fetch(`https://data.skylinkapi.com/v3.1/airlines/search?icao=${prefix}`, {
          headers: { 'x-api-key': apiKey },
          signal: AbortSignal.timeout(10_000),
          redirect: 'error',
        });
        let name: string | null = null;
        if (response.status !== 404) {
          if (!response.ok) { throw new Error('Directory lookup failed'); }
          const payload: unknown = await response.json();
          name = operatorName(payload, prefix);
        }
        cache.names[prefix] = { name, checkedAt: new Date(now()).toISOString() };
        cache.cooldownUntil = 0;
        if (!save()) { return; }
      } catch {
        cache.cooldownUntil = now() + LOOKUP_COOLDOWN_MS;
        save();
        console.error('Directory lookup failed; keeping existing names and pausing lookups for 24 hours.');
        return;
      }
    }
  }

  return {
    apply(snapshot: Snapshot): Snapshot {
      return { ...snapshot, airlines: snapshot.airlines.map(airline => ({
        ...airline, name: cache.names[airline.id]?.name ?? airline.id,
      })) };
    },
    refresh(prefixes: string[]): Promise<void> {
      // The snapshot service also serializes updates; guard direct overlapping calls too.
      pending ??= lookupNames(prefixes).finally(() => { pending = undefined; });
      return pending;
    },
  };
}
