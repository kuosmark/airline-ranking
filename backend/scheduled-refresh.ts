import { type Snapshot } from '../shared/ranking.ts';
import { compareRanks } from './server.ts';
import { REFRESH_INTERVAL_MS } from './skylink.ts';
import type { JsonStore } from './storage.ts';
import type { createOperatorDirectory } from './operator-directory.ts';

interface RefreshState { lastAttemptSlot: number | null; snapshot: Snapshot | null }
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
function isSnapshot(value: unknown): value is Snapshot {
  if (!isRecord(value) || typeof value['updatedAt'] !== 'string' || !Number.isFinite(Date.parse(value['updatedAt'])) ||
      typeof value['isStale'] !== 'boolean' || !Array.isArray(value['airlines']) || value['airlines'].length > 100) { return false; }
  return value['airlines'].every((airline: unknown) => {
    if (!isRecord(airline)) { return false; }
    const count = airline['count'];
    const movement = airline['rankChange'];
    const country = airline['country'];
    return typeof airline['id'] === 'string' && /^[A-Z]{3}$/.test(airline['id']) &&
      typeof airline['name'] === 'string' && typeof count === 'number' && Number.isInteger(count) && count >= 0 &&
      (country === undefined || country === null || typeof country === 'string') &&
      (movement === undefined || movement === 'new' || (typeof movement === 'number' && Number.isInteger(movement))) &&
      Array.isArray(airline['aircraftTypes']) && airline['aircraftTypes'].every((type: unknown) =>
        isRecord(type) && typeof type['name'] === 'string' && typeof type['count'] === 'number' &&
        Number.isInteger(type['count']) && type['count'] >= 0);
  });
}

function readState(value: unknown): RefreshState {
  if (!isRecord(value)) { throw new Error('Scheduled state must be initialized before polling'); }
  const slot = value['lastAttemptSlot'];
  const snapshot = value['snapshot'];
  if (!(slot === null || (typeof slot === 'number' && Number.isSafeInteger(slot) && slot >= 0)) ||
      !(snapshot === null || isSnapshot(snapshot))) { throw new Error('Invalid scheduled state'); }
  return { lastAttemptSlot: slot, snapshot };
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
    if (state.snapshot) { await publish(state.snapshot); }
    return;
  }
  if (!directory.isAvailable() || now() + 30_000 >= deadline) { throw new Error('Refresh cannot safely start'); }
  state.lastAttemptSlot = slot;
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
