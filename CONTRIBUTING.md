# Contributing to Zephyr

Thanks for your interest in contributing! Zephyr is a self-hosted personal weather station system built with Deno, TypeScript, and Fresh v2. Whether you're fixing a bug, adding a new ingest driver, or improving the UI — all contributions are welcome, including AI-assisted ones.

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

# Copy example config files
cp deploy/etc/engine.env.example engine.env
cp deploy/etc/web.env.example web.env
cp deploy/etc/app.env.example app.env

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
- **No hardcoded values** — station identity, paths, ports, and credentials must come from environment variables (see `deploy/etc/*.env.example`).
- **Formatting & linting** — `deno fmt` and `deno lint` must pass before opening a PR. CI will enforce this.

---

## Pull Request Process

1. **Fork** the repo and create a branch from `main`.
2. Keep PRs **focused** — one feature or fix per PR makes review much faster.
3. If your PR relates to a tracked issue, **include the beads issue ID** in the PR title (e.g. `feat: add Ecowitt v3 support [zephyr-abc]`).
4. Make sure `deno check`, `deno lint`, and `deno fmt` all pass locally.
5. Open your PR against `main`. Describe what changed and why.

---

## Adding an Ingest Driver

Ingest drivers receive weather data (push or poll) and normalise it into the internal `Observation` type.

1. **Create a handler** in `engine/ingest/` (e.g. `engine/ingest/my_station/handler.ts`).
2. **Normalise to `Observation`** — map all incoming fields to the standard `Observation` interface. Use SI units.
3. **Register the handler** in the engine's router (see existing drivers for the pattern).
4. Add an `*.env.example` entry if your driver requires new config variables.
5. Write a short README or inline JSDoc explaining the expected payload format.

> **Tip:** The [weewx](https://github.com/weewx/weewx) driver code is a useful porting reference for station-specific field mappings and unit conversions. A fork is available alongside this repo.

---

## Adding a Storage Adapter

Storage adapters abstract the persistence layer behind the `StorageAdapter` interface.

1. **Create a provider directory**: `engine/providers/<name>/`
2. **Add the four required files**:
   - `adapter.ts` — implements `StorageAdapter`
   - `schema.ts` — DDL / migration helpers
   - `queries.ts` — SQL or query logic
   - `mod.ts` — public re-export
3. **Register the adapter** in `engine/providers/factory.ts` — add a branch for your `DB_PROVIDER` value.
4. Implement every method on the `StorageAdapter` interface. Return types must match exactly.
5. Test with realistic data volumes — weather databases grow fast.

---

## Creating a Theme

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

## AI-Assisted Contributions

AI-assisted contributions are explicitly welcome here. If you used an LLM to help write, refactor, or debug code — that's fine, just make sure you've reviewed and understand what you're submitting.

See **[AGENTS.md](./AGENTS.md)** for coding-assistant guidance specific to this codebase, including project conventions, file layout, and tips for prompting effectively within this repo.

---

Thanks again for contributing. If you have questions, open an issue or start a discussion — happy to help you get oriented.
