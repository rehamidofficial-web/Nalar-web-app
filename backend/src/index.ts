import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";

const app = express();
app.use(helmet());
app.use(cors({ origin: "http://localhost:3000" }));
app.use(express.json());

app.get("/api/v1/health", (_req, res) => {
  res.json({ status: "ok", app: "Nalar" });
});

const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`Backend jalan di http://localhost:${port}`);
});
