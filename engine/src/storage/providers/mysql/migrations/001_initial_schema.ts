import type { Pool } from "mysql2/promise";

export async function up(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS observations (
      timestamp        BIGINT       NOT NULL,
      station_id       VARCHAR(255) NOT NULL DEFAULT 'default',
      temp_indoor      DOUBLE,
      temp_outdoor     DOUBLE,
      temp_dewpoint    DOUBLE,
      temp_feels_like  DOUBLE,
      humidity_indoor  DOUBLE,
      humidity_outdoor DOUBLE,
      pressure_abs     DOUBLE,
      pressure_rel     DOUBLE,
      wind_speed       DOUBLE,
      wind_gust        DOUBLE,
      wind_direction   DOUBLE,
      rain_rate        DOUBLE,
      rain_daily       DOUBLE,
      rain_weekly      DOUBLE,
      rain_monthly     DOUBLE,
      rain_yearly      DOUBLE,
      rain_event       DOUBLE,
      solar_radiation  DOUBLE,
      uv_index         DOUBLE,
      vpd              DOUBLE,
      PRIMARY KEY (timestamp),
      INDEX idx_obs_station (station_id, timestamp)
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS readings (
      timestamp  BIGINT       NOT NULL,
      station_id VARCHAR(255) NOT NULL DEFAULT 'default',
      sensor_id  VARCHAR(255) NOT NULL,
      value      DOUBLE       NOT NULL,
      PRIMARY KEY (timestamp, station_id, sensor_id),
      INDEX idx_readings_sensor (sensor_id, timestamp),
      INDEX idx_readings_timestamp (timestamp)
    )
  `);
}
