import type { StorageAdapter } from '../storage/adapter.ts';
import type { IngestPollConfig } from '../../config.ts';

// LAN API poller — polls a device's local HTTP API at the configured interval.
// Polls the gateway's local HTTP API at the configured interval.
// Reference: https://osswww.ecowitt.net/uploads/20210716/WN1900%20GW1000,1100%20WH2680,2650%20telenet%20v1.6.0%20.pdf

export function startPoller(storage: StorageAdapter, config: IngestPollConfig): void {
  const poll = async (): Promise<void> => {
    try {
      const url = `http://${config.gwHost}:${config.gwPort}/get_livedata_info`;
      const resp = await fetch(url, { signal: AbortSignal.timeout(10_000) });

      if (!resp.ok) {
        console.error(`Poller: gateway returned HTTP ${resp.status}`);
        return;
      }

      const data = await resp.json();
      // TODO: parse gateway LAN API JSON response into Observation.
      // The response uses a nested structure; see API documentation for field mapping.
      console.info('Poller: received livedata (parsing TODO)', data);
      void storage;
    } catch (err) {
      console.error('Poller error:', err instanceof Error ? err.message : err);
    }
  };

  poll();
  setInterval(poll, config.intervalSeconds * 1_000);
}
