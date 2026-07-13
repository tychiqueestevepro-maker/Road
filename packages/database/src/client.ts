import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

export function createSqlClient(databaseUrl = process.env.DATABASE_URL) {
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }

  return postgres(databaseUrl, {
    max: Number.parseInt(process.env.DATABASE_POOL_MAX ?? "10", 10),
    idle_timeout: 20,
    connect_timeout: 10
  });
}

export function createDb(databaseUrl = process.env.DATABASE_URL) {
  const sql = createSqlClient(databaseUrl);
  return {
    sql,
    db: drizzle(sql, { schema })
  };
}

export type RoadRealityDb = ReturnType<typeof createDb>["db"];

