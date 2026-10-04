# Airline Ranking

A minimalist Angular leaderboard showing observed airborne aircraft for ten airlines, built as a personal learning project.

A TypeScript backend fetches a worldwide SkyLink snapshot on startup and every 15 minutes. The UI reads the cached ranking and animates changes when a new snapshot arrives.

![Airline leaderboard showing ten airlines with observed airborne counts](docs/preview.png)

## Run locally

Requires Node.js 22.13+ (22.x) or 24.x. GitHub Actions uses Node.js 22.

```sh
npm ci
```

Create an untracked `.env` file in the project root:

```dotenv
SKYLINK_API_KEY=your-api-key
```

Start the backend and frontend in separate terminals:

```sh
npm run backend
```

```sh
npm start
```

Open http://127.0.0.1:4200. Both services listen on loopback only. Angular proxies `/api/ranking` to the backend on port 3000; the API key stays on the backend.

The browser checks the cache every minute. Row changes and counts animate briefly; reduced-motion preferences disable animation. If an update fails, the last successful ranking and its original timestamp remain visible with a delay notice. Before the first successful snapshot, the UI shows an unavailable message and retries automatically.

One continuously running backend makes approximately 96 provider requests per day. Every restart adds an immediate request; opening more browser tabs does not trigger more provider requests. Failed requests are retried at the next scheduled refresh.

## Checks

Run `npm run check` before committing. GitHub Actions runs the same command on pull requests and pushes to `main`.

| Command | Purpose |
| --- | --- |
| `npm run check` | Run linting, backend type checking, tests, and the production build |
| `npm run lint` | Check strict TypeScript rules, Angular conventions, and template accessibility |
| `npm run lint:fix` | Apply automatic lint fixes |
| `npm run typecheck:backend` | Type-check the backend and shared ranking types |
| `npm test` | Test counting, ordering, response validation, caching, and HTTP failure behavior |
| `npm run build` | Build the frontend into `dist/airline-ranking` |

Tests use Node's built-in test runner and synthetic data. They do not require an API key or contact SkyLink. Lint warnings fail the check.

## Scope

The backend uses Node's built-in HTTP server and fetch API. It stores only the latest successful ranking in memory. There is no database or deployment configuration.

Aircraft count toward an airline when their normalized callsign starts with its selected ICAO prefix, `is_on_ground` is explicitly false, and `last_seen` is within five minutes of the provider snapshot. Duplicate ICAO24 addresses use the newest observation. Malformed, incomplete, or outdated global responses are rejected. Regional flights using other callsigns are excluded; these are observed counts, not complete fleet totals, and depend on SkyLink's coverage.

Selected prefixes: Air Canada (ACA), Korean Air (KAL), British Airways (BAW), Iberia (IBE), Aer Lingus (EIN), Cathay Pacific (CPA), American Airlines (AAL), Delta Air Lines (DAL), Air France (AFR), and KLM Royal Dutch Airlines (KLM).

Development follows the lightweight branch, pull request, and squash-merge workflow in [AGENTS.md](AGENTS.md).
