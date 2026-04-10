import type { FreshContext } from 'fresh';

const ENGINE_URL = Deno.env.get('WEB_ENGINE_URL') ?? 'http://localhost:8080';

export async function GET(req: Request, _ctx: FreshContext): Promise<Response> {
  const url = new URL(req.url);
  const date = url.searchParams.get('date');
  const qs = new URLSearchParams();
  if (date) qs.set('date', date);
  try {
    const resp = await fetch(`${ENGINE_URL}/api/almanac?${qs}`);
    if (!resp.ok) return new Response('Engine error', { status: resp.status });
    return Response.json(await resp.json());
  } catch {
    return new Response('Engine unavailable', { status: 502 });
  }
}
