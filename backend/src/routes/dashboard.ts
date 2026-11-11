import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// Semua route di file ini wajib login
router.use(requireAuth);

const recentNotesQuerySchema = z.object({
  limit: z.coerce
    .number()
    .int("Limit harus bilangan bulat")
    .min(1, "Limit minimal 1")
    .max(10, "Limit maksimal 10")
    .default(5),
});

// 1. GET /api/v1/dashboard/stats
router.get("/stats", async (req, res) => {
  const userId = req.userId!;
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  try {
    const [totalNotes, totalConcepts, totalRelationships, recentActivity] =
      await prisma.$transaction([
        prisma.note.count({ where: { userId } }),
        prisma.concept.count({ where: { userId } }),
        prisma.noteRelationship.count({
          where: { sourceNote: { userId } },
        }),
        prisma.note.count({
          where: {
            userId,
            updatedAt: { gte: sevenDaysAgo },
          },
        }),
      ]);

    res.json({
      success: true,
      message: "Statistik dashboard berhasil diambil",
      data: {
        totalNotes,
        totalConcepts,
        totalRelationships,
        recentActivity,
      },
    });
    return;
  } catch (err) {
    console.error("Error mengambil stats dashboard:", err);
    res.status(500).json({
      success: false,
      message: "Gagal mengambil statistik dashboard",
      errors: [],
    });
    return;
  }
});

// 2. GET /api/v1/dashboard/recent-notes
router.get("/recent-notes", async (req, res) => {
  const parsedQuery = recentNotesQuerySchema.safeParse(req.query);
  if (!parsedQuery.success) {
    res.status(422).json({
      success: false,
      message: "Parameter query tidak valid",
      errors: parsedQuery.error.issues.map((i) => ({
        field: i.path.join("."),
        message: i.message,
      })),
    });
    return;
  }

  const { limit } = parsedQuery.data;
  const userId = req.userId!;

  try {
    const notes = await prisma.note.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      take: limit,
      select: {
        id: true,
        title: true,
        content: true,
        summary: true,
        tags: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const items = notes.map((note) => ({
      id: note.id,
      title: note.title,
      summary: note.summary,
      tags: note.tags,
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
      contentPreview: note.content.slice(0, 200),
    }));

    res.json({
      success: true,
      message: "Catatan terbaru berhasil diambil",
      data: { items },
    });
    return;
  } catch (err) {
    console.error("Error mengambil catatan terbaru dashboard:", err);
    res.status(500).json({
      success: false,
      message: "Gagal mengambil catatan terbaru",
      errors: [],
    });
    return;
  }
});

export default router;
