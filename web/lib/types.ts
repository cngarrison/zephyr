// Local copies of engine types for the web package.
// TODO: extract to a shared @zephyr/types package.

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

export interface Observation {
  timestamp: number;
  stationId: string;
  tempIndoor?: number;
  tempOutdoor?: number;
  tempDewpoint?: number;
  tempFeelsLike?: number;
  humidityIndoor?: number;
  humidityOutdoor?: number;
  vpd?: number;             // Vapour Pressure Deficit kPa
  pressureAbsolute?: number;
  pressureRelative?: number;
  windSpeed?: number;
  windGust?: number;
  windDirection?: number;
  rainRate?: number;
  rainDaily?: number;
  rainWeekly?: number;
  rainMonthly?: number;
  rainYearly?: number;
  rainEvent?: number;
  solarRadiation?: number;
  uvIndex?: number;
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
// Almanac
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

// ---------------------------------------------------------------------------
// Today's stats
// ---------------------------------------------------------------------------

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

// sensorId uses dot-notation: 'lightning.count', 'soil.moisture.1', 'temp.extra.2'
export interface SensorReading {
  timestamp: number;
  stationId: string;
  sensorId: string;
  value: number;
}
