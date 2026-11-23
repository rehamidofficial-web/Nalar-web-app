import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { config, parse } from "dotenv";

export function loadTestEnvironment(): Record<string, string> {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Tes backend tidak boleh dijalankan saat NODE_ENV=production.");
  }

  const envTestPath = fileURLToPath(new URL("../.env.test", import.meta.url));
  const envMainPath = fileURLToPath(new URL("../.env", import.meta.url));

  if (!existsSync(envTestPath)) {
    throw new Error(
      "File backend/.env.test belum ada. Buat file ini dan isi DATABASE_URL dengan URL cabang database tes Neon."
    );
  }

  const envTest = parse(readFileSync(envTestPath));
  const envMain = existsSync(envMainPath)
    ? parse(readFileSync(envMainPath))
    : {};
  const databaseUrlTest = envTest.DATABASE_URL?.trim();
  const databaseUrlMain = envMain.DATABASE_URL?.trim();

  if (!databaseUrlTest) {
    throw new Error(
      "DATABASE_URL belum diisi di backend/.env.test. Tes dihentikan agar tidak memakai database yang salah."
    );
  }

  if (databaseUrlTest === databaseUrlMain) {
    throw new Error(
      "DATABASE_URL di backend/.env.test sama dengan .env utama. Gunakan cabang database tes yang berbeda."
    );
  }

  config({ path: envTestPath, override: true });

  if (process.env.NODE_ENV === "production") {
    throw new Error("Tes backend tidak boleh dijalankan saat NODE_ENV=production.");
  }

  return envTest;
}
