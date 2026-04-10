import { MysqlAdapter } from "./adapter.ts";

export function createAdapter(): MysqlAdapter {
  return new MysqlAdapter({
    host: Deno.env.get("MYSQL_HOST") ?? "localhost",
    port: parseInt(Deno.env.get("MYSQL_PORT") ?? "3306"),
    user: Deno.env.get("MYSQL_USER") ?? "",
    password: Deno.env.get("MYSQL_PASSWORD") ?? "",
    database: Deno.env.get("MYSQL_DATABASE") ?? "",
  });
}
