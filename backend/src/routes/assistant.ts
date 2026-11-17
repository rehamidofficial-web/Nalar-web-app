import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { createEmbedding, generateText, kirimErrorAi, AiError } from "../services/ai.service.js";
import {
  ambilKonteks,
  susunPrompt,
  buatTeksPencarian,
  JAWABAN_TIDAK_ADA_KONTEKS,
  BATAS_PESAN_PER_PERCAKAPAN,
  JUMLAH_RIWAYAT,
  type KonteksCatatan,
} from "../services/assistant.service.js";

const router = Router();
router.use(requireAuth);

// ---------------------------------------------------------
// 1. In-Memory Cache Embedding Pertanyaan (TTL 10 menit)
// ---------------------------------------------------------
interface CacheEntry {
  embedding: number[];
  timestamp: number;
}

const CACHE_TTL_MS = 10 * 60 * 1000;
const MAX_CACHE_ENTRIES = 100;
const assistantEmbeddingCache = new Map<string, CacheEntry>();

function getCachedEmbedding(userId: string, text: string): number[] | null {
  const key = `${userId}:${text.toLowerCase().trim()}`;
  const entry = assistantEmbeddingCache.get(key);
  if (!entry) return null;

  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    assistantEmbeddingCache.delete(key);
    return null;
  }
  return entry.embedding;
}

function setCachedEmbedding(userId: string, text: string, embedding: number[]) {
  if (assistantEmbeddingCache.size >= MAX_CACHE_ENTRIES) {
    const firstKey = assistantEmbeddingCache.keys().next().value;
    if (firstKey) {
      assistantEmbeddingCache.delete(firstKey);
    }
  }
  const key = `${userId}:${text.toLowerCase().trim()}`;
  assistantEmbeddingCache.set(key, {
    embedding,
    timestamp: Date.now(),
  });
}

// ---------------------------------------------------------
// 2. Simple Rate Limiter (6 req/menit, 60 req/hari per user)
// ---------------------------------------------------------
interface RateLimitRecord {
  minuteWindowStart: number;
  minuteCount: number;
  dayWindowStart: number;
  dayCount: number;
}

const assistantRateLimitMap = new Map<string, RateLimitRecord>();

function checkAssistantRateLimit(userId: string): boolean {
  const now = Date.now();
  const ONE_MINUTE = 60 * 1000;
  const ONE_DAY = 24 * 60 * 60 * 1000;

  let record = assistantRateLimitMap.get(userId);
  if (!record) {
    record = {
      minuteWindowStart: now,
      minuteCount: 1,
      dayWindowStart: now,
      dayCount: 1,
    };
    assistantRateLimitMap.set(userId, record);
    return true;
  }

  // Cek jendela menit
  if (now - record.minuteWindowStart > ONE_MINUTE) {
    record.minuteWindowStart = now;
    record.minuteCount = 1;
  } else {
    record.minuteCount += 1;
  }

  // Cek jendela hari
  if (now - record.dayWindowStart > ONE_DAY) {
    record.dayWindowStart = now;
    record.dayCount = 1;
  } else {
    record.dayCount += 1;
  }

  if (record.minuteCount > 6 || record.dayCount > 60) {
    return false;
  }

  return true;
}

// Skema validasi UUID
const uuidSchema = z.string().uuid("ID percakapan harus berupa UUID yang valid");

// Skema validasi POST /ai/ask
const askBodySchema = z.object({
  conversationId: z
    .string()
    .uuid("ID percakapan harus berupa UUID yang valid")
    .nullable()
    .optional(),
  question: z
    .string()
    .trim()
    .min(2, "Pertanyaan minimal 2 karakter")
    .max(1000, "Pertanyaan maksimal 1000 karakter"),
});

/**
 * 1. POST /api/v1/ai/ask
 * Tanya jawab AI dengan catatan pribadi pengguna sebagai rujukan.
 */
router.post("/ask", async (req, res) => {
  const waktuMulai = Date.now();
  const userId = req.userId!;

  // 1. Rate limiter check (6/menit, 60/hari)
  if (!checkAssistantRateLimit(userId)) {
    res.status(429).json({
      success: false,
      message: "Terlalu banyak pertanyaan. Coba lagi sebentar lagi.",
      errors: [
        {
          field: "rateLimit",
          message: "Batas 6 pertanyaan per menit atau 60 per hari tercapai.",
        },
      ],
    });
    return;
  }

  // 2. Validasi body request
  const parseResult = askBodySchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(422).json({
      success: false,
      message: "Data pertanyaan tidak valid.",
      errors: parseResult.error.issues.map((i) => ({
        field: i.path.join(".") || "question",
        message: i.message,
      })),
    });
    return;
  }

  const { conversationId, question } = parseResult.data;

  try {
    // 3. Validasi percakapan jika ada conversationId
    let percakapanId = conversationId || null;
    let riwayatPesan: { role: string; content: string }[] = [];
    let pertanyaanSebelumnya: string | undefined = undefined;

    if (percakapanId) {
      const conv = await prisma.aiConversation.findFirst({
        where: { id: percakapanId, userId },
        include: {
          messages: {
            orderBy: { createdAt: "asc" },
            select: { role: true, content: true },
          },
        },
      });

      if (!conv) {
        res.status(404).json({
          success: false,
          message: "Percakapan tidak ditemukan.",
          errors: [],
        });
        return;
      }

      if (conv.messages.length >= BATAS_PESAN_PER_PERCAKAPAN) {
        res.status(422).json({
          success: false,
          message: "Batas pesan dalam percakapan ini sudah tercapai. Silakan mulai percakapan baru.",
          errors: [
            {
              field: "conversationId",
              message: "Percakapan melebihi batas maksimal 40 pesan.",
            },
          ],
        });
        return;
      }

      riwayatPesan = conv.messages;

      // Ambil pertanyaan user terakhir untuk pengayaan teks pencarian
      const pesanUserTerakhir = [...conv.messages]
        .reverse()
        .find((m) => m.role === "user");
      if (pesanUserTerakhir) {
        pertanyaanSebelumnya = pesanUserTerakhir.content;
      }
    }

    // 4. Buat embedding & ambil konteks
    const teksPencarian = buatTeksPencarian(question, pertanyaanSebelumnya);
    let konteks: KonteksCatatan[] = [];
    let mode: "makna" | "kata" = "makna";

    let embedding = getCachedEmbedding(userId, teksPencarian);
    if (!embedding) {
      try {
        const embRes = await createEmbedding(teksPencarian);
        embedding = embRes.embedding;
        setCachedEmbedding(userId, teksPencarian, embedding);
      } catch (err: any) {
        // Jika embedding gagal karena kuota atau layanan (429/502/503), cadangkan ke pencarian teks biasa
        const isQuotaOrService =
          (err instanceof AiError && (err.status === 429 || err.status === 502 || err.status === 503)) ||
          err?.status === 429 ||
          err?.status === 502 ||
          err?.status === 503;

        if (isQuotaOrService) {
          mode = "kata";
        } else {
          kirimErrorAi(res, err);
          return;
        }
      }
    }

    if (mode === "makna" && embedding) {
      konteks = await ambilKonteks({ userId, embedding });
    } else {
      // Cadangan pencarian kata biasa dari judul/isi catatan
      const kataKunci = question.slice(0, 50).trim();
      const catatanKata = await prisma.note.findMany({
        where: {
          userId,
          OR: [
            { title: { contains: kataKunci, mode: "insensitive" } },
            { content: { contains: kataKunci, mode: "insensitive" } },
          ],
        },
        take: 3,
        select: { id: true, title: true, content: true },
      });

      konteks = catatanKata.map((c) => ({
        noteId: c.id,
        title: c.title,
        content: c.content.slice(0, 1500),
        similarity: null,
      }));
    }

    // 5. Jika konteks kosong, JANGAN panggil AI untuk jawaban (hemat kuota & cegah halusinasi)
    let jawaban = "";
    const sources = konteks.map((k) => ({
      noteId: k.noteId,
      title: k.title,
      similarity: k.similarity,
    }));

    if (konteks.length === 0) {
      jawaban = JAWABAN_TIDAK_ADA_KONTEKS;
    } else {
      // Panggil AI untuk menghasilkan jawaban dari konteks
      const prompt = susunPrompt({
        konteks,
        riwayat: riwayatPesan.slice(-JUMLAH_RIWAYAT),
        pertanyaan: question,
      });

      try {
        const aiRes = await generateText({
          system: prompt.system,
          user: prompt.user,
          maxOutputTokens: 800,
        });
        jawaban = aiRes.text.trim();
      } catch (err) {
        kirimErrorAi(res, err);
        return;
      }
    }

    // 6. Simpan dalam satu transaksi (buat percakapan baru jika belum ada)
    const resultConv = await prisma.$transaction(async (tx) => {
      let finalConvId = percakapanId;
      if (!finalConvId) {
        // Judul percakapan: 60 karakter pertama pertanyaan
        const titleConv = question.slice(0, 60).trim();
        const createdConv = await tx.aiConversation.create({
          data: {
            userId,
            title: titleConv,
          },
        });
        finalConvId = createdConv.id;
      }

      // Buat pesan user terlebih dahulu
      await tx.aiMessage.create({
        data: {
          conversationId: finalConvId,
          role: "user",
          content: question,
        },
      });

      // Buat pesan assistant dengan timestamp berurutan
      const assistantData: {
        conversationId: string;
        role: string;
        content: string;
        sources?: any;
      } = {
        conversationId: finalConvId,
        role: "assistant",
        content: jawaban,
      };

      if (sources.length > 0) {
        assistantData.sources = sources;
      }

      await tx.aiMessage.create({
        data: assistantData,
      });

      return finalConvId;
    });

    const durasi = Date.now() - waktuMulai;
    console.log(`[Asisten] konteks=${konteks.length} mode=${mode} durasi=${durasi}ms`);

    res.status(200).json({
      success: true,
      message: "Jawaban siap.",
      data: {
        conversationId: resultConv,
        answer: jawaban,
        sources: konteks.length > 0 ? sources : [],
        mode,
      },
    });
  } catch (error) {
    console.error("[Asisten Error]", error);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan internal saat memproses pertanyaan.",
      errors: [],
    });
  }
});

/**
 * 2. GET /api/v1/ai/conversations
 * Mengambil daftar percakapan milik pengguna (paling baru dulu)
 */
router.get("/conversations", async (req, res) => {
  const userId = req.userId!;

  const limitParam = parseInt(req.query.limit as string, 10);
  const pageParam = parseInt(req.query.page as string, 10);

  const limit = Number.isFinite(limitParam) && limitParam >= 1 && limitParam <= 50 ? limitParam : 20;
  const page = Number.isFinite(pageParam) && pageParam >= 1 ? pageParam : 1;
  const skip = (page - 1) * limit;

  try {
    const [conversations, total] = await Promise.all([
      prisma.aiConversation.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip,
        select: {
          id: true,
          title: true,
          createdAt: true,
          _count: {
            select: { messages: true },
          },
        },
      }),
      prisma.aiConversation.count({
        where: { userId },
      }),
    ]);

    const data = conversations.map((c) => ({
      id: c.id,
      title: c.title,
      createdAt: c.createdAt,
      jumlahPesan: c._count.messages,
    }));

    res.status(200).json({
      success: true,
      message: "Daftar percakapan berhasil diambil.",
      data,
      meta: {
        page,
        limit,
        total,
      },
    });
  } catch (error) {
    console.error("[Get Conversations Error]", error);
    res.status(500).json({
      success: false,
      message: "Gagal mengambil daftar percakapan.",
      errors: [],
    });
  }
});

/**
 * 3. GET /api/v1/ai/conversations/:id
 * Mengambil seluruh pesan dalam satu percakapan berurutan waktu.
 */
router.get("/conversations/:id", async (req, res) => {
  const userId = req.userId!;
  const { id } = req.params;

  const parseId = uuidSchema.safeParse(id);
  if (!parseId.success) {
    res.status(422).json({
      success: false,
      message: "ID percakapan tidak valid.",
      errors: [
        {
          field: "id",
          message: parseId.error.issues[0]?.message || "ID percakapan tidak valid.",
        },
      ],
    });
    return;
  }

  try {
    const conv = await prisma.aiConversation.findFirst({
      where: { id, userId },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            role: true,
            content: true,
            sources: true,
            createdAt: true,
          },
        },
      },
    });

    if (!conv) {
      res.status(404).json({
        success: false,
        message: "Percakapan tidak ditemukan.",
        errors: [],
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Percakapan berhasil diambil.",
      data: {
        id: conv.id,
        title: conv.title,
        createdAt: conv.createdAt,
        messages: conv.messages,
      },
    });
  } catch (error) {
    console.error("[Get Single Conversation Error]", error);
    res.status(500).json({
      success: false,
      message: "Gagal mengambil percakapan.",
      errors: [],
    });
  }
});

/**
 * 4. DELETE /api/v1/ai/conversations/:id
 * Menghapus percakapan (pesan ikut terhapus otomatis via cascade).
 */
router.delete("/conversations/:id", async (req, res) => {
  const userId = req.userId!;
  const { id } = req.params;

  const parseId = uuidSchema.safeParse(id);
  if (!parseId.success) {
    res.status(422).json({
      success: false,
      message: "ID percakapan tidak valid.",
      errors: [
        {
          field: "id",
          message: parseId.error.issues[0]?.message || "ID percakapan tidak valid.",
        },
      ],
    });
    return;
  }

  try {
    const conv = await prisma.aiConversation.findFirst({
      where: { id, userId },
    });

    if (!conv) {
      res.status(404).json({
        success: false,
        message: "Percakapan tidak ditemukan.",
        errors: [],
      });
      return;
    }

    await prisma.aiConversation.delete({
      where: { id },
    });

    res.status(200).json({
      success: true,
      message: "Percakapan dihapus.",
      data: null,
    });
  } catch (error) {
    console.error("[Delete Conversation Error]", error);
    res.status(500).json({
      success: false,
      message: "Gagal menghapus percakapan.",
      errors: [],
    });
  }
});

export default router;
