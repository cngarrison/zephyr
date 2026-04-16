# AGENTS.md — Zephyr Contribution Guide for AI Assistants

## 1. Project Overview

Zephyr is a self-hosted personal weather station system built with Deno and TypeScript (strict mode throughout). It runs as two independent daemons: **engine** ingests weather data and serves a REST/ingest API; **web** is a Fresh v2 SSR UI that proxies API calls to engine. Both compile to self-contained binaries via `deno compile`. All configuration is environment-variable driven — no hardcoded values anywhere.

---

## 2. Critical Rules

1. **Temporal API only** — all timezone-aware date math uses `Temporal` (built into Deno). Never use `Date` for date arithmetic or comparisons.
2. **SI units internally** — values are stored in °C, m/s, mm, hPa, etc. Imperial→SI conversion happens in `engine/src/ingest/normalizer.ts` **only**. Never convert elsewhere.
3. **TypeScript strict** — `noImplicitAny`, explicit return types, no `any`, no `@ts-ignore` without a comment explaining why.
4. **No hardcoded values** — ports, paths, station names, and credentials come from config/env. See `engine/config.ts` and `web/lib/config.ts`.
5. **StorageAdapter is the contract** — all persistence goes through the `StorageAdapter` interface (`engine/src/storage/adapter.ts`). Never import a provider (sqlite/mysql) directly from outside `engine/src/storage/`.
6. **Islands use module-scoped Preact Signals** — shared reactive state lives in `web/lib/hooks/useObservationState.ts`. Do not create per-island local signal state for data that crosses island boundaries.
7. **CSS vars for themeable colours** — use `var(--color-*)` variables defined in `web/assets/styles.css`. Never hardcode Tailwind colour classes (e.g. `text-teal-600`) for theme colours.

---

## 3. Project Structure

```
/
├── engine/                     # Daemon 1: ingest + storage + REST API
│   ├── main.ts                 # Entry point
│   ├── config.ts               # Config loader (env vars → typed config)
│   └── src/
│       ├── ingest/
│       │   ├── normalizer.ts   # ALL imperial→SI conversions live here
│       │   ├── push.ts         # HTTP handlers: /ingest/wu, /ingest/ecowitt
│       │   └── poller.ts       # LAN poll driver (currently: Ecowitt GW-series)
│       ├── storage/
│       │   ├── adapter.ts      # StorageAdapter interface (the contract)
│       │   ├── factory.ts      # createStorageAdapter() — provider selection
│       │   └── providers/
│       │       ├── sqlite/     # SQLite provider (default)
│       │       └── mysql/      # MySQL provider
│       ├── api/
│       │   └── router.ts       # REST API routes (/api/*)
│       ├── domain/
│       │   ├── observation.ts  # Observation type
│       │   └── units.ts        # Unit conversion functions
│       └── almanac/
│           └── calculator.ts   # Sunrise/sunset calculations
├── web/                        # Daemon 2: Fresh v2 SSR UI
│   ├── main.ts
│   ├── routes/                 # File-based routing (Fresh)
│   ├── islands/                # Interactive Preact islands
│   ├── components/             # SSR-only components
│   ├── lib/
│   │   ├── api.ts              # Fetch wrappers → engine REST
│   │   ├── types.ts            # Shared TypeScript types
│   │   ├── config.ts           # Web config loader
│   │   └── hooks/
│   │       └── useObservationState.ts  # Module-scoped signals
│   └── assets/
│       └── styles.css          # CSS vars + Tailwind v4 entry
├── deploy/                     # Systemd units, env examples, nfpm
├── version.ts                  # Single source of version string
└── deno.json                   # Workspace root; compile tasks
```

---

## 4. How to Add an Ingest Driver

1. **Define a params interface** in `engine/src/ingest/normalizer.ts` (e.g. `MyProtocolParams`).
2. **Write a `normalizeMyProtocol()` function** in `normalizer.ts`:
   - Use `const ts = Math.floor(Date.now() / 1000)` for the timestamp — always server receive time, never the device-reported field (device clocks are unreliable).
   - Use `Units.*` helpers from `engine/src/domain/units.ts` for all conversions.
   - Return `{ observation: Observation, readings: SensorReading[] }`.
3. **Register an HTTP handler** in `engine/src/ingest/push.ts` (for push protocols) or create a new poller file alongside `poller.ts` (for LAN poll).
   - Import `normalizeMyProtocol` from `normalizer.ts`.
   - Call `storage.insert(observation)` and `storage.insertReadings(readings)`.
   - Log: `console.info("Ingest [MyProtocol] ts=... station=... readings=...")`.
4. **Wire the handler** in `engine/main.ts` — pass the `StorageAdapter` instance in.
5. **Add config** in `engine/config.ts` if the driver needs settings (URL, poll interval, credentials). Read from env vars; never hardcode.
6. **Type-check**: `deno check engine/main.ts`.

---

## 5. How to Add a Storage Adapter

1. Create `engine/src/storage/providers/<name>/adapter.ts` implementing every method of `StorageAdapter` (`engine/src/storage/adapter.ts`).
2. Create `engine/src/storage/providers/<name>/index.ts` exporting `createAdapter(): Promise<StorageAdapter>`.
3. Add migrations in `engine/src/storage/providers/<name>/migrations/` following the numbered convention (`001_initial_schema.ts`, etc.).
4. Register the provider in `engine/src/storage/factory.ts` — add a `case "<name>":` branch.
5. Document the required env vars in `deploy/etc/zephyr.toml.example`.
6. **Type-check**: `deno check engine/main.ts`.

---

## 6. How to Add a Web Route

1. Create `web/routes/<name>.tsx`. Fresh uses file-based routing.
2. Export a default async function component. Fetch data server-side via helpers in `web/lib/api.ts`.
3. For interactive elements, create an island in `web/islands/` and import it into the route. Islands must be `.tsx` and use Preact.
4. For state shared across islands (e.g. latest observation), read/write module-scoped signals from `web/lib/hooks/useObservationState.ts` — do not duplicate signals.
5. Use CSS var utility classes (`.card`, `.label-text`) and `var(--color-*)` variables. Avoid hardcoded Tailwind colour classes for themed colours.
6. **Type-check**: `deno check web/main.ts`.

---

## 7. How to Create a Theme

All theme colours are CSS custom properties in `web/assets/styles.css`:

```css
:root        { /* light mode */ --color-bg: …; --color-card: …; --color-label: …; … }
.dark        { /* dark mode  */ --color-bg: …; --color-card: …; --color-label: …; … }
```

To create a new theme: override the `--color-*` vars under a new CSS selector (e.g. `.theme-ocean`) and add a toggle mechanism in `web/islands/ThemeToggle.tsx`. Never introduce new hardcoded colour values in component markup.

---

## 8. How to Write Tests for a New Contribution

Every new driver, storage provider, and web route **MUST** ship with tests in the same PR. No exceptions.

### Template Files

- **`engine/tests/ingest/normalizer-template.test.ts`** — exhaustive teaching document for new ingest driver tests (11 sections, covers timestamp contract, SI unit contracts, missing field handling, extended sensor readings). Copy this file and adapt it for every new protocol.
- **`engine/tests/storage/mock-adapter.ts`** — `MockStorageAdapter` for tests that need a `StorageAdapter` without a real database.
- **`engine/tests/storage/adapter-contract.test.ts`** — contract test suite to run against any new storage provider.
- **`web/tests/lib/mock-fetch.ts`** — `mockEngineAPI()` for web route / island tests.
- **`web/tests/lib/test-env.ts`** — `setupTestEnvironment()` / `cleanupTestEnvironment()` bootstraps a happy-dom `Window` for island tests that require browser APIs (localStorage, matchMedia, classList). Use only when DOM interaction is needed; prefer `preact-render-to-string` for SSR shape checks.

### Minimum Assertions by Contribution Type

**New ingest driver (push or poll):**

- [ ] Timestamp uses server receive time (`Math.floor(Date.now() / 1000)`), not device-reported field
- [ ] `stationId` equals the configured `defaultStationId` argument, not the device push ID
- [ ] All temperatures are in °C (assert known °F input → expected °C output with `assertAlmostEquals`)
- [ ] All wind speeds are in m/s
- [ ] All rain values are in mm (rate in mm/hr)
- [ ] All pressures are in hPa
- [ ] Missing/empty fields produce `undefined`, not `NaN` or `0`
- [ ] Extended sensors (soil, lightning, etc.) appear in `readings[]`, not the `Observation`

**New storage adapter:**

- [ ] All `StorageAdapter` interface methods implemented (no stubs)
- [ ] Run `adapter-contract.test.ts` against the new provider
- [ ] Migration runner is idempotent (safe to run twice)

**New web route:**

- [ ] SSR data fetch succeeds with mocked engine API (uses `mockEngineAPI()` from `web/tests/lib/mock-fetch.ts`)
- [ ] Renders gracefully when API returns null / empty array
- [ ] Date range calculations produce correct timestamps (if using Temporal)

**New web island:**

- [ ] Signal reads/writes propagate correctly
- [ ] SSR shape / rendered markup checked via `preact-render-to-string` (no DOM setup required)
- [ ] Tests that need browser APIs (localStorage, matchMedia, classList) call `setupTestEnvironment()` from `web/tests/lib/test-env.ts` before rendering, and `cleanupTestEnvironment()` in a `finally` block
- [ ] No module-level signal state created inside the island file — shared signals come from `useObservationState.ts`

### Running Tests

```bash
deno task test:engine   # engine tests
deno task test:web      # web tests
deno task test:all      # both
```

---

## 9. Issue Tracker

Zephyr uses **beads** (`bd` CLI). Check open issues before starting work.

```bash
bd list                  # list open issues
bd show <id>             # full detail on one issue
bd close <id>            # mark resolved
```

Issue IDs are short alphanumeric codes (e.g. `zephyr-0pv`). Epics group related issues; see `.beads/` for metadata.

**Sync** — the issue database is stored in the GitHub repo under `refs/dolt/data` (separate from source code refs):

```bash
bd dolt pull             # fetch latest issues from remote
bd dolt push             # push local issue changes to remote
```

New contributors: run `bd bootstrap` after cloning to fetch the issue database automatically.

---

## 10. Before Submitting

```bash
deno task test:all          # all tests must pass
deno check engine/main.ts   # type-check engine
deno check web/main.ts      # type-check web
deno lint                   # lint all
deno fmt                    # format all
```

All five must pass with no errors or warnings.

<!-- BEGIN BEADS INTEGRATION v:1 profile:minimal hash:ca08a54f -->
## Beads Issue Tracker

This project uses **bd (beads)** for issue tracking. Run `bd prime` to see full workflow context and commands.

### Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work
bd close <id>         # Complete work
```

### Rules

- Use `bd` for ALL task tracking — do NOT use TodoWrite, TaskCreate, or markdown TODO lists
- Run `bd prime` for detailed command reference and session close protocol
- Use `bd remember` for persistent knowledge — do NOT use MEMORY.md files

## Session Completion

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   bd dolt push
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**
- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds
<!-- END BEADS INTEGRATION -->
