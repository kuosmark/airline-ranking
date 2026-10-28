import { REFRESH_INTERVAL_MS, type Snapshot } from '../shared/ranking.ts';

interface CountEntry { id: string; name: string; count: number }
export interface HistoryRecord {
  schemaVersion: 1;
  countingVersion: 1;
  referenceVersion: string;
  observedAt: string;
  scheduledSlot: number;
  airborneCount: number;
  operators: CountEntry[];
  aircraftTypes: CountEntry[];
  unknownOperatorCount: number;
  unknownTypeCount: number;
}

export interface HistoryCollector {
  referenceVersion: string;
  write(record: HistoryRecord): Promise<void>;
  report(event: 'failed' | 'dropped' | 'invalid'): void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}
function isCountList(value: unknown, pattern: RegExp): value is CountEntry[] {
  if (!Array.isArray(value)) { return false; }
  return value.every((row: unknown) => isRecord(row) &&
    Object.keys(row).length === 3 && typeof row['id'] === 'string' && pattern.test(row['id']) &&
    typeof row['name'] === 'string' && row['name'].trim().length > 0 && isCount(row['count'])) &&
    new Set(value.map((row: CountEntry) => row.id)).size === value.length;
}

export function isHistoryRecord(value: unknown): value is HistoryRecord {
  if (!isRecord(value) || Object.keys(value).length !== 10 ||
      value['schemaVersion'] !== 1 || value['countingVersion'] !== 1 ||
      typeof value['referenceVersion'] !== 'string' || !/^[a-f0-9]{64}$/.test(value['referenceVersion']) ||
      typeof value['observedAt'] !== 'string' || !Number.isFinite(Date.parse(value['observedAt'])) ||
      new Date(value['observedAt']).toISOString() !== value['observedAt'] ||
      !isCount(value['scheduledSlot']) || !Number.isSafeInteger(value['scheduledSlot'] * REFRESH_INTERVAL_MS) ||
      !isCount(value['airborneCount']) || !isCount(value['unknownOperatorCount']) || !isCount(value['unknownTypeCount']) ||
      !isCountList(value['operators'], /^[A-Z]{3}$/) || !isCountList(value['aircraftTypes'], /^[A-Z0-9]{2,4}$/)) {
    return false;
  }
  return value['operators'].reduce((sum, row) => sum + row.count, value['unknownOperatorCount']) === value['airborneCount'] &&
    value['aircraftTypes'].reduce((sum, row) => sum + row.count, value['unknownTypeCount']) === value['airborneCount'];
}

export function createHistoryRecord(snapshot: Snapshot, scheduledSlot: number, referenceVersion: string): HistoryRecord {
  if (snapshot.isStale || !snapshot.aircraftTypeRankings || !snapshot.unassignedAircraft || !snapshot.unknownAircraftType) {
    throw new Error('History requires a complete fresh snapshot');
  }
  // Explicit projection: never spread a snapshot or its rows into the archive.
  const counts = (rows: CountEntry[]) => rows.map(({ id, name, count }) => ({ id, name, count })).sort((a, b) => a.id.localeCompare(b.id));
  const record = {
    schemaVersion: 1, countingVersion: 1, referenceVersion,
    observedAt: new Date(snapshot.updatedAt).toISOString(), scheduledSlot,
    airborneCount: snapshot.airborneCount,
    operators: counts(snapshot.airlines), aircraftTypes: counts(snapshot.aircraftTypeRankings),
    unknownOperatorCount: snapshot.unassignedAircraft.count, unknownTypeCount: snapshot.unknownAircraftType.count,
  };
  if (!isHistoryRecord(record)) { throw new Error('Invalid historical counts'); }
  return record;
}
