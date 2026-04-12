import { assertEquals, assertExists, assertNotEquals } from '@std/assert';
import type { StorageAdapter } from '../../src/storage/adapter.ts';
import { BASE_STATION_ID, BASE_TIMESTAMP, makeObservation, makeSensorReading } from '@zephyr/shared/testing';

/**
 * Provider-agnostic contract tests for StorageAdapter implementations.
 *
 * Usage:
 *   import { runAdapterContractTests } from './adapter-contract.test.ts';
 *   await runAdapterContractTests('sqlite', createAdapter, cleanup);
 *
 * Every StorageAdapter implementation MUST pass all tests here.
 * Adding a new storage provider? Run this suite against it.
 */
export function runAdapterContractTests(
  name: string,
  createAdapter: () => Promise<StorageAdapter>,
  cleanup?: () => Promise<void>,
): Promise<void> {
  // ---------------------------------------------------------------------------
  // 1. insert + latest
  // ---------------------------------------------------------------------------
  Deno.test(`[${name}] insert + latest: stores and retrieves most recent observation`, async () => {
    const adapter = await createAdapter();
    try {
      const obs1 = makeObservation({ timestamp: BASE_TIMESTAMP, tempOutdoor: 20.0 });
      const obs2 = makeObservation({ timestamp: BASE_TIMESTAMP + 60, tempOutdoor: 21.0 });
      await adapter.insert(obs1);
      await adapter.insert(obs2);

      const latest = await adapter.latest();
      assertExists(latest);
      assertEquals(latest.timestamp, BASE_TIMESTAMP + 60);
      assertEquals(latest.tempOutdoor, 21.0);
    } finally {
      await adapter.close();
    }
  });

  Deno.test(`[${name}] latest: returns null when no observations`, async () => {
    const adapter = await createAdapter();
    try {
      const result = await adapter.latest();
      assertEquals(result, null);
    } finally {
      await adapter.close();
    }
  });

  // ---------------------------------------------------------------------------
  // 2. insertBatch + query
  // ---------------------------------------------------------------------------
  Deno.test(`[${name}] insertBatch + query: stores batch and filters by time range`, async () => {
    const adapter = await createAdapter();
    try {
      const batch = [
        makeObservation({ timestamp: BASE_TIMESTAMP, tempOutdoor: 18.0 }),
        makeObservation({ timestamp: BASE_TIMESTAMP + 300, tempOutdoor: 19.0 }),
        makeObservation({ timestamp: BASE_TIMESTAMP + 600, tempOutdoor: 20.0 }),
        makeObservation({ timestamp: BASE_TIMESTAMP + 900, tempOutdoor: 21.0 }),
      ];
      await adapter.insertBatch(batch);

      // Query only the middle two
      const result = await adapter.query({
        from: BASE_TIMESTAMP + 200,
        to: BASE_TIMESTAMP + 700,
      });
      assertEquals(result.length, 2);
      assertEquals(result[0].tempOutdoor, 19.0);
      assertEquals(result[1].tempOutdoor, 20.0);
    } finally {
      await adapter.close();
    }
  });

  Deno.test(`[${name}] query: respects limit`, async () => {
    const adapter = await createAdapter();
    try {
      const batch = Array.from({ length: 10 }, (_, i) => makeObservation({ timestamp: BASE_TIMESTAMP + i * 60 }));
      await adapter.insertBatch(batch);

      const result = await adapter.query({ limit: 3 });
      assertEquals(result.length, 3);
    } finally {
      await adapter.close();
    }
  });

  // ---------------------------------------------------------------------------
  // 3. insertReadings + latestReadings
  // ---------------------------------------------------------------------------
  Deno.test(`[${name}] insertReadings + latestReadings: stores and retrieves per sensorId`, async () => {
    const adapter = await createAdapter();
    try {
      const r1 = makeSensorReading({ sensorId: 'soil.moisture.1', value: 42, timestamp: BASE_TIMESTAMP });
      const r2 = makeSensorReading({ sensorId: 'soil.temp.1', value: 18.0, timestamp: BASE_TIMESTAMP });
      const r3 = makeSensorReading({ sensorId: 'soil.moisture.1', value: 45, timestamp: BASE_TIMESTAMP + 60 });
      await adapter.insertReadings([r1, r2, r3]);

      const latest = await adapter.latestReadings(BASE_STATION_ID);
      const byId = Object.fromEntries(latest.map((r) => [r.sensorId, r.value]));
      // r3 should win over r1 for soil.moisture.1
      assertEquals(byId['soil.moisture.1'], 45);
      assertEquals(byId['soil.temp.1'], 18.0);
    } finally {
      await adapter.close();
    }
  });

  // ---------------------------------------------------------------------------
  // 4. getObservationsRange
  // ---------------------------------------------------------------------------
  Deno.test(`[${name}] getObservationsRange: returns observations within Date range`, async () => {
    const adapter = await createAdapter();
    try {
      const batch = [
        makeObservation({ timestamp: BASE_TIMESTAMP }),
        makeObservation({ timestamp: BASE_TIMESTAMP + 3600 }),
        makeObservation({ timestamp: BASE_TIMESTAMP + 7200 }),
      ];
      await adapter.insertBatch(batch);

      const from = new Date((BASE_TIMESTAMP - 1) * 1000);
      const to = new Date((BASE_TIMESTAMP + 3700) * 1000);
      const result = await adapter.getObservationsRange(from, to);
      assertEquals(result.length, 2);
      assertEquals(result[0].timestamp, BASE_TIMESTAMP);
      assertEquals(result[1].timestamp, BASE_TIMESTAMP + 3600);
    } finally {
      await adapter.close();
    }
  });

  // ---------------------------------------------------------------------------
  // 5. getAggregates
  // ---------------------------------------------------------------------------
  Deno.test(`[${name}] getAggregates: returns buckets for given range`, async () => {
    const adapter = await createAdapter();
    try {
      // Insert two observations an hour apart
      await adapter.insertBatch([
        makeObservation({ timestamp: BASE_TIMESTAMP, tempOutdoor: 18.0 }),
        makeObservation({ timestamp: BASE_TIMESTAMP + 3600, tempOutdoor: 22.0 }),
      ]);

      const from = new Date((BASE_TIMESTAMP - 1) * 1000);
      const to = new Date((BASE_TIMESTAMP + 7200) * 1000);
      const aggs = await adapter.getAggregates(from, to, 'hour');

      // Must return at least 1 bucket
      assertNotEquals(aggs.length, 0);
      for (const agg of aggs) {
        assertExists(agg.bucket);
      }
    } finally {
      await adapter.close();
    }
  });

  // ---------------------------------------------------------------------------
  // 6. getDailyAggregates
  // ---------------------------------------------------------------------------
  Deno.test(`[${name}] getDailyAggregates: returns at least one row for stored data`, async () => {
    const adapter = await createAdapter();
    try {
      await adapter.insert(makeObservation({ timestamp: BASE_TIMESTAMP }));

      const rows = await adapter.getDailyAggregates();
      assertNotEquals(rows.length, 0);
      for (const row of rows) {
        assertExists(row.date);
        assertEquals(row.date.length, 10); // YYYY-MM-DD
      }
    } finally {
      await adapter.close();
    }
  });

  // ---------------------------------------------------------------------------
  // 7. getTodayStats
  // ---------------------------------------------------------------------------
  Deno.test(`[${name}] getTodayStats: returns min/max/avg from stored observations`, async () => {
    const adapter = await createAdapter();
    try {
      await adapter.insertBatch([
        makeObservation({ timestamp: BASE_TIMESTAMP, tempOutdoor: 15.0, humidityOutdoor: 60 }),
        makeObservation({ timestamp: BASE_TIMESTAMP + 3600, tempOutdoor: 25.0, humidityOutdoor: 40 }),
      ]);

      const stats = await adapter.getTodayStats(BASE_TIMESTAMP - 1, BASE_TIMESTAMP + 7200);
      assertExists(stats);
      assertEquals(stats.temp_min, 15.0);
      assertEquals(stats.temp_max, 25.0);
    } finally {
      await adapter.close();
    }
  });

  Deno.test(`[${name}] getTodayStats: null fields when no data in range`, async () => {
    const adapter = await createAdapter();
    try {
      const stats = await adapter.getTodayStats(BASE_TIMESTAMP, BASE_TIMESTAMP + 3600);
      assertEquals(stats.temp_min, null);
      assertEquals(stats.temp_max, null);
    } finally {
      await adapter.close();
    }
  });

  if (cleanup) {
    Deno.test(`[${name}] cleanup`, async () => {
      await cleanup();
    });
  }
}
