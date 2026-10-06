import { fileStore, type JsonStore } from './storage.ts';
import type { Snapshot } from '../shared/ranking.ts';

const DAY_MS = 24 * 60 * 60 * 1000;
export const NAME_REFRESH_MS = 30 * DAY_MS;
export const MISSING_NAME_REFRESH_MS = 7 * DAY_MS;
export const LOOKUP_COOLDOWN_MS = DAY_MS;
export const LOOKUP_WINDOW_MS = 32 * DAY_MS;
export const MAX_LOOKUP_ATTEMPTS = 750;

interface OperatorDetails { name: string | null; country: string | null }
interface Entry { name: string | null; country?: string | null; checkedAt: string }
export interface OperatorCache {
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

function isCache(value: unknown): value is OperatorCache {
  if (!isRecord(value) || !isRecord(value['names']) || !Array.isArray(value['attempts']) ||
      !value['attempts'].every(isTimestamp) || !isTimestamp(value['cooldownUntil'])) { return false; }
  return Object.entries(value['names']).every(([prefix, entry]) =>
    /^[A-Z]{3}$/.test(prefix) && isRecord(entry) &&
    (entry['name'] === null || (typeof entry['name'] === 'string' && entry['name'].trim().length > 0)) &&
    (entry['country'] === undefined || entry['country'] === null || typeof entry['country'] === 'string') &&
    typeof entry['checkedAt'] === 'string' && Number.isFinite(Date.parse(entry['checkedAt'])));
}

export function operatorDetails(payload: unknown, prefix: string): OperatorDetails {
  if (!Array.isArray(payload)) { throw new Error('Invalid directory response'); }
  const matches = payload.filter((entry: unknown): entry is Record<string, unknown> =>
    isRecord(entry) && entry['icao'] === prefix && typeof entry['name'] === 'string' && entry['name'].trim().length > 0);
  if (payload.length > 0 && matches.length === 0) { throw new Error('Invalid directory match'); }
  const names = new Set(matches.map(entry => (entry['name'] as string).trim()));
  const activeNames = new Set(matches.filter(entry => entry['active'] === 'Y').map(entry => (entry['name'] as string).trim()));
  let name: string | null = null;
  if (names.size === 1) { name = [...names][0]; }
  else if (activeNames.size === 1) { name = [...activeNames][0]; }
  if (!name) { return { name: null, country: null }; }

  const namedMatches = matches.filter(entry => (entry['name'] as string).trim() === name);
  const activeMatches = namedMatches.filter(entry => entry['active'] === 'Y');
  const countryMatches = activeMatches.length > 0 ? activeMatches : namedMatches;
  const countries = new Set(countryMatches.map(entry => entry['country'])
    .filter((country): country is string => typeof country === 'string' && country.trim().length > 0)
    .map(country => country.trim()));
  return { name, country: countries.size === 1 ? [...countries][0] : null };
}

export async function createOperatorDirectory(apiKey: string, storage: string | JsonStore, now = Date.now) {
  const store = typeof storage === 'string' ? fileStore(storage) : storage;
  let cache: OperatorCache = { names: {}, attempts: [], cooldownUntil: 0 };
  let isDisabled = false;
  let pending: Promise<void> | undefined;
  try {
    const saved = await store.read();
    // Only the local file store returns null for a genuinely absent cache.
    if (saved !== null) {
      if (!isCache(saved)) { throw new Error('Invalid operator cache'); }
      cache = saved;
    }
  } catch {
    isDisabled = true;
    console.error('Operator cache could not be read; directory lookups are disabled.');
  }

  async function save(): Promise<boolean> {
    try {
      await store.write(cache);
      return true;
    } catch {
      isDisabled = true;
      console.error('Operator cache could not be saved; directory lookups are disabled.');
      return false;
    }
  }

  async function lookupNames(prefixes: string[], deadline: number): Promise<void> {
    for (const prefix of new Set(prefixes)) {
      const time = now();
      if (isDisabled || time + 15_000 >= deadline || time < cache.cooldownUntil) { return; }
      if (!/^[A-Z]{3}$/.test(prefix)) { continue; }
      const entry = cache.names[prefix];
      const refreshAfter = entry?.name === null ? MISSING_NAME_REFRESH_MS : NAME_REFRESH_MS;
      if (entry && time - Date.parse(entry.checkedAt) < refreshAfter) { continue; }
      cache.attempts = cache.attempts.filter(attempt => time - attempt < LOOKUP_WINDOW_MS);
      if (cache.attempts.length >= MAX_LOOKUP_ATTEMPTS) { return; }

      // Reserve the attempt and a crash-safe cooldown before contacting the provider.
      cache.attempts.push(time);
      cache.cooldownUntil = time + LOOKUP_COOLDOWN_MS;
      if (!await save()) { return; }
      try {
        const response = await fetch(`https://data.skylinkapi.com/v3.1/airlines/search?icao=${prefix}`, {
          headers: { 'x-api-key': apiKey },
          signal: AbortSignal.timeout(10_000),
          redirect: 'error',
        });
        let details: OperatorDetails = { name: null, country: null };
        if (response.status !== 404) {
          if (!response.ok) { throw new Error('Directory lookup failed'); }
          const payload: unknown = await response.json();
          details = operatorDetails(payload, prefix);
        }
        cache.names[prefix] = { ...details, checkedAt: new Date(now()).toISOString() };
        cache.cooldownUntil = 0;
        if (!await save()) { return; }
      } catch {
        cache.cooldownUntil = now() + LOOKUP_COOLDOWN_MS;
        await save();
        console.error('Directory lookup failed; keeping existing names and pausing lookups for 24 hours.');
        return;
      }
    }
  }

  return {
    isAvailable(): boolean { return !isDisabled; },
    apply(snapshot: Snapshot): Snapshot {
      return { ...snapshot, airlines: snapshot.airlines.map(airline => ({
        ...airline, name: cache.names[airline.id]?.name ?? airline.id,
        country: cache.names[airline.id]?.country ?? null,
      })) };
    },
    refresh(prefixes: string[], deadline = Infinity): Promise<void> {
      // The snapshot service also serializes updates; guard direct overlapping calls too.
      pending ??= lookupNames(prefixes, deadline).finally(() => { pending = undefined; });
      return pending;
    },
  };
}
