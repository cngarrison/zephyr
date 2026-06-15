import { parse } from '@std/toml';

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface StationConfig {
  id: string;
  name: string;
  lat: number;
  lon: number;
  altitude: number;
  timezone: string;
}

export interface WebConfig {
  engineUrl: string;
}

export interface Config {
  web: WebConfig;
  stations: StationConfig[];
}

// ---------------------------------------------------------------------------
// Path resolution (identical logic in engine/config.ts)
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
  } catch (e) {
    // In development the production path won't exist; fall back to defaults
    // so the web server can start without a config file present.
    console.warn(
      `[zephyr/web] Config file not found at ${configPath}; using defaults. ` +
        `Set ZEPHYR_CONFIG or pass --config <path> to override.`,
      e,
    );
    return {
      web: { engineUrl: 'http://localhost:8080' },
      stations: [],
    };
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
  }));

  return {
    web: {
      engineUrl: t.web?.engine_url ?? 'http://localhost:8080',
    },
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
