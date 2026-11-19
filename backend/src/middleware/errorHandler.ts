import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";
import { AiError, kirimErrorAi } from "../services/ai.service.js";

/**
 * 404 Handler untuk rute yang tidak ditemukan.
 */
export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({
    success: false,
    message: "Alamat tidak ditemukan.",
  });
}

/**
 * Global Error Handler (4 parameter Express).
 * Memetakan semua jenis error ke format seragam:
 * { success: false, message: string, errors?: Array<{ field?: string, message: string }> }
 */
export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  const isProduction = process.env.NODE_ENV === "production";
  const path = req.baseUrl ? `${req.baseUrl}${req.path}` : req.path;

  // 1. JSON parse error dari express.json / body-parser
  if (
    err?.type === "entity.parse.failed" ||
    (err instanceof SyntaxError && "status" in err && err.status === 400 && "body" in err)
  ) {
    res.status(400).json({
      success: false,
      message: "Format data yang dikirim tidak valid.",
    });
    return;
  }

  // 2. Body payload terlalu besar
  if (err?.type === "entity.too.large" || err?.status === 413) {
    res.status(413).json({
      success: false,
      message: "Data yang dikirim terlalu besar.",
    });
    return;
  }

  // 3. Zod validation error yang lolos
  if (err instanceof ZodError) {
    const formattedErrors = err.issues.map((issue) => ({
      field: issue.path.join(".") || undefined,
      message: issue.message,
    }));
    res.status(422).json({
      success: false,
      message: "Validasi data gagal.",
      errors: formattedErrors,
    });
    return;
  }

  // 4. AiError (gunakan helper kirimErrorAi yang sudah ada)
  if (err instanceof AiError) {
    kirimErrorAi(res, err);
    return;
  }

  // 5. JWT Error (JsonWebTokenError / TokenExpiredError)
  if (err?.name === "JsonWebTokenError" || err?.name === "TokenExpiredError") {
    res.status(401).json({
      success: false,
      message: "Sesi tidak valid. Silakan masuk lagi.",
    });
    return;
  }

  // 6. Prisma Error
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    // P2002: Unique constraint failed (duplikat)
    if (err.code === "P2002") {
      res.status(409).json({
        success: false,
        message: "Data sudah ada.",
      });
      return;
    }
    // P2025: Record to update/delete not found
    if (err.code === "P2025") {
      res.status(404).json({
        success: false,
        message: "Data tidak ditemukan.",
      });
      return;
    }
  }

  // Masalah koneksi database
  if (
    (err instanceof Prisma.PrismaClientKnownRequestError &&
      (err.code === "P1001" || err.code === "P1002")) ||
    err instanceof Prisma.PrismaClientInitializationError
  ) {
    console.error(`[${new Date().toISOString()}] ${req.method} ${path} 503 DB_CONN_ERR`);
    res.status(503).json({
      success: false,
      message: "Layanan sedang sibuk, coba lagi sebentar.",
    });
    return;
  }

  // 7. Error umum / tak terduga (500)
  const status = typeof err?.status === "number" && err.status >= 400 && err.status < 600 ? err.status : 500;
  
  if (status >= 500) {
    console.error(`[${new Date().toISOString()}] ${req.method} ${path} ${status} ${err?.name || "Error"}`);
  }

  const responseBody: { success: boolean; message: string; detail?: string } = {
    success: false,
    message: status === 500 ? "Terjadi kesalahan di server. Coba lagi nanti." : (err?.message || "Terjadi kesalahan."),
  };

  if (!isProduction && status === 500 && err?.message) {
    responseBody.detail = err.message;
  }

  res.status(status).json(responseBody);
}
