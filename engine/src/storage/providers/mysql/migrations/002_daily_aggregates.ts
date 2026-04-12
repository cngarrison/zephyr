import type { Pool } from 'mysql2/promise';

export async function up(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS daily_aggregates (
      date               VARCHAR(10)  NOT NULL,
      temp_c_min         DOUBLE,
      temp_c_max         DOUBLE,
      temp_c_avg         DOUBLE,
      dew_point_c_min    DOUBLE,
      dew_point_c_max    DOUBLE,
      dew_point_c_avg    DOUBLE,
      humidity_pct_min   DOUBLE,
      humidity_pct_max   DOUBLE,
      humidity_pct_avg   DOUBLE,
      pressure_hpa_min   DOUBLE,
      pressure_hpa_max   DOUBLE,
      pressure_hpa_avg   DOUBLE,
      wind_speed_ms_max  DOUBLE,
      wind_speed_ms_avg  DOUBLE,
      wind_gust_ms_max   DOUBLE,
      rain_total_mm      DOUBLE,
      uv_index_max       DOUBLE,
      uv_index_avg       DOUBLE,
      solar_rad_wm2_max  DOUBLE,
      solar_rad_wm2_avg  DOUBLE,
      PRIMARY KEY (date)
    )
  `);
}
