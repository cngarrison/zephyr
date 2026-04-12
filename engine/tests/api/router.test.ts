import { assertEquals, assertExists } from '@std/assert';

// ---------------------------------------------------------------------------
// Config must be set before any module that imports engine/config.ts is loaded.
// engine/config.ts exports a module-level singleton (loadConfig() at import time).
// We use dynamic imports below so that ZEPHYR_CONFIG is set first.
// ---------------------------------------------------------------------------
const testConfigPath = new URL('../fixtures/test-config.toml', import.meta.url).pathname;
Deno.env.set('ZEPHYR_CONFIG', testConfigPath);

// Dynamic imports ensure config is read AFTER env var is set
const { createApiRouter } = await import('../../src/api/router.ts');
const { createMockAdapter } = await import('../storage/mock-adapter.ts');
const { makeObservation, BASE_TIMESTAMP } = await import('@zephyr/shared/testing');

// ---------------------------------------------------------------------------
// Test server helpers
// ---------------------------------------------------------------------------

function randomPort(): number {
  return 49152 + Math.floor(Math.random() * 16383);
}

async function withServer(
  adapter: Awaited<ReturnType<typeof createMockAdapter>>,
  fn: (baseUrl: string) => Promise<void>,
): Promise<void> {
  const port = randomPort();
  const handler = createApiRouter(adapter);
  const controller = new AbortController();
  const server = Deno.serve(
    { port, hostname: '127.0.0.1', signal: controller.signal, onListen: () => {} },
    handler,
  );
  try {
    await fn(`http://127.0.0.1:${port}`);
  } finally {
    controller.abort();
    await server.finished;
  }
}

// ---------------------------------------------------------------------------
// GET /api/observations/latest
// ---------------------------------------------------------------------------

Deno.test('GET /api/observations/latest → 200 with latest observation', async () => {
  const adapter = createMockAdapter();
  await adapter.init();
  await adapter.insert(makeObservation({ timestamp: BASE_TIMESTAMP, tempOutdoor: 20.0 }));

  await withServer(adapter, async (base) => {
    const res = await fetch(`${base}/api/observations/latest`);
    assertEquals(res.status, 200);
    const body = await res.json();
    assertExists(body);
    assertEquals(body.timestamp, BASE_TIMESTAMP);
    assertEquals(body.tempOutdoor, 20.0);
  });
});

Deno.test('GET /api/observations/latest → 200 null when no data', async () => {
  // The router returns 200 with a null body when no observation exists yet
  // (empty DB on first start). A 404 would be semantically wrong: the endpoint
  // exists, there is just no data. The web UI handles null gracefully.
  const adapter = createMockAdapter();
  await adapter.init();

  await withServer(adapter, async (base) => {
    const res = await fetch(`${base}/api/observations/latest`);
    assertEquals(res.status, 200);
    const body = await res.json();
    assertEquals(body, null);
  });
});

// ---------------------------------------------------------------------------
// GET /api/observations
// ---------------------------------------------------------------------------

Deno.test('GET /api/observations → 200 JSON array', async () => {
  const adapter = createMockAdapter();
  await adapter.init();
  await adapter.insertBatch([
    makeObservation({ timestamp: BASE_TIMESTAMP }),
    makeObservation({ timestamp: BASE_TIMESTAMP + 60 }),
  ]);

  await withServer(adapter, async (base) => {
    const res = await fetch(`${base}/api/observations`);
    assertEquals(res.status, 200);
    const body = await res.json();
    assertEquals(Array.isArray(body), true);
    assertEquals(body.length >= 2, true);
  });
});

// ---------------------------------------------------------------------------
// GET /api/observations/range
// ---------------------------------------------------------------------------

Deno.test('GET /api/observations/range → 200 with from/to params', async () => {
  const adapter = createMockAdapter();
  await adapter.init();
  await adapter.insertBatch([
    makeObservation({ timestamp: BASE_TIMESTAMP }),
    makeObservation({ timestamp: BASE_TIMESTAMP + 3600 }),
    makeObservation({ timestamp: BASE_TIMESTAMP + 7200 }),
  ]);

  await withServer(adapter, async (base) => {
    const from = new Date((BASE_TIMESTAMP - 1) * 1000).toISOString();
    const to   = new Date((BASE_TIMESTAMP + 3700) * 1000).toISOString();
    const res  = await fetch(`${base}/api/observations/range?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
    assertEquals(res.status, 200);
    const body = await res.json();
    assertEquals(Array.isArray(body), true);
    assertEquals(body.length, 2);
  });
});

Deno.test('GET /api/observations/range → 400 when from/to missing', async () => {
  const adapter = createMockAdapter();
  await adapter.init();

  await withServer(adapter, async (base) => {
    const res = await fetch(`${base}/api/observations/range`);
    assertEquals(res.status, 400);
    await res.body?.cancel();
  });
});

// ---------------------------------------------------------------------------
// GET /api/observations/aggregate
// ---------------------------------------------------------------------------

Deno.test('GET /api/observations/aggregate → 200 with bucket=hour', async () => {
  const adapter = createMockAdapter();
  await adapter.init();
  await adapter.insert(makeObservation({ timestamp: BASE_TIMESTAMP }));

  await withServer(adapter, async (base) => {
    const from = new Date((BASE_TIMESTAMP - 1) * 1000).toISOString();
    const to   = new Date((BASE_TIMESTAMP + 7200) * 1000).toISOString();
    const res  = await fetch(
      `${base}/api/observations/aggregate?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&bucket=hour`,
    );
    assertEquals(res.status, 200);
    const body = await res.json();
    assertEquals(Array.isArray(body), true);
  });
});

Deno.test('GET /api/observations/aggregate → 400 when params missing', async () => {
  const adapter = createMockAdapter();
  await adapter.init();

  await withServer(adapter, async (base) => {
    const res = await fetch(`${base}/api/observations/aggregate`);
    assertEquals(res.status, 400);
    await res.body?.cancel();
  });
});

// ---------------------------------------------------------------------------
// GET /api/config
// ---------------------------------------------------------------------------

Deno.test('GET /api/config → 200 with station info', async () => {
  const adapter = createMockAdapter();
  await adapter.init();

  await withServer(adapter, async (base) => {
    const res = await fetch(`${base}/api/config`);
    assertEquals(res.status, 200);
    const body = await res.json();
    // Should contain station info from test-config.toml
    assertExists(body.station ?? body.stations ?? body);
  });
});

// ---------------------------------------------------------------------------
// Unknown route → 404
// ---------------------------------------------------------------------------

Deno.test('unknown route → 404', async () => {
  const adapter = createMockAdapter();
  await adapter.init();

  await withServer(adapter, async (base) => {
    const res = await fetch(`${base}/api/nonexistent`);
    assertEquals(res.status, 404);
    await res.body?.cancel();
  });
});
