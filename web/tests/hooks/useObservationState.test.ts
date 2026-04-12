/**
 * Tests for web/lib/hooks/useObservationState.ts
 *
 * Signals are MODULE-SCOPED. Because Deno caches modules, every test
 * in this file shares the same signal instances. We reset .value = null
 * in a helper before each step to guarantee a clean slate.
 *
 * startObservationPolling() calls refresh() immediately (no await), then
 * sets an interval. A single flush() yields to the event loop so all
 * pending microtasks (fetch → .json() → signal assignment) can settle
 * before we assert.
 */
import { assertEquals, assertMatch, assertNotEquals } from '@std/assert';
import { mockEngineAPI, restoreFetch } from '../lib/mock-fetch.ts';
import {
  lastObservationTime,
  latestObservation,
  startObservationPolling,
  todayStats,
} from '../../lib/hooks/useObservationState.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Flush all pending microtasks.
 * Scheduling a setTimeout(0) macrotask ensures every queued Promise
 * callback has run before we resume the test.
 */
function flush(): Promise<void> {
  return new Promise<void>((resolve) => setTimeout(resolve, 0));
}

/** Reset all module-scoped signals to their initial null state before each step. */
function resetSignals(): void {
  latestObservation.value = null;
  todayStats.value = null;
  lastObservationTime.value = null;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

Deno.test('useObservationState', async (t) => {
  await t.step('initial state: signals are null before polling starts', () => {
    resetSignals();
    assertEquals(latestObservation.value, null);
    assertEquals(todayStats.value, null);
    assertEquals(lastObservationTime.value, null);
  });

  await t.step('startObservationPolling: updates latestObservation signal', async () => {
    resetSignals();
    mockEngineAPI({ observation: { tempOutdoor: 21.5 } });
    const cleanup = startObservationPolling(100_000);
    await flush();
    assertNotEquals(latestObservation.value, null, 'latestObservation should be set after first poll');
    assertEquals(latestObservation.value?.tempOutdoor, 21.5);
    cleanup();
    restoreFetch();
  });

  await t.step('startObservationPolling: updates todayStats signal', async () => {
    resetSignals();
    mockEngineAPI({ todayStats: { temp_max: 30.0 } });
    const cleanup = startObservationPolling(100_000);
    await flush();
    assertNotEquals(todayStats.value, null, 'todayStats should be set after first poll');
    assertEquals(todayStats.value?.temp_max, 30.0);
    cleanup();
    restoreFetch();
  });

  await t.step('startObservationPolling: updates lastObservationTime as ISO string', async () => {
    resetSignals();
    mockEngineAPI();
    const cleanup = startObservationPolling(100_000);
    await flush();
    assertNotEquals(lastObservationTime.value, null, 'lastObservationTime should be set after first poll');
    assertMatch(
      lastObservationTime.value!,
      /^\d{4}-\d{2}-\d{2}T/,
      'lastObservationTime should be an ISO 8601 string',
    );
    cleanup();
    restoreFetch();
  });

  await t.step('startObservationPolling: cleanup function cancels interval', async () => {
    resetSignals();
    mockEngineAPI();
    const cleanup = startObservationPolling(100_000);
    await flush();
    // Signals have been updated
    assertNotEquals(latestObservation.value, null);
    const snapObs = latestObservation.value;
    // cleanup() must not throw and should cancel the interval
    cleanup();
    // Signals retain their last values after cleanup
    assertEquals(latestObservation.value, snapObs);
    restoreFetch();
  });

  await t.step('startObservationPolling: calling twice cancels previous interval', async () => {
    resetSignals();
    mockEngineAPI();
    // First call — interval is started but we don’t capture its cleanup
    startObservationPolling(100_000);
    await flush();
    // Second call — cancels the first interval, starts a new one
    const cleanup = startObservationPolling(100_000);
    await flush();
    // Should not throw and signals should still be updated
    assertNotEquals(latestObservation.value, null);
    cleanup();
    restoreFetch();
  });

  await t.step('startObservationPolling: handles failed fetch gracefully', async () => {
    resetSignals();
    // Return HTTP 500 for every request — simulates engine being down
    globalThis.fetch = async (_input: RequestInfo | URL): Promise<Response> => {
      return new Response('Internal Server Error', { status: 500 });
    };
    const cleanup = startObservationPolling(100_000);
    await flush();
    // Promise.allSettled + .ok check means 500 responses are silently ignored
    assertEquals(latestObservation.value, null, 'signal must remain null on HTTP 500');
    assertEquals(todayStats.value, null, 'todayStats must remain null on HTTP 500');
    cleanup();
    restoreFetch();
  });
});
