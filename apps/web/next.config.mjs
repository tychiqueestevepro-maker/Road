import { existsSync } from "node:fs";
import path from "node:path";
import { config as loadDotenv } from "dotenv";

const rootEnv = path.resolve(process.cwd(), "../../.env.local");
if (existsSync(rootEnv)) {
  loadDotenv({ path: rootEnv, override: false });
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [
    "@road-reality/api",
    "@road-reality/config",
    "@road-reality/connectors",
    "@road-reality/database",
    "@road-reality/email",
    "@road-reality/road-engine",
    "@road-reality/shared",
    "@road-reality/vision",
    "@road-reality/worker"
  ],
  webpack(config) {
    config.resolve.extensionAlias = {
      ...(config.resolve.extensionAlias ?? {}),
      ".js": [".ts", ".tsx", ".js", ".jsx"],
      ".mjs": [".mts", ".mjs"]
    };
    return config;
  }
};

export default nextConfig;
