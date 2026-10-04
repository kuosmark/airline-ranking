# Airline Ranking

A minimalist Angular leaderboard showing observed airborne aircraft for 100 selected passenger airlines, built as a personal learning project.

A TypeScript backend fetches a worldwide SkyLink snapshot on startup and every 15 minutes. The UI reads the cached ranking and animates changes when a new snapshot arrives.

![Airline leaderboard showing observed airborne counts](docs/preview.png)

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

Aircraft count toward an airline when their normalized callsign starts with its selected ICAO prefix, `is_on_ground` is explicitly false, and `last_seen` is within five minutes of the provider snapshot. Duplicate ICAO24 addresses use the newest observation. Malformed, incomplete, or outdated global responses are rejected. Each selected prefix is counted separately; other operators flying for the same brand are not combined. These are observed counts, not complete fleet totals, and depend on SkyLink's coverage. Selecting passenger airlines does not exclude cargo flights that use the same prefix.

The fixed selection in [backend/airlines.ts](backend/airlines.ts) is based on [FlightsFrom's top 100 by daily departures](https://www.flightsfrom.com/top-100-airlines), dated 1 October 2026. It is a starting selection, not a ranking by annual passengers or a comprehensive list of operators. The application ranks these airlines by observed airborne aircraft and keeps airlines with zero observations in the list.

ICAO prefixes were checked against the [FAA designator directory](https://www.faa.gov/air_traffic/publications/atpubs/cnt_html/chap3_section_3.html). Brand entries are mapped to one named operator: for example, easyJet UK (`EZY`), LATAM Airlines Chile (`LAN`), Avianca Colombia (`AVA`), and AirAsia Malaysia (`AXM`). Wizz Air Hungary (`WZZ`) and Wizz Air Malta (`WMT`) have separate rows. The source's “Gestair” / `G5` label is corrected to China Express Airlines (`HXA`) using [IATA's carrier record](https://www.iata.org/en/about/members/airline-list/china-express-airlines/480/).

Display names use the airlines' own public-facing names, with a source link beside every entry in `backend/airlines.ts` (checked 4 October 2026). Airline websites are the primary reference; IATA's member records are the fallback for Aeroflot and Loong Air, whose English names could not be verified on their own sites. Legal suffixes are omitted, and operator or country qualifiers are retained where needed to clarify which prefix is counted. These are display labels, not a register of full legal company names. Changes to names should be checked against the linked source.

Development follows the lightweight branch, pull request, and squash-merge workflow in [AGENTS.md](AGENTS.md).
