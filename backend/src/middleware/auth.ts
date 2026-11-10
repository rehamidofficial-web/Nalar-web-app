import type { Request, Response, NextFunction } from "express";
import { verifyToken } from "../lib/jwt.js";

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    res
      .status(401)
      .json({
        success: false,
        message: "Silakan login terlebih dahulu",
        errors: [],
      });
    return;
  }
  try {
    const token = header.slice(7).trim();
    const payload = verifyToken(token);
    req.userId = payload.userId;
    next();
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Token error";
    res
      .status(401)
      .json({
        success: false,
        message: "Token tidak valid atau sudah kedaluwarsa",
        errors: [{ message: errorMsg }],
      });
  }
}
