import type { StorageAdapter } from '../storage/adapter.ts';
import { primaryStation } from '../../config.ts';
import { computeAlmanac } from '../almanac/calculator.ts';

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
};

export function createApiRouter(storage: StorageAdapter) {
  return async (req: Request): Promise<Response> => {
    const url = new URL(req.url);

    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    try {
      // -----------------------------------------------------------------------
      // Config
      // -----------------------------------------------------------------------

      // GET /api/config
      if (url.pathname === '/api/config' && req.method === 'GET') {
        return Response.json({ station: primaryStation() }, { headers: CORS_HEADERS });
      }

      // GET /api/almanac?date=YYYY-MM-DD  (date optional — defaults to today UTC noon)
      if (url.pathname === '/api/almanac' && req.method === 'GET') {
        const dateStr = url.searchParams.get('date');
        let date: Date;
        if (dateStr) {
          date = new Date(dateStr + 'T12:00:00Z');
          if (isNaN(date.getTime())) {
            return Response.json({ error: 'invalid date' }, { status: 400, headers: CORS_HEADERS });
          }
        } else {
          const now = new Date();
          date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 12, 0, 0));
        }
        const station = primaryStation();
        const almanac = computeAlmanac(date, station.lat, station.lon);
        return Response.json(almanac, { headers: CORS_HEADERS });
      }

      // -----------------------------------------------------------------------
      // Observations
      // -----------------------------------------------------------------------

      // GET /api/observations/today?tz=<IANA>  (tz optional — defaults to config.station.timezone)
      if (url.pathname === '/api/observations/today' && req.method === 'GET') {
        const tz = url.searchParams.get('tz') ?? primaryStation().timezone;
        let start: number;
        let end: number;
        try {
          const now = Temporal.Now.zonedDateTimeISO(tz);
          start = Math.floor(now.startOfDay().epochMilliseconds / 1000);
          end = Math.floor(now.epochMilliseconds / 1000);
        } catch {
          return Response.json({ error: 'invalid timezone' }, { status: 400, headers: CORS_HEADERS });
        }
        const stats = await storage.getTodayStats(start, end);
        return Response.json(stats, { headers: CORS_HEADERS });
      }

      // GET /api/observations/latest
      if (url.pathname === '/api/observations/latest' && req.method === 'GET') {
        const obs = await storage.latest();
        return Response.json(obs, { headers: CORS_HEADERS });
      }

      // GET /api/observations/aggregate?from=<ISO>&to=<ISO>&bucket=hour|day
      if (url.pathname === '/api/observations/aggregate' && req.method === 'GET') {
        const fromStr = url.searchParams.get('from');
        const toStr = url.searchParams.get('to');
        const bucketStr = url.searchParams.get('bucket') ?? 'hour';
        if (!fromStr || !toStr) {
          return Response.json({ error: 'from and to are required' }, { status: 400, headers: CORS_HEADERS });
        }
        const from = new Date(fromStr);
        const to = new Date(toStr);
        if (isNaN(from.getTime()) || isNaN(to.getTime())) {
          return Response.json({ error: 'invalid date' }, { status: 400, headers: CORS_HEADERS });
        }
        if (bucketStr !== 'hour' && bucketStr !== 'day') {
          return Response.json({ error: "bucket must be 'hour' or 'day'" }, { status: 400, headers: CORS_HEADERS });
        }
        const aggs = await storage.getAggregates(from, to, bucketStr as 'hour' | 'day');
        return Response.json(aggs, { headers: CORS_HEADERS });
      }

      // GET /api/observations/daily?year=YYYY  (year optional — omit for all years)
      if (url.pathname === '/api/observations/daily' && req.method === 'GET') {
        const yearStr = url.searchParams.get('year');
        const year = yearStr ? parseInt(yearStr, 10) : undefined;
        if (yearStr && (isNaN(year!) || year! < 1900 || year! > 2100)) {
          return Response.json({ error: 'invalid year' }, { status: 400, headers: CORS_HEADERS });
        }
        const rows = await storage.getDailyAggregates(year);
        return Response.json(rows, { headers: CORS_HEADERS });
      }

      // GET /api/observations/range?from=<ISO>&to=<ISO>
      if (url.pathname === '/api/observations/range' && req.method === 'GET') {
        const fromStr = url.searchParams.get('from');
        const toStr = url.searchParams.get('to');
        if (!fromStr || !toStr) {
          return Response.json({ error: 'from and to required' }, { status: 400, headers: CORS_HEADERS });
        }
        const from = new Date(fromStr);
        const to = new Date(toStr);
        if (isNaN(from.getTime()) || isNaN(to.getTime())) {
          return Response.json({ error: 'invalid date' }, { status: 400, headers: CORS_HEADERS });
        }
        const obs = await storage.getObservationsRange(from, to);
        return Response.json(obs, { headers: CORS_HEADERS });
      }

      // GET /api/observations?from=<epoch>&to=<epoch>&limit=<n>&offset=<n>
      if (url.pathname === '/api/observations' && req.method === 'GET') {
        const obs = await storage.query(parseQuery(url));
        return Response.json(obs, { headers: CORS_HEADERS });
      }

      // -----------------------------------------------------------------------
      // Readings
      // -----------------------------------------------------------------------

      // GET /api/readings/latest?station=<id>
      if (url.pathname === '/api/readings/latest' && req.method === 'GET') {
        const stationId = url.searchParams.get('station') ?? undefined;
        const readings = await storage.latestReadings(stationId);
        return Response.json(readings, { headers: CORS_HEADERS });
      }

      // GET /api/readings/<sensorId>?from=&to=&limit=&offset=
      // sensorId uses dot-notation: lightning.count, soil.moisture.1, etc.
      const readingsMatch = url.pathname.match(/^\/api\/readings\/(.+)$/);
      if (readingsMatch && req.method === 'GET') {
        const sensorId = decodeURIComponent(readingsMatch[1]);
        const readings = await storage.queryReadings(sensorId, parseQuery(url));
        return Response.json(readings, { headers: CORS_HEADERS });
      }

      return Response.json({ error: 'Not found' }, { status: 404, headers: CORS_HEADERS });
    } catch (err) {
      console.error('API error:', err instanceof Error ? err.message : err);
      return Response.json({ error: 'Internal error' }, { status: 500, headers: CORS_HEADERS });
    }
  };
}

function parseQuery(url: URL): { from?: number; to?: number; limit?: number; offset?: number } {
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  const limit = url.searchParams.get('limit');
  const offset = url.searchParams.get('offset');
  return {
    from: from ? parseInt(from, 10) : undefined,
    to: to ? parseInt(to, 10) : undefined,
    limit: limit ? parseInt(limit, 10) : 1000,
    offset: offset ? parseInt(offset, 10) : undefined,
  };
}
