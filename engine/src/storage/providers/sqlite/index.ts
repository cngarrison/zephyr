import { SqliteAdapter } from "./adapter.ts";

export function createAdapter(): SqliteAdapter {
  const path = Deno.env.get("SQLITE_PATH") ?? "./data/zephyr.db";
  return new SqliteAdapter(path);
}
