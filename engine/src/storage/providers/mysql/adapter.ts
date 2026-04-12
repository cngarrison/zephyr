import mysql from 'mysql2/promise';
import { runMigrations } from './migrate.ts';
import type {
  AggregateObservation,
  DailyAggregate,
  ObservationQuery,
  SensorReading,
  StorageAdapter,
  TodayStats,
} from '../../adapter.ts';
import type { Observation } from '../../../domain/observation.ts';

export interface MysqlConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

export class MysqlAdapter implements StorageAdapter {
  #pool: mysql.Pool | null = null;
  readonly #config: MysqlConfig;

  constructor(config: MysqlConfig) {
    this.#config = config;
  }

  async init(): Promise<void> {
    this.#pool = mysql.createPool({
      host: this.#config.host,
      port: this.#config.port,
      user: this.#config.user,
      password: this.#config.password,
      database: this.#config.database,
      waitForConnections: true,
      connectionLimit: 10,
    });
    await runMigrations(this.#pool);
  }

  // ---------------------------------------------------------------------------
  // Core observations
  // ---------------------------------------------------------------------------

  async insert(obs: Observation): Promise<void> {
    await this.#pool!.execute(
      `INSERT INTO observations (
        timestamp, station_id,
        temp_indoor, temp_outdoor, temp_dewpoint, temp_feels_like,
        humidity_indoor, humidity_outdoor,
        pressure_abs, pressure_rel,
        wind_speed, wind_gust, wind_direction,
        rain_rate, rain_daily, rain_weekly, rain_monthly, rain_yearly, rain_event,
        solar_radiation, uv_index, vpd
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        station_id      = VALUES(station_id),
        temp_indoor     = VALUES(temp_indoor),
        temp_outdoor    = VALUES(temp_outdoor),
        temp_dewpoint   = VALUES(temp_dewpoint),
        temp_feels_like = VALUES(temp_feels_like),
        humidity_indoor  = VALUES(humidity_indoor),
        humidity_outdoor = VALUES(humidity_outdoor),
        pressure_abs    = VALUES(pressure_abs),
        pressure_rel    = VALUES(pressure_rel),
        wind_speed      = VALUES(wind_speed),
        wind_gust       = VALUES(wind_gust),
        wind_direction  = VALUES(wind_direction),
        rain_rate       = VALUES(rain_rate),
        rain_daily      = VALUES(rain_daily),
        rain_weekly     = VALUES(rain_weekly),
        rain_monthly    = VALUES(rain_monthly),
        rain_yearly     = VALUES(rain_yearly),
        rain_event      = VALUES(rain_event),
        solar_radiation = VALUES(solar_radiation),
        uv_index        = VALUES(uv_index),
        vpd             = VALUES(vpd)`,
      [
        obs.timestamp,
        obs.stationId,
        obs.tempIndoor ?? null,
        obs.tempOutdoor ?? null,
        obs.tempDewpoint ?? null,
        obs.tempFeelsLike ?? null,
        obs.humidityIndoor ?? null,
        obs.humidityOutdoor ?? null,
        obs.pressureAbsolute ?? null,
        obs.pressureRelative ?? null,
        obs.windSpeed ?? null,
        obs.windGust ?? null,
        obs.windDirection ?? null,
        obs.rainRate ?? null,
        obs.rainDaily ?? null,
        obs.rainWeekly ?? null,
        obs.rainMonthly ?? null,
        obs.rainYearly ?? null,
        obs.rainEvent ?? null,
        obs.solarRadiation ?? null,
        obs.uvIndex ?? null,
        obs.vpd ?? null,
      ],
    );
  }

  async insertBatch(obs: Observation[]): Promise<void> {
    const conn = await this.#pool!.getConnection();
    try {
      await conn.beginTransaction();
      for (const o of obs) {
        await conn.execute(
          `INSERT INTO observations (
            timestamp, station_id,
            temp_indoor, temp_outdoor, temp_dewpoint, temp_feels_like,
            humidity_indoor, humidity_outdoor,
            pressure_abs, pressure_rel,
            wind_speed, wind_gust, wind_direction,
            rain_rate, rain_daily, rain_weekly, rain_monthly, rain_yearly, rain_event,
            solar_radiation, uv_index, vpd
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            station_id      = VALUES(station_id),
            temp_indoor     = VALUES(temp_indoor),
            temp_outdoor    = VALUES(temp_outdoor),
            temp_dewpoint   = VALUES(temp_dewpoint),
            temp_feels_like = VALUES(temp_feels_like),
            humidity_indoor  = VALUES(humidity_indoor),
            humidity_outdoor = VALUES(humidity_outdoor),
            pressure_abs    = VALUES(pressure_abs),
            pressure_rel    = VALUES(pressure_rel),
            wind_speed      = VALUES(wind_speed),
            wind_gust       = VALUES(wind_gust),
            wind_direction  = VALUES(wind_direction),
            rain_rate       = VALUES(rain_rate),
            rain_daily      = VALUES(rain_daily),
            rain_weekly     = VALUES(rain_weekly),
            rain_monthly    = VALUES(rain_monthly),
            rain_yearly     = VALUES(rain_yearly),
            rain_event      = VALUES(rain_event),
            solar_radiation = VALUES(solar_radiation),
            uv_index        = VALUES(uv_index),
            vpd             = VALUES(vpd)`,
          [
            o.timestamp,
            o.stationId,
            o.tempIndoor ?? null,
            o.tempOutdoor ?? null,
            o.tempDewpoint ?? null,
            o.tempFeelsLike ?? null,
            o.humidityIndoor ?? null,
            o.humidityOutdoor ?? null,
            o.pressureAbsolute ?? null,
            o.pressureRelative ?? null,
            o.windSpeed ?? null,
            o.windGust ?? null,
            o.windDirection ?? null,
            o.rainRate ?? null,
            o.rainDaily ?? null,
            o.rainWeekly ?? null,
            o.rainMonthly ?? null,
            o.rainYearly ?? null,
            o.rainEvent ?? null,
            o.solarRadiation ?? null,
            o.uvIndex ?? null,
            o.vpd ?? null,
          ],
        );
      }
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  async latest(): Promise<Observation | null> {
    const [rows] = await this.#pool!.execute(
      'SELECT * FROM observations ORDER BY timestamp DESC LIMIT 1',
    );
    const r = (rows as Record<string, unknown>[])[0];
    return r ? rowToObservation(r) : null;
  }

  async query(q: ObservationQuery): Promise<Observation[]> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    if (q.from !== undefined) {
      conditions.push('timestamp >= ?');
      params.push(q.from);
    }
    if (q.to !== undefined) {
      conditions.push('timestamp <= ?');
      params.push(q.to);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = q.limit !== undefined ? `LIMIT ${q.limit}` : '';
    const offset = q.offset !== undefined ? `OFFSET ${q.offset}` : '';
    const [rows] = await this.#pool!.execute(
      `SELECT * FROM observations ${where} ORDER BY timestamp ASC ${limit} ${offset}`,
      params,
    );
    return (rows as Record<string, unknown>[]).map(rowToObservation);
  }

  // ---------------------------------------------------------------------------
  // Extended sensor readings
  // ---------------------------------------------------------------------------

  async insertReadings(readings: SensorReading[]): Promise<void> {
    const conn = await this.#pool!.getConnection();
    try {
      await conn.beginTransaction();
      for (const r of readings) {
        await conn.execute(
          `INSERT INTO readings (timestamp, station_id, sensor_id, value)
           VALUES (?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE value = VALUES(value)`,
          [r.timestamp, r.stationId, r.sensorId, r.value],
        );
      }
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  async latestReadings(stationId?: string): Promise<SensorReading[]> {
    const stationFilter = stationId ? 'WHERE station_id = ?' : '';
    const joinFilter = stationId ? 'WHERE r.station_id = ?' : '';
    const params: unknown[] = stationId ? [stationId, stationId] : [];
    const [rows] = await this.#pool!.execute(
      `SELECT r.* FROM readings r
       INNER JOIN (
         SELECT sensor_id, MAX(timestamp) AS max_ts
         FROM readings ${stationFilter}
         GROUP BY sensor_id
       ) latest ON r.sensor_id = latest.sensor_id AND r.timestamp = latest.max_ts
       ${joinFilter}
       ORDER BY r.sensor_id`,
      params,
    );
    return (rows as Record<string, unknown>[]).map(rowToReading);
  }

  async queryReadings(sensorId: string, q: ObservationQuery): Promise<SensorReading[]> {
    const conditions = ['sensor_id = ?'];
    const params: unknown[] = [sensorId];
    if (q.from !== undefined) {
      conditions.push('timestamp >= ?');
      params.push(q.from);
    }
    if (q.to !== undefined) {
      conditions.push('timestamp <= ?');
      params.push(q.to);
    }
    const where = `WHERE ${conditions.join(' AND ')}`;
    const limit = q.limit !== undefined ? `LIMIT ${q.limit}` : '';
    const offset = q.offset !== undefined ? `OFFSET ${q.offset}` : '';
    const [rows] = await this.#pool!.execute(
      `SELECT * FROM readings ${where} ORDER BY timestamp ASC ${limit} ${offset}`,
      params,
    );
    return (rows as Record<string, unknown>[]).map(rowToReading);
  }

  async getAggregates(from: Date, to: Date, bucket: 'hour' | 'day'): Promise<AggregateObservation[]> {
    const fromEpoch = Math.floor(from.getTime() / 1000);
    const toEpoch = Math.floor(to.getTime() / 1000);
    const bucketExpr = bucket === 'hour'
      ? `DATE_FORMAT(FROM_UNIXTIME(timestamp), '%Y-%m-%dT%H:00:00Z')`
      : `DATE_FORMAT(FROM_UNIXTIME(timestamp), '%Y-%m-%dT00:00:00Z')`;
    const [rows] = await this.#pool!.execute(
      `SELECT
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
      ORDER BY bucket ASC`,
      [fromEpoch, toEpoch],
    );
    return (rows as Record<string, unknown>[]).map((r) => ({
      bucket: r.bucket as string,
      temp_c_avg: r.temp_c_avg != null ? r.temp_c_avg as number : undefined,
      temp_c_min: r.temp_c_min != null ? r.temp_c_min as number : undefined,
      temp_c_max: r.temp_c_max != null ? r.temp_c_max as number : undefined,
      dew_point_c_avg: r.dew_point_c_avg != null ? r.dew_point_c_avg as number : undefined,
      humidity_pct_avg: r.humidity_pct_avg != null ? r.humidity_pct_avg as number : undefined,
      pressure_hpa_avg: r.pressure_hpa_avg != null ? r.pressure_hpa_avg as number : undefined,
      wind_speed_ms_avg: r.wind_speed_ms_avg != null ? r.wind_speed_ms_avg as number : undefined,
      wind_gust_ms_max: r.wind_gust_ms_max != null ? r.wind_gust_ms_max as number : undefined,
      rain_total_mm: r.rain_total_mm != null ? r.rain_total_mm as number : undefined,
      uv_index_avg: r.uv_index_avg != null ? r.uv_index_avg as number : undefined,
      solar_rad_wm2_avg: r.solar_rad_wm2_avg != null ? r.solar_rad_wm2_avg as number : undefined,
    }));
  }

  async getObservationsRange(from: Date, to: Date): Promise<Observation[]> {
    const fromEpoch = Math.floor(from.getTime() / 1000);
    const toEpoch = Math.floor(to.getTime() / 1000);
    const [rows] = await this.#pool!.execute(
      'SELECT * FROM observations WHERE timestamp >= ? AND timestamp <= ? ORDER BY timestamp ASC',
      [fromEpoch, toEpoch],
    );
    return (rows as Record<string, unknown>[]).map(rowToObservation);
  }

  async getDailyAggregates(year?: number): Promise<DailyAggregate[]> {
    let fromEpoch: number;
    let toEpoch: number;
    if (year !== undefined) {
      fromEpoch = Math.floor(new Date(`${year}-01-01T00:00:00Z`).getTime() / 1000);
      toEpoch = Math.floor(new Date(`${year + 1}-01-01T00:00:00Z`).getTime() / 1000);
    } else {
      fromEpoch = 0;
      toEpoch = Math.floor(Date.now() / 1000) + 86400;
    }
    const [rows] = await this.#pool!.execute(
      `SELECT
        DATE_FORMAT(FROM_UNIXTIME(timestamp), '%Y-%m-%d') AS date,
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
      ORDER BY date ASC`,
      [fromEpoch, toEpoch],
    );
    return (rows as Record<string, unknown>[]).map((r): DailyAggregate => ({
      date: r.date as string,
      temp_c_min: r.temp_c_min != null ? r.temp_c_min as number : undefined,
      temp_c_max: r.temp_c_max != null ? r.temp_c_max as number : undefined,
      temp_c_avg: r.temp_c_avg != null ? r.temp_c_avg as number : undefined,
      dew_point_c_min: r.dew_point_c_min != null ? r.dew_point_c_min as number : undefined,
      dew_point_c_max: r.dew_point_c_max != null ? r.dew_point_c_max as number : undefined,
      dew_point_c_avg: r.dew_point_c_avg != null ? r.dew_point_c_avg as number : undefined,
      humidity_pct_min: r.humidity_pct_min != null ? r.humidity_pct_min as number : undefined,
      humidity_pct_max: r.humidity_pct_max != null ? r.humidity_pct_max as number : undefined,
      humidity_pct_avg: r.humidity_pct_avg != null ? r.humidity_pct_avg as number : undefined,
      pressure_hpa_min: r.pressure_hpa_min != null ? r.pressure_hpa_min as number : undefined,
      pressure_hpa_max: r.pressure_hpa_max != null ? r.pressure_hpa_max as number : undefined,
      pressure_hpa_avg: r.pressure_hpa_avg != null ? r.pressure_hpa_avg as number : undefined,
      wind_speed_ms_max: r.wind_speed_ms_max != null ? r.wind_speed_ms_max as number : undefined,
      wind_speed_ms_avg: r.wind_speed_ms_avg != null ? r.wind_speed_ms_avg as number : undefined,
      wind_gust_ms_max: r.wind_gust_ms_max != null ? r.wind_gust_ms_max as number : undefined,
      rain_total_mm: r.rain_total_mm != null ? r.rain_total_mm as number : undefined,
      uv_index_max: r.uv_index_max != null ? r.uv_index_max as number : undefined,
      uv_index_avg: r.uv_index_avg != null ? r.uv_index_avg as number : undefined,
      solar_rad_wm2_max: r.solar_rad_wm2_max != null ? r.solar_rad_wm2_max as number : undefined,
      solar_rad_wm2_avg: r.solar_rad_wm2_avg != null ? r.solar_rad_wm2_avg as number : undefined,
    }));
  }

  async getTodayStats(from: number, to: number): Promise<TodayStats> {
    const [rows] = await this.#pool!.execute(
      `WITH today AS (
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
      FROM today`,
      [from, to],
    );

    const n = (v: unknown): number | null => v !== null && v !== undefined ? v as number : null;

    const row = (rows as Record<string, unknown>[])[0];
    if (!row) {
      return {
        temp_min: null,
        temp_min_time: null,
        temp_max: null,
        temp_max_time: null,
        humidity_min: null,
        humidity_min_time: null,
        humidity_max: null,
        humidity_max_time: null,
        pressure_min: null,
        pressure_min_time: null,
        pressure_max: null,
        pressure_max_time: null,
        wind_speed_avg: null,
        wind_speed_max: null,
        wind_speed_max_time: null,
        wind_dir_at_max: null,
        rain_rate_max: null,
        rain_rate_max_time: null,
        rain_today: null,
        dew_point_min: null,
        dew_point_min_time: null,
        dew_point_max: null,
        dew_point_max_time: null,
        uv_max: null,
        uv_max_time: null,
        solar_max: null,
        solar_max_time: null,
        temp_indoor_min: null,
        temp_indoor_min_time: null,
        temp_indoor_max: null,
        temp_indoor_max_time: null,
      };
    }

    return {
      temp_min: n(row.temp_min),
      temp_min_time: n(row.temp_min_time),
      temp_max: n(row.temp_max),
      temp_max_time: n(row.temp_max_time),
      humidity_min: n(row.humidity_min),
      humidity_min_time: n(row.humidity_min_time),
      humidity_max: n(row.humidity_max),
      humidity_max_time: n(row.humidity_max_time),
      pressure_min: n(row.pressure_min),
      pressure_min_time: n(row.pressure_min_time),
      pressure_max: n(row.pressure_max),
      pressure_max_time: n(row.pressure_max_time),
      wind_speed_avg: n(row.wind_speed_avg),
      wind_speed_max: n(row.wind_speed_max),
      wind_speed_max_time: n(row.wind_speed_max_time),
      wind_dir_at_max: n(row.wind_dir_at_max),
      rain_rate_max: n(row.rain_rate_max),
      rain_rate_max_time: n(row.rain_rate_max_time),
      rain_today: n(row.rain_today),
      dew_point_min: n(row.dew_point_min),
      dew_point_min_time: n(row.dew_point_min_time),
      dew_point_max: n(row.dew_point_max),
      dew_point_max_time: n(row.dew_point_max_time),
      uv_max: n(row.uv_max),
      uv_max_time: n(row.uv_max_time),
      solar_max: n(row.solar_max),
      solar_max_time: n(row.solar_max_time),
      temp_indoor_min: n(row.temp_indoor_min),
      temp_indoor_min_time: n(row.temp_indoor_min_time),
      temp_indoor_max: n(row.temp_indoor_max),
      temp_indoor_max_time: n(row.temp_indoor_max_time),
    };
  }

  async close(): Promise<void> {
    await this.#pool?.end();
    this.#pool = null;
  }
}

function rowToObservation(row: Record<string, unknown>): Observation {
  return {
    timestamp: row.timestamp as number,
    stationId: row.station_id as string,
    tempIndoor: (row.temp_indoor ?? undefined) as number | undefined,
    tempOutdoor: (row.temp_outdoor ?? undefined) as number | undefined,
    tempDewpoint: (row.temp_dewpoint ?? undefined) as number | undefined,
    tempFeelsLike: (row.temp_feels_like ?? undefined) as number | undefined,
    humidityIndoor: (row.humidity_indoor ?? undefined) as number | undefined,
    humidityOutdoor: (row.humidity_outdoor ?? undefined) as number | undefined,
    pressureAbsolute: (row.pressure_abs ?? undefined) as number | undefined,
    pressureRelative: (row.pressure_rel ?? undefined) as number | undefined,
    windSpeed: (row.wind_speed ?? undefined) as number | undefined,
    windGust: (row.wind_gust ?? undefined) as number | undefined,
    windDirection: (row.wind_direction ?? undefined) as number | undefined,
    rainRate: (row.rain_rate ?? undefined) as number | undefined,
    rainDaily: (row.rain_daily ?? undefined) as number | undefined,
    rainWeekly: (row.rain_weekly ?? undefined) as number | undefined,
    rainMonthly: (row.rain_monthly ?? undefined) as number | undefined,
    rainYearly: (row.rain_yearly ?? undefined) as number | undefined,
    rainEvent: (row.rain_event ?? undefined) as number | undefined,
    solarRadiation: (row.solar_radiation ?? undefined) as number | undefined,
    uvIndex: (row.uv_index ?? undefined) as number | undefined,
    vpd: (row.vpd ?? undefined) as number | undefined,
  };
}

function rowToReading(row: Record<string, unknown>): SensorReading {
  return {
    timestamp: row.timestamp as number,
    stationId: row.station_id as string,
    sensorId: row.sensor_id as string,
    value: row.value as number,
  };
}
