import type { DatabaseSync } from "node:sqlite";

export function up(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS observations (
      timestamp        INTEGER PRIMARY KEY,
      station_id       TEXT    NOT NULL DEFAULT 'default',
      temp_indoor      REAL,
      temp_outdoor     REAL,
      temp_dewpoint    REAL,
      temp_feels_like  REAL,
      humidity_indoor  REAL,
      humidity_outdoor REAL,
      pressure_abs     REAL,
      pressure_rel     REAL,
      wind_speed       REAL,
      wind_gust        REAL,
      wind_direction   REAL,
      rain_rate        REAL,
      rain_daily       REAL,
      rain_weekly      REAL,
      rain_monthly     REAL,
      rain_yearly      REAL,
      rain_event       REAL,
      solar_radiation  REAL,
      uv_index         REAL,
      vpd              REAL
    );
    CREATE INDEX IF NOT EXISTS idx_obs_timestamp ON observations (timestamp);
    CREATE INDEX IF NOT EXISTS idx_obs_station   ON observations (station_id, timestamp);
    CREATE TABLE IF NOT EXISTS readings (
      timestamp  INTEGER NOT NULL,
      station_id TEXT    NOT NULL DEFAULT 'default',
      sensor_id  TEXT    NOT NULL,
      value      REAL    NOT NULL,
      PRIMARY KEY (timestamp, station_id, sensor_id)
    );
    CREATE INDEX IF NOT EXISTS idx_readings_sensor    ON readings (sensor_id, timestamp);
    CREATE INDEX IF NOT EXISTS idx_readings_timestamp ON readings (timestamp);
  `);
}
