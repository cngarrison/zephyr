import type { AggregateObservation, DailyAggregate, Observation, SensorReading, TodayStats } from '../types.ts';

// Base epoch used across all fixtures — 2024-06-15T12:00:00Z
export const BASE_TIMESTAMP = 1718445600;
export const BASE_STATION_ID = 'test-station';

export function makeObservation(overrides: Partial<Observation> = {}): Observation {
  return {
    timestamp: BASE_TIMESTAMP,
    stationId: BASE_STATION_ID,
    tempOutdoor: 20.0,      // 68°F in °C
    tempIndoor: 22.0,
    tempDewpoint: 10.0,
    humidityOutdoor: 50,
    humidityIndoor: 45,
    pressureAbsolute: 1013.25,
    pressureRelative: 1015.0,
    windSpeed: 5.0,          // m/s
    windGust: 8.0,
    windDirection: 180,
    rainRate: 0,
    rainDaily: 0,
    solarRadiation: 500,
    uvIndex: 3,
    ...overrides,
  };
}

export function makeSensorReading(overrides: Partial<SensorReading> = {}): SensorReading {
  return {
    timestamp: BASE_TIMESTAMP,
    stationId: BASE_STATION_ID,
    sensorId: 'temp.extra.1',
    value: 18.5,
    ...overrides,
  };
}

/**
 * Returns a Weather Underground protocol payload in imperial units,
 * as pushed by GW-series devices.
 * Compatible with WuParams (index signature Record<string, string | undefined>).
 */
export function makeWuPayload(overrides: Record<string, string | undefined> = {}): Record<string, string | undefined> {
  return {
    ID: 'STATION001',
    tempf: '68.0',          // → 20.0°C
    tempinf: '71.6',        // → 22.0°C
    humidity: '50',
    humidityin: '45',
    baromin: '29.92',       // → ~1013.25 hPa
    baromrelin: '30.01',
    winddir: '180',
    windspeedmph: '11.185', // → ~5.0 m/s
    windgustmph: '17.895',  // → ~8.0 m/s
    rainratein: '0',
    dailyrainin: '0',
    solarradiation: '500',
    UV: '3',
    dateutc: '2024-06-15 12:00:00',  // intentionally different from server time
    ...overrides,
  };
}

/**
 * Returns an Ecowitt protocol POST payload in imperial units.
 * Compatible with EcowittParams (index signature Record<string, string | undefined>).
 */
export function makeEcowittPayload(overrides: Record<string, string | undefined> = {}): Record<string, string | undefined> {
  return {
    PASSKEY: 'ECOWITT001',
    stationtype: 'GW1000B_V1.6.8',
    dateutc: '2024-06-15 12:00:00',
    tempf: '68.0',
    tempinf: '71.6',
    humidity: '50',
    humidityin: '45',
    baromabsin: '29.92',
    baromrelin: '30.01',
    winddir: '180',
    windspeedmph: '11.185',
    windgustmph: '17.895',
    rainratein: '0',
    dailyrainin: '0',
    weeklyrainin: '0',
    monthlyrainin: '0',
    yearlyrainin: '0',
    eventrainin: '0',
    solarradiation: '500',
    uv: '3',
    ...overrides,
  };
}

export function makeAggregateObservation(overrides: Partial<AggregateObservation> = {}): AggregateObservation {
  return {
    bucket: '2024-06-15T12:00:00.000Z',
    temp_c_avg: 20.0,
    temp_c_min: 18.0,
    temp_c_max: 22.0,
    humidity_pct_avg: 50,
    pressure_hpa_avg: 1013.25,
    wind_speed_ms_avg: 3.0,
    wind_gust_ms_max: 8.0,
    rain_total_mm: 0,
    uv_index_avg: 3,
    ...overrides,
  };
}

export function makeDailyAggregate(overrides: Partial<DailyAggregate> = {}): DailyAggregate {
  return {
    date: '2024-06-15',
    temp_c_min: 15.0,
    temp_c_max: 25.0,
    temp_c_avg: 20.0,
    humidity_pct_avg: 50,
    pressure_hpa_avg: 1013.25,
    wind_speed_ms_avg: 3.0,
    wind_gust_ms_max: 8.0,
    rain_total_mm: 0,
    uv_index_max: 5,
    ...overrides,
  };
}

export function makeTodayStats(overrides: Partial<TodayStats> = {}): TodayStats {
  return {
    temp_min: 15.0, temp_min_time: BASE_TIMESTAMP,
    temp_max: 25.0, temp_max_time: BASE_TIMESTAMP + 3600,
    humidity_min: 40, humidity_min_time: BASE_TIMESTAMP,
    humidity_max: 70, humidity_max_time: BASE_TIMESTAMP + 7200,
    pressure_min: 1010.0, pressure_min_time: BASE_TIMESTAMP,
    pressure_max: 1016.0, pressure_max_time: BASE_TIMESTAMP + 3600,
    wind_speed_avg: 3.0,
    wind_speed_max: 10.0, wind_speed_max_time: BASE_TIMESTAMP + 1800,
    wind_dir_at_max: 270,
    rain_rate_max: 2.0, rain_rate_max_time: BASE_TIMESTAMP + 5400,
    rain_today: 5.0,
    dew_point_min: 8.0, dew_point_min_time: BASE_TIMESTAMP,
    dew_point_max: 14.0, dew_point_max_time: BASE_TIMESTAMP + 3600,
    uv_max: 6, uv_max_time: BASE_TIMESTAMP + 7200,
    solar_max: 800, solar_max_time: BASE_TIMESTAMP + 7200,
    temp_indoor_min: 20.0, temp_indoor_min_time: BASE_TIMESTAMP,
    temp_indoor_max: 24.0, temp_indoor_max_time: BASE_TIMESTAMP + 3600,
    ...overrides,
  };
}
