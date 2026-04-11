import { signal } from '@preact/signals';
import type { Observation, TodayStats } from '@/lib/types.ts';

/**
 * Module-scoped signals shared across all islands.
 * Because Vite deduplicates shared imports, every island that imports from
 * this module operates on the same signal instances at runtime.
 */

/** ISO string of the most recently received observation's timestamp. */
export const lastObservationTime = signal<string | null>(null);

/** The most recently received observation. */
export const latestObservation = signal<Observation | null>(null);

/** Today's aggregated stats, updated alongside latestObservation. */
export const todayStats = signal<TodayStats | null>(null);

// Internal interval handle — prevents duplicate timers if called more than once.
let _handle: number | undefined;

/**
 * Start polling /api/observations/latest and /api/observations/today.
 * Updates module-scoped signals on each successful response so any island
 * that reads them will reactively re-render.
 *
 * Safe to call multiple times — cancels any previous interval first.
 * Returns a cleanup function suitable for useEffect.
 */
export function startObservationPolling(intervalMs = 60_000): () => void {
  async function refresh(): Promise<void> {
    const [obsResult, statsResult] = await Promise.allSettled([
      fetch('/api/observations/latest'),
      fetch('/api/observations/today'),
    ]);

    if (obsResult.status === 'fulfilled' && obsResult.value.ok) {
      const obs = await obsResult.value.json() as Observation;
      latestObservation.value = obs;
      // timestamp is stored as epoch seconds → convert to ISO for display
      lastObservationTime.value = new Date(obs.timestamp * 1000).toISOString();
    }

    if (statsResult.status === 'fulfilled' && statsResult.value.ok) {
      todayStats.value = await statsResult.value.json() as TodayStats;
    }
  }

  if (_handle !== undefined) clearInterval(_handle);
  refresh();
  _handle = setInterval(refresh, intervalMs);

  return () => {
    if (_handle !== undefined) {
      clearInterval(_handle);
      _handle = undefined;
    }
  };
}
