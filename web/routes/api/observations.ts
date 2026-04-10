import { define } from "../../utils.ts";

const ENGINE_URL = Deno.env.get("WEB_ENGINE_URL") ?? "http://localhost:8080";

export const handler = define.handlers({
  async GET(ctx) {
    const url = new URL(ctx.req.url);
    const targetUrl = `${ENGINE_URL}/api/observations${url.search}`;
    try {
      const resp = await fetch(targetUrl);
      const data = await resp.json();
      return Response.json(data, { status: resp.status });
    } catch {
      return Response.json({ error: "Engine unavailable" }, { status: 503 });
    }
  },
});
