import "dotenv/config";
import { app } from "./app.js";
import { validateJwtSecretConfiguration } from "./lib/jwt.js";

validateJwtSecretConfiguration();

// Tangani uncaughtException dan unhandledRejection di tingkat proses
process.on("uncaughtException", (err) => {
  console.error(`[${new Date().toISOString()}] FATAL uncaughtException: ${err?.name || "Error"}`);
  process.exit(1);
});

process.on("unhandledRejection", (reason: any) => {
  const errorName = reason instanceof Error ? reason.name : "UnknownError";
  console.error(`[${new Date().toISOString()}] WARN unhandledRejection: ${errorName}`);
});

const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`Backend jalan di http://localhost:${port}`);
});
