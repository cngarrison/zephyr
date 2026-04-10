import { DatabaseSync } from "node:sqlite";
import type { SQLInputValue } from "node:sqlite";
import { ensureDir } from "@std/fs";
import { dirname } from "@std/path";
import { runMigrations } from "./migrate.ts";
import type {
  AggregateObservation,
  DailyAggregate,
  ObservationQuery,
  SensorReading,
  StorageAdapter,
  TodayStats,
} from "../../adapter.ts";
import type { Observation } from "../../../domain/observation.ts";

export class SqliteAdapter implements StorageAdapter {
  #db: DatabaseSync | null = null;
  readonly #path: string;

  constructor(path: string) {
    this.#path = path;
  }

  async init(): Promise<void> {
    await ensureDir(dirname(this.#path));
    this.#db = new DatabaseSync(this.#path);
    runMigrations(this.#db);
  }

  // ---------------------------------------------------------------------------
  // Core observations
  // ---------------------------------------------------------------------------

  // deno-lint-ignore require-await
  async insert(obs: Observation): Promise<void> {
    this.#db!.prepare(
      `INSERT OR REPLACE INTO observations (
        timestamp, station_id,
        temp_indoor, temp_outdoor, temp_dewpoint, temp_feels_like,
        humidity_indoor, humidity_outdoor,
        pressure_abs, pressure_rel,
        wind_speed, wind_gust, wind_direction,
        rain_rate, rain_daily, rain_weekly, rain_monthly, rain_yearly, rain_event,
        solar_radiation, uv_index, vpd
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      obs.timestamp, obs.stationId,
      obs.tempIndoor ?? null, obs.tempOutdoor ?? null,
      obs.tempDewpoint ?? null, obs.tempFeelsLike ?? null,
      obs.humidityIndoor ?? null, obs.humidityOutdoor ?? null,
      obs.pressureAbsolute ?? null, obs.pressureRelative ?? null,
      obs.windSpeed ?? null, obs.windGust ?? null, obs.windDirection ?? null,
      obs.rainRate ?? null, obs.rainDaily ?? null, obs.rainWeekly ?? null,
      obs.rainMonthly ?? null, obs.rainYearly ?? null, obs.rainEvent ?? null,
      obs.solarRadiation ?? null, obs.uvIndex ?? null, obs.vpd ?? null,
    );
  }

  async insertBatch(obs: Observation[]): Promise<void> {
    this.#db!.exec("BEGIN");
    try {
      for (const o of obs) await this.insert(o);
      this.#db!.exec("COMMIT");
    } catch (err) {
      this.#db!.exec("ROLLBACK");
      throw err;
    }
  }

  // deno-lint-ignore require-await
  async latest(): Promise<Observation | null> {
    const row = this.#db!.prepare(
      "SELECT * FROM observations ORDER BY timestamp DESC LIMIT 1",
    ).get() as Record<string, unknown> | undefined;
    return row ? rowToObservation(row) : null;
  }

  // deno-lint-ignore require-await
  async query(q: ObservationQuery): Promise<Observation[]> {
    const conditions: string[] = [];
    const params: SQLInputValue[] = [];
    if (q.from !== undefined) { conditions.push("timestamp >= ?"); params.push(q.from); }
    if (q.to !== undefined) { conditions.push("timestamp <= ?"); params.push(q.to); }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const limit = q.limit !== undefined ? `LIMIT ${q.limit}` : "";
    const offset = q.offset !== undefined ? `OFFSET ${q.offset}` : "";
    const rows = this.#db!.prepare(
      `SELECT * FROM observations ${where} ORDER BY timestamp ASC ${limit} ${offset}`,
    ).all(...params) as Record<string, unknown>[];
    return rows.map(rowToObservation);
  }

  // ---------------------------------------------------------------------------
  // Extended sensor readings
  // ---------------------------------------------------------------------------

  // deno-lint-ignore require-await
  async insertReadings(readings: SensorReading[]): Promise<void> {
    const stmt = this.#db!.prepare(
      "INSERT OR REPLACE INTO readings (timestamp, station_id, sensor_id, value) VALUES (?, ?, ?, ?)",
    );
    this.#db!.exec("BEGIN");
    try {
      for (const r of readings) stmt.run(r.timestamp, r.stationId, r.sensorId, r.value);
      this.#db!.exec("COMMIT");
    } catch (err) {
      this.#db!.exec("ROLLBACK");
      throw err;
    }
  }

  // deno-lint-ignore require-await
  async latestReadings(stationId?: string): Promise<SensorReading[]> {
    const stationFilter = stationId ? "WHERE station_id = ?" : "";
    const joinFilter = stationId ? "WHERE r.station_id = ?" : "";
    const params: SQLInputValue[] = stationId ? [stationId, stationId] : [];
    const rows = this.#db!.prepare(
      `SELECT r.* FROM readings r
       INNER JOIN (
         SELECT sensor_id, MAX(timestamp) AS max_ts
         FROM readings ${stationFilter}
         GROUP BY sensor_id
       ) latest ON r.sensor_id = latest.sensor_id AND r.timestamp = latest.max_ts
       ${joinFilter}
       ORDER BY r.sensor_id`,
    ).all(...params) as Record<string, unknown>[];
    return rows.map(rowToReading);
  }

  // deno-lint-ignore require-await
  async queryReadings(sensorId: string, q: ObservationQuery): Promise<SensorReading[]> {
    const conditions = ["sensor_id = ?"];
    const params: SQLInputValue[] = [sensorId];
    if (q.from !== undefined) { conditions.push("timestamp >= ?"); params.push(q.from); }
    if (q.to !== undefined) { conditions.push("timestamp <= ?"); params.push(q.to); }
    const where = `WHERE ${conditions.join(" AND ")}`;
    const limit = q.limit !== undefined ? `LIMIT ${q.limit}` : "";
    const offset = q.offset !== undefined ? `OFFSET ${q.offset}` : "";
    const rows = this.#db!.prepare(
      `SELECT * FROM readings ${where} ORDER BY timestamp ASC ${limit} ${offset}`,
    ).all(...params) as Record<string, unknown>[];
    return rows.map(rowToReading);
  }

  // deno-lint-ignore require-await
  async getAggregates(from: Date, to: Date, bucket: 'hour' | 'day'): Promise<AggregateObservation[]> {
    const fromEpoch = Math.floor(from.getTime() / 1000);
    const toEpoch = Math.floor(to.getTime() / 1000);
    const bucketExpr = bucket === 'hour'
      ? `strftime('%Y-%m-%dT%H:00:00Z', timestamp, 'unixepoch')`
      : `strftime('%Y-%m-%dT00:00:00Z', timestamp, 'unixepoch')`;
    const rows = this.#db!.prepare(`
      SELECT
        ${bucketExpr} AS bucket,
        AVG(temp_outdoor)    AS temp_c_avg,
        MIN(temp_outdoor)    AS temp_c_min,
        MAX(temp_outdoor)    AS temp_c_max,
        AVG(temp_dewpoint)   AS dew_point_c_avg,
        AVG(humidity_outdoor) AS humidity_pct_avg,
        AVG(pressure_rel)    AS pressure_hpa_avg,
        AVG(wind_speed)      AS wind_speed_ms_avg,
        MAX(wind_gust)       AS wind_gust_ms_max,
        SUM(rain_rate)       AS rain_total_mm,
        AVG(uv_index)        AS uv_index_avg,
        AVG(solar_radiation) AS solar_rad_wm2_avg
      FROM observations
      WHERE timestamp >= ? AND timestamp <= ?
      GROUP BY bucket
      ORDER BY bucket ASC
    `).all(fromEpoch, toEpoch) as Record<string, unknown>[];
    return rows.map((r) => ({
      bucket: r.bucket as string,
      temp_c_avg:        r.temp_c_avg        != null ? r.temp_c_avg        as number : undefined,
      temp_c_min:        r.temp_c_min        != null ? r.temp_c_min        as number : undefined,
      temp_c_max:        r.temp_c_max        != null ? r.temp_c_max        as number : undefined,
      dew_point_c_avg:   r.dew_point_c_avg   != null ? r.dew_point_c_avg   as number : undefined,
      humidity_pct_avg:  r.humidity_pct_avg  != null ? r.humidity_pct_avg  as number : undefined,
      pressure_hpa_avg:  r.pressure_hpa_avg  != null ? r.pressure_hpa_avg  as number : undefined,
      wind_speed_ms_avg: r.wind_speed_ms_avg != null ? r.wind_speed_ms_avg as number : undefined,
      wind_gust_ms_max:  r.wind_gust_ms_max  != null ? r.wind_gust_ms_max  as number : undefined,
      rain_total_mm:     r.rain_total_mm     != null ? r.rain_total_mm     as number : undefined,
      uv_index_avg:      r.uv_index_avg      != null ? r.uv_index_avg      as number : undefined,
      solar_rad_wm2_avg: r.solar_rad_wm2_avg != null ? r.solar_rad_wm2_avg as number : undefined,
    }));
  }

  // deno-lint-ignore require-await
  async getObservationsRange(from: Date, to: Date): Promise<Observation[]> {
    const fromEpoch = Math.floor(from.getTime() / 1000);
    const toEpoch = Math.floor(to.getTime() / 1000);
    const rows = this.#db!.prepare(
      "SELECT * FROM observations WHERE timestamp >= ? AND timestamp <= ? ORDER BY timestamp ASC",
    ).all(fromEpoch, toEpoch) as Record<string, unknown>[];
    return rows.map(rowToObservation);
  }

  // deno-lint-ignore require-await
  async getDailyAggregates(year?: number): Promise<DailyAggregate[]> {
    let fromEpoch: number;
    let toEpoch: number;
    if (year !== undefined) {
      fromEpoch = Math.floor(new Date(`${year}-01-01T00:00:00Z`).getTime() / 1000);
      toEpoch   = Math.floor(new Date(`${year + 1}-01-01T00:00:00Z`).getTime() / 1000);
    } else {
      fromEpoch = 0;
      toEpoch   = Math.floor(Date.now() / 1000) + 86400;
    }
    const rows = this.#db!.prepare(`
      SELECT
        strftime('%Y-%m-%d', timestamp, 'unixepoch') AS date,
        MIN(temp_outdoor)     AS temp_c_min,
        MAX(temp_outdoor)     AS temp_c_max,
        AVG(temp_outdoor)     AS temp_c_avg,
        MIN(temp_dewpoint)    AS dew_point_c_min,
        MAX(temp_dewpoint)    AS dew_point_c_max,
        AVG(temp_dewpoint)    AS dew_point_c_avg,
        MIN(humidity_outdoor) AS humidity_pct_min,
        MAX(humidity_outdoor) AS humidity_pct_max,
        AVG(humidity_outdoor) AS humidity_pct_avg,
        MIN(pressure_rel)     AS pressure_hpa_min,
        MAX(pressure_rel)     AS pressure_hpa_max,
        AVG(pressure_rel)     AS pressure_hpa_avg,
        MAX(wind_speed)       AS wind_speed_ms_max,
        AVG(wind_speed)       AS wind_speed_ms_avg,
        MAX(wind_gust)        AS wind_gust_ms_max,
        MAX(rain_daily)       AS rain_total_mm,
        MAX(uv_index)         AS uv_index_max,
        AVG(uv_index)         AS uv_index_avg,
        MAX(solar_radiation)  AS solar_rad_wm2_max,
        AVG(solar_radiation)  AS solar_rad_wm2_avg
      FROM observations
      WHERE timestamp >= ? AND timestamp < ?
      GROUP BY date
      ORDER BY date ASC
    `).all(fromEpoch, toEpoch) as Record<string, unknown>[];
    return rows.map((r): DailyAggregate => ({
      date:              r.date              as string,
      temp_c_min:        r.temp_c_min        != null ? r.temp_c_min        as number : undefined,
      temp_c_max:        r.temp_c_max        != null ? r.temp_c_max        as number : undefined,
      temp_c_avg:        r.temp_c_avg        != null ? r.temp_c_avg        as number : undefined,
      dew_point_c_min:   r.dew_point_c_min   != null ? r.dew_point_c_min   as number : undefined,
      dew_point_c_max:   r.dew_point_c_max   != null ? r.dew_point_c_max   as number : undefined,
      dew_point_c_avg:   r.dew_point_c_avg   != null ? r.dew_point_c_avg   as number : undefined,
      humidity_pct_min:  r.humidity_pct_min  != null ? r.humidity_pct_min  as number : undefined,
      humidity_pct_max:  r.humidity_pct_max  != null ? r.humidity_pct_max  as number : undefined,
      humidity_pct_avg:  r.humidity_pct_avg  != null ? r.humidity_pct_avg  as number : undefined,
      pressure_hpa_min:  r.pressure_hpa_min  != null ? r.pressure_hpa_min  as number : undefined,
      pressure_hpa_max:  r.pressure_hpa_max  != null ? r.pressure_hpa_max  as number : undefined,
      pressure_hpa_avg:  r.pressure_hpa_avg  != null ? r.pressure_hpa_avg  as number : undefined,
      wind_speed_ms_max: r.wind_speed_ms_max != null ? r.wind_speed_ms_max as number : undefined,
      wind_speed_ms_avg: r.wind_speed_ms_avg != null ? r.wind_speed_ms_avg as number : undefined,
      wind_gust_ms_max:  r.wind_gust_ms_max  != null ? r.wind_gust_ms_max  as number : undefined,
      rain_total_mm:     r.rain_total_mm     != null ? r.rain_total_mm     as number : undefined,
      uv_index_max:      r.uv_index_max      != null ? r.uv_index_max      as number : undefined,
      uv_index_avg:      r.uv_index_avg      != null ? r.uv_index_avg      as number : undefined,
      solar_rad_wm2_max: r.solar_rad_wm2_max != null ? r.solar_rad_wm2_max as number : undefined,
      solar_rad_wm2_avg: r.solar_rad_wm2_avg != null ? r.solar_rad_wm2_avg as number : undefined,
    }));
  }

  // deno-lint-ignore require-await
  async getTodayStats(from: number, to: number): Promise<TodayStats> {
    const row = this.#db!.prepare(`
      WITH today AS (
        SELECT * FROM observations WHERE timestamp BETWEEN ? AND ?
      )
      SELECT
        MIN(temp_outdoor)     AS temp_min,
        (SELECT timestamp FROM today WHERE temp_outdoor IS NOT NULL ORDER BY temp_outdoor ASC  LIMIT 1) AS temp_min_time,
        MAX(temp_outdoor)     AS temp_max,
        (SELECT timestamp FROM today WHERE temp_outdoor IS NOT NULL ORDER BY temp_outdoor DESC LIMIT 1) AS temp_max_time,
        MIN(humidity_outdoor) AS humidity_min,
        (SELECT timestamp FROM today WHERE humidity_outdoor IS NOT NULL ORDER BY humidity_outdoor ASC  LIMIT 1) AS humidity_min_time,
        MAX(humidity_outdoor) AS humidity_max,
        (SELECT timestamp FROM today WHERE humidity_outdoor IS NOT NULL ORDER BY humidity_outdoor DESC LIMIT 1) AS humidity_max_time,
        MIN(pressure_rel)     AS pressure_min,
        (SELECT timestamp FROM today WHERE pressure_rel IS NOT NULL ORDER BY pressure_rel ASC  LIMIT 1) AS pressure_min_time,
        MAX(pressure_rel)     AS pressure_max,
        (SELECT timestamp FROM today WHERE pressure_rel IS NOT NULL ORDER BY pressure_rel DESC LIMIT 1) AS pressure_max_time,
        AVG(wind_speed)       AS wind_speed_avg,
        MAX(wind_speed)       AS wind_speed_max,
        (SELECT timestamp     FROM today WHERE wind_speed IS NOT NULL ORDER BY wind_speed DESC LIMIT 1) AS wind_speed_max_time,
        (SELECT wind_direction FROM today WHERE wind_speed IS NOT NULL ORDER BY wind_speed DESC LIMIT 1) AS wind_dir_at_max,
        MAX(rain_rate)        AS rain_rate_max,
        (SELECT timestamp FROM today WHERE rain_rate IS NOT NULL ORDER BY rain_rate DESC LIMIT 1) AS rain_rate_max_time,
        MAX(rain_daily)       AS rain_today,
        MIN(temp_dewpoint)    AS dew_point_min,
        (SELECT timestamp FROM today WHERE temp_dewpoint IS NOT NULL ORDER BY temp_dewpoint ASC  LIMIT 1) AS dew_point_min_time,
        MAX(temp_dewpoint)    AS dew_point_max,
        (SELECT timestamp FROM today WHERE temp_dewpoint IS NOT NULL ORDER BY temp_dewpoint DESC LIMIT 1) AS dew_point_max_time,
        MAX(uv_index)         AS uv_max,
        (SELECT timestamp FROM today WHERE uv_index IS NOT NULL ORDER BY uv_index DESC LIMIT 1) AS uv_max_time,
        MAX(solar_radiation)  AS solar_max,
        (SELECT timestamp FROM today WHERE solar_radiation IS NOT NULL ORDER BY solar_radiation DESC LIMIT 1) AS solar_max_time,
        MIN(temp_indoor)      AS temp_indoor_min,
        (SELECT timestamp FROM today WHERE temp_indoor IS NOT NULL ORDER BY temp_indoor ASC  LIMIT 1) AS temp_indoor_min_time,
        MAX(temp_indoor)      AS temp_indoor_max,
        (SELECT timestamp FROM today WHERE temp_indoor IS NOT NULL ORDER BY temp_indoor DESC LIMIT 1) AS temp_indoor_max_time
      FROM today
    `).get(from, to) as Record<string, unknown> | undefined;

    const n = (v: unknown): number | null =>
      v !== null && v !== undefined ? v as number : null;

    if (!row) {
      return {
        temp_min: null, temp_min_time: null, temp_max: null, temp_max_time: null,
        humidity_min: null, humidity_min_time: null, humidity_max: null, humidity_max_time: null,
        pressure_min: null, pressure_min_time: null, pressure_max: null, pressure_max_time: null,
        wind_speed_avg: null, wind_speed_max: null, wind_speed_max_time: null, wind_dir_at_max: null,
        rain_rate_max: null, rain_rate_max_time: null, rain_today: null,
        dew_point_min: null, dew_point_min_time: null, dew_point_max: null, dew_point_max_time: null,
        uv_max: null, uv_max_time: null, solar_max: null, solar_max_time: null,
        temp_indoor_min: null, temp_indoor_min_time: null, temp_indoor_max: null, temp_indoor_max_time: null,
      };
    }

    return {
      temp_min:             n(row.temp_min),
      temp_min_time:        n(row.temp_min_time),
      temp_max:             n(row.temp_max),
      temp_max_time:        n(row.temp_max_time),
      humidity_min:         n(row.humidity_min),
      humidity_min_time:    n(row.humidity_min_time),
      humidity_max:         n(row.humidity_max),
      humidity_max_time:    n(row.humidity_max_time),
      pressure_min:         n(row.pressure_min),
      pressure_min_time:    n(row.pressure_min_time),
      pressure_max:         n(row.pressure_max),
      pressure_max_time:    n(row.pressure_max_time),
      wind_speed_avg:       n(row.wind_speed_avg),
      wind_speed_max:       n(row.wind_speed_max),
      wind_speed_max_time:  n(row.wind_speed_max_time),
      wind_dir_at_max:      n(row.wind_dir_at_max),
      rain_rate_max:        n(row.rain_rate_max),
      rain_rate_max_time:   n(row.rain_rate_max_time),
      rain_today:           n(row.rain_today),
      dew_point_min:        n(row.dew_point_min),
      dew_point_min_time:   n(row.dew_point_min_time),
      dew_point_max:        n(row.dew_point_max),
      dew_point_max_time:   n(row.dew_point_max_time),
      uv_max:               n(row.uv_max),
      uv_max_time:          n(row.uv_max_time),
      solar_max:            n(row.solar_max),
      solar_max_time:       n(row.solar_max_time),
      temp_indoor_min:      n(row.temp_indoor_min),
      temp_indoor_min_time: n(row.temp_indoor_min_time),
      temp_indoor_max:      n(row.temp_indoor_max),
      temp_indoor_max_time: n(row.temp_indoor_max_time),
    };
  }

  // deno-lint-ignore require-await
  async close(): Promise<void> {
    this.#db?.close();
    this.#db = null;
  }
}

function rowToObservation(row: Record<string, unknown>): Observation {
  return {
    timestamp:        row.timestamp as number,
    stationId:        row.station_id as string,
    tempIndoor:       (row.temp_indoor       ?? undefined) as number | undefined,
    tempOutdoor:      (row.temp_outdoor      ?? undefined) as number | undefined,
    tempDewpoint:     (row.temp_dewpoint     ?? undefined) as number | undefined,
    tempFeelsLike:    (row.temp_feels_like   ?? undefined) as number | undefined,
    humidityIndoor:   (row.humidity_indoor   ?? undefined) as number | undefined,
    humidityOutdoor:  (row.humidity_outdoor  ?? undefined) as number | undefined,
    pressureAbsolute: (row.pressure_abs      ?? undefined) as number | undefined,
    pressureRelative: (row.pressure_rel      ?? undefined) as number | undefined,
    windSpeed:        (row.wind_speed        ?? undefined) as number | undefined,
    windGust:         (row.wind_gust         ?? undefined) as number | undefined,
    windDirection:    (row.wind_direction    ?? undefined) as number | undefined,
    rainRate:         (row.rain_rate         ?? undefined) as number | undefined,
    rainDaily:        (row.rain_daily        ?? undefined) as number | undefined,
    rainWeekly:       (row.rain_weekly       ?? undefined) as number | undefined,
    rainMonthly:      (row.rain_monthly      ?? undefined) as number | undefined,
    rainYearly:       (row.rain_yearly       ?? undefined) as number | undefined,
    rainEvent:        (row.rain_event        ?? undefined) as number | undefined,
    solarRadiation:   (row.solar_radiation   ?? undefined) as number | undefined,
    uvIndex:          (row.uv_index          ?? undefined) as number | undefined,
    vpd:              (row.vpd               ?? undefined) as number | undefined,
  };
}

function rowToReading(row: Record<string, unknown>): SensorReading {
  return {
    timestamp: row.timestamp as number,
    stationId: row.station_id as string,
    sensorId:  row.sensor_id as string,
    value:     row.value as number,
  };
}
