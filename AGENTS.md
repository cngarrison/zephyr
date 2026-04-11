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

## 8. Issue Tracker

Zephyr uses **beads** (`bd` CLI). Check open issues before starting work.

```bash
bd list                  # list open issues
bd show <id>             # full detail on one issue
bd close <id>            # mark resolved
```

Issue IDs are short alphanumeric codes (e.g. `zephyr-0pv`). Epics group related issues; see `.beads/` for metadata.

---

## 9. Before Submitting

```bash
deno check engine/main.ts   # type-check engine
deno check web/main.ts      # type-check web
deno lint                   # lint all
deno fmt                    # format all
```

All four must pass with no errors or warnings.
