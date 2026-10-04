# Airline Ranking

A minimalist Angular leaderboard for ten airlines, built as a personal learning project.

The current version runs locally with **illustrative sample data**. It demonstrates ranking, animated row changes, and count transitions; it does not fetch live aircraft data.

![Airline leaderboard showing ten airlines with sample airborne counts](docs/preview.jpg)

## Run locally

Requires Node.js 22.13+ (22.x) or 24.x. GitHub Actions uses Node.js 22.

```sh
npm ci
npm start
```

Open http://127.0.0.1:4200. Use **Show sample update** to preview row movement and a 1.5-second count transition. Reduced-motion preferences disable animation.

No API key or `.env` file is needed for this preview.

## Checks

Run `npm run check` before committing. GitHub Actions runs the same command on pull requests and pushes to `main`.

| Command | Purpose |
| --- | --- |
| `npm run check` | Run linting, tests, and the production build |
| `npm run lint` | Check strict TypeScript rules, Angular conventions, and template accessibility |
| `npm run lint:fix` | Apply automatic lint fixes |
| `npm test` | Test count ordering, alphabetical ties, zero counts, input preservation, and empty rankings |
| `npm run build` | Build the application into `dist/airline-ranking` |

Tests use Node's built-in test runner. Lint warnings fail the check.

## Scope

Angular and TypeScript handle the UI; browser animation APIs move the rows. The app contains two sample snapshots and has no backend or deployment yet.

The intended live-data approach is to count observed aircraft by selected airline callsigns, excluding regional flights using other callsigns. That filtering is not implemented in this preview. The next step is a SkyLink backend refresh every 15 minutes; observed counts will depend on the provider's coverage.

Development follows the lightweight branch, pull request, and squash-merge workflow in [AGENTS.md](AGENTS.md).
