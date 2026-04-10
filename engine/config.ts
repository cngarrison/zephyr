import "@std/dotenv/load";

export interface IngestPushConfig {
  enabled: boolean;
  debugDump: boolean;  // Write raw ingest params to data/ for debugging
}

export interface IngestPollConfig {
  enabled: boolean;
  gwHost: string;
  gwPort: number;
  intervalSeconds: number;
}

export interface ServerConfig {
  port: number;
  host: string;
}

export interface ExtraEmbed {
  label: string;
  url: string;
  height?: number;
}

export interface StationConfig {
  name: string;
  lat: number;
  lon: number;
  altitude: number;
  timezone: string;
  extras: ExtraEmbed[];
}

export interface Config {
  ingest: {
    push: IngestPushConfig;
    poll: IngestPollConfig;
  };
  server: ServerConfig;
  station: StationConfig;
}

function envInt(key: string, fallback: number): number {
  const val = Deno.env.get(key);
  if (!val) return fallback;
  const n = parseInt(val, 10);
  return isNaN(n) ? fallback : n;
}

function envFloat(key: string, fallback: number): number {
  const val = Deno.env.get(key);
  if (!val) return fallback;
  const n = parseFloat(val);
  return isNaN(n) ? fallback : n;
}

function envBool(key: string, fallback: boolean): boolean {
  const val = Deno.env.get(key);
  if (val === undefined) return fallback;
  return val !== "false" && val !== "0";
}

function envJsonArray<T>(key: string, fallback: T[]): T[] {
  const val = Deno.env.get(key);
  if (!val) return fallback;
  try {
    const parsed = JSON.parse(val);
    return Array.isArray(parsed) ? parsed as T[] : fallback;
  } catch {
    return fallback;
  }
}

export const config: Config = {
  ingest: {
    push: {
      enabled: envBool("INGEST_PUSH_ENABLED", true),
      debugDump: envBool("INGEST_DEBUG_DUMP", false),
    },
    poll: {
      enabled: envBool("INGEST_POLL_ENABLED", false),
      gwHost: Deno.env.get("GW_HOST") ?? "192.168.1.100",
      gwPort: envInt("GW_PORT", 45000),
      intervalSeconds: envInt("POLL_INTERVAL_SECONDS", 60),
    },
  },
  server: {
    port: envInt("ENGINE_PORT", 8080),
    host: Deno.env.get("ENGINE_HOST") ?? "0.0.0.0",
  },
  station: {
    name: Deno.env.get("STATION_NAME") ?? "My Weather Station",
    lat: envFloat("STATION_LAT", 0),
    lon: envFloat("STATION_LON", 0),
    altitude: envFloat("STATION_ALTITUDE_M", 0),
    timezone: Deno.env.get("STATION_TIMEZONE") ?? "UTC",
    extras: envJsonArray<ExtraEmbed>("STATION_EXTRAS_JSON", []),
  },
};
