# Zephyr Engine

The Zephyr engine is the core daemon: it receives weather data, stores it, and exposes a REST API. It runs independently of the web UI.

## Running

```bash
# Development (with file watcher)
deno task dev

# Production
deno task start
```

Runs from the `engine/` directory. Copy `.env.example` to `.env` and edit before starting.

## Configuration

All configuration is via environment variables loaded from `.env`.

| Variable | Default | Description |
|---|---|---|
| `DB_TYPE` | `sqlite` | `sqlite` or `mysql` |
| `SQLITE_PATH` | `./data/zephyr.db` | SQLite file path. Supports absolute paths for NFS mounts. |
| `ENGINE_PORT` | `8080` | HTTP server port |
| `ENGINE_HOST` | `0.0.0.0` | HTTP server bind address |
| `INGEST_PUSH_ENABLED` | `true` | Enable push receiver |
| `INGEST_POLL_ENABLED` | `false` | Enable GW1000 LAN API poller |
| `GW_HOST` | `192.168.1.100` | GW1000 IP address (poll mode) |
| `GW_PORT` | `45000` | GW1000 LAN API port (poll mode) |
| `POLL_INTERVAL_SECONDS` | `60` | Poll interval in seconds |

## API

### Observations

```
GET /api/observations/latest
  → latest Observation object

GET /api/observations?from=<epoch>&to=<epoch>&limit=<n>&offset=<n>
  → Observation[]
```

### Readings (extended sensors)

```
GET /api/readings/latest?station=<id>
  → SensorReading[] (one per sensor, latest value)

GET /api/readings/<sensorId>?from=<epoch>&to=<epoch>&limit=<n>
  → SensorReading[] time series for one sensor
```

### Ingest

```
GET  /ingest/wu       Weather Underground push protocol
POST /ingest/ecowitt  Ecowitt push protocol (form-encoded)
```

## Module Structure

```
engine/
├── main.ts                   Entry point
├── config.ts                 Typed config from env
└── src/
    ├── domain/
    │   ├── observation.ts    Canonical Observation type (SI units)
    │   └── units.ts          Unit conversions (°F→°C, inHg→hPa, etc.)
    ├── storage/
    │   ├── adapter.ts        StorageAdapter interface + SQL schema
    │   ├── sqlite.ts         node:sqlite (DatabaseSync) implementation
    │   ├── mysql.ts          MySQL stub (TODO)
    │   └── factory.ts        createStorageAdapter(config)
    ├── ingest/
    │   ├── normalizer.ts     WU/Ecowitt params → Observation + SensorReading[]
    │   ├── push.ts           HTTP push receiver
    │   └── poller.ts         GW1000 LAN API poller (parsing TODO)
    └── api/
        └── router.ts         REST API handlers
```

## Extending

### Add a new storage adapter

Implement `StorageAdapter` from `src/storage/adapter.ts` and register it in `src/storage/factory.ts`.

### Add a new ingest protocol

Add a handler in `src/ingest/push.ts` (for HTTP push) or create a new poller in `src/ingest/`. Normalise to `NormalizedData` (`{ observation: Observation, readings: SensorReading[] }`) using the helpers in `src/ingest/normalizer.ts`.
