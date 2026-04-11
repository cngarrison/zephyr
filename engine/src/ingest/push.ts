import type { StorageAdapter } from "../storage/adapter.ts";
import { normalizeEcowitt, normalizeWu } from "./normalizer.ts";
import { config, primaryStation } from "../../config.ts";

/** Write raw ingest params to data/ for debugging. Fire-and-forget. */
async function dumpDebug(protocol: string, params: Record<string, string>): Promise<void> {
  try {
    const path = `./data/debug-${protocol}-latest.json`;
    const payload = JSON.stringify({ capturedAt: new Date().toISOString(), params }, null, 2);
    await Deno.writeTextFile(path, payload);
  } catch (_) {
    // Non-fatal — never block ingest
  }
}

export function createIngestHandler(storage: StorageAdapter) {
  return async (req: Request): Promise<Response> => {
    const url = new URL(req.url);

    // WU protocol: GET /ingest/wu?action=updateraw&ID=...&tempf=...
    if (url.pathname === "/ingest/wu" && req.method === "GET") {
      const params = Object.fromEntries(url.searchParams.entries());
      const station = primaryStation();
      if (station.ingest.push.debugDump) dumpDebug("wu", params);
      const { observation, readings } = normalizeWu(params, station.id);
      await storage.insert(observation);
      if (readings.length > 0) await storage.insertReadings(readings);
      console.info(
        `Ingest [WU] ts=${observation.timestamp} station=${observation.stationId} readings=${readings.length}`,
      );
      return new Response("success", { status: 200 });
    }

    // Ecowitt protocol: POST /ingest/ecowitt (application/x-www-form-urlencoded)
    if (url.pathname === "/ingest/ecowitt" && req.method === "POST") {
      const body = await req.text();
      const params = Object.fromEntries(new URLSearchParams(body).entries());
      const station = primaryStation();
      if (station.ingest.push.debugDump) dumpDebug("ecowitt", params);
      const { observation, readings } = normalizeEcowitt(params, station.id);
      await storage.insert(observation);
      if (readings.length > 0) await storage.insertReadings(readings);
      console.info(
        `Ingest [Ecowitt] ts=${observation.timestamp} station=${observation.stationId} readings=${readings.length}`,
      );
      return new Response("ok", { status: 200 });
    }

    return new Response("Not found", { status: 404 });
  };
}
