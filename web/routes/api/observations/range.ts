import { define } from '../../../utils.ts';

import { config } from '@/lib/config.ts';
const ENGINE_URL = config.web.engineUrl;

export const handler = define.handlers({
  async GET(ctx) {
    const url = new URL(ctx.req.url);
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    const targetUrl = `${ENGINE_URL}/api/observations/range?from=${encodeURIComponent(from ?? '')}&to=${
      encodeURIComponent(to ?? '')
    }`;
    try {
      const resp = await fetch(targetUrl);
      const data = await resp.json();
      return Response.json(data, { status: resp.status });
    } catch {
      return Response.json({ error: 'Engine unavailable' }, { status: 502 });
    }
  },
});
