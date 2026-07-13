import { existsSync } from "node:fs";
import path from "node:path";
import { config } from "dotenv";

export function loadLocalEnv(startDir = process.cwd()) {
  const root = findWorkspaceRoot(startDir);
  const candidates = [
    path.join(startDir, ".env.local"),
    path.join(startDir, ".env"),
    root ? path.join(root, ".env.local") : undefined,
    root ? path.join(root, ".env") : undefined
  ].filter((candidate): candidate is string => Boolean(candidate));

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      config({ path: candidate, override: false });
    }
  }
}

function findWorkspaceRoot(startDir: string) {
  let current = path.resolve(startDir);
  while (true) {
    if (existsSync(path.join(current, "pnpm-workspace.yaml"))) return current;
    const parent = path.dirname(current);
    if (parent === current) return undefined;
    current = parent;
  }
}
