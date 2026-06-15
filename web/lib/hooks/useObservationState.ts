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

/**
 * Recent observations for graph display. Null until initRecentObservations()
 * completes. Appended to on each polling cycle so chart islands stay live
 * without triggering additional DB queries.
 */
export const recentObservations = signal<Observation[] | null>(null);

// Tracks the from/to range currently loaded into recentObservations.
let _recentRange: { from: string; to: string } | null = null;

/**
 * Fetch the initial observation range for graph display.
 *
 * Idempotent — skips the network request when the same from/to range is
 * already loaded. All chart islands on a page call this on mount; only the
 * first call triggers a fetch; the rest return immediately with the cached
 * signal value.
 *
 * Returns true on success, false on network/HTTP error.
 */
export async function initRecentObservations(from: string, to: string): Promise<boolean> {
  if (
    _recentRange?.from === from &&
    _recentRange?.to === to &&
    recentObservations.value !== null
  ) {
    return true; // already loaded for this range
  }

  // Reset signal so charts know to show loading state for the new range.
  recentObservations.value = null;
  _recentRange = { from, to };

  try {
    const resp = await fetch(
      `/api/observations/range?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
    );
    if (resp.ok) {
      recentObservations.value = await resp.json() as Observation[];
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

// Internal interval handle — prevents duplicate timers if called more than once.
let _handle: number | undefined;

/**
 * Start polling /api/observations/latest and /api/observations/today.
 * Updates module-scoped signals on each successful response so any island
 * that reads them will reactively re-render.
 *
 * Also appends new observations to recentObservations so chart islands
 * stay live without issuing additional DB queries.
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

      // Append to recentObservations if this is a newer point — chart islands
      // subscribe to this signal and will re-render automatically.
      const recent = recentObservations.value;
      if (recent !== null) {
        const lastTs = recent.length > 0 ? recent[recent.length - 1].timestamp : 0;
        if (obs.timestamp > lastTs) {
          recentObservations.value = [...recent, obs];
        }
      }
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
