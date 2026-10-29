import { REFRESH_INTERVAL_MS, type Snapshot } from '../shared/ranking.ts';
import { isHistoryRecord, type HistoryRecord } from './history.ts';
import { isSnapshot } from '../shared/snapshot-validation.ts';

export const SNAPSHOT_WINDOW_MS = 32 * 24 * 60 * 60 * 1000;

interface RefreshState {
  lastAttemptSlot: number | null;
  snapshot: Snapshot | null;
  snapshotAttempts: number[];
  pendingHistory: HistoryRecord | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
export function readRefreshState(value: unknown): RefreshState {
  if (!isRecord(value)) { throw new Error('Scheduled state must be initialized before polling'); }
  const slot = value['lastAttemptSlot'];
  const snapshot = value['snapshot'];
  if (!(slot === null || (typeof slot === 'number' && Number.isSafeInteger(slot) && slot >= 0)) ||
      !(snapshot === null || isSnapshot(snapshot))) { throw new Error('Invalid scheduled state'); }
  let snapshotAttempts: number[];
  const attempts = value['snapshotAttempts'];
  if (attempts === undefined) {
    // Older state recorded only the last slot. Assume every preceding slot was used
    // within the window, so upgrading never grants a fresh paid request budget.
    const windowSlots = SNAPSHOT_WINDOW_MS / REFRESH_INTERVAL_MS;
    const count = slot === null ? 0 : Math.min(slot + 1, windowSlots);
    const firstSlot = slot === null ? 0 : slot - count + 1;
    snapshotAttempts = Array.from({ length: count }, (_, index) => (firstSlot + index) * REFRESH_INTERVAL_MS);
  } else {
    if (!Array.isArray(attempts) || !attempts.every((attempt: unknown) =>
      typeof attempt === 'number' && Number.isFinite(attempt) && attempt >= 0)) {
      throw new Error('Invalid SkyLink request history');
    }
    snapshotAttempts = attempts as number[];
  }
  const pendingHistory = value['pendingHistory'] ?? null;
  if (pendingHistory !== null && !isHistoryRecord(pendingHistory)) { throw new Error('Invalid pending history'); }
  return { lastAttemptSlot: slot, snapshot, snapshotAttempts, pendingHistory };
}
