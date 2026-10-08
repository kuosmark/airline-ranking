import { setTimeout } from 'node:timers/promises';
import { fileStore, type JsonStore } from './storage.ts';
import type { Snapshot } from '../shared/ranking.ts';

const DAY_MS = 24 * 60 * 60 * 1000;
export const NAME_REFRESH_MS = 30 * DAY_MS;
export const MISSING_NAME_REFRESH_MS = 7 * DAY_MS;
export const LOOKUP_COOLDOWN_MS = DAY_MS;
export const LOOKUP_WINDOW_MS = 32 * DAY_MS;
export const MAX_LOOKUP_ATTEMPTS = 5_000;
export const MAX_LOOKUPS_PER_REFRESH = 100;
export const LOOKUP_SPACING_MS = 1_000;

interface OperatorDetails { name: string | null; country: string | null; countryIso?: string | null; iata: string | null; icao: string | null }
interface Entry extends OperatorDetails { checkedAt: string }
interface RequestHistory { attempts: number[]; cooldownUntil: number }
export interface OperatorCache extends RequestHistory {
  source: 'adsbdb';
  names: Record<string, Entry | undefined>;
  legacySkylink?: RequestHistory;
}
const emptyDetails: OperatorDetails = { name: null, country: null, countryIso: null, iata: null, icao: null };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function isTimestamp(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}
function isHistory(value: unknown): value is RequestHistory {
  return isRecord(value) && Array.isArray(value['attempts']) && value['attempts'].every(isTimestamp) &&
    isTimestamp(value['cooldownUntil']);
}
function isCache(value: unknown): value is OperatorCache {
  if (!isRecord(value) || value['source'] !== 'adsbdb' || !isHistory(value) || !isRecord(value['names']) ||
      (value['legacySkylink'] !== undefined && !isHistory(value['legacySkylink']))) { return false; }
  return Object.entries(value['names']).every(([prefix, entry]) =>
    /^[A-Z]{3}$/.test(prefix) && isRecord(entry) &&
    (entry['name'] === null || (typeof entry['name'] === 'string' && entry['name'].trim().length > 0)) &&
    (entry['country'] === null || typeof entry['country'] === 'string') &&
    (entry['countryIso'] === undefined || entry['countryIso'] === null ||
      (typeof entry['countryIso'] === 'string' && /^[A-Z]{2}$/.test(entry['countryIso']))) &&
    (entry['iata'] === null || (typeof entry['iata'] === 'string' && /^[A-Z\d]{2}$/.test(entry['iata']))) &&
    (entry['icao'] === null || entry['icao'] === prefix) &&
    typeof entry['checkedAt'] === 'string' && Number.isFinite(Date.parse(entry['checkedAt'])));
}

export function operatorDetails(payload: unknown, prefix: string): OperatorDetails {
  if (!isRecord(payload) || !Array.isArray(payload['response'])) { throw new Error('Invalid ADSBDB response'); }
  const records: unknown[] = payload['response'];
  const matches = records.filter((entry): entry is Record<string, unknown> =>
    isRecord(entry) && entry['icao'] === prefix && typeof entry['name'] === 'string' && entry['name'].trim().length > 0);
  if (records.length > 0 && matches.length === 0) { throw new Error('Invalid ADSBDB match'); }
  const names = new Set(matches.map(entry => (entry['name'] as string).trim()));
  if (names.size !== 1) { return { ...emptyDetails }; }
  const name = [...names][0];
  const countries = new Set(matches.map(entry => entry['country'])
    .filter((country): country is string => typeof country === 'string' && country.trim().length > 0)
    .map(country => country.trim()));
  const countryCodes = new Set(matches.map(entry => entry['country_iso'])
    .filter((code): code is string => typeof code === 'string' && /^[A-Z]{2}$/.test(code)));
  const codes = new Set(matches.map(entry => entry['iata'])
    .filter((code): code is string => typeof code === 'string' && /^[A-Z\d]{2}$/.test(code)));
  return { name, country: countries.size === 1 ? [...countries][0] : null,
    countryIso: countries.size === 1 && countryCodes.size === 1 ? [...countryCodes][0] : null,
    iata: codes.size === 1 ? [...codes][0] : null, icao: prefix };
}

export async function createOperatorDirectory(storage: string | JsonStore, now = Date.now, wait = setTimeout) {
  const store = typeof storage === 'string' ? fileStore(storage) : storage;
  let cache: OperatorCache = { source: 'adsbdb', names: {}, attempts: [], cooldownUntil: 0 };
  let isDisabled = false;
  let pending: Promise<void> | undefined;

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
  try {
    const saved = await store.read();
    // Cloud storage must already exist; only an absent local file returns null.
    if (saved !== null) {
      if (isCache(saved)) { cache = saved; }
      else if (isRecord(saved) && saved['source'] === undefined && isHistory(saved) && isRecord(saved['names'])) {
        // Archive paid request history, but do not reuse SkyLink's operator labels.
        cache.legacySkylink = { attempts: saved.attempts, cooldownUntil: saved.cooldownUntil };
        await save();
      } else { throw new Error('Invalid operator cache'); }
    }
  } catch {
    isDisabled = true;
    console.error('Operator cache could not be read; directory lookups are disabled.');
  }

  async function lookupNames(prefixes: string[], deadline: number): Promise<void> {
    let lookups = 0;
    for (const prefix of new Set(prefixes)) {
      let time = now();
      if (isDisabled || time + 15_000 >= deadline || time < cache.cooldownUntil || lookups >= MAX_LOOKUPS_PER_REFRESH) { return; }
      if (!/^[A-Z]{3}$/.test(prefix)) { continue; }
      const entry = cache.names[prefix];
      const refreshAfter = entry?.name === null ? MISSING_NAME_REFRESH_MS : NAME_REFRESH_MS;
      if (entry && entry.countryIso !== undefined && time - Date.parse(entry.checkedAt) < refreshAfter) { continue; }
      cache.attempts = cache.attempts.filter(attempt => time - attempt < LOOKUP_WINDOW_MS);
      if (cache.attempts.length >= MAX_LOOKUP_ATTEMPTS) { return; }
      const nextAttemptAt = cache.attempts.length > 0 ? Math.max(...cache.attempts) + LOOKUP_SPACING_MS : time;
      if (nextAttemptAt + 15_000 >= deadline) { return; }
      if (nextAttemptAt > time) { await wait(nextAttemptAt - time); }
      time = now();
      if (time + 15_000 >= deadline) { return; }

      // Persist the attempt and crash-safe cooldown before contacting ADSBDB.
      cache.attempts.push(time);
      cache.cooldownUntil = time + LOOKUP_COOLDOWN_MS;
      if (!await save()) { return; }
      lookups++;
      try {
        const response = await fetch(`https://api.adsbdb.com/v0/airline/${prefix}`, {
          signal: AbortSignal.timeout(10_000), redirect: 'error',
        });
        let details: OperatorDetails = { ...emptyDetails };
        if (response.status !== 404) {
          if (!response.ok) { throw new Error('ADSBDB lookup failed'); }
          const payload: unknown = await response.json();
          details = operatorDetails(payload, prefix);
        }
        const completedAt = now();
        // Pace from completion so storage and network delays cannot shorten the gap.
        cache.attempts[cache.attempts.length - 1] = completedAt;
        cache.names[prefix] = { ...details, checkedAt: new Date(completedAt).toISOString() };
        cache.cooldownUntil = 0;
        if (!await save()) { return; }
      } catch {
        cache.cooldownUntil = now() + LOOKUP_COOLDOWN_MS;
        await save();
        console.error('ADSBDB lookup failed; keeping cached details and pausing lookups for 24 hours.');
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
        countryIso: cache.names[airline.id]?.countryIso ?? null,
        iata: cache.names[airline.id]?.iata ?? null,
        icao: cache.names[airline.id]?.icao ?? null,
      })) };
    },
    refresh(prefixes: string[], deadline = Infinity): Promise<void> {
      pending ??= lookupNames(prefixes, deadline).finally(() => { pending = undefined; });
      return pending;
    },
  };
}
