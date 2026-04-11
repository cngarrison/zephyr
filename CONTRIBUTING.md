# Contributing to Zephyr

Thanks for your interest in contributing! Zephyr is a self-hosted personal weather station system built with Deno, TypeScript, and Fresh v2. All contributions are welcome — bug fixes, new ingest drivers, storage adapters, UI improvements, and documentation.

**AI-assisted contributions are first-class here.** The expected workflow for most new features — especially new ingest drivers — is to plan with a coding assistant, review the output, then submit a PR. The manual reference sections below exist as a fallback, not a prerequisite. Start with the [AI-Assisted Development](#ai-assisted-development) section.

---

## AI-Assisted Development

The recommended workflow for most contributions — especially new ingest drivers — is with an LLM coding assistant (Claude, Copilot, Cursor, etc.).

### Before you start

Load these files into your coding assistant's context:

- **[AGENTS.md](./AGENTS.md)** — critical rules, project conventions, file structure, and step-by-step guides for all common contribution types. **Load this first.**
- **[docs/drivers.md](./docs/drivers.md)** — driver architecture and the `Observation` type your driver must produce.
- **[engine/src/ingest/normalizer.ts](./engine/src/ingest/normalizer.ts)** — the existing WU and Ecowitt normalisers as a concrete reference.

### Adding a new push driver

```
I want to add a new ingest driver for <protocol / station name> to the Zephyr weather system.
Here is the protocol documentation / payload format: <paste or attach docs>

Read AGENTS.md and engine/src/ingest/normalizer.ts for context, then:
1. Define a params interface for the incoming payload in normalizer.ts.
2. Write a normalizer function mapping the payload to Observation (SI units only).
3. Add an HTTP handler in engine/src/ingest/push.ts.
4. Wire it into engine/main.ts.
5. Add any required config keys to engine/config.ts and zephyr.toml.example.

Important: use Math.floor(Date.now() / 1000) for the observation timestamp.
Never use any device-reported time field — device clocks are unreliable.
```

### Adding a LAN polling driver

```
I want to add a LAN polling driver for <device name> to Zephyr.
The device exposes a local HTTP API: <describe the endpoint and response format>

Read AGENTS.md and engine/src/ingest/poller.ts for context, then:
1. Create engine/src/ingest/<name>_poller.ts with a startPoller() function.
2. Write a normaliser for the response payload to Observation (SI units).
3. Wire it into engine/main.ts alongside the existing poller.
4. Add poll config keys to engine/config.ts and zephyr.toml.example under [stations.ingest.poll].
```

### Adding a storage adapter

```
I want to add a <database> storage adapter to Zephyr.

Read AGENTS.md and engine/src/storage/providers/sqlite/ for context, then:
1. Create engine/src/storage/providers/<name>/ with index.ts, adapter.ts, migrate.ts, and migrations/.
2. Implement every method of the StorageAdapter interface (engine/src/storage/adapter.ts).
3. Register the adapter in engine/src/storage/factory.ts.
4. Add TOML config keys to engine/config.ts and zephyr.toml.example.
```

### After generation

1. Run `deno check engine/main.ts` and `deno check web/main.ts` — fix any type errors.
2. Run `deno lint` and `deno fmt`.
3. Test locally with `deno task dev`.
4. Open a PR referencing the beads issue ID if applicable.

---

## Development Setup

**Prerequisites**

- [Deno](https://deno.com) v2.2 or later
- Git
- A weather station (or sample data) for end-to-end testing

**Getting started**

```bash
# Clone the repo
git clone https://github.com/cngarrison/zephyr.git
cd zephyr

# Copy and edit the config file
cp zephyr.toml.example zephyr.toml
# Edit zephyr.toml — set station name, lat/lon, timezone, storage path, etc.

# Start engine + web in dev mode (hot-reload)
deno task dev
```

**Other useful tasks**

| Command | Purpose |
|---|---|
| `deno task dev` | Run engine + web in development mode |
| `deno task build` | Fresh/Vite production build (required before compile) |
| `deno task compile` | Compile self-contained binaries for the current platform |
| `deno check` | TypeScript type-checking |
| `deno lint` | Linter |
| `deno fmt` | Formatter |

---

## Code Conventions

- **TypeScript strict mode** — all code must pass `deno check` with no errors.
- **Temporal API** — use `Temporal` for all timezone-aware date/time math. Do not use `Date` for anything that touches timezones or arithmetic.
- **SI units internally** — store and process measurements in SI units (°C, m/s, hPa, mm). Convert only at the display layer.
- **No hardcoded values** — station identity, paths, ports, and credentials come from `zephyr.toml` (loaded via `engine/config.ts` or `web/lib/config.ts`). Never hardcode them.
- **Formatting & linting** — `deno fmt` and `deno lint` must pass before opening a PR. CI will enforce this.

---

## Pull Request Process

1. **Fork** the repo and create a branch from `main`.
2. Keep PRs **focused** — one feature or fix per PR makes review much faster.
3. If your PR relates to a tracked issue, **include the beads issue ID** in the PR title (e.g. `feat: add Ecowitt v3 support [zephyr-abc]`).
4. Make sure `deno check`, `deno lint`, and `deno fmt` all pass locally.
5. Open your PR against `main`. Describe what changed and why.

---

## Manual Reference: Adding an Ingest Driver

> Prefer the [AI-assisted workflow](#adding-a-new-push-driver) above. These steps are a manual reference.

Ingest drivers receive weather data (push or poll) and normalise it into the internal `Observation` type.

1. **Create a handler** in `engine/ingest/` (e.g. `engine/ingest/my_station/handler.ts`).
2. **Normalise to `Observation`** — map all incoming fields to the standard `Observation` interface. Use SI units.
3. **Register the handler** in the engine's router (see existing drivers for the pattern).
4. Add any new config keys to `engine/config.ts` and `zephyr.toml.example` under the appropriate `[stations.ingest.*]` section.
5. Write a short README or inline JSDoc explaining the expected payload format.

> **Tip:** The [weewx](https://github.com/weewx/weewx) driver code is a useful porting reference for station-specific field mappings and unit conversions. A fork is available alongside this repo.

---

## Manual Reference: Adding a Storage Adapter

> Prefer the [AI-assisted workflow](#adding-a-storage-adapter) above. These steps are a manual reference.

Storage adapters abstract the persistence layer behind the `StorageAdapter` interface.

1. **Create a provider directory**: `engine/providers/<name>/`
2. **Add the four required files**:
   - `adapter.ts` — implements `StorageAdapter`
   - `schema.ts` — DDL / migration helpers
   - `queries.ts` — SQL or query logic
   - `mod.ts` — public re-export
3. **Register the adapter** in `engine/src/storage/factory.ts` and add TOML config keys to `engine/config.ts` and `zephyr.toml.example`.
4. Implement every method on the `StorageAdapter` interface. Return types must match exactly.
5. Test with realistic data volumes — weather databases grow fast.

---

## Manual Reference: Creating a Theme

Zephyr uses Tailwind v4 with class-based dark mode.

- **CSS variables** for all colour tokens live in `web/static/styles.css`. Add or override vars there.
- **Dark mode** is toggled by adding/removing a class on `<html>` via `classList` — no media-query dependence.
- Keep contrast ratios accessible (WCAG AA minimum).
- Test both light and dark variants before submitting.

---

## Issue Tracking

Zephyr uses **beads** (`bd` CLI) for issue tracking.

```bash
bd list            # list open issues
bd show <id>       # view an issue
bd new             # create a new issue
bd close <id>      # close an issue
```

If you're picking up an existing issue, mention the ID in your branch name and PR title so it's easy to cross-reference.

---

Thanks for contributing. If you have questions, open an issue — happy to help you get oriented.
