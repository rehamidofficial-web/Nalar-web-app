import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { loadTestEnvironment } from "./testEnvironment.js";

const envTest = loadTestEnvironment();
const backendDirectory = fileURLToPath(new URL("../", import.meta.url));
const prismaCli = fileURLToPath(
  new URL("../node_modules/prisma/build/index.js", import.meta.url)
);

const result = spawnSync(
  process.execPath,
  [prismaCli, "migrate", "deploy"],
  {
    cwd: backendDirectory,
    env: { ...process.env, ...envTest },
    stdio: "inherit",
  }
);

if (result.error) {
  throw new Error("Tidak dapat menjalankan migrasi Prisma untuk database tes.");
}

process.exitCode = result.status ?? 1;
