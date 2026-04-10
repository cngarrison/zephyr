import type { StorageAdapter } from "./adapter.ts";

export async function createStorageAdapter(): Promise<StorageAdapter> {
  const provider = Deno.env.get("DB_PROVIDER") ?? "sqlite";
  switch (provider) {
    case "sqlite": {
      const { createAdapter } = await import("./providers/sqlite/index.ts");
      return createAdapter();
    }
    case "mysql": {
      const { createAdapter } = await import("./providers/mysql/index.ts");
      return createAdapter();
    }
    default:
      throw new Error(`Unknown DB_PROVIDER: "${provider}". Supported: sqlite, mysql`);
  }
}
