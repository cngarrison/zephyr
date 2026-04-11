import { App, staticFiles } from 'fresh';
import type { State } from '@/utils.ts';

export const app = new App<State>();

app.use(staticFiles());

// Pass a shared value from a middleware
// app.use(async (ctx) => {
//   ctx.state.station = "Samaya";
//   return await ctx.next();
// });

// Include file-system based routes here
app.fsRoutes();

// Note: do NOT call app.listen() here.
// - deno task dev  → Vite owns the server (port from vite.config.ts)
// - deno task start → deno serve owns the server (--port flag)
// - deno task start:prod → server.ts owns the server (WEB_PORT env var)
// Calling listen() alongside any of the above causes AddrInUse errors.
// See https://github.com/denoland/fresh/issues/3548
