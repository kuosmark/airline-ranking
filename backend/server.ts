import { createServer } from 'node:http';
import type { Snapshot } from '../shared/ranking.ts';
import { REFRESH_INTERVAL_MS } from './skylink.ts';

export function createRankingService(load: () => Promise<Snapshot>, now = Date.now) {
  let snapshot: Snapshot | null = null;
  let isRefreshFailed = false;
  let pending: Promise<void> | undefined;

  return {
    read(): Snapshot | null {
      if (!snapshot) { return null; }
      return {
        ...snapshot,
        isStale: isRefreshFailed || now() - Date.parse(snapshot.updatedAt) > REFRESH_INTERVAL_MS + 30_000,
      };
    },
    refresh(): Promise<void> {
      if (pending) { return pending; }
      pending = (async () => {
        try {
          const next = await load();
          if (snapshot && Date.parse(next.updatedAt) < Date.parse(snapshot.updatedAt)) {
            throw new Error('Snapshot moved backwards');
          }
          snapshot = next;
          isRefreshFailed = false;
        } catch {
          isRefreshFailed = true;
          // Do not log provider responses or credentials.
          console.error('Ranking refresh failed; waiting for the next scheduled refresh.');
        }
      })().finally(() => { pending = undefined; });
      return pending;
    },
  };
}

export function createRankingServer(service: Pick<ReturnType<typeof createRankingService>, 'read'>) {
  return createServer((request, response) => {
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.setHeader('Cache-Control', 'no-store');
    if (request.url !== '/api/ranking') {
      response.writeHead(404).end(JSON.stringify({ error: 'Not found' }));
      return;
    }
    if (request.method !== 'GET') {
      response.setHeader('Allow', 'GET');
      response.writeHead(405).end(JSON.stringify({ error: 'Method not allowed' }));
      return;
    }
    const snapshot = service.read();
    response.writeHead(snapshot ? 200 : 503).end(JSON.stringify(snapshot ?? { error: 'Ranking is not available yet' }));
  });
}
