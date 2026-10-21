# Architecture

[Back to overview](../README.md)

## Scope

The frontend separates polling and page layout (`app`) from leaderboard interactions (`ranking-board`), search/status (`ranking-toolbar`), operator metadata (`operator-details`), shared type breakdowns (`aircraft-group-details`) and aircraft selection (`aircraft-map`). Each component has separate TypeScript, HTML and scoped CSS files. Global styles contain document defaults, shared design tokens and the screen-reader utility.

The local backend uses Node's built-in HTTP server and fetch API, holding the latest ranking in memory and persisting operator details and lookup cost controls in an untracked JSON cache. In AWS, Lambda persists these in S3. CDK defines the infrastructure in `infra/`; an AWS-native pipeline deploys application changes from `main`.

The browser and scheduled-state reader share `shared/snapshot-validation.ts`. A successful HTTP response with malformed ranking data is rejected before rendering; the browser keeps its last valid snapshot and retries normally. Optional metadata and positions may be absent in older snapshots. New snapshots also carry `airborneCount` and `unassignedAircraft` (count, type breakdown and positions); operator counts plus the unassigned count must equal the airborne total. Both new fields may be absent in older snapshots, whose complete airborne total is not displayed.

`backend/skylink.ts` validates and deduplicates observations before grouping aircraft by operator. `backend/adsbdb.ts` handles operator-detail requests and response parsing; `backend/operator-directory.ts` owns caching, pacing and lookup limits. `backend/operator-cache.ts` validates and migrates stored operator details; `backend/refresh-state.ts` does the same for scheduled snapshot state and request history. `backend/scheduled-refresh.ts` keeps request reservation, fetching and publication in one workflow.

Aircraft are deduplicated by ICAO24, keeping the newest observation (ground wins equal-time conflicts). We count only explicitly airborne aircraft observed within five minutes of the snapshot. Operator assignment requires three letters followed by one to four letters or digits, and a callsign different from the aircraft registration after removing spaces and hyphens. Aircraft without such a callsign remain in the unassigned group. Missing or invalid coordinates omit only the map position, not the aircraft count. Malformed, incomplete, or outdated global snapshots are rejected.

Every qualifying prefix is counted, including cargo and regional operators. All qualifying operators are ranked by count, with prefix order breaking ties. Separate prefixes are not combined under a brand. The format check is a heuristic, not proof of operator identity. These are observed counts, dependent on SkyLink coverage, not worldwide fleet totals.

## Scheduled Lambda handler

`backend/lambda.ts` runs one refresh per invocation and publishes the ranking as `api/ranking` in a private website bucket. The frontend can read this object through CloudFront without a separate HTTP backend. The browser derives staleness from the original snapshot timestamp (15 minutes plus 30 seconds), so a stopped job still produces a delay notice.

The CDK stack packages the handler and defines its permissions and schedule. All Regional resources use the selected AWS Region, `eu-north-1`.

The handler requires:

| Setting | Purpose |
| --- | --- |
| `STATE_BUCKET` | Private bucket containing operator cache and refresh state |
| `WEBSITE_BUCKET` | Private bucket receiving the published ranking |
| `SKYLINK_KEY_PARAMETER` | SSM SecureString parameter name containing the API key |

The scheduler must supply `scheduledAt` as its original scheduled UTC timestamp, run every 15 minutes, and use a single concurrent Lambda invocation. Events older than 15 minutes are rejected. A persistent slot reservation is written before fetching SkyLink; duplicate deliveries or restarts in that slot cannot repeat the paid snapshot call. Failed attempts wait until the next slot. A retry can republish the saved ranking without another provider request, preserving its operator details if the directory cache is unavailable.

Before enabling the schedule, initialize `refresh-state.json` with `{"lastAttemptSlot":null,"snapshot":null,"snapshotAttempts":[]}` only for a new poller, and preserve the existing `operator-names.json` cache. Its provider migration runs automatically on first load, preserving paid lookup history while discarding old labels. Missing, unreadable or invalid cloud state blocks polling rather than silently resetting these controls. State writes require the S3 version just read; a conflicting writer stops without making its reserved provider call.

The latest snapshot and its rank changes survive restarts. The ranking is published before lookups and again after enrichment. Lookups stop when execution time is running low and continue on a later scheduled refresh; the existing TTL, rolling cap and failure cooldown still apply. SDK retries are disabled, and provider requests retain their timeouts (15 seconds for snapshots, ten seconds for directory lookups). A failed publication leaves the last published object available; a later invocation can recover it from saved state.

Lambda errors identify a fixed failure stage: configuration, API key retrieval, operator cache loading, snapshot fetching, ranking publication, or the remaining refresh processing. An allowlisted category distinguishes timeouts, access denials and conflicting writes; other errors use “unknown”. Raw error messages, provider responses and credentials are not included.

Use one active poller per API key. Stop the local backend when enabling the cloud schedule: local and S3 budgets are separate and cannot enforce an account-wide cap. Do not delete or replace cloud state as a refresh mechanism. Confirm AWS spending protection before deployment; application request controls do not cap AWS charges.

