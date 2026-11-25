import authRoutes from "./routes/auth.js";
import notesRoutes from "./routes/notes.js";
import dashboardRoutes from "./routes/dashboard.js";
import aiRoutes from "./routes/ai.js";
import searchRoutes from "./routes/search.js";
import graphRoutes from "./routes/graph.js";
import assistantRoutes from "./routes/assistant.js";
import { prisma } from "./lib/prisma.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { batasUmum } from "./middleware/rateLimit.js";
import express from "express";
import cors from "cors";
import helmet from "helmet";

export const app = express();

app.disable("x-powered-by");
// Di belakang proxy hosting (Vercel/Render): percayai 1 lapis proxy agar IP asli pengguna terbaca
// (dipakai pembatas laju). Tanpa ini semua pengguna dianggap satu IP.
app.set("trust proxy", 1);
const helmetOptions =
  process.env.NODE_ENV === "production"
    ? {}
    : { strictTransportSecurity: false };
app.use(helmet(helmetOptions));

// Produksi hanya mengizinkan origin yang dikonfigurasi; development memakai localhost.
const allowedOrigin =
  process.env.FRONTEND_URL ||
  (process.env.NODE_ENV === "production" ? false : "http://localhost:3000");
app.use(
  cors({
    origin: (requestOrigin, callback) => {
      callback(
        null,
        typeof allowedOrigin === "string" && requestOrigin === allowedOrigin
      );
    },
    exposedHeaders: ["Retry-After", "RateLimit-Limit", "RateLimit-Remaining", "RateLimit-Reset"],
  })
);

app.use(express.json({ limit: "1mb" }));

// Terapkan batas laju umum untuk seluruh /api/v1 (300 req / 15 menit per IP)
app.use("/api/v1", batasUmum);

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/notes", notesRoutes);
app.use("/api/v1/dashboard", dashboardRoutes);
app.use("/api/v1/ai", assistantRoutes);
app.use("/api/v1/ai", aiRoutes);
app.use("/api/v1/search", searchRoutes);
app.use("/api/v1/graph", graphRoutes);

app.get("/api/v1/health", (_req, res) => {
  res.json({ status: "ok", app: "Nalar" });
});

app.get("/api/v1/health/db", async (_req, res) => {
  await prisma.$queryRaw`SELECT 1`;
  res.json({ status: "ok", database: "terhubung" });
});

app.use(notFoundHandler);
app.use(errorHandler);

// Default export dibutuhkan hosting serverless (Vercel). Export bernama `app` tetap dipakai tes.
export default app;
