import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// Semua route di file ini wajib login
router.use(requireAuth);

const uuidSchema = z.string().uuid("ID tidak valid");

// Aturan tag: array string, tiap tag trim & lowercase, 1-30 karakter, maks 10 tag, unik
const tagsSchema = z
  .array(
    z
      .string()
      .trim()
      .toLowerCase()
      .min(1, "Tag minimal 1 karakter")
      .max(30, "Tag maksimal 30 karakter")
  )
  .max(10, "Maksimal 10 tag")
  .transform((tags) => [...new Set(tags)]);

const createNoteSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Judul minimal 1 karakter dan tidak boleh hanya spasi")
    .max(255, "Judul maksimal 255 karakter"),
  content: z
    .string()
    .trim()
    .min(1, "Isi catatan minimal 1 karakter dan tidak boleh hanya spasi")
    .max(50000, "Isi catatan maksimal 50.000 karakter"),
  tags: tagsSchema.optional().default([]),
});

const updateNoteSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, "Judul minimal 1 karakter dan tidak boleh hanya spasi")
      .max(255, "Judul maksimal 255 karakter")
      .optional(),
    content: z
      .string()
      .trim()
      .min(1, "Isi catatan minimal 1 karakter dan tidak boleh hanya spasi")
      .max(50000, "Isi catatan maksimal 50.000 karakter")
      .optional(),
    tags: tagsSchema.optional(),
  })
  .refine(
    (data) =>
      data.title !== undefined ||
      data.content !== undefined ||
      data.tags !== undefined,
    {
      message: "Minimal salah satu field harus diisi untuk memperbarui catatan",
    }
  );

const getNotesQuerySchema = z.object({
  page: z.coerce
    .number()
    .int("Page harus bilangan bulat")
    .min(1, "Page minimal 1")
    .default(1),
  limit: z.coerce
    .number()
    .int("Limit harus bilangan bulat")
    .min(1, "Limit minimal 1")
    .max(50, "Limit maksimal 50")
    .default(10),
  search: z
    .string()
    .trim()
    .max(100, "Search maksimal 100 karakter")
    .optional(),
  tag: z
    .string()
    .trim()
    .toLowerCase()
    .optional(),
  sort: z
    .enum(["terbaru", "terlama", "judul"])
    .default("terbaru"),
});

// 1. GET /api/v1/notes/tags (WAJIB sebelum /:id)
router.get("/tags", async (req, res) => {
  const userId = req.userId!;

  try {
    const rows = await prisma.$queryRaw<{ tag: string; count: number }[]>`
      SELECT t AS tag, COUNT(*)::int AS count
      FROM notes, UNNEST(tags) AS t
      WHERE user_id = ${userId}::uuid
      GROUP BY t
      ORDER BY count DESC, t ASC`;

    res.json({
      success: true,
      message: "Daftar tag berhasil diambil",
      data: { tags: rows },
    });
    return;
  } catch (err) {
    console.error("Error mengambil tags:", err);
    res.status(500).json({
      success: false,
      message: "Gagal mengambil daftar tag",
      errors: [],
    });
    return;
  }
});

// 2. GET /api/v1/notes (Daftar catatan dengan pagination, filter, search, sort)
router.get("/", async (req, res) => {
  const parsedQuery = getNotesQuerySchema.safeParse(req.query);
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

  const { page, limit, search, tag, sort } = parsedQuery.data;
  const userId = req.userId!;

  // Penyusunan where clause
  const where: any = {
    userId,
  };

  if (search && search.length > 0) {
    where.OR = [
      { title: { contains: search, mode: "insensitive" } },
      { content: { contains: search, mode: "insensitive" } },
    ];
  }

  if (tag && tag.length > 0) {
    where.tags = { has: tag };
  }

  // Penyusunan order by
  let orderBy: any = { updatedAt: "desc" };
  if (sort === "terlama") {
    orderBy = { updatedAt: "asc" };
  } else if (sort === "judul") {
    orderBy = { title: "asc" };
  }

  const skip = (page - 1) * limit;

  try {
    const [total, notes] = await prisma.$transaction([
      prisma.note.count({ where }),
      prisma.note.findMany({
        where,
        orderBy,
        skip,
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
      }),
    ]);

    const totalPages = Math.ceil(total / limit);

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
      message: "Daftar catatan berhasil diambil",
      data: {
        items,
        pagination: {
          page,
          limit,
          total,
          totalPages,
        },
      },
    });
    return;
  } catch (err) {
    console.error("Error mengambil daftar catatan:", err);
    res.status(500).json({
      success: false,
      message: "Gagal mengambil daftar catatan",
      errors: [],
    });
    return;
  }
});

// 3. GET /api/v1/notes/:id (Detail catatan)
router.get("/:id", async (req, res) => {
  const { id } = req.params;
  const parsedId = uuidSchema.safeParse(id);
  if (!parsedId.success) {
    res.status(404).json({
      success: false,
      message: "Catatan tidak ditemukan",
      errors: [],
    });
    return;
  }

  const userId = req.userId!;
  const note = await prisma.note.findFirst({
    where: {
      id,
      userId,
    },
    select: {
      id: true,
      title: true,
      content: true,
      summary: true,
      tags: true,
      createdAt: true,
      updatedAt: true,
      noteConcepts: {
        select: {
          concept: {
            select: {
              id: true,
              name: true,
              description: true,
            },
          },
        },
        orderBy: {
          concept: {
            name: "asc",
          },
        },
      },
    },
  });

  if (!note) {
    res.status(404).json({
      success: false,
      message: "Catatan tidak ditemukan",
      errors: [],
    });
    return;
  }

  const { noteConcepts, ...restNote } = note;
  const concepts = noteConcepts.map((nc) => nc.concept);

  res.json({
    success: true,
    message: "Catatan berhasil diambil",
    data: {
      ...restNote,
      concepts,
    },
  });
  return;
});

// 4. POST /api/v1/notes (Buat catatan baru)
router.post("/", async (req, res) => {
  const parsed = createNoteSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({
      success: false,
      message: "Data tidak valid",
      errors: parsed.error.issues.map((i) => ({
        field: i.path.join("."),
        message: i.message,
      })),
    });
    return;
  }

  const userId = req.userId!;
  const { title, content, tags } = parsed.data;

  const note = await prisma.note.create({
    data: {
      userId,
      title,
      content,
      tags,
    },
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

  res.status(201).json({
    success: true,
    message: "Catatan berhasil dibuat",
    data: note,
  });
  return;
});

// 5. PATCH /api/v1/notes/:id (Update catatan)
router.patch("/:id", async (req, res) => {
  const { id } = req.params;
  const parsedId = uuidSchema.safeParse(id);
  if (!parsedId.success) {
    res.status(404).json({
      success: false,
      message: "Catatan tidak ditemukan",
      errors: [],
    });
    return;
  }

  const parsedBody = updateNoteSchema.safeParse(req.body);
  if (!parsedBody.success) {
    res.status(422).json({
      success: false,
      message: "Data tidak valid",
      errors: parsedBody.error.issues.map((i) => ({
        field: i.path.join("."),
        message: i.message,
      })),
    });
    return;
  }

  const userId = req.userId!;

  // Cek keberadaan dan kepemilikan catatan terlebih dahulu
  const existingNote = await prisma.note.findFirst({
    where: { id, userId },
  });

  if (!existingNote) {
    res.status(404).json({
      success: false,
      message: "Catatan tidak ditemukan",
      errors: [],
    });
    return;
  }

  // Siapkan data update tanpa properti undefined (exactOptionalPropertyTypes: true)
  const dataToUpdate: { title?: string; content?: string; tags?: string[]; summary?: string | null } = {};
  if (parsedBody.data.title !== undefined) {
    dataToUpdate.title = parsedBody.data.title;
  }
  if (parsedBody.data.content !== undefined) {
    dataToUpdate.content = parsedBody.data.content;
    // Task 3.6: Jika content berubah, reset summary menjadi null
    if (parsedBody.data.content !== existingNote.content) {
      dataToUpdate.summary = null;
    }
  }
  if (parsedBody.data.tags !== undefined) {
    dataToUpdate.tags = parsedBody.data.tags;
  }

  const updatedNote = await prisma.note.update({
    where: { id },
    data: dataToUpdate,
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

  res.json({
    success: true,
    message: "Catatan berhasil diperbarui",
    data: updatedNote,
  });
  return;
});

// 6. DELETE /api/v1/notes/:id (Hapus catatan)
router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  const parsedId = uuidSchema.safeParse(id);
  if (!parsedId.success) {
    res.status(404).json({
      success: false,
      message: "Catatan tidak ditemukan",
      errors: [],
    });
    return;
  }

  const userId = req.userId!;

  // Cek keberadaan dan kepemilikan catatan terlebih dahulu
  const existingNote = await prisma.note.findFirst({
    where: { id, userId },
  });

  if (!existingNote) {
    res.status(404).json({
      success: false,
      message: "Catatan tidak ditemukan",
      errors: [],
    });
    return;
  }

  await prisma.note.delete({
    where: { id },
  });

  // Task 3.7: Bersihkan konsep yatim milik pengguna setelah catatan terhapus
  await prisma.concept.deleteMany({
    where: {
      userId,
      noteConcepts: {
        none: {},
      },
    },
  });

  res.json({
    success: true,
    message: "Catatan berhasil dihapus",
  });
  return;
});

export default router;
