import { config } from "./config.ts";
import { createStorageAdapter } from "./src/storage/factory.ts";
import { createIngestHandler } from "./src/ingest/push.ts";
import { startPoller } from "./src/ingest/poller.ts";
import { createApiRouter } from "./src/api/router.ts";

console.info("Starting Zephyr engine...");

const storage = await createStorageAdapter();
await storage.init();

const provider = Deno.env.get("DB_PROVIDER") ?? "sqlite";
console.info(`Storage: ${provider}`);

const ingestHandler = createIngestHandler(storage);
const apiRouter = createApiRouter(storage);

Deno.serve({
  port: config.server.port,
  hostname: config.server.host,
  handler: async (req: Request): Promise<Response> => {
    const url = new URL(req.url);

    if (url.pathname.startsWith("/ingest") && config.ingest.push.enabled) {
      return await ingestHandler(req);
    }
    if (url.pathname.startsWith("/api")) {
      return await apiRouter(req);
    }
    return new Response("Zephyr Engine", { status: 200 });
  },
  onListen: ({ hostname, port }) => {
    console.info(`Engine listening on http://${hostname}:${port}`);
  },
});

if (config.ingest.poll.enabled) {
  startPoller(storage, config.ingest.poll);
  console.info(`Poller started (interval: ${config.ingest.poll.intervalSeconds}s)`);
}
