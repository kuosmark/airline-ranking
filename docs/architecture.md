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
| `IS_HISTORY_ENABLED` | Set to `true` by CDK to collect counts; absent or other values leave collection disabled |

The scheduler must supply `scheduledAt` as its original scheduled UTC timestamp, run every 15 minutes, and use a single concurrent Lambda invocation. Events older than 15 minutes are rejected. A persistent slot reservation is written before fetching SkyLink; duplicate deliveries or restarts in that slot cannot repeat the paid snapshot call. Failed attempts wait until the next slot. A retry can republish the saved ranking without another provider request, preserving its operator details if the directory cache is unavailable.

Before enabling the schedule, initialize `refresh-state.json` with `{"lastAttemptSlot":null,"snapshot":null,"snapshotAttempts":[]}` only for a new poller, and preserve the existing `operator-names.json` cache. Its provider migration runs automatically on first load, preserving paid lookup history while discarding old labels. Missing, unreadable or invalid cloud state blocks polling rather than silently resetting these controls. State writes require the S3 version just read; a conflicting writer stops without making its reserved provider call.

The latest snapshot and its rank changes survive restarts. The ranking is published before lookups and again after enrichment. Lookups stop when execution time is running low and continue on a later scheduled refresh; the existing TTL, rolling cap and failure cooldown still apply. SDK retries are disabled, and provider requests retain their timeouts (15 seconds for snapshots, ten seconds for directory lookups). A failed publication leaves the last published object available; a later invocation can recover it from saved state.

Lambda errors identify a fixed failure stage: configuration, API key retrieval, operator cache loading, snapshot fetching, ranking publication, or the remaining refresh processing. An allowlisted category distinguishes timeouts, access denials and conflicting writes; other errors use “unknown”. Raw error messages, provider responses and credentials are not included.

Use one active poller per API key. Stop the local backend when enabling the cloud schedule: local and S3 budgets are separate and cannot enforce an account-wide cap. Do not delete or replace cloud state as a refresh mechanism. Confirm AWS spending protection before deployment; application request controls do not cap AWS charges.

## Counts-only history collection

Production also archives aggregate counts in the private state bucket. This is collection only: no historical API, summaries or charts are provided yet, and the local backend does not collect history. There are no additional provider requests.

`backend/history.ts` explicitly selects the historical fields; it never copies entire snapshot objects. Each record contains schema version 1, counting version 1, the SHA-256 fingerprint of the bundled Mictronics references, source `observedAt`, the original `scheduledSlot` (UTC epoch divided into 15-minute intervals), total airborne count, operator/type IDs, names and counts, and the two unknown counts. Names and classifications reflect collection time. Counting version must change when assignment/counting rules change; the reference fingerprint follows both infrastructure and code-only releases. These records cannot reconstruct or reclassify individual aircraft observations.

Complete count dimensions are required, even though legacy live snapshots may omit them. Counts must be nonnegative safe integers, IDs unique and valid, and operator counts plus unknown operators and type counts plus unknown types must each equal the total. The unknown groups overlap and are not summed together. Coordinates, aircraft identifiers, callsigns, individual observations, reported descriptions and nested breakdowns are excluded. Empty complete snapshots are allowed; failed refreshes are gaps, not zero observations.

`backend/history-storage.ts` writes gzip JSON using a source-timestamp key:

```text
history/counts/v1/YYYY-MM-DD/<observedAt>.json.gz
```

Conditional creation preserves the first record for an observation. An existing-object response is success; conflicts, timeouts and other errors remain failures. Source time controls the archive path and future time buckets. The original scheduled slot describes collection coverage, not observation time. Repeated source timestamps and duplicate deliveries do not become new observations; legacy saved snapshots are not backfilled.

The workflow persists a counts-only `pendingHistory` record together with the new snapshot before attempting archival. Each invocation first retries any pending record, without fetching SkyLink. Successful archival clears the pending record through the existing conditional state store. Fresh records are archived separately from the two live publication steps, before initial publication. An archive request is bounded to five seconds and failure does not skip live publication or metadata enrichment. The invocation reports a failure after those steps so the existing Lambda alarm covers archival failures too.

Recovery is deliberately bounded to one pending record. If its next recovery attempt fails and a new valid observation arrives, a fixed `Counts history dropped` log marks the gap before the newer pending record replaces it. A prolonged outage can therefore lose historical samples while live updates continue. Invalid new count projections are reported without archiving them. Existing state validation and paid-request reservation protections remain intact. A process failure between provider retrieval and state persistence can still lose that observation; history is not guaranteed delivery.

Objects become eligible for S3 lifecycle expiration 365 days after creation. In the versioned state bucket, superseded versions remain for up to the configured seven-day lifecycle interval; expired delete markers are cleaned up. Lifecycle deletion is asynchronous. Future readers must independently enforce the observation-time retention window. CloudFront has no access to these archives, and the refresh role can only create objects under the history prefix, not list, read or delete them.

The counts-only scope reduces replication of provider output but does not establish explicit long-term retention permission. SkyLink's published terms allow analysis and product display and restrict substantially replicating databases; continued retention and reuse remain subject to provider terms.
