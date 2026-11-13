import authRoutes from "./routes/auth.js";
import notesRoutes from "./routes/notes.js";
import dashboardRoutes from "./routes/dashboard.js";
import aiRoutes from "./routes/ai.js";
import { prisma } from "./lib/prisma.js";
import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";

const app = express();
app.use(helmet());
app.use(cors({ origin: "http://localhost:3000" }));
app.use(express.json({ limit: "1mb" }));
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/notes", notesRoutes);
app.use("/api/v1/dashboard", dashboardRoutes);
app.use("/api/v1/ai", aiRoutes);

app.get("/api/v1/health", (_req, res) => {
  res.json({ status: "ok", app: "Nalar" });
});

app.get("/api/v1/health/db", async (_req, res) => {
  await prisma.$queryRaw`SELECT 1`;
  res.json({ status: "ok", database: "terhubung" });
});

const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`Backend jalan di http://localhost:${port}`);
});
