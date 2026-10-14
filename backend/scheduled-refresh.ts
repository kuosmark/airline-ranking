import { compareRanks, REFRESH_INTERVAL_MS, type Snapshot } from '../shared/ranking.ts';
import type { JsonStore } from './storage.ts';
import { readRefreshState, SNAPSHOT_WINDOW_MS } from './refresh-state.ts';
import type { createOperatorDirectory } from './operator-directory.ts';

export const MAX_SNAPSHOT_ATTEMPTS = 3_100;
interface RefreshOptions {
  state: JsonStore;
  directory: Awaited<ReturnType<typeof createOperatorDirectory>>;
  fetchSnapshot: () => Promise<Snapshot>;
  publish: (snapshot: Snapshot) => Promise<void>;
  scheduledAt: string;
  deadline: number;
  now?: () => number;
}

export async function refreshScheduledRanking(options: RefreshOptions): Promise<void> {
  const { state: store, directory, publish, deadline } = options;
  const now = options.now ?? Date.now;
  const scheduledTime = Date.parse(options.scheduledAt);
  if (!Number.isFinite(scheduledTime) || scheduledTime > now() + 60_000 || now() - scheduledTime >= REFRESH_INTERVAL_MS) {
    throw new Error('Invalid or expired scheduled event');
  }
  const state = readRefreshState(await store.read());
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
