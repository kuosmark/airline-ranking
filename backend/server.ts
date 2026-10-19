import { createHash } from 'node:crypto';
import { compactSnapshot } from '../shared/snapshot-wire.ts';
import { createServer } from 'node:http';
import { compareRanks, isSnapshotStale, type Snapshot } from '../shared/ranking.ts';

export function createRankingService(load: () => Promise<Snapshot>, now = Date.now, enrich?: (snapshot: Snapshot) => Promise<Snapshot>) {
  let snapshot: Snapshot | null = null;
  let isRefreshFailed = false;
  let pending: Promise<void> | undefined;

  return {
    read(): Snapshot | null {
      if (!snapshot) { return null; }
      return {
        ...snapshot,
        isStale: isRefreshFailed || isSnapshotStale(snapshot, now()),
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
          const isNewSnapshot = !snapshot || Date.parse(next.updatedAt) > Date.parse(snapshot.updatedAt);
          if (isNewSnapshot) { snapshot = compareRanks(next, snapshot); }
          isRefreshFailed = false;
          if (enrich && snapshot) {
            try { snapshot = await enrich(snapshot); }
            catch { console.error('Operator names unavailable; keeping the current ranking.'); }
          }
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
    if (request.url !== '/api/ranking' && request.url !== '/api/ranking-v2') {
      response.writeHead(404).end(JSON.stringify({ error: 'Not found' }));
      return;
    }
    if (request.method !== 'GET') {
      response.setHeader('Allow', 'GET');
      response.writeHead(405).end(JSON.stringify({ error: 'Method not allowed' }));
      return;
    }
    const snapshot = service.read();
    if (!snapshot) {
      response.writeHead(503).end(JSON.stringify({ error: 'Ranking is not available yet' }));
      return;
    }
    const body = JSON.stringify(request.url === '/api/ranking-v2' ? compactSnapshot(snapshot) : snapshot);
    const etag = `"${createHash('sha256').update(body).digest('hex')}"`;
    response.setHeader('ETag', etag);
    if (request.headers['if-none-match'] === etag) {
      response.writeHead(304).end();
      return;
    }
    response.writeHead(200).end(body);
  });
}
