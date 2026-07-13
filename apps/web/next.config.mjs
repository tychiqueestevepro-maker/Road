import { existsSync } from "node:fs";
import path from "node:path";
import { config as loadDotenv } from "dotenv";

const rootEnv = path.resolve(process.cwd(), "../../.env.local");
if (existsSync(rootEnv)) {
  loadDotenv({ path: rootEnv, override: false });
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: []
};

export default nextConfig;
