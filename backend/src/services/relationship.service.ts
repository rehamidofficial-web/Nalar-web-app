import { prisma } from "../lib/prisma.js";
import { cariCatatanMiripDenganCatatan } from "./vector.service.js";

// Batasan relasi per catatan
export const RELASI_MAKS_PER_CATATAN = 5;

// Ambang kemiripan vektor untuk membentuk relasi tipe 'similar'
// Sedikit di atas AMBANG_RELEVANSI (0.55) agar grafik tidak kusut/terlalu padat
export const RELASI_AMBANG = 0.58;

/**
 * Mengurutkan pasangan noteId secara kanonik (a < b berdasarkan urutan leksikografis UUID huruf kecil).
 * Memastikan pasangan A-B dan B-A disimpan secara seragam di tabel note_relationships
 * (source = ID lebih kecil, target = ID lebih besar).
 */
export function urutkanPasangan(a: string, b: string): { source: string; target: string } {
  const normA = a.toLowerCase();
  const normB = b.toLowerCase();
  if (normA < normB) {
    return { source: normA, target: normB };
  }
  return { source: normB, target: normA };
}

/**
 * Menghitung dan menyimpan relasi berdasarkan kemiripan embedding vektor.
 * Mengembalikan jumlah relasi baru yang dibuat.
 */
export async function hitungRelasiSimilar(
  userId: string,
  noteId: string,
  ambang = RELASI_AMBANG
): Promise<number> {
  // 1. Pastikan catatan milik userId
  const note = await prisma.note.findFirst({
    where: { id: noteId, userId },
    select: { id: true },
  });

  if (!note) {
    return 0;
  }

  // 2. Cari catatan mirip via vector service
  const tetangga = await cariCatatanMiripDenganCatatan({
    userId,
    noteId,
    batas: RELASI_MAKS_PER_CATATAN,
    ambang,
  });

  if (tetangga.length === 0) {
    // Tetap bersihkan relasi similar lama milik catatan ini bila sekarang tidak ada tetangga di atas ambang
    await prisma.noteRelationship.deleteMany({
      where: {
        relationshipType: "similar",
        OR: [{ sourceNoteId: noteId }, { targetNoteId: noteId }],
      },
    });
    return 0;
  }

  // Siapkan data relasi dengan urutan kanonik (source < target)
  const relasiDataMap = new Map<string, { source: string; target: string; similarity: number }>();

  for (const t of tetangga) {
    const { source, target } = urutkanPasangan(noteId, t.noteId);
    const key = `${source}:${target}`;
    if (!relasiDataMap.has(key)) {
      relasiDataMap.set(key, { source, target, similarity: t.similarity });
    }
  }

  const relasiList = Array.from(relasiDataMap.values());

  // 3. Transaksi: Hapus relasi 'similar' lama yang melibatkan catatan ini, lalu buat yang baru
  const result = await prisma.$transaction(async (tx) => {
    await tx.noteRelationship.deleteMany({
      where: {
        relationshipType: "similar",
        OR: [{ sourceNoteId: noteId }, { targetNoteId: noteId }],
      },
    });

    const created = await tx.noteRelationship.createMany({
      data: relasiList.map((r) => ({
        sourceNoteId: r.source,
        targetNoteId: r.target,
        relationshipType: "similar",
        similarityScore: r.similarity,
      })),
      skipDuplicates: true,
    });

    return created.count;
  });

  return result;
}

/**
 * Menghitung dan menyimpan relasi berdasarkan konsep bersama (note_concepts).
 * Catatan yang sudah memiliki relasi 'similar' tidak akan dibuatkan relasi 'concept' (similar menang).
 */
export async function hitungRelasiKonsep(
  userId: string,
  noteId: string
): Promise<number> {
  // 1. Pastikan catatan milik userId
  const note = await prisma.note.findFirst({
    where: { id: noteId, userId },
    select: { id: true },
  });

  if (!note) {
    return 0;
  }

  // 2. Ambil catatan lain milik user yang berbagi konsep dengan catatan ini
  // Filter kepemilikan userId di kedua sisi: catatan target dan konsep milik user
  const kandidat = await prisma.$queryRaw<{ noteId: string; jumlahKonsep: bigint | number }[]>`
    SELECT other_nc.note_id AS "noteId", COUNT(other_nc.concept_id) AS "jumlahKonsep"
    FROM note_concepts my_nc
    JOIN concepts c ON c.id = my_nc.concept_id AND c.user_id = ${userId}::uuid
    JOIN note_concepts other_nc ON other_nc.concept_id = c.id
    JOIN notes other_n ON other_n.id = other_nc.note_id AND other_n.user_id = ${userId}::uuid
    WHERE my_nc.note_id = ${noteId}::uuid
      AND other_nc.note_id <> ${noteId}::uuid
    GROUP BY other_nc.note_id
    ORDER BY COUNT(other_nc.concept_id) DESC
    LIMIT ${RELASI_MAKS_PER_CATATAN}
  `;

  if (kandidat.length === 0) {
    // Bersihkan relasi concept lama bila sudah tidak ada konsep bersama
    await prisma.noteRelationship.deleteMany({
      where: {
        relationshipType: "concept",
        OR: [{ sourceNoteId: noteId }, { targetNoteId: noteId }],
      },
    });
    return 0;
  }

  // 3. Susun pasangan kanonik dan buang pasangan yang sudah memiliki relasi 'similar'
  const pasanganKandidat = kandidat.map((k) => urutkanPasangan(noteId, k.noteId));

  // Cek relasi similar yang sudah ada di database untuk pasangan-pasangan ini
  const existingSimilar = await prisma.noteRelationship.findMany({
    where: {
      relationshipType: "similar",
      OR: pasanganKandidat.map((p) => ({
        sourceNoteId: p.source,
        targetNoteId: p.target,
      })),
    },
    select: { sourceNoteId: true, targetNoteId: true },
  });

  const similarSet = new Set(
    existingSimilar.map((s) => `${s.sourceNoteId}:${s.targetNoteId}`)
  );

  // Buang yang sudah ada di similar
  const relasiConceptList = pasanganKandidat.filter(
    (p) => !similarSet.has(`${p.source}:${p.target}`)
  );

  // 4. Transaksi: Hapus relasi 'concept' lama catatan ini, buat yang baru
  const result = await prisma.$transaction(async (tx) => {
    await tx.noteRelationship.deleteMany({
      where: {
        relationshipType: "concept",
        OR: [{ sourceNoteId: noteId }, { targetNoteId: noteId }],
      },
    });

    if (relasiConceptList.length === 0) {
      return 0;
    }

    const created = await tx.noteRelationship.createMany({
      data: relasiConceptList.map((r) => ({
        sourceNoteId: r.source,
        targetNoteId: r.target,
        relationshipType: "concept",
        similarityScore: null,
      })),
      skipDuplicates: true,
    });

    return created.count;
  });

  return result;
}

/**
 * Menghitung semua jenis relasi untuk catatan ini (similar terlebih dahulu, kemudian concept).
 */
export async function hitungSemuaRelasiCatatan(
  userId: string,
  noteId: string,
  ambang = RELASI_AMBANG
): Promise<{ similar: number; concept: number }> {
  const similar = await hitungRelasiSimilar(userId, noteId, ambang);
  const concept = await hitungRelasiKonsep(userId, noteId);
  return { similar, concept };
}

/**
 * Menghapus semua relasi yang melibatkan catatan (baik sebagai source maupun target).
 * Dipakai saat isi catatan berubah atau embedding dihapus.
 */
export async function hapusRelasiCatatan(noteId: string): Promise<void> {
  await prisma.noteRelationship.deleteMany({
    where: {
      OR: [{ sourceNoteId: noteId }, { targetNoteId: noteId }],
    },
  });
}

/**
 * Menjalankan perhitungan semua relasi di latar belakang tanpa melempar error.
 */
export async function jalankanRelasiDiLatarBelakang(
  userId: string,
  noteId: string,
  ambang = RELASI_AMBANG
): Promise<void> {
  try {
    const { similar, concept } = await hitungSemuaRelasiCatatan(userId, noteId, ambang);
    console.log(`[Relasi] catatan=${noteId}, similar=${similar}, concept=${concept}`);
  } catch (error: any) {
    console.error(`[Relasi] Gagal menghitung relasi catatan ${noteId}:`, error instanceof Error ? error.name : "UnknownError");
  }
}

/**
 * Menjalankan perhitungan relasi konsep di latar belakang setelah ekstraksi konsep berhasil.
 */
export async function jalankanRelasiKonsepDiLatarBelakang(
  userId: string,
  noteId: string
): Promise<void> {
  try {
    const concept = await hitungRelasiKonsep(userId, noteId);
    console.log(`[Relasi Konsep] catatan=${noteId}, concept=${concept}`);
  } catch (error: any) {
    console.error(`[Relasi Konsep] Gagal menghitung relasi konsep catatan ${noteId}:`, error instanceof Error ? error.name : "UnknownError");
  }
}
