import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadLocalEnv } from "@road-reality/config";
import { createSqlClient } from "./client.js";

loadLocalEnv();
const dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.resolve(dirname, "../migrations");

async function main() {
  const sql = createSqlClient();
  await sql`create table if not exists drizzle_migrations (
    id serial primary key,
    name text not null unique,
    applied_at timestamptz not null default now()
  )`;

  const files = (await readdir(migrationsDir))
    .filter((file) => file.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const [existing] = await sql<{ id: number }[]>`
      select id from drizzle_migrations where name = ${file}
    `;
    if (existing) continue;

    const migration = await readFile(path.join(migrationsDir, file), "utf8");
    await sql.begin(async (tx) => {
      await tx.unsafe(migration);
      await tx`insert into drizzle_migrations (name) values (${file})`;
    });
    console.log(`applied migration ${file}`);
  }

  await sql.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
