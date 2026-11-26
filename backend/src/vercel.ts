// Pintu masuk untuk hosting serverless (Vercel). Tidak dipakai saat development lokal
// (lokal tetap memakai src/index.ts). Dirakit oleh esbuild saat build di Vercel.
import { app } from "./app.js";
import { validateJwtSecretConfiguration } from "./lib/jwt.js";

validateJwtSecretConfiguration();

export default app;
