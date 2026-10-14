import type { OperatorDetails } from './adsbdb.ts';

interface OperatorEntry extends OperatorDetails {
  checkedAt: string;
}
interface RequestHistory {
  attempts: number[];
  cooldownUntil: number;
}
export interface OperatorCache extends RequestHistory {
  source: 'adsbdb';
  names: Record<string, OperatorEntry | undefined>;
  legacySkylink?: RequestHistory;
}

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
function isOperatorCache(value: unknown): value is OperatorCache {
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

export function createEmptyOperatorCache(): OperatorCache {
  return { source: 'adsbdb', names: {}, attempts: [], cooldownUntil: 0 };
}

export function readOperatorCache(value: unknown): { cache: OperatorCache; isMigrated: boolean } {
  if (value === null) { return { cache: createEmptyOperatorCache(), isMigrated: false }; }
  if (isOperatorCache(value)) { return { cache: value, isMigrated: false }; }
  if (!isRecord(value) || value['source'] !== undefined || !isHistory(value) || !isRecord(value['names'])) {
    throw new Error('Invalid operator cache');
  }
  // Archive paid request history, but do not reuse SkyLink's operator labels.
  const cache = createEmptyOperatorCache();
  cache.legacySkylink = { attempts: value.attempts, cooldownUntil: value.cooldownUntil };
  return { cache, isMigrated: true };
}
