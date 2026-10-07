import { createOperatorDirectory } from './operator-directory.ts';
import { createRankingServer, createRankingService } from './server.ts';
import { fetchSnapshot, REFRESH_INTERVAL_MS } from './skylink.ts';

const apiKey = process.env['SKYLINK_API_KEY'];
if (!apiKey?.trim()) { throw new Error('Set SKYLINK_API_KEY in .env before starting the backend.'); }

const directory = await createOperatorDirectory('.cache/operator-names.json');
const service = createRankingService(
  async () => directory.apply(await fetchSnapshot(apiKey)),
  Date.now,
  async snapshot => {
    await directory.refresh(snapshot.airlines.map(airline => airline.id));
    return directory.apply(snapshot);
  },
);
const server = createRankingServer(service);
server.listen(3000, '127.0.0.1', () => {
  console.log('Ranking API listening on http://127.0.0.1:3000');
  void service.refresh();
  const timer = setInterval(() => { void service.refresh(); }, REFRESH_INTERVAL_MS);
  const stop = () => {
    clearInterval(timer);
    server.close();
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
});
