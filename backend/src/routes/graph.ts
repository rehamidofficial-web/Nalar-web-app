import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

const uuidSchema = z.string().uuid("ID catatan harus berupa UUID yang valid.");

// Validasi query parameter untuk GET /api/v1/graph
const graphQuerySchema = z.object({
  batas: z.coerce
    .number()
    .int("Batas harus bilangan bulat.")
    .min(1, "Batas minimal 1.")
    .max(300, "Batas maksimal 300.")
    .default(200),
  tipe: z
    .enum(["semua", "similar", "concept"])
    .default("semua"),
  skorMin: z.coerce
    .number()
    .min(0, "skorMin minimal 0.")
    .max(1, "skorMin maksimal 1.")
    .default(0),
  tag: z.string().trim().optional(),
});

// Validasi query parameter untuk GET /api/v1/graph/:noteId
const singleGraphQuerySchema = z.object({
  tipe: z
    .enum(["semua", "similar", "concept"])
    .default("semua"),
  skorMin: z.coerce
    .number()
    .min(0, "skorMin minimal 0.")
    .max(1, "skorMin maksimal 1.")
    .default(0),
});

/**
 * 1. GET /api/v1/graph
 * Mengambil seluruh node catatan dan edge relasi milik pengguna yang sedang login.
 */
router.get("/", async (req, res) => {
  const waktuMulai = Date.now();
  const userId = req.userId!;

  const parseResult = graphQuerySchema.safeParse(req.query);
  if (!parseResult.success) {
    res.status(422).json({
      success: false,
      message: "Parameter query graph tidak valid.",
      errors: parseResult.error.issues.map((i) => ({
        field: i.path.join(".") || "query",
        message: i.message,
      })),
    });
    return;
  }

  const { batas, tipe, skorMin, tag } = parseResult.data;

  try {
    // 1. Kondisi filter catatan milik user
    const whereNote: any = { userId };
    if (tag && tag.length > 0) {
      whereNote.tags = { has: tag };
    }

    const [notes, totalCatatan] = await Promise.all([
      prisma.note.findMany({
        where: whereNote,
        select: {
          id: true,
          title: true,
          tags: true,
          updatedAt: true,
        },
        orderBy: { updatedAt: "desc" },
        take: batas,
      }),
      prisma.note.count({ where: whereNote }),
    ]);

    if (notes.length === 0) {
      const durasi = Date.now() - waktuMulai;
      console.log(`[Graph] node=0 edge=0 durasi=${durasi}ms`);
      res.status(200).json({
        success: true,
        message: "Graph berhasil dimuat.",
        data: {
          nodes: [],
          edges: [],
          meta: {
            totalCatatan: 0,
            jumlahNode: 0,
            jumlahEdge: 0,
            terpotong: false,
          },
        },
      });
      return;
    }

    const nodeIds = notes.map((n) => n.id);

    // 2. Filter relasi antar node yang terpilih
    const whereRelationship: any = {
      sourceNoteId: { in: nodeIds },
      targetNoteId: { in: nodeIds },
      sourceNote: { userId },
      targetNote: { userId },
    };

    if (tipe !== "semua") {
      whereRelationship.relationshipType = tipe;
    }

    const rawEdges = await prisma.noteRelationship.findMany({
      where: whereRelationship,
      select: {
        sourceNoteId: true,
        targetNoteId: true,
        relationshipType: true,
        similarityScore: true,
      },
    });

    // 3. Filter skorMin untuk tipe similar (tipe concept tidak terpengaruh skorMin)
    const filteredEdges = rawEdges.filter((edge) => {
      if (edge.relationshipType === "similar") {
        const score = edge.similarityScore ?? 0;
        return score >= skorMin;
      }
      return true;
    });

    // 4. Hitung jumlahHubungan untuk tiap node
    const connectionCounts = new Map<string, number>();
    for (const edge of filteredEdges) {
      connectionCounts.set(
        edge.sourceNoteId,
        (connectionCounts.get(edge.sourceNoteId) ?? 0) + 1
      );
      connectionCounts.set(
        edge.targetNoteId,
        (connectionCounts.get(edge.targetNoteId) ?? 0) + 1
      );
    }

    const nodes = notes.map((n) => ({
      id: n.id,
      label: n.title,
      type: "note",
      tags: n.tags,
      jumlahHubungan: connectionCounts.get(n.id) ?? 0,
      updatedAt: n.updatedAt,
    }));

    const edges = filteredEdges.map((e) => ({
      source: e.sourceNoteId,
      target: e.targetNoteId,
      type: e.relationshipType,
      similarity: e.relationshipType === "similar" ? e.similarityScore : null,
    }));

    const terpotong = totalCatatan > nodes.length;
    const durasi = Date.now() - waktuMulai;
    console.log(`[Graph] node=${nodes.length} edge=${edges.length} durasi=${durasi}ms`);

    res.status(200).json({
      success: true,
      message: "Graph berhasil dimuat.",
      data: {
        nodes,
        edges,
        meta: {
          totalCatatan,
          jumlahNode: nodes.length,
          jumlahEdge: edges.length,
          terpotong,
        },
      },
    });
    return;
  } catch (error) {
    console.error("[Graph Error]", error);
    res.status(500).json({
      success: false,
      message: "Gagal memuat graph catatan.",
      errors: [],
    });
    return;
  }
});

/**
 * 2. GET /api/v1/graph/:noteId
 * Mengambil sub-grafik lingkungan satu catatan (catatan pusat beserta tetangga-tetangganya).
 */
router.get("/:noteId", async (req, res) => {
  const waktuMulai = Date.now();
  const userId = req.userId!;
  const { noteId } = req.params;

  // 1. Validasi noteId sebagai UUID
  const parseIdResult = uuidSchema.safeParse(noteId);
  if (!parseIdResult.success) {
    res.status(422).json({
      success: false,
      message: "ID catatan tidak valid.",
      errors: [
        {
          field: "noteId",
          message: parseIdResult.error.issues[0]?.message || "ID catatan tidak valid.",
        },
      ],
    });
    return;
  }

  // 2. Validasi query params (tipe, skorMin)
  const parseQueryResult = singleGraphQuerySchema.safeParse(req.query);
  if (!parseQueryResult.success) {
    res.status(422).json({
      success: false,
      message: "Parameter query graph tidak valid.",
      errors: parseQueryResult.error.issues.map((i) => ({
        field: i.path.join(".") || "query",
        message: i.message,
      })),
    });
    return;
  }

  const { tipe, skorMin } = parseQueryResult.data;

  try {
    // 3. Pastikan catatan pusat milik userId
    const centerNote = await prisma.note.findFirst({
      where: { id: noteId, userId },
      select: {
        id: true,
        title: true,
        tags: true,
        updatedAt: true,
      },
    });

    if (!centerNote) {
      res.status(404).json({
        success: false,
        message: "Catatan tidak ditemukan.",
        errors: [],
      });
      return;
    }

    // 4. Ambil semua relasi langsung yang melibatkan catatan pusat
    const centerRelationWhere: any = {
      OR: [{ sourceNoteId: noteId }, { targetNoteId: noteId }],
      sourceNote: { userId },
      targetNote: { userId },
    };

    if (tipe !== "semua") {
      centerRelationWhere.relationshipType = tipe;
    }

    const directRawEdges = await prisma.noteRelationship.findMany({
      where: centerRelationWhere,
      select: {
        sourceNoteId: true,
        targetNoteId: true,
        relationshipType: true,
        similarityScore: true,
      },
    });

    const directEdges = directRawEdges.filter((edge) => {
      if (edge.relationshipType === "similar") {
        const score = edge.similarityScore ?? 0;
        return score >= skorMin;
      }
      return true;
    });

    // Kumpulkan id semua tetangga langsung
    const neighborIds = new Set<string>();
    for (const edge of directEdges) {
      if (edge.sourceNoteId !== noteId) neighborIds.add(edge.sourceNoteId);
      if (edge.targetNoteId !== noteId) neighborIds.add(edge.targetNoteId);
    }

    const allClusterIds = [noteId, ...Array.from(neighborIds)];

    // 5. Ambil data catatan untuk semua tetangga
    const neighborNotes = await prisma.note.findMany({
      where: {
        id: { in: Array.from(neighborIds) },
        userId,
      },
      select: {
        id: true,
        title: true,
        tags: true,
        updatedAt: true,
      },
    });

    // 6. Ambil semua relasi di dalam klaster (termasuk relasi antar tetangga agar klaster terlihat)
    const clusterRelationWhere: any = {
      sourceNoteId: { in: allClusterIds },
      targetNoteId: { in: allClusterIds },
      sourceNote: { userId },
      targetNote: { userId },
    };

    if (tipe !== "semua") {
      clusterRelationWhere.relationshipType = tipe;
    }

    const clusterRawEdges = await prisma.noteRelationship.findMany({
      where: clusterRelationWhere,
      select: {
        sourceNoteId: true,
        targetNoteId: true,
        relationshipType: true,
        similarityScore: true,
      },
    });

    const clusterEdges = clusterRawEdges.filter((edge) => {
      if (edge.relationshipType === "similar") {
        const score = edge.similarityScore ?? 0;
        return score >= skorMin;
      }
      return true;
    });

    // 7. Hitung jumlahHubungan di dalam sub-grafik
    const connectionCounts = new Map<string, number>();
    for (const edge of clusterEdges) {
      connectionCounts.set(
        edge.sourceNoteId,
        (connectionCounts.get(edge.sourceNoteId) ?? 0) + 1
      );
      connectionCounts.set(
        edge.targetNoteId,
        (connectionCounts.get(edge.targetNoteId) ?? 0) + 1
      );
    }

    const allNotesInCluster = [centerNote, ...neighborNotes];
    const nodes = allNotesInCluster.map((n) => ({
      id: n.id,
      label: n.title,
      type: "note",
      tags: n.tags,
      jumlahHubungan: connectionCounts.get(n.id) ?? 0,
      updatedAt: n.updatedAt,
      pusat: n.id === noteId ? true : false,
    }));

    const edges = clusterEdges.map((e) => ({
      source: e.sourceNoteId,
      target: e.targetNoteId,
      type: e.relationshipType,
      similarity: e.relationshipType === "similar" ? e.similarityScore : null,
    }));

    const durasi = Date.now() - waktuMulai;
    console.log(`[Graph] noteId=${noteId} node=${nodes.length} edge=${edges.length} durasi=${durasi}ms`);

    res.status(200).json({
      success: true,
      message: "Graph catatan berhasil dimuat.",
      data: {
        pusat: noteId,
        nodes,
        edges,
        meta: {
          jumlahNode: nodes.length,
          jumlahEdge: edges.length,
        },
      },
    });
    return;
  } catch (error) {
    console.error("[Graph Single Note Error]", error);
    res.status(500).json({
      success: false,
      message: "Gagal memuat graph catatan.",
      errors: [],
    });
    return;
  }
});

export default router;
