import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// Semua route di file ini wajib login
router.use(requireAuth);

const uuidSchema = z.string().uuid();

const createNoteSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Judul minimal 1 karakter")
    .max(255, "Judul maksimal 255 karakter"),
  content: z
    .string()
    .trim()
    .min(1, "Isi catatan minimal 1 karakter"),
});

const updateNoteSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, "Judul minimal 1 karakter")
      .max(255, "Judul maksimal 255 karakter")
      .optional(),
    content: z
      .string()
      .trim()
      .min(1, "Isi catatan minimal 1 karakter")
      .optional(),
  })
  .refine(
    (data) => data.title !== undefined || data.content !== undefined,
    {
      message: "Minimal salah satu dari title atau content harus diisi",
    }
  );

// 1. GET /api/v1/notes (Daftar catatan milik user)
router.get("/", async (req, res) => {
  const userId = req.userId!;

  const notes = await prisma.note.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      content: true,
      summary: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  const items = notes.map((note) => ({
    id: note.id,
    title: note.title,
    summary: note.summary,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
    contentPreview: note.content.slice(0, 200),
  }));

  res.json({
    success: true,
    message: "Daftar catatan berhasil diambil",
    data: { items },
  });
  return;
});

// 2. GET /api/v1/notes/:id (Detail catatan)
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
      createdAt: true,
      updatedAt: true,
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

  res.json({
    success: true,
    message: "Catatan berhasil diambil",
    data: note,
  });
  return;
});

// 3. POST /api/v1/notes (Buat catatan baru)
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
  const { title, content } = parsed.data;

  const note = await prisma.note.create({
    data: {
      userId,
      title,
      content,
    },
    select: {
      id: true,
      title: true,
      content: true,
      summary: true,
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

// 4. PATCH /api/v1/notes/:id (Update catatan)
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

  // Siapkan data update tanpa properti undefined (karena exactOptionalPropertyTypes: true)
  const dataToUpdate: { title?: string; content?: string } = {};
  if (parsedBody.data.title !== undefined) {
    dataToUpdate.title = parsedBody.data.title;
  }
  if (parsedBody.data.content !== undefined) {
    dataToUpdate.content = parsedBody.data.content;
  }

  const updatedNote = await prisma.note.update({
    where: { id },
    data: dataToUpdate,
    select: {
      id: true,
      title: true,
      content: true,
      summary: true,
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

// 5. DELETE /api/v1/notes/:id (Hapus catatan)
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

  res.json({
    success: true,
    message: "Catatan berhasil dihapus",
  });
  return;
});

export default router;
