import type { Observation } from '../domain/observation.ts';

// Re-export shared domain types so engine-internal code can import from this
// stable path without knowing about @zephyr/shared directly.
export type { AggregateObservation, DailyAggregate, ObservationQuery, SensorReading, TodayStats } from '@zephyr/shared';
import type { AggregateObservation, DailyAggregate, ObservationQuery, SensorReading, TodayStats } from '@zephyr/shared';

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
