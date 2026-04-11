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

Do not convert units anywhere except normalizer.ts.
Do not use the device-reported timestamp.
```

**After generation:** confirm the timestamp source is `Date.now()`, not a field from the payload. Confirm all unit conversions are in `normalizer.ts` only. Run `deno check engine/main.ts`.

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

The response format I pasted above is authoritative — parse it exactly.
Use `Math.floor(Date.now() / 1000)` for the timestamp.
```

**After generation:** verify the device response is parsed from the actual format you provided, not a guessed schema. Confirm poll interval comes from config. Run `deno check engine/main.ts`.

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
```

**After generation:** check every method of `StorageAdapter` is implemented (no stubs that throw). Verify the migration runner is called on startup. Run `deno check engine/main.ts`.

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
```

**After generation:** confirm `Promise.all` is used for parallel fetches. Confirm `Temporal` is used for any date math, not `new Date()`. Run `deno check web/main.ts`.

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

## Working Iteratively

- **Start with the normalizer/domain type, not the handler.** Get `normalize<Name>()` compiling and returning the right shape before wiring up HTTP or polling logic.
- **Ask the assistant to reason through types before writing code.** Prompt: *"Before writing any code, describe the types involved and how data flows from the raw payload to an `Observation`."* This surfaces misunderstandings early.
- **Paste error output verbatim.** When `deno check` fails, copy the full error (including file paths and line numbers) back into the chat without paraphrasing. The model needs the exact text.
- **One driver per PR.** Mixing a new driver with refactors or unrelated fixes makes review harder and increases the chance of merge conflicts in shared files like `normalizer.ts`.

---

## Post-Generation Checklist

Run all of these before opening a PR:

```bash
deno check engine/main.ts   # type-check engine
deno check web/main.ts      # type-check web
deno lint                   # lint all
deno fmt                    # format all
deno task dev               # smoke test — confirm it starts without errors
```

All five must pass cleanly.

---

## Common Mistakes to Watch For

These are the things LLMs most frequently get wrong in this codebase:

- **Using `new Date()` for timezone math.** All timezone-aware date operations must use `Temporal`. `new Date()` is only acceptable for `Date.now()` as a raw millisecond source.
- **Doing imperial→SI conversion in the handler.** All conversions belong in `normalizer.ts`. Handlers must receive already-normalised SI values.
- **Hardcoding a port, path, or station name.** Everything comes from config/env. There are no acceptable exceptions.
- **Using the device-reported timestamp.** Always use `Math.floor(Date.now() / 1000)`. Device clocks are unreliable.
- **Importing a storage provider directly.** Code outside `engine/src/storage/` must only ever interact with the `StorageAdapter` interface — never with a concrete provider.
- **Creating per-island signal state.** Signals for data shared across islands go in `web/lib/hooks/useObservationState.ts`. New module-level signals in individual island files will cause state sync bugs.
