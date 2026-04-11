import { define } from "../../../utils.ts";

import { config } from '@/lib/config.ts';
const ENGINE_URL = config.web.engineUrl;

// Proxy GET /api/observations/today → engine /api/observations/today
// Used by client-side islands (same-origin fetch).
export const handler = define.handlers({
  async GET(ctx) {
    try {
      const tz = ctx.url.searchParams.get("tz");
      const qs = tz ? `?tz=${encodeURIComponent(tz)}` : "";
      const resp = await fetch(`${ENGINE_URL}/api/observations/today${qs}`);
      const data = await resp.json();
      return Response.json(data, { status: resp.status });
    } catch {
      return Response.json({ error: "Engine unavailable" }, { status: 503 });
    }
  },
});
