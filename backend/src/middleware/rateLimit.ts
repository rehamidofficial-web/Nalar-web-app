import { rateLimit, ipKeyGenerator } from "express-rate-limit";
import type { Request, Response, NextFunction } from "express";

// Catatan arsitektur untuk Task 5.8:
// Pembatas laju ini menggunakan penyimpanan memori (MemoryStore) bawaan express-rate-limit.
// Hitungan akan reset saat server restart dan tidak dibagi antar-instans jika berjalan multi-instance (misal di balik load balancer).

/**
 * Format standar respon 429 ketika batas laju terlampaui.
 */
function buatHandlerBatas(pesanDefault: string, isHarian = false) {
  return (req: Request, res: Response, _next: NextFunction, options: any) => {
    const sisaDetik =
      Math.ceil(
        ((req as any).rateLimit?.resetTime?.getTime() - Date.now()) / 1000,
      ) || 60;

    const pesan = isHarian
      ? "Batas pemakaian AI hari ini sudah tercapai. Coba lagi besok."
      : `Terlalu banyak permintaan. Coba lagi sekitar ${sisaDetik} detik lagi.`;

    res.status(429).json({
      success: false,
      message: pesan,
    });
  };
}

/**
 * Pembatas umum untuk semua rute /api/v1 (per IP)
 * 300 permintaan per 15 menit
 */
export const batasUmum = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.RATE_LIMIT_UMUM_MAX) || 300,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  handler: buatHandlerBatas("Terlalu banyak permintaan."),
});

/**
 * Pembatas autentikasi (login & register) per IP
 * 10 percobaan per 15 menit
 * Skip request jika status sukses (khusus untuk login)
 */
export const batasAuth = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.RATE_LIMIT_AUTH_MAX) || 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: buatHandlerBatas("Terlalu banyak percobaan autentikasi."),
});

/**
 * Key generator berdasarkan userId dari JWT auth
 * Fallback ke ipKeyGenerator agar subnet IPv6 ditangani dengan aman
 */
function getUserIdKey(req: Request): string {
  if (req.userId) {
    return req.userId;
  }
  return req.ip ? ipKeyGenerator(req.ip) : "unknown";
}

/**
 * Pembatas panggilan AI per menit per user
 * Default: 8 panggilan per menit (bisa diatur lewat env RATE_LIMIT_AI_MENIT_MAX)
 */
export const batasAiPerMenit = rateLimit({
  windowMs: 60 * 1000,
  limit: Number(process.env.RATE_LIMIT_AI_MENIT_MAX) || 8,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  keyGenerator: getUserIdKey,
  handler: buatHandlerBatas("Terlalu banyak permintaan AI."),
});

/**
 * Pembatas panggilan AI khusus merge preview (lebih ketat)
 * Default: 4 panggilan per menit
 */
export const batasAiMergePerMenit = rateLimit({
  windowMs: 60 * 1000,
  limit: Number(process.env.RATE_LIMIT_AI_MERGE_MAX) || 4,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  keyGenerator: getUserIdKey,
  handler: buatHandlerBatas("Terlalu banyak permintaan penggabungan catatan."),
});

/**
 * Pembatas panggilan AI harian per user
 * Default: 60 panggilan per 24 jam (bisa diatur lewat env RATE_LIMIT_AI_HARIAN_MAX)
 * Rute pencarian bisa menandai req.lewatiBatasAiHarian = true bila jawabannya sudah ada di cache,
 * sehingga membuka ulang pencarian yang sama tidak menghabiskan jatah AI.
 */
export const batasAiHarian = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  limit: Number(process.env.RATE_LIMIT_AI_HARIAN_MAX) || 60,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  keyGenerator: getUserIdKey,
  // Permintaan yang pasti tidak memanggil AI (hasil cache) tidak memakai jatah harian.
  skip: (req) => req.lewatiBatasAiHarian === true,
  handler: buatHandlerBatas("Batas harian tercapai.", true),
});

/**
 * Pembatas pencarian semantik (search)
 * Mengizinkan hingga 20 per menit per user
 */
export const batasSearchPerMenit = rateLimit({
  windowMs: 60 * 1000,
  limit: Number(process.env.RATE_LIMIT_SEARCH_MENIT_MAX) || 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  keyGenerator: getUserIdKey,
  handler: buatHandlerBatas("Terlalu banyak pencarian."),
});
