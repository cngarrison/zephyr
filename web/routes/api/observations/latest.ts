import { define } from '../../../utils.ts';

import { config } from '@/lib/config.ts';
const ENGINE_URL = config.web.engineUrl;

// Proxy GET /api/observations/latest → engine /api/observations/latest
// Used by client-side islands (same-origin fetch).
export const handler = define.handlers({
  async GET(_ctx) {
    try {
      const resp = await fetch(`${ENGINE_URL}/api/observations/latest`);
      const data = await resp.json();
      return Response.json(data, { status: resp.status });
    } catch {
      return Response.json({ error: 'Engine unavailable' }, { status: 503 });
    }
  },
});
