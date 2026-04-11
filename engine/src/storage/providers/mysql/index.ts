import { MysqlAdapter } from "./adapter.ts";
import { config } from "../../../../config.ts";

export function createAdapter(): MysqlAdapter {
  const mysql = config.storage.mysql;
  if (!mysql) {
    throw new Error(
      "MySQL storage provider selected but [storage.mysql] is not configured in zephyr.toml",
    );
  }
  return new MysqlAdapter({
    host: mysql.host,
    port: mysql.port,
    user: mysql.user,
    password: mysql.password,
    database: mysql.database,
  });
}
