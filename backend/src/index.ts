import authRoutes from "./routes/auth.js";
import notesRoutes from "./routes/notes.js";
import dashboardRoutes from "./routes/dashboard.js";
import aiRoutes from "./routes/ai.js";
import searchRoutes from "./routes/search.js";
import graphRoutes from "./routes/graph.js";
import assistantRoutes from "./routes/assistant.js";
import { prisma } from "./lib/prisma.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";

// Tangani uncaughtException dan unhandledRejection di tingkat proses
process.on("uncaughtException", (err) => {
  console.error(`[${new Date().toISOString()}] FATAL uncaughtException: ${err?.name || "Error"} - ${err?.message || ""}`);
  process.exit(1);
});

process.on("unhandledRejection", (reason: any) => {
  console.error(`[${new Date().toISOString()}] WARN unhandledRejection: ${reason?.name || "Reason"} - ${reason?.message || reason}`);
});

const app = express();
app.use(helmet());

// CORS: izinkan origin frontend dari FRONTEND_URL atau bawaan http://localhost:3000
const allowedOrigin = process.env.FRONTEND_URL || "http://localhost:3000";
app.use(
  cors({
    origin: allowedOrigin,
    exposedHeaders: ["Retry-After", "RateLimit-Limit", "RateLimit-Remaining", "RateLimit-Reset"],
  })
);

app.use(express.json({ limit: "1mb" }));

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

// 404 handler untuk rute yang tidak dikenal
app.use(notFoundHandler);

// Global Error Handler diletakkan paling akhir
app.use(errorHandler);

const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`Backend jalan di http://localhost:${port}`);
});
