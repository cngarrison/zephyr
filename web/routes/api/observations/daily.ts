import { define } from '@/utils.ts';

import { config } from '@/lib/config.ts';
const ENGINE_URL = config.web.engineUrl;

export const handler = define.handlers({
  async GET({ req }) {
    const url = new URL(req.url);
    const year = url.searchParams.get('year') ?? '';
    const qs = year ? new URLSearchParams({ year }) : new URLSearchParams();
    try {
      const resp = await fetch(`${ENGINE_URL}/api/observations/daily?${qs}`);
      const data = await resp.json();
      return Response.json(data, { status: resp.status });
    } catch {
      return Response.json({ error: 'engine unavailable' }, { status: 502 });
    }
  },
});
