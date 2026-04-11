import { define } from "@/utils.ts";

import { config } from '@/lib/config.ts';
const ENGINE_URL = config.web.engineUrl;

export const handler = define.handlers({
  async GET({ req }) {
    const url = new URL(req.url);
    const from = url.searchParams.get("from") ?? "";
    const to = url.searchParams.get("to") ?? "";
    const bucket = url.searchParams.get("bucket") ?? "hour";
    const qs = new URLSearchParams({ from, to, bucket });
    try {
      const resp = await fetch(`${ENGINE_URL}/api/observations/aggregate?${qs}`);
      const data = await resp.json();
      return Response.json(data, { status: resp.status });
    } catch {
      return Response.json({ error: "engine unavailable" }, { status: 502 });
    }
  },
});
