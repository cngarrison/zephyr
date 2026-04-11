# Writing a Storage Adapter

Zephyr's storage layer is provider-agnostic. Each provider implements the `StorageAdapter` interface and lives in its own directory under `engine/src/storage/providers/`.

---

## The `StorageAdapter` interface

Defined in `engine/src/storage/adapter.ts`:

```typescript
export interface StorageAdapter {
  /** Persist a single observation. */
  saveObservation(obs: Observation): Promise<void>;

  /** Most recent observation for a station. */
  getLatestObservation(stationId?: string): Promise<Observation | null>;

  /** Observations within a time range. */
  getObservationsRange(
    from: number,
    to: number,
    stationId?: string,
  ): Promise<Observation[]>;

  /** Time-bucketed aggregates ('hour' | 'day'). */
  getAggregates(
    from: number,
    to: number,
    bucket: "hour" | "day",
    stationId?: string,
  ): Promise<AggregateObservation[]>;

  /** Today's high/low/total summary. */
  getTodayStats(
    from: number,
    to: number,
    stationId?: string,
  ): Promise<TodayStats | null>;

  /** Per-day aggregates for heatmaps/history. */
  getDailyAggregates(year?: number): Promise<DailyAggregate[]>;

  /** Called once on startup — run migrations, open connections, etc. */
  init(): Promise<void>;

  /** Called on shutdown — close connections, flush buffers. */
  close(): Promise<void>;
}
```

Domain types (`Observation`, `AggregateObservation`, `TodayStats`, `DailyAggregate`) are also defined in `adapter.ts`.

---

## Directory structure

Create a new directory for your provider:

```
engine/src/storage/providers/
  mydb/
    index.ts        — createAdapter() entry point
    adapter.ts      — class implementing StorageAdapter
    migrate.ts      — migration runner
    migrations/
      001_initial_schema.ts
      002_daily_aggregates.ts
```

### `index.ts`

Reads connection config from the `Config` object and returns a ready adapter:

```typescript
import type { Config } from "../../../config.ts";
import { MyDbAdapter } from "./adapter.ts";

export async function createAdapter(config: Config): Promise<MyDbAdapter> {
  const cfg = config.storage.mydb;
  if (!cfg) throw new Error("[storage.mydb] section missing in config");
  const adapter = new MyDbAdapter(cfg);
  await adapter.init();
  return adapter;
}
```

### `adapter.ts`

Implement all methods from `StorageAdapter`. Call `runMigrations` inside `init()`:

```typescript
import type { StorageAdapter, Observation /*, ... */ } from "../../adapter.ts";
import { runMigrations } from "./migrate.ts";

export class MyDbAdapter implements StorageAdapter {
  constructor(private cfg: MyDbConfig) {}

  async init() {
    // open connection pool
    await runMigrations(this.connection);
  }

  async close() { /* close pool */ }

  async saveObservation(obs: Observation) { /* INSERT */ }
  // ... implement remaining methods
}
```

---

## Migrations

### `migrate.ts`

Forward-only migration runner. Maintain a `schema_version` table:

```typescript
import { migrations } from "./migrations/index.ts";

export async function runMigrations(db: YourConnectionType) {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version    INT  PRIMARY KEY,
      name       TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT NOW()
    )
  `);

  const [rows] = await db.query("SELECT MAX(version) AS v FROM schema_version");
  const current = rows[0].v ?? 0;

  for (const m of migrations) {
    if (m.version <= current) continue;
    await m.up(db);
    await db.execute(
      "INSERT INTO schema_version (version, name) VALUES (?, ?)",
      [m.version, m.name],
    );
  }
}
```

### `migrations/001_initial_schema.ts`

```typescript
export const migration = {
  version: 1,
  name: "initial_schema",
  async up(db) {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS observations (
        id         BIGINT PRIMARY KEY AUTO_INCREMENT,
        station_id TEXT   NOT NULL,
        timestamp  BIGINT NOT NULL,
        temp_c     DOUBLE,
        -- ... other columns
        UNIQUE KEY uq_station_ts (station_id, timestamp)
      )
    `);
  },
};
```

---

## Register the provider

### `engine/src/storage/factory.ts`

Add a case for your provider name:

```typescript
case "mydb": {
  const { createAdapter } = await import("./providers/mydb/index.ts");
  return createAdapter(config);
}
```

### `engine/config.ts`

Add a typed sub-section to the `StorageConfig` interface and parse it from TOML:

```typescript
export interface MyDbConfig {
  host:     string;
  port:     number;
  user:     string;
  password: string;
  database: string;
}

export interface StorageConfig {
  provider: "sqlite" | "mysql" | "mydb";
  sqlite?:  SqliteConfig;
  mysql?:   MySqlConfig;
  mydb?:    MyDbConfig;   // ← add this
}
```

Users configure it in `zephyr.toml`:

```toml
[storage]
provider = "mydb"

[storage.mydb]
host     = "localhost"
port     = 5432
user     = "zephyr"
password = "changeme"
database = "zephyr"
```

---

## SQL dialect notes

| Feature | SQLite | MySQL |
|---|---|---|
| Auto-increment PK | `INTEGER PRIMARY KEY` | `BIGINT PRIMARY KEY AUTO_INCREMENT` |
| Floating point | `REAL` | `DOUBLE` |
| Epoch timestamp | `INTEGER` | `BIGINT` |
| Upsert | `INSERT OR REPLACE` | `INSERT ... ON DUPLICATE KEY UPDATE` |
| Time bucketing | `strftime('%Y-%m-%dT%H:00:00Z', datetime(ts,'unixepoch'))` | `DATE_FORMAT(FROM_UNIXTIME(ts), '%Y-%m-%dT%H:00:00Z')` |
| DDL transactions | Supported (wrap in `BEGIN`/`COMMIT`) | **Not supported** — DDL auto-commits; do not wrap migrations in transactions |
| Node driver | `node:sqlite` (Deno built-in) | `npm:mysql2` (promise pool) |
