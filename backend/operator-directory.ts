import { setTimeout } from 'node:timers/promises';
import { fetchOperatorDetails } from './adsbdb.ts';
import { createEmptyOperatorCache, readOperatorCache, type OperatorCache } from './operator-cache.ts';
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

function isLookupNeeded(cache: OperatorCache, prefix: string, time: number): boolean {
  if (!/^[A-Z]{3}$/.test(prefix)) { return false; }
  const entry = cache.names[prefix];
  if (!entry || entry.countryIso === undefined) { return true; }
  const refreshAfter = entry.name === null ? MISSING_NAME_REFRESH_MS : NAME_REFRESH_MS;
  return time - Date.parse(entry.checkedAt) >= refreshAfter;
}

export async function createOperatorDirectory(storage: string | JsonStore, now = Date.now, wait = setTimeout) {
  const store = typeof storage === 'string' ? fileStore(storage) : storage;
  let cache = createEmptyOperatorCache();
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
    // Cloud storage must already exist; only an absent local file returns null.
    const loaded = readOperatorCache(await store.read());
    cache = loaded.cache;
    if (loaded.isMigrated) { await save(); }
  } catch {
    isDisabled = true;
    console.error('Operator cache could not be read; directory lookups are disabled.');
  }

  async function lookupNames(prefixes: string[], deadline: number): Promise<void> {
    let lookups = 0;
    for (const prefix of new Set(prefixes)) {
      let time = now();
      if (isDisabled || time + 15_000 >= deadline || time < cache.cooldownUntil || lookups >= MAX_LOOKUPS_PER_REFRESH) { return; }
      if (!isLookupNeeded(cache, prefix, time)) { continue; }
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
        const details = await fetchOperatorDetails(prefix);
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
      const airlines = snapshot.airlines.map(airline => {
        const details = cache.names[airline.id];
        return {
          ...airline,
          name: details?.name ?? airline.id,
          country: details?.country ?? null,
          countryIso: details?.countryIso ?? null,
          iata: details?.iata ?? null,
          icao: details?.icao ?? null,
        };
      });
      return { ...snapshot, airlines };
    },
    refresh(prefixes: string[], deadline = Infinity): Promise<void> {
      pending ??= lookupNames(prefixes, deadline).finally(() => { pending = undefined; });
      return pending;
    },
  };
}
