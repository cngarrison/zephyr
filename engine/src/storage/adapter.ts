import type { Observation } from "../domain/observation.ts";

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

export interface StorageAdapter {
  init(): Promise<void>;

  // Core interval observations (universal sensors, fixed schema)
  insert(obs: Observation): Promise<void>;
  insertBatch(obs: Observation[]): Promise<void>;
  latest(): Promise<Observation | null>;
  query(q: ObservationQuery): Promise<Observation[]>;

  // Extended sensor readings (event sensors, multi-channel, custom hardware)
  insertReadings(readings: SensorReading[]): Promise<void>;
  latestReadings(stationId?: string): Promise<SensorReading[]>;
  queryReadings(sensorId: string, q: ObservationQuery): Promise<SensorReading[]>;

  getObservationsRange(from: Date, to: Date): Promise<Observation[]>;
  getAggregates(from: Date, to: Date, bucket: 'hour' | 'day'): Promise<AggregateObservation[]>;
  getDailyAggregates(year?: number): Promise<DailyAggregate[]>;
  getTodayStats(from: number, to: number): Promise<TodayStats>;

  close(): Promise<void>;
}
