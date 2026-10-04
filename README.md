# Airline Ranking

A minimalist Angular leaderboard showing observed airborne aircraft for the top 100 observed operators, built as a personal learning project.

A TypeScript backend fetches a worldwide SkyLink snapshot on startup and every 15 minutes. The UI reads the cached ranking and animates changes when a new snapshot arrives.

![Airline leaderboard showing rank movement](docs/preview.png)

Preview uses synthetic data to illustrate rank indicators and the aircraft-type breakdown.

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

The browser checks the cache every minute. The sticky leaderboard header shows the snapshot age and any delay notice while scrolling; the exact UTC timestamp is in the footer, and the relative age updates on each browser check. A decorative aircraft glides into the title once on page load. Row changes and counts animate briefly; reduced-motion preferences disable these animations. If an update fails, the last successful ranking and its original timestamp remain visible with a delay notice. Before the first successful snapshot, the UI shows an unavailable message and retries automatically.

Click an airline to expand its aircraft-type breakdown; only one row is expanded at a time. The same cached snapshot supplies both the total and its breakdown, without extra provider requests. The expanded airline stays open when the ranking changes, and its total updates immediately with its breakdown. Other totals retain their brief count animation with a neutral update highlight. Breakdown bars show each type’s share of that operator’s total, alongside the exact counts.

Rank indicators compare each operator's position with the previous successful, distinct snapshot: a green upward wing-shaped chevron for a higher rank, a red downward chevron for a lower rank, and “New” for an operator absent from the previous top 100 (including returning operators). A dash marks unchanged ranks or an unavailable comparison (including the first snapshot). Movement has its own column before the rank. Equal aircraft counts still use prefix order, so indicators reflect row position rather than count changes. Screen-reader text describes each indicator.

Comparison happens in the backend, so browser reloads and different viewers receive the same indicators. Repeated timestamps, name-only updates and failed fetches do not advance the comparison. After an outage, the next successful snapshot compares with the last successful one, even if the gap exceeds 15 minutes. Comparison state is held only in memory; the first snapshot after a backend restart has no indicators. This feature adds no provider calls or persistent history.

Aircraft types come from SkyLink's `aircraft_type` field. Common ICAO designators and a few exact model aliases are normalized using the [FAA type table](https://www.faa.gov/air_traffic/publications/atpubs/foa_html/appendix_3.html), with labels in `backend/aircraft-types.ts`. Distinct variants remain separate. Unrecognized labels retain the provider wording with normalized whitespace and capitalization; missing or invalid values become “Unknown type”. Metadata can be incomplete or incorrect, and unfamiliar aliases may remain separate. Breakdown counts always sum to the airline total.

One continuously running backend makes approximately 96 aircraft-snapshot requests per day. Every restart adds an immediate request; opening more browser tabs does not trigger more provider requests. Failed requests are retried at the next scheduled refresh.

## Checks

Run `npm run check` before committing. GitHub Actions runs the same command on pull requests and pushes to `main`.

| Command | Purpose |
| --- | --- |
| `npm run check` | Run linting, backend type checking, tests, and the production build |
| `npm run lint` | Check strict TypeScript rules, Angular conventions, and template accessibility |
| `npm run lint:fix` | Apply automatic lint fixes |
| `npm run typecheck:backend` | Type-check the backend and shared ranking types |
| `npm test` | Test counting, ordering, snapshot ages, response validation, caching, and HTTP failure behavior |
| `npm run build` | Build the frontend into `dist/airline-ranking` |

Tests use Node's built-in test runner and synthetic data. They do not require an API key or contact SkyLink. Lint warnings fail the check.

## Scope

The backend uses Node's built-in HTTP server and fetch API. The latest ranking lives in memory; operator names and lookup cost controls are persisted in an untracked JSON cache. There is no database or deployment configuration.

Aircraft are deduplicated by ICAO24, keeping the newest observation (ground wins equal-time conflicts). We count only explicitly airborne aircraft observed within five minutes of the snapshot. Callsigns must contain three letters followed by one to four letters or digits. Callsigns matching the aircraft registration after removing spaces and hyphens are excluded. Malformed, incomplete, or outdated global snapshots are rejected.

Every qualifying prefix is counted, including cargo and regional operators. The 100 highest counts are selected, with prefix order breaking ties; fewer qualifying operators means fewer rows. Separate prefixes are not combined under a brand. The format check is a heuristic, not proof of operator identity. These are observed counts, dependent on SkyLink coverage, not worldwide fleet totals.

## Operator names and lookup costs

Names come from [SkyLink's airline lookup](https://skylinkapi.com/docs/v31/airlines/) for prefixes in the top 100 only. Matching records that agree on a name use that name; conflicting names use a single distinct active name if available, otherwise the prefix. A lone inactive record can still supply a name. Missing results (HTTP 404 or an empty array) and unresolved duplicate names are cached as `null`. Provider names can be outdated. Names do not control eligibility or tie-breaking.

The backend publishes the ranking before directory lookups complete. Browsers may initially display prefixes, then receive names on their next normal poll. Name-only updates keep the snapshot timestamp and do not restart count animations.

`.cache/operator-names.json` is created relative to the project root and excluded from Git. For example:

```json
{
  "names": {
    "FIN": { "name": "Finnair", "checkedAt": "2026-10-04T21:00:00.000Z" },
    "WMT": { "name": null, "checkedAt": "2026-10-04T21:00:00.000Z" }
  },
  "attempts": [1791147600000],
  "cooldownUntil": 0
}
```

`checkedAt` is an ISO timestamp. `attempts` and `cooldownUntil` use Unix milliseconds. Constants in `backend/operator-directory.ts` enforce:

| Control | Value |
| --- | --- |
| Successful name refresh | 30 days |
| Missing or ambiguous name refresh | 7 days |
| Cooldown after any failed lookup | 24 hours |
| Maximum lookup attempts | 1,000 per rolling 30 days |

Expiry is checked only for the current top 100 during scheduled snapshot updates. There is no separate lookup timer. Requests run sequentially; overlapping refreshes share work. Every attempt, including errors, is persisted **before** contacting SkyLink. A provisional cooldown is saved too, so a crash during a request cannot immediately retry on restart. Successful responses clear it; failures stop the batch, retain previous names, and keep a 24-hour cooldown. Authentication and quota errors follow the same stop rule. Missing results are completed lookups, not failures.

Writes replace the cache via a temporary file and rename. Invalid or unreadable caches disable directory calls for that process. Failed writes also disable further calls; cached names or prefixes remain available. Fix the file or filesystem problem and restart to recover. A genuinely absent cache initializes a new budget; **do not delete the file to refresh names**, because this also discards quota history. To force one name refresh, stop the backend and remove only that prefix from `names`, preserving `attempts` and `cooldownUntil`.

A continuously running backend makes 2,880 snapshot calls in 30 days, plus at most 1,000 directory attempts in that rolling period. A 31-day billing period has 2,976 scheduled snapshot calls, but the rolling directory window does not align with billing dates. Startup fetches, manual tests, other instances, and other API usage are additional. This is a directory guardrail, **not an account-wide spending cap**. Monitor actual usage in the provider account.

The cache requires one backend process and durable local storage. Retain it across restarts; sharing it between concurrent processes is unsupported. AWS deployment will need an appropriate persistent storage strategy. Cached provider output must remain outside the public repository and is subject to [SkyLink's terms](https://skylinkapi.com/terms/).

Development follows the lightweight branch, pull request, and squash-merge workflow in [AGENTS.md](AGENTS.md).
