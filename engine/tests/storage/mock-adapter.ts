// deno-lint-ignore-file require-await
import type { StorageAdapter } from '../../src/storage/adapter.ts';
import type {
  AggregateObservation,
  DailyAggregate,
  Observation,
  ObservationQuery,
  SensorReading,
  TodayStats,
} from '@zephyr/shared';

// ---------------------------------------------------------------------------
// Call tracking — lets tests assert which methods were called and with what args
// ---------------------------------------------------------------------------
export interface MockCalls {
  insert: Observation[];
  insertBatch: Observation[][];
  latest: number; // call count
  query: ObservationQuery[];
  insertReadings: SensorReading[][];
  latestReadings: Array<string | undefined>;
  queryReadings: Array<{ sensorId: string; q: ObservationQuery }>;
  getObservationsRange: Array<{ from: Date; to: Date }>;
  getAggregates: Array<{ from: Date; to: Date; bucket: 'hour' | 'day' }>;
  getDailyAggregates: Array<number | undefined>;
  getTodayStats: Array<{ from: number; to: number }>;
  init: number;
  close: number;
}

export interface MockStorageAdapter extends StorageAdapter {
  readonly calls: MockCalls;
  readonly observations: Observation[];
  readonly readings: SensorReading[];
  reset(): void;
}

function nullStats(): TodayStats {
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

function minmax<T extends number>(
  items: T[],
): { min: T | null; max: T | null; avg: number | null } {
  if (items.length === 0) return { min: null, max: null, avg: null };
  const min = Math.min(...items) as T;
  const max = Math.max(...items) as T;
  const avg = items.reduce((s, v) => s + v, 0) / items.length;
  return { min, max, avg };
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------
export function createMockAdapter(): MockStorageAdapter {
  const obs: Observation[] = [];
  const rds: SensorReading[] = [];

  const calls: MockCalls = {
    insert: [],
    insertBatch: [],
    latest: 0,
    query: [],
    insertReadings: [],
    latestReadings: [],
    queryReadings: [],
    getObservationsRange: [],
    getAggregates: [],
    getDailyAggregates: [],
    getTodayStats: [],
    init: 0,
    close: 0,
  };

  const adapter: MockStorageAdapter = {
    get calls() {
      return calls;
    },
    get observations() {
      return obs;
    },
    get readings() {
      return rds;
    },

    reset() {
      obs.length = 0;
      rds.length = 0;
      for (const k of Object.keys(calls) as (keyof MockCalls)[]) {
        const v = calls[k];
        if (typeof v === 'number') (calls[k] as number) = 0;
        else if (Array.isArray(v)) (calls[k] as unknown[]).length = 0;
      }
    },

    async init(): Promise<void> {
      calls.init++;
    },
    async close(): Promise<void> {
      calls.close++;
    },

    async insert(o: Observation): Promise<void> {
      calls.insert.push(o);
      obs.push(o);
    },

    async insertBatch(batch: Observation[]): Promise<void> {
      calls.insertBatch.push(batch);
      obs.push(...batch);
    },

    async latest(): Promise<Observation | null> {
      calls.latest++;
      if (obs.length === 0) return null;
      return obs.reduce((a, b) => (a.timestamp >= b.timestamp ? a : b));
    },

    async query(q: ObservationQuery): Promise<Observation[]> {
      calls.query.push(q);
      let result = [...obs];
      if (q.from !== undefined) result = result.filter((o) => o.timestamp >= q.from!);
      if (q.to !== undefined) result = result.filter((o) => o.timestamp <= q.to!);
      result.sort((a, b) => a.timestamp - b.timestamp);
      const offset = q.offset ?? 0;
      const limit = q.limit ?? 1000;
      return result.slice(offset, offset + limit);
    },

    async insertReadings(readings: SensorReading[]): Promise<void> {
      calls.insertReadings.push(readings);
      rds.push(...readings);
    },

    async latestReadings(stationId?: string): Promise<SensorReading[]> {
      calls.latestReadings.push(stationId);
      const filtered = stationId ? rds.filter((r) => r.stationId === stationId) : rds;
      // Return the latest reading per sensorId
      const byId = new Map<string, SensorReading>();
      for (const r of filtered) {
        const existing = byId.get(r.sensorId);
        if (!existing || r.timestamp > existing.timestamp) byId.set(r.sensorId, r);
      }
      return [...byId.values()];
    },

    async queryReadings(sensorId: string, q: ObservationQuery): Promise<SensorReading[]> {
      calls.queryReadings.push({ sensorId, q });
      let result = rds.filter((r) => r.sensorId === sensorId);
      if (q.from !== undefined) result = result.filter((r) => r.timestamp >= q.from!);
      if (q.to !== undefined) result = result.filter((r) => r.timestamp <= q.to!);
      result.sort((a, b) => a.timestamp - b.timestamp);
      const offset = q.offset ?? 0;
      const limit = q.limit ?? 1000;
      return result.slice(offset, offset + limit);
    },

    async getObservationsRange(from: Date, to: Date): Promise<Observation[]> {
      calls.getObservationsRange.push({ from, to });
      const fromEpoch = Math.floor(from.getTime() / 1000);
      const toEpoch = Math.floor(to.getTime() / 1000);
      return obs
        .filter((o) => o.timestamp >= fromEpoch && o.timestamp <= toEpoch)
        .sort((a, b) => a.timestamp - b.timestamp);
    },

    async getAggregates(from: Date, to: Date, bucket: 'hour' | 'day'): Promise<AggregateObservation[]> {
      calls.getAggregates.push({ from, to, bucket });
      const fromEpoch = Math.floor(from.getTime() / 1000);
      const toEpoch = Math.floor(to.getTime() / 1000);
      const filtered = obs.filter((o) => o.timestamp >= fromEpoch && o.timestamp <= toEpoch);

      // Group by bucket (ISO hour or day)
      const groups = new Map<string, Observation[]>();
      for (const o of filtered) {
        const d = new Date(o.timestamp * 1000);
        const key = bucket === 'hour'
          ? d.toISOString().slice(0, 13) + ':00:00.000Z'
          : d.toISOString().slice(0, 10) + 'T00:00:00.000Z';
        const g = groups.get(key) ?? [];
        g.push(o);
        groups.set(key, g);
      }

      const result: AggregateObservation[] = [];
      for (const [bkt, items] of groups) {
        const temps = items.map((o) => o.tempOutdoor).filter((v): v is number => v !== undefined);
        const tmm = minmax(temps);
        result.push({
          bucket: bkt,
          temp_c_avg: tmm.avg ?? undefined,
          temp_c_min: tmm.min ?? undefined,
          temp_c_max: tmm.max ?? undefined,
          humidity_pct_avg: minmax(
            items.map((o) => o.humidityOutdoor).filter((v): v is number => v !== undefined),
          ).avg ?? undefined,
          pressure_hpa_avg: minmax(
            items.map((o) => o.pressureRelative).filter((v): v is number => v !== undefined),
          ).avg ?? undefined,
          wind_speed_ms_avg: minmax(items.map((o) => o.windSpeed).filter((v): v is number => v !== undefined)).avg ??
            undefined,
          wind_gust_ms_max: minmax(items.map((o) => o.windGust).filter((v): v is number => v !== undefined)).max ??
            undefined,
          rain_total_mm: items.reduce((s, o) => s + (o.rainDaily ?? 0), 0),
          uv_index_avg: minmax(items.map((o) => o.uvIndex).filter((v): v is number => v !== undefined)).avg ??
            undefined,
        });
      }
      return result.sort((a, b) => a.bucket.localeCompare(b.bucket));
    },

    async getDailyAggregates(year?: number): Promise<DailyAggregate[]> {
      calls.getDailyAggregates.push(year);
      const filtered = year ? obs.filter((o) => new Date(o.timestamp * 1000).getUTCFullYear() === year) : obs;

      const groups = new Map<string, Observation[]>();
      for (const o of filtered) {
        const date = new Date(o.timestamp * 1000).toISOString().slice(0, 10);
        const g = groups.get(date) ?? [];
        g.push(o);
        groups.set(date, g);
      }

      const result: DailyAggregate[] = [];
      for (const [date, items] of groups) {
        const temps = items.map((o) => o.tempOutdoor).filter((v): v is number => v !== undefined);
        const tmm = minmax(temps);
        result.push({
          date,
          temp_c_min: tmm.min ?? undefined,
          temp_c_max: tmm.max ?? undefined,
          temp_c_avg: tmm.avg ?? undefined,
          humidity_pct_avg: minmax(
            items.map((o) => o.humidityOutdoor).filter((v): v is number => v !== undefined),
          ).avg ?? undefined,
          pressure_hpa_avg: minmax(
            items.map((o) => o.pressureRelative).filter((v): v is number => v !== undefined),
          ).avg ?? undefined,
          wind_speed_ms_avg: minmax(items.map((o) => o.windSpeed).filter((v): v is number => v !== undefined)).avg ??
            undefined,
          wind_gust_ms_max: minmax(items.map((o) => o.windGust).filter((v): v is number => v !== undefined)).max ??
            undefined,
          rain_total_mm: items.length > 0 ? (items[items.length - 1].rainDaily ?? 0) : 0,
          uv_index_max: minmax(items.map((o) => o.uvIndex).filter((v): v is number => v !== undefined)).max ??
            undefined,
        });
      }
      return result.sort((a, b) => a.date.localeCompare(b.date));
    },

    async getTodayStats(from: number, to: number): Promise<TodayStats> {
      calls.getTodayStats.push({ from, to });
      const items = obs.filter((o) => o.timestamp >= from && o.timestamp <= to);
      if (items.length === 0) return nullStats();

      function statForField<K extends keyof Observation>(
        field: K,
        _tsField?: keyof Observation,
      ): {
        min: number | null;
        min_time: number | null;
        max: number | null;
        max_time: number | null;
        avg: number | null;
      } {
        const vals = items
          .map((o) => ({ v: o[field] as number | undefined, ts: o.timestamp }))
          .filter((x): x is { v: number; ts: number } => typeof x.v === 'number');
        if (vals.length === 0) return { min: null, min_time: null, max: null, max_time: null, avg: null };
        const minItem = vals.reduce((a, b) => (a.v <= b.v ? a : b));
        const maxItem = vals.reduce((a, b) => (a.v >= b.v ? a : b));
        const avg = vals.reduce((s, x) => s + x.v, 0) / vals.length;
        return { min: minItem.v, min_time: minItem.ts, max: maxItem.v, max_time: maxItem.ts, avg };
      }

      const temp = statForField('tempOutdoor');
      const hum = statForField('humidityOutdoor');
      const pres = statForField('pressureRelative');
      const wind = statForField('windSpeed');
      const gust = statForField('windGust');
      const dew = statForField('tempDewpoint');
      const uv = statForField('uvIndex');
      const solar = statForField('solarRadiation');
      const tempIn = statForField('tempIndoor');
      const rainRate = statForField('rainRate');

      // wind dir at max gust
      let windDirAtMax: number | null = null;
      if (gust.max !== null) {
        const maxGustObs = items.find((o) => o.windGust === gust.max);
        windDirAtMax = maxGustObs?.windDirection ?? null;
      }

      // Rain today: last rainDaily value in range
      const rainItems = items.filter((o) => o.rainDaily !== undefined);
      const rainToday = rainItems.length > 0 ? (rainItems[rainItems.length - 1].rainDaily ?? null) : null;

      return {
        temp_min: temp.min,
        temp_min_time: temp.min_time,
        temp_max: temp.max,
        temp_max_time: temp.max_time,
        humidity_min: hum.min,
        humidity_min_time: hum.min_time,
        humidity_max: hum.max,
        humidity_max_time: hum.max_time,
        pressure_min: pres.min,
        pressure_min_time: pres.min_time,
        pressure_max: pres.max,
        pressure_max_time: pres.max_time,
        wind_speed_avg: wind.avg,
        wind_speed_max: gust.max,
        wind_speed_max_time: gust.max_time,
        wind_dir_at_max: windDirAtMax,
        rain_rate_max: rainRate.max,
        rain_rate_max_time: rainRate.max_time,
        rain_today: rainToday,
        dew_point_min: dew.min,
        dew_point_min_time: dew.min_time,
        dew_point_max: dew.max,
        dew_point_max_time: dew.max_time,
        uv_max: uv.max,
        uv_max_time: uv.max_time,
        solar_max: solar.max,
        solar_max_time: solar.max_time,
        temp_indoor_min: tempIn.min,
        temp_indoor_min_time: tempIn.min_time,
        temp_indoor_max: tempIn.max,
        temp_indoor_max_time: tempIn.max_time,
      };
    },
  };

  return adapter;
}
