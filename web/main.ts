import '@std/dotenv/load';
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
