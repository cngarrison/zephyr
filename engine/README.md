# Zephyr Engine

The Zephyr engine is the core daemon: it receives weather data, stores it, and exposes a REST API. It runs independently of the web UI.

## Running

```bash
# Development (with file watcher)
deno task dev

# Production
deno task start
```

Runs from the `engine/` directory.

## Configuration

Configuration is loaded from a TOML file. The path is resolved in order:

1. `--config <path>` CLI flag
2. `$ZEPHYR_CONFIG` environment variable
3. `/etc/zephyr/zephyr.toml` (default)

Relevant sections for the engine:

```toml
[engine]
port = 8080
host = "0.0.0.0"

[storage]
provider = "sqlite"  # or "mysql"

[storage.sqlite]
path = "/var/lib/zephyr/zephyr.db"

[storage.mysql]
host = "localhost"
port = 3306
user = "zephyr"
password = "secret"
database = "zephyr"

[[stations]]
id = "default"
name = "My Weather Station"
lat = -33.8688
lon = 151.2093
altitude = 50
timezone = "Australia/Sydney"

[stations.ingest.push]
enabled = true

[stations.ingest.poll]
enabled = false
gw_host = "192.168.1.100"
gw_port = 45000
interval_seconds = 60
```

## API

### Config / Almanac

```
GET /api/config
  → { station: StationConfig }

GET /api/almanac?date=YYYY-MM-DD
  → sunrise/sunset/solar noon for station lat/lon
  date defaults to today UTC noon if omitted
```

### Observations

```
GET /api/observations/latest
  → latest Observation object

GET /api/observations/today?tz=<IANA>
  → today's stats (tz defaults to station config timezone)

GET /api/observations/range?from=<ISO>&to=<ISO>
  → Observation[] for time window

GET /api/observations?from=<epoch>&to=<epoch>&limit=<n>&offset=<n>
  → Observation[] (epoch seconds; limit defaults to 1000)

GET /api/observations/aggregate?from=<ISO>&to=<ISO>&bucket=hour|day
  → AggregateObservation[] bucketed by hour or day

GET /api/observations/daily?year=YYYY
  → daily aggregate rows; year optional (omit for all)
```

### Readings (extended/extra sensors)

```
GET /api/readings/latest?station=<id>
  → SensorReading[] (latest value per sensor)

GET /api/readings/<sensorId>?from=<epoch>&to=<epoch>&limit=<n>&offset=<n>
  → SensorReading[] time series for one sensor
  sensorId uses dot-notation: lightning.count, soil.moisture.1, etc.
```

### Ingest

```
GET  /ingest/wu       Weather Underground push protocol
POST /ingest/ecowitt  Ecowitt push protocol (form-encoded)
```

## Module Structure

```
engine/
├── main.ts                              Entry point; init storage → Deno.serve
├── config.ts                            TOML config loader; ZephyrConfig types
└── src/
    ├── domain/
    │   ├── observation.ts               Canonical Observation type (SI units)
    │   └── units.ts                     Unit conversions (°F→°C, inHg→hPa, etc.)
    ├── storage/
    │   ├── adapter.ts                   StorageAdapter interface + domain types
    │   ├── factory.ts                   createStorageAdapter() — reads config.storage.provider
    │   └── providers/
    │       ├── sqlite/
    │       │   ├── index.ts             createAdapter() factory
    │       │   ├── adapter.ts           SqliteAdapter implementation
    │       │   ├── migrate.ts           Forward-only migration runner
    │       │   └── migrations/          001_initial_schema.ts, 002_daily_aggregates.ts, …
    │       └── mysql/
    │           ├── index.ts             createAdapter() factory
    │           ├── adapter.ts           MysqlAdapter implementation (mysql2/promise)
    │           ├── migrate.ts           Async migration runner
    │           └── migrations/          001_initial_schema.ts, 002_daily_aggregates.ts, …
    ├── ingest/
    │   ├── normalizer.ts               WU/Ecowitt params → Observation + SensorReading[]
    │   ├── push.ts                     HTTP push receiver (WU + Ecowitt)
    │   └── poller.ts                   LAN API poller (currently: Ecowitt GW-series)
    ├── almanac/
    │   └── calculator.ts               Sunrise/sunset/solar-noon computation
    └── api/
        └── router.ts                   REST API handlers
```

## Extending

### Add a new storage adapter

1. Create a directory under `src/storage/providers/<name>/` containing:
   - `index.ts` — exported `createAdapter()` factory function
   - `adapter.ts` — class implementing `StorageAdapter` from `src/storage/adapter.ts`
   - `migrate.ts` — migration runner
   - `migrations/` — numbered migration files
2. Register the new provider in `src/storage/factory.ts` alongside the existing `sqlite` and `mysql` cases.

### Add a new ingest protocol

Add a handler in `src/ingest/push.ts` (HTTP push) or create a new poller in `src/ingest/`. Normalise incoming data to `{ observation: Observation, readings: SensorReading[] }` using helpers in `src/ingest/normalizer.ts`.
