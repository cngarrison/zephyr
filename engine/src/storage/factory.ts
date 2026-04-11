import type { StorageAdapter } from "./adapter.ts";
import { config } from "../../config.ts";

export async function createStorageAdapter(): Promise<StorageAdapter> {
  const provider = config.storage.provider;
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
      throw new Error(`Unknown storage provider: "${provider}". Supported: sqlite, mysql`);
  }
}
