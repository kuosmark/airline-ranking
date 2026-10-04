# Airline Ranking

A minimalist Angular leaderboard for ten airlines, showing observed aircraft airborne.

## Run locally

Requires Node.js 22.12+ (22.x) or 24.x.

```sh
npm install
npm start
```

Open http://127.0.0.1:4200. Use **Show sample update** to preview row movement and a 1.5-second count transition. Reduced-motion preferences disable animation.

```sh
npm run build
```

Run `npm run check` before committing: it runs linting, ranking tests, and the production build, stopping on the first failure.
Run `npm test` for the ranking tests alone. They use Node's built-in test runner with TypeScript type stripping; no additional test framework is needed.

Check code quality with `npm run lint`, or apply safe automatic fixes with `npm run lint:fix`.
ESLint checks TypeScript with strict type-aware rules, Angular conventions, and template accessibility. All warnings fail the check. Rule versions are pinned so upgrades are deliberate.

This frontend uses two illustrative snapshots, with no API requests. Counts follow selected airline callsigns; regional flights using other callsigns are excluded. SkyLink integration and a shared 15-minute backend refresh are the next step. The existing `.env` is private and is not used by the frontend.
