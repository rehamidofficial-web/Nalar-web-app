import { AiError, createEmbedding } from "./ai.service.js";
import { prisma } from "../lib/prisma.js";
import { keTeksVektor } from "../lib/vektor.js";

type NoteContent = {
  title: string;
  content: string;
};

type NoteForEmbedding = NoteContent & {
  id: string;
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
  } catch (error) {
    const message =
      error instanceof AiError
        ? error.userMessage
        : "Terjadi kesalahan saat menyimpan embedding.";
    console.error(`[Embedding] Catatan ${note.id} gagal di-embed: ${message}`);
  }
}
