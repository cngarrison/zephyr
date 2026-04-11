# Zephyr Web

The web UI daemon for the Zephyr weather station system. Built with [Fresh v2](https://fresh.deno.dev/) + Vite + Preact + Tailwind v4, compiled to a single self-contained binary via `deno compile`.

> **Depends on the Zephyr engine.** All observation data is fetched from the engine's REST API (`WEB_ENGINE_URL`). The web daemon has no direct database access.

---

## Running

### Development

```sh
# From the repo root:
deno task dev

# Or from web/:
deno task dev
```

Starts the Fresh/Vite dev server with HMR. Vite listens on port 9081 (see `vite.config.ts`); Fresh proxies through it.

### Build (required before production start or compile)

```sh
deno task build
```

Runs the Fresh + Vite build pipeline, emitting `_fresh/` artifacts. **This must be run before `deno task start` or `deno compile`.** The compiled binary embeds the `_fresh/` directory.

### Production start

```sh
deno task start
```

Runs `server.ts` directly (no Vite). Reads `PORT` from the environment (set via systemd `Environment=` in production).

### Compiled binary

Built from the repo root:

```sh
deno task compile:web   # current platform
deno task compile       # all 4 cross-compile targets
```

The binary is `zephyr-web`. It embeds the built `_fresh/` directory and has no external dependencies.

---

## Configuration

In **production**, all configuration comes from `/etc/zephyr/zephyr.toml` (the `[web]` section), loaded by `lib/config.ts` at startup. Config path resolution: `--config` flag → `$ZEPHYR_CONFIG` env → `/etc/zephyr/zephyr.toml`.

In **development**, a `.env` file in `web/` can supply overrides (loaded via `@std/dotenv`).

| Variable / TOML key | Default | Description |
|---|---|---|
| `[web] engine_url` / `WEB_ENGINE_URL` | `http://localhost:8080` | URL of the engine API (server-side fetches only) |
| `PORT` | `8081` | Web daemon listen port — set as a process env var (systemd `Environment=`), not in `zephyr.toml` |
| `HOSTNAME` | `0.0.0.0` | Web daemon bind address |

**`PORT` is always a process env var**, not a TOML key, because Fresh reads it before user code initialises. In production it is set in the systemd unit file.

Example `zephyr.toml` snippet:

```toml
[web]
engine_url = "http://localhost:8080"
```

See `deploy/etc/zephyr.toml.example` for the full production template.

---

## Routes

### Page routes

| Route | Description |
|---|---|
| `/` | Current conditions dashboard — latest observation + live 24-hour raw charts |
| `/yesterday` | Hourly aggregate charts for the previous calendar day (station timezone) |
| `/week` | Hourly aggregate charts for the past 7 days |
| `/month` | Daily aggregate charts for the past 30 days |
| `/year` | Daily aggregate charts for the past 365 days |
| `/history` | Multi-year climate heatmaps + all-time records table |
| `/almanac` | Sunrise/sunset/twilight times + moon phase for any date (date nav via `?date=YYYY-MM-DD`) |
| `/archive` | ⚠ Partial stub — year/month download grid not yet implemented |

### API proxy routes

All routes under `routes/api/` proxy requests to the engine. Browser islands fetch from the same origin (`/api/*`); no CORS configuration is needed.

| Route | Proxies to engine |
|---|---|
| `GET /api/observations` | `GET /api/observations` |
| `GET /api/observations/latest` | `GET /api/observations/latest` |
| `GET /api/observations/range` | `GET /api/observations/range?from=&to=` |
| `GET /api/observations/aggregate` | `GET /api/observations/aggregate?from=&to=&bucket=hour\|day` |
| `GET /api/observations/today` | `GET /api/observations/today?tz=` |
| `GET /api/observations/daily` | `GET /api/observations/daily?year=` |
| `GET /api/almanac` | `GET /api/almanac?date=YYYY-MM-DD` |

---

## Component Structure

```
web/
├── routes/                         Fresh file-based routing
│   ├── _app.tsx                    Root app shell; FOUC-prevention inline script
│   ├── index.tsx                   / — current conditions page
│   ├── yesterday.tsx               /yesterday
│   ├── week.tsx                    /week
│   ├── month.tsx                   /month
│   ├── year.tsx                    /year
│   ├── history.tsx                 /history — heatmaps + records
│   ├── almanac.tsx                 /almanac — sun/moon data
│   └── api/                        API proxy handlers (thin fetch → engine)
│       ├── almanac.ts
│       ├── observations.ts
│       └── observations/
│           ├── latest.ts
│           ├── range.ts
│           ├── aggregate.ts
│           ├── today.ts
│           └── daily.ts
│
├── islands/                        Client-hydrated Preact components
│   ├── Header.tsx                  Logo + station name + almanac box + ThemeToggle; reads shared signals
│   ├── CurrentConditions.tsx       Mounts shared polling; renders ConditionsGrid
│   ├── ThemeToggle.tsx             Light → dark → system cycle
│   └── charts/                     24-hour raw observation charts (ECharts)
│       ├── TemperatureChart.tsx
│       ├── PressureChart.tsx
│       ├── HumidityChart.tsx
│       ├── WindChart.tsx
│       ├── RainChart.tsx
│       ├── UVChart.tsx
│       └── agg/                    Aggregate (hourly/daily bucket) charts
│           ├── TempAggChart.tsx
│           ├── PressureAggChart.tsx
│           ├── HumidityAggChart.tsx
│           ├── WindAggChart.tsx
│           ├── RainAggChart.tsx
│           └── UVAggChart.tsx
│
├── components/                     SSR-only Preact components (no hydration)
│   ├── layout/
│   │   ├── NavTabs.tsx             8-tab navigation bar
│   │   └── AggregateView.tsx       Shared layout wrapper for /yesterday–/year
│   ├── conditions/
│   │   ├── ConditionCard.tsx       Single metric card (label/value/unit/icon/trend/today stats)
│   │   ├── ConditionsGrid.tsx      2×6 grid of ConditionCards; null-safe
│   │   ├── ChartCard.tsx           Titled card wrapper for chart islands
│   │   ├── ChartsGrid.tsx          2-column grid of 6 ChartCards (raw 24h data)
│   │   └── AggregateChartsGrid.tsx 2-column grid of 6 ChartCards (aggregate data)
│   └── history/
│       ├── HeatmapTable.tsx        Month×year colour-gradient heatmap table
│       └── RecordsTable.tsx        All-time records grouped by category
│
├── lib/
│   ├── types.ts                    Shared TS interfaces (Observation, AggregateObservation,
│   │                               DailyAggregate, TodayStats, StationConfig, AlmanacData, …)
│   ├── api.ts                      Server-side fetch helpers (fetchLatest, fetchAggregates, …)
│   ├── config.ts                   TOML config loader; resolves engine URL + station config
│   └── hooks/
│       └── useObservationState.ts  Module-scoped Preact Signals + polling orchestration
│
├── assets/
│   └── styles.css                  Tailwind v4 entry; CSS custom properties (light/dark)
│
├── static/
│   ├── logo.svg / logo-dark.svg            Full wordmark (light/dark)
│   ├── logo-mark.svg / logo-mark-dark.svg  Mark only
│   ├── logo-mark-z.svg / …-dark.svg        Z-only mark
│   ├── favicon.ico, favicon-32.png, apple-touch-icon.png
│   └── weather-icons/              Vendored Erik Flowers weather-icons v2
│       ├── weather-icons.min.css   Font-face + icon classes (font paths patched)
│       ├── weather-icons-wind.min.css
│       └── font/                   woff2, woff, ttf
│
├── main.ts                         Dev entry point (deno task dev)
├── server.ts                       Production entry point (deno task start / compiled binary)
├── client.ts                       Browser client entry
├── vite.config.ts                  Vite: Fresh plugin + Tailwind v4; server.port=9081
└── deno.json                       Tasks, imports map
```

---

## Islands Architecture

Fresh v2 islands are hydrated individually in the browser. To avoid duplicated polling and signal fragmentation across multiple islands on the same page, observation state is centralised in **`lib/hooks/useObservationState.ts`**.

### How it works

`useObservationState.ts` exports **module-scoped** Preact Signals:

```ts
export const latestObservation: Signal<Observation | null>
export const todayStats: Signal<TodayStats | null>
export const lastObservationTime: Signal<string | null>
```

It also exports `startObservationPolling()`, which sets up a 60-second interval fetching `/api/observations/latest` and `/api/observations/today` in parallel. Because the signals are module-scoped (not component-scoped), **`startObservationPolling()` is called exactly once** — inside the `CurrentConditions` island's `useEffect` — and the resulting state is automatically shared with every other island that imports the same signals (e.g. `Header`).

This means adding a new island that reacts to live observation data requires only:
1. Import the signal(s) from `lib/hooks/useObservationState.ts`
2. Read the signal value inside the component — no additional polling setup needed

---

## API Proxies

Every handler in `routes/api/` is a thin proxy:

```ts
// routes/api/observations/latest.ts
export const handler: Handlers = {
  async GET(req) {
    const url = new URL("/api/observations/latest", engineUrl());
    const res = await fetch(url);
    return new Response(res.body, {
      status: res.status,
      headers: { "Content-Type": "application/json" },
    });
  },
};
```

- **Server-side route handlers** call the engine directly via `WEB_ENGINE_URL` (from `lib/config.ts`).
- **Browser islands** call `/api/*` on the same origin — the web daemon proxies to the engine, so no CORS is needed and the engine is never exposed directly to the browser.
- Query parameters (e.g. `?from=`, `?to=`, `?tz=`) are forwarded as-is.

---

## Theme System

Theme is controlled by a **CSS class on `<html>`** (`dark` or absent), toggled by the `ThemeToggle` island. Three modes cycle in order: **light → dark → system**.

- **CSS variables** are defined in `assets/styles.css`:
  ```css
  :root {
    --color-bg: #f8fafc;
    --color-card: #ffffff;
    --color-card-border: #e2e8f0;
    --color-label: #64748b;
    --color-nav-bg: #1e293b;
    --color-nav-text: #f8fafc;
  }
  .dark {
    --color-bg: #0f172a;
    --color-card: #1e293b;
    /* … */
  }
  ```
- **Tailwind v4** `darkMode: 'class'` — utilities like `dark:hidden` and `dark:text-white` work alongside the CSS vars.
- **FOUC prevention**: `routes/_app.tsx` injects an inline `<script>` that reads `localStorage['zephyr-theme']` and applies the `.dark` class before the first paint.
- **Logo swap**: `Header` renders both `logo.svg` and `logo-dark.svg`; the dark variant uses `class="hidden dark:block"` and the light variant `class="dark:hidden"`.
- **Persistence**: The selected mode is stored in `localStorage` under the key `zephyr-theme` (`'light'` | `'dark'` | `'system'`). System preference is read from `window.matchMedia('(prefers-color-scheme: dark)')`.

---

## weather-icons

[Erik Flowers weather-icons](https://github.com/erikflowers/weather-icons) v2 is **not published to npm** at v2. It is vendored directly into `static/weather-icons/`:

```
static/weather-icons/
├── weather-icons.min.css       # font-face + .wi-* classes
├── weather-icons-wind.min.css  # wind direction variants
└── font/                       # woff2, woff, ttf
```

**Font path patch**: the upstream CSS references `../font/` (relative to a `css/` subdirectory). Because we serve the CSS from `/weather-icons/weather-icons.min.css` directly (no `css/` subdirectory), all `../font/` references are patched to `font/`.

The stylesheet is loaded via a `<link>` in `routes/_app.tsx`:

```tsx
<link rel="stylesheet" href="/weather-icons/weather-icons.min.css" />
```

Usage in components — add the `wi` base class plus a variant:

```tsx
<i class="wi wi-thermometer" />
<i class="wi wi-moon-waxing-crescent-3" />
```

To update: download the new CSS and font files from the [GitHub releases](https://github.com/erikflowers/weather-icons/releases) and re-apply the font path patch.

---

## Key Dev Patterns

### Fresh v2 handler + page

A route file exports both a `handler` (for data fetching) and a default page component:

```tsx
// routes/yesterday.tsx
import type { Handlers, PageProps } from "$fresh/server.ts";
import { AggregateView } from "../components/layout/AggregateView.tsx";
import { fetchAggregates, fetchAlmanac } from "../lib/api.ts";

interface Data {
  observations: AggregateObservation[];
  almanac: AlmanacData | null;
  station: StationConfig;
}

export const handler: Handlers<Data> = {
  async GET(_req, ctx) {
    const tz = station.timezone;
    // Use Temporal for timezone-correct midnight boundaries
    const today = Temporal.Now.plainDateISO(tz);
    const yesterday = today.subtract({ days: 1 });
    const from = yesterday.toZonedDateTime({ timeZone: tz, plainTime: "00:00" })
      .toInstant().epochSeconds;
    const to = today.toZonedDateTime({ timeZone: tz, plainTime: "00:00" })
      .toInstant().epochSeconds;

    const [observations, almanac] = await Promise.all([
      fetchAggregates(from, to, "hour"),
      fetchAlmanac(yesterday.toString()),
    ]);
    return ctx.render({ observations, almanac, station });
  },
};

export default function YesterdayPage({ data }: PageProps<Data>) {
  return <AggregateView title="Yesterday" {...data} />;
}
```

### Adding a new chart island

1. Create `islands/charts/MyChart.tsx` — accept `data: Observation[]` as a prop, initialise ECharts in a `useEffect`.
2. Add a `<ChartCard title="My Metric"><MyChart data={data} /></ChartCard>` entry to `components/conditions/ChartsGrid.tsx`.
3. No additional proxy route is needed unless you require a new engine endpoint.

### Adding a new island that reads live data

```tsx
import { latestObservation } from "../lib/hooks/useObservationState.ts";

export default function MyIsland() {
  const obs = latestObservation.value;
  return <div>{obs ? obs.temperature_c.toFixed(1) : "—"}</div>;
}
```

No polling setup is required — `CurrentConditions` calls `startObservationPolling()` once on mount and the module-scoped signal updates all consumers automatically.
