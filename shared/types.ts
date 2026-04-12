// shared/types.ts — Single source of truth for all domain types shared between
// engine and web packages. When adding a new observation field, add it HERE only.
// Engine: import from '@zephyr/shared'
// Web:    import from '@zephyr/shared' (or via web/lib/types.ts re-export)

// ---------------------------------------------------------------------------
// Core observation (engine/src/domain/observation.ts — canonical)
// ---------------------------------------------------------------------------

// Canonical interval weather observation.
// All numeric values in SI units unless otherwise noted.
// Extended/event sensors (lightning, soil, extra channels) are stored
// in the readings table — see storage/adapter.ts.
export interface Observation {
  timestamp: number; // Unix epoch, seconds
  stationId: string;

  // Temperature °C
  tempIndoor?: number;
  tempOutdoor?: number;
  tempDewpoint?: number;
  tempFeelsLike?: number;

  // Humidity %
  humidityIndoor?: number;
  humidityOutdoor?: number;

  // Atmospheric
  vpd?: number;             // Vapour Pressure Deficit kPa

  // Pressure hPa
  pressureAbsolute?: number;
  pressureRelative?: number;

  // Wind
  windSpeed?: number; // m/s
  windGust?: number; // m/s
  windDirection?: number; // degrees 0–360

  // Rain mm
  rainRate?: number; // mm/hr
  rainDaily?: number;
  rainWeekly?: number;
  rainMonthly?: number;
  rainYearly?: number;
  rainEvent?: number;

  // Solar
  solarRadiation?: number; // W/m²
  uvIndex?: number;
}

// ---------------------------------------------------------------------------
// Storage domain types (engine/src/storage/adapter.ts — canonical)
// ---------------------------------------------------------------------------

// A single extended sensor reading.
// sensorId uses dot-notation: 'lightning.count', 'soil.moisture.1', 'temp.extra.2'
export interface SensorReading {
  timestamp: number; // Unix epoch, seconds
  stationId: string;
  sensorId: string;
  value: number;
}

export interface ObservationQuery {
  from?: number; // epoch seconds (inclusive)
  to?: number; // epoch seconds (inclusive)
  limit?: number;
  offset?: number;
}

export interface TodayStats {
  temp_min: number | null;         temp_min_time: number | null;
  temp_max: number | null;         temp_max_time: number | null;
  humidity_min: number | null;     humidity_min_time: number | null;
  humidity_max: number | null;     humidity_max_time: number | null;
  pressure_min: number | null;     pressure_min_time: number | null;
  pressure_max: number | null;     pressure_max_time: number | null;
  wind_speed_avg: number | null;
  wind_speed_max: number | null;   wind_speed_max_time: number | null;
  wind_dir_at_max: number | null;
  rain_rate_max: number | null;    rain_rate_max_time: number | null;
  rain_today: number | null;
  dew_point_min: number | null;    dew_point_min_time: number | null;
  dew_point_max: number | null;    dew_point_max_time: number | null;
  uv_max: number | null;           uv_max_time: number | null;
  solar_max: number | null;        solar_max_time: number | null;
  temp_indoor_min: number | null;  temp_indoor_min_time: number | null;
  temp_indoor_max: number | null;  temp_indoor_max_time: number | null;
}

export interface AggregateObservation {
  bucket: string;            // ISO timestamp string (hour or day bucket)
  temp_c_avg?: number;
  temp_c_min?: number;
  temp_c_max?: number;
  dew_point_c_avg?: number;
  humidity_pct_avg?: number;
  pressure_hpa_avg?: number;
  wind_speed_ms_avg?: number;
  wind_gust_ms_max?: number;
  rain_total_mm?: number;
  uv_index_avg?: number;
  solar_rad_wm2_avg?: number;
}

export interface DailyAggregate {
  date: string;               // YYYY-MM-DD
  temp_c_min?: number;
  temp_c_max?: number;
  temp_c_avg?: number;
  dew_point_c_min?: number;
  dew_point_c_max?: number;
  dew_point_c_avg?: number;
  humidity_pct_min?: number;
  humidity_pct_max?: number;
  humidity_pct_avg?: number;
  pressure_hpa_min?: number;
  pressure_hpa_max?: number;
  pressure_hpa_avg?: number;
  wind_speed_ms_max?: number;
  wind_speed_ms_avg?: number;
  wind_gust_ms_max?: number;
  rain_total_mm?: number;
  uv_index_max?: number;
  uv_index_avg?: number;
  solar_rad_wm2_max?: number;
  solar_rad_wm2_avg?: number;
}

// ---------------------------------------------------------------------------
// Web / station config types (web/lib/types.ts — canonical)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Almanac types (engine/src/almanac/calculator.ts + web/lib/types.ts — canonical)
// ---------------------------------------------------------------------------

export interface SunTimes {
  sunrise: string | null;
  sunset: string | null;
  solarNoon: string | null;
  dawn: string | null;       // civil twilight begin
  dusk: string | null;       // civil twilight end
  goldenHourEnd: string | null;
  goldenHour: string | null;
  dayLengthSeconds: number;
}

export interface MoonData {
  rise: string | null;
  set: string | null;
  fraction: number;    // 0–1 illuminated fraction
  phase: number;       // 0–1 (0 = new, 0.5 = full)
  phaseName: string;
  angle: number;
}

export interface AlmanacData {
  date: string;        // YYYY-MM-DD
  sun: SunTimes;
  moon: MoonData;
}
