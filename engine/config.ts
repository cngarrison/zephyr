import { parse } from '@std/toml';

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface IngestPushConfig {
  enabled: boolean;
  debugDump: boolean;
  deviceIds: Record<string, string>;
}

export interface IngestPollConfig {
  enabled: boolean;
  gwHost: string;
  gwPort: number;
  intervalSeconds: number;
}

export interface IngestConfig {
  push: IngestPushConfig;
  poll: IngestPollConfig;
}

export interface StationConfig {
  id: string;
  name: string;
  lat: number;
  lon: number;
  altitude: number;
  timezone: string;
  ingest: IngestConfig;
}

export interface StorageSqliteConfig {
  path: string;
}

export interface StorageMysqlConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

export interface StorageConfig {
  provider: 'sqlite' | 'mysql';
  sqlite: StorageSqliteConfig;
  mysql?: StorageMysqlConfig;
}

export interface EngineServerConfig {
  port: number;
  host: string;
}

export interface WebConfig {
  engineUrl: string;
}

export interface Config {
  engine: EngineServerConfig;
  web: WebConfig;
  storage: StorageConfig;
  stations: StationConfig[];
}

// ---------------------------------------------------------------------------
// Path resolution (identical logic in web/lib/config.ts)
// ---------------------------------------------------------------------------

function resolveConfigPath(): string {
  // 1. --config <path> CLI flag
  const flagIdx = Deno.args.indexOf('--config');
  if (flagIdx !== -1 && Deno.args[flagIdx + 1]) {
    return Deno.args[flagIdx + 1];
  }
  // 2. $ZEPHYR_CONFIG environment variable
  const envPath = Deno.env.get('ZEPHYR_CONFIG');
  if (envPath) return envPath;
  // 3. Well-known default
  return '/etc/zephyr/zephyr.toml';
}

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

function loadConfig(): Config {
  const configPath = resolveConfigPath();
  let raw: string;
  try {
    raw = Deno.readTextFileSync(configPath);
  } catch (err) {
    throw new Error(`Failed to read Zephyr config at ${configPath}: ${err}`);
  }

  // deno-lint-ignore no-explicit-any
  const t = parse(raw) as any;

  // deno-lint-ignore no-explicit-any
  const stations: StationConfig[] = (t.stations ?? []).map((s: any) => ({
    id: s.id ?? 'default',
    name: s.name ?? 'My Weather Station',
    lat: s.lat ?? 0,
    lon: s.lon ?? 0,
    altitude: s.altitude ?? 0,
    timezone: s.timezone ?? 'UTC',
    ingest: {
      push: {
        enabled: s.ingest?.push?.enabled ?? true,
        debugDump: s.ingest?.push?.debug_dump ?? false,
        deviceIds: s.ingest?.push?.device_ids ?? {},
      },
      poll: {
        enabled: s.ingest?.poll?.enabled ?? false,
        gwHost: s.ingest?.poll?.gw_host ?? '192.168.1.100',
        gwPort: s.ingest?.poll?.gw_port ?? 45000,
        intervalSeconds: s.ingest?.poll?.interval_seconds ?? 60,
      },
    },
  }));

  const storage: StorageConfig = {
    provider: t.storage?.provider ?? 'sqlite',
    sqlite: {
      path: t.storage?.sqlite?.path ?? '/var/lib/zephyr/zephyr.db',
    },
  };
  if (t.storage?.mysql) {
    storage.mysql = {
      host: t.storage.mysql.host ?? 'localhost',
      port: t.storage.mysql.port ?? 3306,
      user: t.storage.mysql.user ?? '',
      password: t.storage.mysql.password ?? '',
      database: t.storage.mysql.database ?? '',
    };
  }

  return {
    engine: {
      port: t.engine?.port ?? 8080,
      host: t.engine?.host ?? '0.0.0.0',
    },
    web: {
      engineUrl: t.web?.engine_url ?? 'http://localhost:8080',
    },
    storage,
    stations,
  };
}

// ---------------------------------------------------------------------------
// Singleton + helpers
// ---------------------------------------------------------------------------

export const config: Config = loadConfig();

export function primaryStation(): StationConfig {
  if (config.stations.length === 0) {
    throw new Error('No [[stations]] configured in zephyr.toml');
  }
  return config.stations[0];
}
