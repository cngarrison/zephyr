# Zephyr Web

The Zephyr web dashboard — a Fresh v2 + Vite + Tailwind v4 UI that displays weather data from the Zephyr engine.

## Running

```bash
# Development (Vite HMR)
deno task dev

# Build for production
deno task build

# Run production server
deno task start   # serves on configured WEB_PORT
```

Set `WEB_ENGINE_URL` in the environment (or shell) to point at your engine instance.

## Configuration

| Variable | Default | Description |
|---|---|---|
| `WEB_ENGINE_URL` | `http://localhost:8080` | Engine base URL |

## Data Flow

```
Browser request
  → Fresh route handler (server-side)
  → lib/api.ts fetchLatest() → Engine REST API
  → page() data passed to page component
  → SSR HTML returned to browser

Browser islands (planned)
  → fetch /api/observations  (proxied to engine via routes/api/)
  → ECharts graph islands
```

## Key Files

```
web/
├── main.ts              Fresh app entry (define.middleware, fsRoutes)
├── utils.ts             createDefine<State>() — typed Fresh helpers
├── lib/
│   ├── types.ts         Local copy of Observation + SensorReading types
│   └── api.ts           Engine fetch client (fetchLatest, fetchObservations)
├── routes/
│   ├── _app.tsx         HTML shell (PageProps from 'fresh')
│   ├── index.tsx        Current conditions dashboard
│   └── api/
│       └── observations.ts  Proxy → engine (for browser islands)
└── assets/
    └── styles.css       Tailwind v4 + CSS vars
```

## Fresh v2 Patterns

```typescript
// Handler: fetch data server-side
import { page } from "fresh";
export const handler = define.handlers({
  async GET(_ctx) {
    return page({ obs: await fetchLatest() });
  }
});

// Page: receive data as props
export default define.page(function Home({ data }) {
  const { obs } = data;
  return <main>...</main>;
});
```
