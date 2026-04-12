import type { DatabaseSync } from 'node:sqlite';

export function up(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS daily_aggregates (
      date               TEXT PRIMARY KEY,
      temp_c_min         REAL,
      temp_c_max         REAL,
      temp_c_avg         REAL,
      dew_point_c_min    REAL,
      dew_point_c_max    REAL,
      dew_point_c_avg    REAL,
      humidity_pct_min   REAL,
      humidity_pct_max   REAL,
      humidity_pct_avg   REAL,
      pressure_hpa_min   REAL,
      pressure_hpa_max   REAL,
      pressure_hpa_avg   REAL,
      wind_speed_ms_max  REAL,
      wind_speed_ms_avg  REAL,
      wind_gust_ms_max   REAL,
      rain_total_mm      REAL,
      uv_index_max       REAL,
      uv_index_avg       REAL,
      solar_rad_wm2_max  REAL,
      solar_rad_wm2_avg  REAL
    )
  `);
}
