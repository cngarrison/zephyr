# AI-Assisted Development

## Overview

AI contributions are first-class in Zephyr. `AGENTS.md` is written specifically for LLM coding assistants — it contains every critical rule and step-by-step how-to guide the model needs to produce correct code. Most new ingest drivers are expected to arrive via AI-assisted workflows, so the patterns below are well-trodden.

---

## Setting Up Your Assistant

Load this context before starting any task:

1. **`AGENTS.md`** — always load this first. It contains the critical rules (Temporal, SI units, StorageAdapter contract, etc.) and the canonical how-to guides for every contribution type.
2. **The relevant reference file for your task:**
   - New ingest driver → `engine/src/ingest/normalizer.ts`
   - New storage adapter → `engine/src/storage/providers/sqlite/` (all four files)
   - New web route → `web/lib/api.ts`, `web/lib/types.ts`
   - New theme → `web/assets/styles.css`, `web/islands/ThemeToggle.tsx`
3. **The relevant `docs/` file** for your contribution type (`docs/drivers.md`, `docs/storage-adapters.md`, etc.).

**Tip:** Paste or attach the actual file contents. Describing the files is not enough — the model needs to see the real types, function signatures, and conventions to produce code that compiles.

---

## Prompt Templates

### a. New Push Ingest Driver

```
I'm adding a new push ingest driver to Zephyr. I've attached AGENTS.md,
engine/src/ingest/normalizer.ts, engine/src/ingest/push.ts, and
engine/src/domain/units.ts.

Protocol name: <NAME>
HTTP path:     /ingest/<name>
Payload format:
<paste example payload here>

Please:
1. Add a `<Name>Params` interface and a `normalize<Name>()` function in
   normalizer.ts. Use `Math.floor(Date.now() / 1000)` for the timestamp
   — never the device-reported field. Use `Units.*` helpers for all
   conversions. Return `{ observation: Observation, readings: SensorReading[] }`.
2. Register an HTTP handler in push.ts that calls `normalize<Name>()`,
   calls `storage.insert(observation)` and `storage.insertReadings(readings)`,
   and logs `console.info("Ingest [<Name>] ts=... station=... readings=")`.
3. Wire the handler in engine/main.ts.
4. Add any required env vars to engine/config.ts.
5. Write engine/tests/ingest/normalizer-<name>.test.ts following the
   structure of normalizer-template.test.ts. Cover: timestamp contract,
   stationId contract, all SI unit conversions, missing fields → undefined,
   and extended sensor readings.

Do not convert units anywhere except normalizer.ts.
Do not use the device-reported timestamp.
```

**After generation:** confirm the timestamp source is `Date.now()`, not a field from the payload. Confirm all unit conversions are in `normalizer.ts` only. Run `deno check engine/main.ts`. Run `deno task test:engine` and confirm all tests pass.

---

### b. New LAN Polling Driver

```
I'm adding a new LAN polling driver to Zephyr. I've attached AGENTS.md,
engine/src/ingest/normalizer.ts, engine/src/ingest/poller.ts, and
engine/src/domain/units.ts.

Device name:    <NAME>
Poll URL:       <URL pattern — include placeholders for host/port from config>
Response format:
<paste a real or representative JSON/XML response here>

Please:
1. Add a `<Name>Params` interface and `normalize<Name>()` in normalizer.ts
   following the same pattern as existing normalizers.
2. Create `engine/src/ingest/<name>-poller.ts` modelled on poller.ts:
   - Read host/port/interval from config (no hardcoded values).
   - Fetch on the configured interval.
   - Call `normalize<Name>()`, then `storage.insert()` / `storage.insertReadings()`.
3. Wire the poller in engine/main.ts.
4. Add config fields to engine/config.ts.
5. Write engine/tests/ingest/normalizer-<name>.test.ts following the
   structure of normalizer-template.test.ts. Cover: timestamp contract,
   stationId contract, all SI unit conversions, missing fields → undefined,
   and extended sensor readings.

The response format I pasted above is authoritative — parse it exactly.
Use `Math.floor(Date.now() / 1000)` for the timestamp.
```

**After generation:** verify the device response is parsed from the actual format you provided, not a guessed schema. Confirm poll interval comes from config. Run `deno check engine/main.ts`. Run `deno task test:engine` and confirm all tests pass.

---

### c. New Storage Adapter

```
I'm adding a new storage adapter to Zephyr. I've attached AGENTS.md,
engine/src/storage/adapter.ts (the interface), engine/src/storage/factory.ts,
and the full engine/src/storage/providers/sqlite/ directory.

Provider name: <NAME>
Connection env vars: <list them>

Please create a four-file structure under
engine/src/storage/providers/<name>/:
  - adapter.ts     — implements every method of StorageAdapter
  - index.ts       — exports createAdapter(): Promise<StorageAdapter>
  - migrations/001_initial_schema.ts — initial schema matching SQLite's tables
  - migrations/runner.ts — migration runner

Then register a `case "<name>":` branch in factory.ts.

Mirror the SQLite provider's migration pattern exactly.
Never import the provider from outside engine/src/storage/.
Also run the existing adapter-contract.test.ts suite against the new
provider to confirm all storage contract tests pass.
```

**After generation:** check every method of `StorageAdapter` is implemented (no stubs that throw). Verify the migration runner is called on startup. Run `deno check engine/main.ts`. Run `deno task test:engine` and confirm the contract suite passes against your new provider.

---

### d. New Web Route

```
I'm adding a new route to the Zephyr web UI. I've attached AGENTS.md,
web/lib/api.ts, web/lib/types.ts, web/lib/config.ts, and an existing
route (web/routes/index.tsx) for reference.

Route path:  /<path>
Purpose:     <describe what data it shows>

Please:
1. Create web/routes/<name>.tsx as a Fresh v2 async server component.
2. Fetch all data server-side using helpers from web/lib/api.ts.
   Run independent fetches in parallel with Promise.all().
3. Fetch almanac data and pass it to the Header component (every route does this).
4. Use Temporal (not Date) for any date arithmetic.
5. If the route needs interactivity, create web/islands/<Name>.tsx using Preact.
   Read/write shared state from web/lib/hooks/useObservationState.ts — do not
   create new module-level signals.
6. Use CSS var utility classes and var(--color-*) variables for all colours.
   Do not hardcode Tailwind colour classes for theme colours.
7. Write web/tests/components/<name>.test.tsx (or web/tests/routes/<name>.test.ts)
   using mockEngineAPI() from web/tests/lib/mock-fetch.ts to stub the engine.
   Test: successful render with mocked data, graceful null/empty handling,
   correct date range if Temporal is used.
```

**After generation:** confirm `Promise.all` is used for parallel fetches. Confirm `Temporal` is used for any date math, not `new Date()`. Run `deno check web/main.ts`. Run `deno task test:web` and confirm all tests pass.

---

### e. New Theme

```
I'm adding a new theme to the Zephyr web UI. I've attached AGENTS.md,
web/assets/styles.css, and web/islands/ThemeToggle.tsx.

Theme name:   <NAME>
Colour palette:
  background:  <hex>
  card:        <hex>
  label:       <hex>
  accent:      <hex>
  <add more as needed>

Please:
1. Add a `.<theme-name>` CSS class in styles.css that overrides the
   --color-* custom properties defined in :root.
   Do not introduce any new hardcoded colour values in component markup.
2. Update ThemeToggle.tsx to cycle through the new theme following the
   existing pattern.
```

**After generation:** grep for any hardcoded Tailwind colour classes (e.g. `text-teal-600`) that snuck in. Confirm only `--color-*` vars are used. Run `deno check web/main.ts`.

---

## Writing Tests

### Test Directory Structure

```
engine/tests/
  domain/          # Pure function tests (units, calculations)
  storage/         # StorageAdapter contract + provider tests
  ingest/          # Normalizer tests (one file per protocol)
  api/             # HTTP router tests
  almanac/         # Almanac calculation tests
  fixtures/        # JSON test payloads (wu-payload.json, ecowitt-payload.json, etc.)

web/tests/
  lib/             # test-env.ts (DOM setup), mock-fetch.ts (API mocking)
  hooks/           # useObservationState.test.ts
  components/      # SSR component render tests
  islands/         # Island interaction tests

shared/testing/
  fixtures.ts      # Factory functions: makeObservation, makeWuPayload, etc.
```

### Using Fixture Factories

All tests import from `@zephyr/shared/testing`:

```typescript
import { makeObservation, makeWuPayload, makeTodayStats } from '@zephyr/shared/testing';

// All factories accept overrides:
const obs = makeObservation({ tempOutdoor: 22.5, windSpeed: 3.0 });
const payload = makeWuPayload({ tempf: '72.5', windspeedmph: '0' });
const stats = makeTodayStats({ temp_min: 10.0, temp_max: 25.0 });
```

Available factories: `makeObservation`, `makeSensorReading`, `makeWuPayload`, `makeEcowittPayload`, `makeAggregateObservation`, `makeDailyAggregate`, `makeTodayStats`.

### Using MockStorageAdapter

For tests that need a `StorageAdapter` without a real database:

```typescript
import { createMockAdapter } from '../../tests/storage/mock-adapter.ts';

const adapter = createMockAdapter();
await adapter.init();
await adapter.insert(makeObservation());

// Inspect call tracking:
console.log(adapter.calls.insert);   // all inserted observations
console.log(adapter.calls.latest);   // number of times latest() was called
console.log(adapter.observations);   // current in-memory store

adapter.reset(); // clear all state and call tracking between tests
```

### Using mockEngineAPI (web tests)

For web tests that call `fetch` to the engine:

```typescript
import { mockEngineAPI, restoreFetch } from '../../lib/mock-fetch.ts';
import { makeObservation } from '@zephyr/shared/testing';

Deno.test('my web test', async (t) => {
  mockEngineAPI({ observation: { tempOutdoor: 19.0 } });
  try {
    // ... test code that calls fetch('/api/observations/latest')
  } finally {
    restoreFetch();
  }
});
```

### Using test-env.ts (DOM setup for island tests)

For islands that access browser APIs (localStorage, matchMedia, `document.documentElement`), set up the happy-dom environment before rendering:

```typescript
import { setupTestEnvironment, cleanupTestEnvironment } from '../lib/test-env.ts';
import { renderToString } from 'preact-render-to-string';
import MyIsland from '../../islands/MyIsland.tsx';

Deno.test('MyIsland', async (t) => {
  setupTestEnvironment();
  try {
    await t.step('renders initial state', () => {
      const html = renderToString(<MyIsland />);
      assertStringIncludes(html, 'expected content');
    });
    await t.step('writes to localStorage', () => {
      // globalThis.localStorage is available after setupTestEnvironment()
      assertEquals(localStorage.getItem('my-key'), 'expected');
    });
  } finally {
    cleanupTestEnvironment();
  }
});
```

**Use DOM setup when:** the island reads/writes `localStorage`, calls `matchMedia`, or manipulates `document.documentElement.classList`.
**Skip DOM setup when:** you only need to verify SSR output shape — `renderToString` works without it and is faster.

> **Path note:** All imports are relative to the test file's location. From `web/tests/islands/` use `'../lib/test-env.ts'`; from `web/tests/components/conditions/` use `'../../../lib/test-env.ts'`. The same rule applies to `mock-fetch.ts`.

---

### The Normalizer Template

`engine/tests/ingest/normalizer-template.test.ts` is an exhaustive teaching document for new ingest driver tests. It covers all three non-negotiable contracts:

1. **Timestamp contract** — must use `Math.floor(Date.now() / 1000)`, never the device-reported field
2. **SI unit contract** — all temperatures in °C, wind in m/s, rain in mm, pressure in hPa
3. **Missing field contract** — absent or empty fields produce `undefined`, not `NaN` or `0`

Copy this file and adapt it for every new protocol. The test names and structure are intentionally verbose — they serve as documentation for future contributors.

---

## Working Iteratively

- **Start with the normalizer/domain type, not the handler.** Get `normalize<Name>()` compiling and returning the right shape before wiring up HTTP or polling logic.
- **Ask the assistant to reason through types before writing code.** Prompt: *"Before writing any code, describe the types involved and how data flows from the raw payload to an `Observation`."* This surfaces misunderstandings early.
- **Paste error output verbatim.** When `deno check` fails, copy the full error (including file paths and line numbers) back into the chat without paraphrasing. The model needs the exact text.
- **One driver per PR.** Mixing a new driver with refactors or unrelated fixes makes review harder and increases the chance of merge conflicts in shared files like `normalizer.ts`.

---

## Post-Generation Checklist

Run all of these before opening a PR:

```bash
deno task test:all          # all tests must pass
deno check engine/main.ts   # type-check engine
deno check web/main.ts      # type-check web
deno lint                   # lint all
deno fmt                    # format all
deno task dev               # smoke test — confirm it starts without errors
```

All six must pass cleanly.

---

## Common Mistakes to Watch For

These are the things LLMs most frequently get wrong in this codebase:

- **Using `new Date()` for timezone math.** All timezone-aware date operations must use `Temporal`. `new Date()` is only acceptable for `Date.now()` as a raw millisecond source.
- **Doing imperial→SI conversion in the handler.** All conversions belong in `normalizer.ts`. Handlers must receive already-normalised SI values.
- **Hardcoding a port, path, or station name.** Everything comes from config/env. There are no acceptable exceptions.
- **Using the device-reported timestamp.** Always use `Math.floor(Date.now() / 1000)`. Device clocks are unreliable.
- **Importing a storage provider directly.** Code outside `engine/src/storage/` must only ever interact with the `StorageAdapter` interface — never with a concrete provider.
- **Creating per-island signal state.** Signals for data shared across islands go in `web/lib/hooks/useObservationState.ts`. New module-level signals in individual island files will cause state sync bugs.
