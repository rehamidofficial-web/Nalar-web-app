import "dotenv/config";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { AiError } from "../src/services/ai.service.js";
import { prisma } from "../src/lib/prisma.js";
import { simpanEmbeddingCatatan } from "../src/services/embedding.service.js";

type NoteToEmbed = {
  id: string;
  title: string;
  content: string;
};

function bacaOpsi(args: string[]): {
  semua: boolean;
  email: string | null;
  batas: number | null;
} {
  let semua = false;
  let email: string | null = null;
  let batas: number | null = null;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--semua") {
      semua = true;
    } else if (arg === "--email") {
      const value = args[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error("Opsi --email membutuhkan alamat email.");
      }
      email = value;
      index += 1;
    } else if (arg === "--batas") {
      const value = args[index + 1];
      const parsed = Number(value);
      if (!value || !Number.isSafeInteger(parsed) || parsed < 1) {
        throw new Error("Opsi --batas membutuhkan bilangan bulat positif.");
      }
      batas = parsed;
      index += 1;
    } else {
      throw new Error(`Opsi tidak dikenal: ${arg}`);
    }
  }

  return { semua, email, batas };
}

function apakahHarusBerhenti(error: unknown): boolean {
  return (
    error instanceof AiError &&
    (error.providerStatus === 401 ||
      error.providerStatus === 403 ||
      error.providerStatus === 429 ||
      error.userMessage === "Layanan AI belum dikonfigurasi di server.")
  );
}

async function main(): Promise<void> {
  let opsi: ReturnType<typeof bacaOpsi>;
  try {
    opsi = bacaOpsi(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Opsi perintah tidak valid.");
    process.exitCode = 1;
    return;
  }

  const notes = await prisma.$queryRaw<NoteToEmbed[]>`
    SELECT n.id, n.title, n.content
    FROM notes n
    JOIN users u ON u.id = n.user_id
    LEFT JOIN note_embeddings e ON e.note_id = n.id
    WHERE (${opsi.semua}::boolean OR e.note_id IS NULL)
      AND (${opsi.email}::text IS NULL OR u.email = ${opsi.email})
    ORDER BY n.created_at ASC
    LIMIT ${opsi.batas ?? 2147483647}`;

  const skippedRows = opsi.semua
    ? [{ count: 0 }]
    : await prisma.$queryRaw<{ count: number }[]>`
        SELECT COUNT(*)::int AS count
        FROM notes n
        JOIN users u ON u.id = n.user_id
        JOIN note_embeddings e ON e.note_id = n.id
        WHERE (${opsi.email}::text IS NULL OR u.email = ${opsi.email})`;
  const dilewati = skippedRows[0]?.count ?? 0;

  console.log(`Panggilan embedding yang akan dilakukan: ${notes.length}`);
  console.log(`Catatan yang dilewati karena sudah memiliki embedding: ${dilewati}`);

  if (notes.length === 0) {
    console.log("Tidak ada catatan yang perlu diproses.");
    return;
  }

  if (notes.length > 30) {
    const terminal = createInterface({ input, output });
    const jawaban = await terminal.question(
      `Proses ${notes.length} catatan dapat memakai kuota AI. Lanjutkan? (y/N) `
    );
    terminal.close();
    if (jawaban.trim().toLowerCase() !== "y") {
      console.log("Proses dibatalkan.");
      return;
    }
  }

  let berhasil = 0;
  let gagal = 0;
  let dihentikan = false;

  for (let index = 0; index < notes.length; index += 1) {
    const note = notes[index]!;
    try {
      await simpanEmbeddingCatatan(note);
      berhasil += 1;
    } catch (error) {
      gagal += 1;
      const message =
        error instanceof AiError
          ? error.userMessage
          : "Terjadi kesalahan saat membuat atau menyimpan embedding.";
      console.error(`Catatan ${note.id} gagal: ${message}`);

      if (apakahHarusBerhenti(error)) {
        dihentikan = true;
        console.error(
          `Proses dihentikan karena masalah akses atau kuota. ${berhasil} catatan sudah berhasil.`
        );
        break;
      }
    }

    console.log(
      `${index + 1}/${notes.length} diproses | berhasil=${berhasil} gagal=${gagal}`
    );
    if (index < notes.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 700));
    }
  }

  console.log(
    `Ringkasan: berhasil=${berhasil}, gagal=${gagal}, dilewati=${dilewati}.`
  );
  if (dihentikan || gagal > 0) {
    process.exitCode = 1;
  }
}

main()
  .catch((error: unknown) => {
    console.error(
      "Gagal menjalankan script embedding. Periksa koneksi database dan konfigurasi tanpa membagikan API key."
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
