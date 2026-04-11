import { SqliteAdapter } from "./adapter.ts";
import { config } from "../../../../config.ts";

export function createAdapter(): SqliteAdapter {
  const path = config.storage.sqlite.path;
  return new SqliteAdapter(path);
}
