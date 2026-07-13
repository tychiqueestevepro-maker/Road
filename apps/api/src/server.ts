import { loadConfig } from "@road-reality/config";
import { buildApiApp } from "./app.js";

const config = loadConfig();
const { app, sql } = await buildApiApp();

const close = async () => {
  await app.close();
  await sql.end();
};

process.on("SIGINT", close);
process.on("SIGTERM", close);

await app.listen({
  port: config.API_PORT,
  host: "0.0.0.0"
});
