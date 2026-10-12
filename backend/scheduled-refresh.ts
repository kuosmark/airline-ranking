import { compareRanks, isValidCoordinates, REFRESH_INTERVAL_MS, type Snapshot } from '../shared/ranking.ts';
import type { JsonStore } from './storage.ts';
import type { createOperatorDirectory } from './operator-directory.ts';

export const SNAPSHOT_WINDOW_MS = 32 * 24 * 60 * 60 * 1000;
export const MAX_SNAPSHOT_ATTEMPTS = 3_100;
interface RefreshState { lastAttemptSlot: number | null; snapshot: Snapshot | null; snapshotAttempts: number[] }
interface RefreshOptions {
  state: JsonStore;
  directory: Awaited<ReturnType<typeof createOperatorDirectory>>;
  fetchSnapshot: () => Promise<Snapshot>;
  publish: (snapshot: Snapshot) => Promise<void>;
  scheduledAt: string;
  deadline: number;
  now?: () => number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function isAircraftPosition(value: unknown): boolean {
  if (!isRecord(value)) { return false; }
  const altitude = value['altitudeFt'];
  return typeof value['id'] === 'string' && /^[a-f\d]{6}$/.test(value['id']) &&
    typeof value['callsign'] === 'string' && typeof value['aircraftType'] === 'string' &&
    isValidCoordinates(value['latitude'], value['longitude']) &&
    (altitude === undefined || (typeof altitude === 'number' && Number.isFinite(altitude)));
}

function isAircraftType(value: unknown): boolean {
  if (!isRecord(value)) { return false; }
  const count = value['count'];
  return typeof value['name'] === 'string' && typeof count === 'number' &&
    Number.isInteger(count) && count >= 0;
}

function isAirline(value: unknown): boolean {
  if (!isRecord(value)) { return false; }
  const id = value['id'];
  const count = value['count'];
  if (typeof id !== 'string' || !/^[A-Z]{3}$/.test(id) || typeof value['name'] !== 'string' ||
      typeof count !== 'number' || !Number.isInteger(count) || count < 0) { return false; }

  const country = value['country'];
  const iata = value['iata'];
  const icao = value['icao'];
  if (country !== undefined && country !== null && typeof country !== 'string') { return false; }
  if (iata !== undefined && iata !== null && (typeof iata !== 'string' || !/^[A-Z\d]{2}$/.test(iata))) { return false; }
  if (icao !== undefined && icao !== null && icao !== id) { return false; }

  const positions = value['positions'];
  if (positions !== undefined && (!Array.isArray(positions) || positions.length > count ||
      !positions.every(isAircraftPosition))) { return false; }
  const movement = value['rankChange'];
  if (movement !== undefined && movement !== 'new' &&
      (typeof movement !== 'number' || !Number.isInteger(movement))) { return false; }
  const aircraftTypes = value['aircraftTypes'];
  return Array.isArray(aircraftTypes) && aircraftTypes.every(isAircraftType);
}

function isSnapshot(value: unknown): value is Snapshot {
  return isRecord(value) && typeof value['updatedAt'] === 'string' && Number.isFinite(Date.parse(value['updatedAt'])) &&
    typeof value['isStale'] === 'boolean' && Array.isArray(value['airlines']) && value['airlines'].every(isAirline);
}

function readState(value: unknown): RefreshState {
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
  return { lastAttemptSlot: slot, snapshot, snapshotAttempts };
}

export async function refreshScheduledRanking(options: RefreshOptions): Promise<void> {
  const { state: store, directory, publish, deadline } = options;
  const now = options.now ?? Date.now;
  const scheduledTime = Date.parse(options.scheduledAt);
  if (!Number.isFinite(scheduledTime) || scheduledTime > now() + 60_000 || now() - scheduledTime >= REFRESH_INTERVAL_MS) {
    throw new Error('Invalid or expired scheduled event');
  }
  const state = readState(await store.read());
  const slot = Math.floor(scheduledTime / REFRESH_INTERVAL_MS);
  if (state.lastAttemptSlot !== null && slot <= state.lastAttemptSlot) {
    // Recover a failed publication without repeating the provider request.
    if (state.snapshot) {
      const snapshot = directory.isAvailable() ? directory.apply(state.snapshot) : state.snapshot;
      await publish(snapshot);
    }
    return;
  }
  if (!directory.isAvailable() || now() + 30_000 >= deadline) { throw new Error('Refresh cannot safely start'); }
  state.snapshotAttempts = state.snapshotAttempts.filter(attempt => now() - attempt < SNAPSHOT_WINDOW_MS);
  if (state.snapshotAttempts.length >= MAX_SNAPSHOT_ATTEMPTS) { throw new Error('SkyLink snapshot request limit reached'); }
  state.lastAttemptSlot = slot;
  state.snapshotAttempts.push(now());
  await store.write(state);
  const next = await options.fetchSnapshot();
  if (state.snapshot && Date.parse(next.updatedAt) < Date.parse(state.snapshot.updatedAt)) {
    throw new Error('Snapshot moved backwards');
  }
  const previous = state.snapshot;
  const current = previous && next.updatedAt === previous.updatedAt ? previous : compareRanks(next, previous);
  state.snapshot = directory.apply(current);
  await store.write(state);
  await publish(state.snapshot);
  await directory.refresh(state.snapshot.airlines.map(airline => airline.id), deadline - 10_000);
  if (!directory.isAvailable()) { throw new Error('Directory state persistence failed'); }
  state.snapshot = directory.apply(state.snapshot);
  await store.write(state);
  await publish(state.snapshot);
}
