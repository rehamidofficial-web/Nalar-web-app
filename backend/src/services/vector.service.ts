import { prisma } from "../lib/prisma.js";
import { keTeksVektor } from "../lib/vektor.js";

export const AMBANG_RELEVANSI = 0.55;
export const BATAS_MAKS = 50;
export const BATAS_BAWAAN = 10;

export interface HasilMirip {
  noteId: string;
  title: string;
  similarity: number;
}

interface RawHasilMirip {
  noteId: string;
  title: string;
  similarity: number | string;
}

function rapikanBatas(batas?: number): number {
  if (batas === undefined || batas === null || !Number.isFinite(batas)) {
    return BATAS_BAWAAN;
  }
  const bulat = Math.floor(batas);
  if (bulat < 1) return 1;
  if (bulat > BATAS_MAKS) return BATAS_MAKS;
  return bulat;
}

function rapikanAmbang(ambang?: number): number {
  if (ambang === undefined || ambang === null || !Number.isFinite(ambang)) {
    return AMBANG_RELEVANSI;
  }
  if (ambang < 0) return 0;
  if (ambang > 1) return 1;
  return ambang;
}

/**
 * Mencari catatan pengguna yang paling mirip secara makna dengan vektor embedding yang diberikan.
 * Selalu memfilter catatan berdasarkan userId milik pengguna.
 */
export async function cariCatatanMirip(params: {
  userId: string;
  embedding: number[];
  batas?: number;
  ambang?: number;
}): Promise<HasilMirip[]> {
  const { userId, embedding } = params;
  if (!userId || typeof userId !== "string") {
    throw new Error("userId harus berupa string UUID yang valid.");
  }

  const batas = rapikanBatas(params.batas);
  const ambang = rapikanAmbang(params.ambang);
  const vektor = keTeksVektor(embedding);

  const baris = await prisma.$queryRaw<RawHasilMirip[]>`
    SELECT n.id AS "noteId", n.title AS title,
           1 - (e.embedding <=> ${vektor}::vector) AS similarity
    FROM note_embeddings e
    JOIN notes n ON n.id = e.note_id
    WHERE n.user_id = ${userId}::uuid
    ORDER BY e.embedding <=> ${vektor}::vector
    LIMIT ${batas}`;

  return baris
    .map((item) => {
      const sim = Number(item.similarity);
      return {
        noteId: item.noteId,
        title: item.title,
        similarity: Number(sim.toFixed(4)),
      };
    })
    .filter((item) => item.similarity >= ambang);
}

/**
 * Mencari catatan pengguna lain yang mirip dengan sebuah catatan milik pengguna tersebut.
 * Tanpa perlu panggil AI lagi karena memanfaatkan embedding yang sudah ada di database.
 */
export async function cariCatatanMiripDenganCatatan(params: {
  userId: string;
  noteId: string;
  batas?: number;
  ambang?: number;
}): Promise<HasilMirip[]> {
  const { userId, noteId } = params;
  if (!userId || typeof userId !== "string") {
    throw new Error("userId harus berupa string UUID yang valid.");
  }
  if (!noteId || typeof noteId !== "string") {
    throw new Error("noteId harus berupa string UUID yang valid.");
  }

  const catatanAda = await prisma.note.findFirst({
    where: { id: noteId, userId },
    select: { id: true },
  });

  if (!catatanAda) {
    return [];
  }

  const batas = rapikanBatas(params.batas);
  const ambang = rapikanAmbang(params.ambang);

  const baris = await prisma.$queryRaw<RawHasilMirip[]>`
    SELECT n.id AS "noteId", n.title AS title,
           1 - (e.embedding <=> src.embedding) AS similarity
    FROM note_embeddings e
    JOIN notes n ON n.id = e.note_id
    CROSS JOIN (SELECT embedding FROM note_embeddings WHERE note_id = ${noteId}::uuid) src
    WHERE n.user_id = ${userId}::uuid AND n.id <> ${noteId}::uuid
    ORDER BY e.embedding <=> src.embedding
    LIMIT ${batas}`;

  return baris
    .map((item) => {
      const sim = Number(item.similarity);
      return {
        noteId: item.noteId,
        title: item.title,
        similarity: Number(sim.toFixed(4)),
      };
    })
    .filter((item) => item.similarity >= ambang);
}
