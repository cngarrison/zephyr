import { config, primaryStation } from './config.ts';
import { createStorageAdapter } from './src/storage/factory.ts';
import { createIngestHandler } from './src/ingest/push.ts';
import { startPoller } from './src/ingest/poller.ts';
import { createApiRouter } from './src/api/router.ts';

console.info('Starting Zephyr engine...');

const storage = await createStorageAdapter();
await storage.init();

console.info(`Storage: ${config.storage.provider}`);

const station = primaryStation();
console.info(`Station: ${station.name} (${station.id})`);

const ingestHandler = createIngestHandler(storage);
const apiRouter = createApiRouter(storage);

Deno.serve({
  port: config.engine.port,
  hostname: config.engine.host,
  handler: async (req: Request): Promise<Response> => {
    const url = new URL(req.url);

    if (url.pathname.startsWith('/ingest') && station.ingest.push.enabled) {
      return await ingestHandler(req);
    }
    if (url.pathname.startsWith('/api')) {
      return await apiRouter(req);
    }
    return new Response('Zephyr Engine', { status: 200 });
  },
  onListen: ({ hostname, port }) => {
    console.info(`Engine listening on http://${hostname}:${port}`);
  },
});

if (station.ingest.poll.enabled) {
  startPoller(storage, station.ingest.poll);
  console.info(`Poller started (interval: ${station.ingest.poll.intervalSeconds}s)`);
}
