import type {
  AggregateObservation,
  AlmanacData,
  DailyAggregate,
  Observation,
  StationConfig,
  TodayStats,
} from './types.ts';
import { config } from './config.ts';

// Engine base URL — server-side only. Islands use the /api proxy route.
// Resolved lazily (function, not module-level const) to ensure the TOML config
// singleton has been evaluated before this value is read.
function engineUrl(): string {
  return config.web.engineUrl;
}

export async function fetchStationConfig(): Promise<StationConfig> {
  try {
    const resp = await fetch(`${engineUrl()}/api/config`);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json() as { station: StationConfig };
    //console.log('API: fetchStationConfig:', data);
    return data.station;
  } catch {
    return {
      name: 'My Weather Station',
      lat: 0,
      lon: 0,
      altitude: 0,
      timezone: 'UTC',
      extras: [],
    };
  }
}

export async function fetchLatest(): Promise<Observation | null> {
  try {
    const resp = await fetch(`${engineUrl()}/api/observations/latest`);
    if (!resp.ok) return null;
    return await resp.json() as Observation | null;
  } catch {
    return null;
  }
}

export interface ObservationQueryParams {
  from?: number;
  to?: number;
  limit?: number;
  offset?: number;
}

export async function fetchAggregates(
  from: string,
  to: string,
  bucket: 'hour' | 'day',
): Promise<AggregateObservation[]> {
  try {
    const qs = new URLSearchParams({ from, to, bucket });
    const resp = await fetch(`${engineUrl()}/api/observations/aggregate?${qs}`);
    if (!resp.ok) return [];
    return await resp.json() as AggregateObservation[];
  } catch (err) {
    console.error('fetchAggregates error:', err);
    return [];
  }
}

export async function fetchDailyAggregates(year?: number): Promise<DailyAggregate[]> {
  try {
    const qs = new URLSearchParams();
    if (year !== undefined) qs.set('year', String(year));
    const resp = await fetch(`${engineUrl()}/api/observations/daily?${qs}`);
    if (!resp.ok) return [];
    return await resp.json() as DailyAggregate[];
  } catch (err) {
    console.error('fetchDailyAggregates error:', err);
    return [];
  }
}

export async function fetchTodayStats(): Promise<TodayStats | null> {
  try {
    const resp = await fetch(`${engineUrl()}/api/observations/today`);
    if (!resp.ok) return null;
    return await resp.json() as TodayStats;
  } catch (err) {
    console.error('fetchTodayStats error:', err);
    return null;
  }
}

export async function fetchAlmanac(date?: string): Promise<AlmanacData | null> {
  try {
    const qs = new URLSearchParams();
    if (date) qs.set('date', date);
    const resp = await fetch(`${engineUrl()}/api/almanac?${qs}`);
    if (!resp.ok) return null;
    const data = await resp.json() as AlmanacData;
    //console.log('API: fetchAlmanac:', data);
    return data;
  } catch (err) {
    console.error('fetchAlmanac error:', err);
    return null;
  }
}

export async function fetchObservations(
  params: ObservationQueryParams = {},
): Promise<Observation[]> {
  try {
    const qs = new URLSearchParams();
    if (params.from !== undefined) qs.set('from', String(params.from));
    if (params.to !== undefined) qs.set('to', String(params.to));
    if (params.limit !== undefined) qs.set('limit', String(params.limit));
    if (params.offset !== undefined) qs.set('offset', String(params.offset));

    const resp = await fetch(`${engineUrl()}/api/observations?${qs}`);
    if (!resp.ok) return [];
    return await resp.json() as Observation[];
  } catch {
    return [];
  }
}
