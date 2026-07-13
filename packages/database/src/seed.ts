import { loadLocalEnv } from "@road-reality/config";
import { createDb } from "./client.js";
import { seedDataSources } from "./repositories.js";

loadLocalEnv();
async function main() {
  const { db, sql } = createDb();
  await seedDataSources(db);
  await sql.end();
  console.log("seeded Verytis data sources");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
