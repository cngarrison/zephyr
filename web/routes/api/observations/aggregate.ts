import { define } from "@/utils.ts";

const ENGINE_URL = Deno.env.get("WEB_ENGINE_URL") ?? "http://localhost:8080";

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
