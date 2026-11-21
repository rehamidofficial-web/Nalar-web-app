import { createEmbedding } from "./ai.service.js";
import { prisma } from "../lib/prisma.js";
import { keTeksVektor } from "../lib/vektor.js";
import { jalankanRelasiDiLatarBelakang } from "./relationship.service.js";

type NoteContent = {
  title: string;
  content: string;
};

type NoteForEmbedding = NoteContent & {
  id: string;
  userId?: string;
};

export function buatTeksEmbedding(note: NoteContent): string {
  return `${note.title}\n\n${note.content}`;
}

export async function simpanEmbeddingCatatan(note: NoteForEmbedding): Promise<void> {
  const { embedding, model } = await createEmbedding(buatTeksEmbedding(note));
  const vektor = keTeksVektor(embedding);

  await prisma.$executeRaw`
    INSERT INTO note_embeddings (note_id, embedding, model)
    VALUES (${note.id}::uuid, ${vektor}::vector, ${model})
    ON CONFLICT (note_id) DO UPDATE
    SET embedding = EXCLUDED.embedding, model = EXCLUDED.model, created_at = NOW()`;
}

export async function hapusEmbeddingCatatan(noteId: string): Promise<void> {
  await prisma.$executeRaw`
    DELETE FROM note_embeddings WHERE note_id = ${noteId}::uuid`;
}

export async function jalankanEmbeddingDiLatarBelakang(
  note: NoteForEmbedding
): Promise<void> {
  try {
    await simpanEmbeddingCatatan(note);

    // Ambil userId jika belum ada di parameter note
    let userId = note.userId;
    if (!userId) {
      const dbNote = await prisma.note.findUnique({
        where: { id: note.id },
        select: { userId: true },
      });
      userId = dbNote?.userId;
    }

    if (userId) {
      void jalankanRelasiDiLatarBelakang(userId, note.id);
    }
  } catch (error) {
    const errorName = error instanceof Error ? error.name : "UnknownError";
    console.error(
      `[Embedding] Catatan ${note.id} gagal di-embed: ${errorName}`
    );
  }
}
