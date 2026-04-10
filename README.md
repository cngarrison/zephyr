# Zephyr Weather

A lightweight, engine-first weather station system built with Deno and TypeScript. Zephyr collects, stores and displays weather data from personal weather stations — designed as a modern, extensible alternative to [weewx](https://weewx.com).

## Why Zephyr?

weewx is a capable system but has accumulated complexity over many years of Python 2→3 migration, and its storage layer has known issues with MySQL case-sensitivity that emerged in v5.3. Zephyr takes a fresh approach:

- **Engine-first**: the data collection and storage core is the product. The web UI is one consumer among many.
- **No Python**: pure Deno + TypeScript throughout.
- **Simple by default**: SQLite out of the box, no database server required.
- **Extensible by design**: storage adapters, ingest plugins, and sensor types are all interface-driven.

## Features

### Current
- Ecowitt GW1000 gateway support (WU push, Ecowitt push, LAN API poll)
- SQLite storage via `node:sqlite` (configurable path — NFS/network mounts supported)
- Hybrid storage schema: core observations table + extensible readings table
- Auto-normalises all data to SI units internally
- Supports all standard GW1000 sensors: temperature, humidity, pressure, wind, rain, solar, UV
- Extended sensor support: soil moisture/temperature (8 channels), extra temp/humidity (8 channels), leaf wetness, lightning
- REST API for observations and sensor readings
- Fresh v2 web dashboard with current conditions display
- Daily/weekly/monthly graphs (Apache ECharts)
- Tailwind v4 dark theme
- weewx data migration script

### Planned
- Live updates via SSE or polling islands
- Almanac (sunrise/sunset, moon phase)
- MySQL storage adapter
- Systemd service units for Raspberry Pi
- Third-party embeds (Windy Map, BOM radar, etc.)
- Cloud upload adapters (Weather Underground, Ecowitt, CWOP)
- Static HTML export for HomeAssistant integration
- Themes / skins

## Architecture

```
GW1000 ──push──▶ Engine (HTTP :8080)
                  ├── /ingest/wu       WU protocol push
                  ├── /ingest/ecowitt  Ecowitt protocol push
                  ├── /api/observations/latest
                  └── /api/observations?from=&to=&limit=
                  └── /api/readings/latest
                  └── /api/readings/<sensorId>?from=&to=

Browser ◀── Web (Fresh v2, :8081) ◀── Engine REST API
```

Two Deno packages in a workspace:

| Package | Description |
|---|---|
| `engine/` | Data ingest, SQLite storage, REST API |
| `web/` | Fresh v2 + Vite dashboard |

## Quick Start

### Prerequisites

- [Deno](https://deno.com) v2.2+
- Ecowitt GW1000 (or compatible) gateway on your LAN

### Setup

```bash
git clone https://github.com/cngarrison/zephyr
cd zephyr
deno install
cp engine/.env.example engine/.env
# Edit engine/.env — set SQLITE_PATH, ENGINE_PORT, etc.
```

### Run (development)

```bash
# Engine only
deno task engine

# Web dev server only
deno task web:dev

# Both
deno task dev
```

### Configure your gateway

Point your GW1000 to push to the engine:

| Protocol | URL |
|---|---|
| Weather Underground | `http://<host>:8080/ingest/wu` |
| Ecowitt | `http://<host>:8080/ingest/ecowitt` |

In the Ecowitt app or GW1000 web UI: *Weather Services → Customized → set server IP, path, and port.*

### Test ingest

```bash
curl "http://localhost:8080/ingest/wu?tempf=72.5&humidity=65&baromrelin=29.92&windspeedmph=5&winddir=225&solarradiation=450&UV=3"
curl http://localhost:8080/api/observations/latest
```

## Configuration

See [`engine/.env.example`](engine/.env.example) and [`web/.env.example`](web/.env.example) for all options.

### Key engine variables

| Variable | Default | Description |
|---|---|---|
| `DB_TYPE` | `sqlite` | Storage adapter (`sqlite` or `mysql`) |
| `SQLITE_PATH` | `./data/zephyr.db` | SQLite database path (supports NFS mounts) |
| `ENGINE_PORT` | `8080` | Engine HTTP port |
| `INGEST_PUSH_ENABLED` | `true` | Enable HTTP push receiver |
| `INGEST_POLL_ENABLED` | `false` | Enable GW1000 LAN API poller |
| `GW_HOST` | `192.168.1.100` | GW1000 IP (if polling) |

## Storage Schema

Zephyr uses a hybrid two-table schema:

**`observations`** — one row per interval, fixed columns for universal sensors. All values in SI units.

**`readings`** — flexible key-value table for extended sensors. `sensor_id` uses dot-notation:

```
lightning.count       soil.moisture.1    temp.extra.1
lightning.distance_km soil.temp.1        leaf.wetness.1
```

This avoids the per-type-table explosion of weewx while keeping common observations fast to query.

## REST API

```
GET /api/observations/latest
GET /api/observations?from=<epoch>&to=<epoch>&limit=<n>
GET /api/readings/latest?station=<id>
GET /api/readings/<sensorId>?from=<epoch>&to=<epoch>&limit=<n>
```

## Development

```bash
# Type check
deno check engine/main.ts

# Lint
deno lint

# Format
deno fmt

# Build web for production
deno task web:build

# Run production
deno task start
```

## Raspberry Pi Deployment

Systemd service units are planned. For now, run engine and web as background processes or use `tmux`/`screen`. The engine should be run from the `engine/` directory so it picks up its `.env` file.

## Contributing

Contributions welcome. Key areas for community extension:

- **Storage adapters** — implement `StorageAdapter` interface (`engine/src/storage/adapter.ts`)
- **Ingest drivers** — additional hardware protocols (`engine/src/ingest/`)
- **Cloud uploaders** — Weather Underground, CWOP, Ecowitt cloud, etc.
- **Web themes** — alternative Tailwind/CSS themes
- **GW1000 poller parsing** — complete the LAN API JSON → Observation mapping (`engine/src/ingest/poller.ts`)

## License

MIT
