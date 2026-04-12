/**
 * Mock engine API fetch for web tests.
 * Replaces globalThis.fetch with a stub that returns realistic fixture data
 * for all known engine API endpoints.
 */
import type { Observation, TodayStats } from '@zephyr/shared';
import {
  makeAggregateObservation,
  makeObservation,
  makeTodayStats,
} from '@zephyr/shared/testing';

export interface MockEngineAPIOptions {
  observation?: Partial<Observation>;
  todayStats?: Partial<TodayStats>;
}

// Capture the real fetch before any mocking occurs.
const _originalFetch: typeof globalThis.fetch = globalThis.fetch;

function makeJsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Replace globalThis.fetch with a mock that intercepts engine API endpoints:
 *   GET /api/observations/latest    → makeObservation(opts?.observation)
 *   GET /api/observations/today     → makeTodayStats(opts?.todayStats)
 *   GET /api/observations/range     → [makeObservation()]
 *   GET /api/observations/aggregate → [makeAggregateObservation()]
 *   GET /api/config                 → { station: { name, lat, lon, ... } }
 *   Anything else                   → throws Error
 */
export function mockEngineAPI(opts?: MockEngineAPIOptions): void {
  globalThis.fetch = async (
    input: RequestInfo | URL,
    _init?: RequestInit,
  ): Promise<Response> => {
    const urlStr = typeof input === 'string'
      ? input
      : input instanceof URL
      ? input.toString()
      : (input as Request).url;

    // Order matters: check more specific paths before generic prefixes.
    if (urlStr.includes('/api/observations/aggregate')) {
      return makeJsonResponse([makeAggregateObservation()]);
    }
    if (urlStr.includes('/api/observations/latest')) {
      return makeJsonResponse(makeObservation(opts?.observation));
    }
    if (urlStr.includes('/api/observations/today')) {
      return makeJsonResponse(makeTodayStats(opts?.todayStats));
    }
    if (urlStr.includes('/api/observations/range')) {
      return makeJsonResponse([makeObservation()]);
    }
    if (urlStr.includes('/api/config')) {
      return makeJsonResponse({
        station: {
          name: 'Test Station',
          lat: 51.5,
          lon: -0.1,
          altitude: 10,
          timezone: 'Europe/London',
          extras: [],
        },
      });
    }
    throw new Error(`unexpected fetch: ${urlStr}`);
  };
}

/** Restore globalThis.fetch to the original implementation captured at module load. */
export function restoreFetch(): void {
  globalThis.fetch = _originalFetch;
}
