import { z } from "zod";

const conceptItemSchema = z.object({
  name: z.string(),
  description: z.string().optional().nullable(),
});

const conceptsPayloadSchema = z.object({
  concepts: z.array(z.unknown()),
});

export interface ParsedConcept {
  name: string;
  description: string | null;
}

/**
 * Mengurai string mentah keluaran AI menjadi daftar konsep yang bersih dan tervalidasi.
 *
 * Aturan:
 * 1. Menghapus wrapper markdown (misal ```json ... ```).
 * 2. Mengambil substring dari kurung kurawal pertama `{` hingga terakhir `}`.
 * 3. JSON.parse aman di dalam try/catch.
 * 4. Tiap entri divalidasi:
 *    - `name` di-trim, spasi ganda dirapatkan jadi satu, panjang 1 - 150 karakter.
 *    - `description` di-trim, potong maksimal 300 karakter jika lebih, boleh null.
 *    - Entri tidak valid dilewati (tidak menggagalkan semuanya).
 * 5. Deduplikasi case-insensitive (huruf besar/kecil dianggap sama, ambil yang pertama).
 * 6. Maksimal 8 konsep.
 * 7. Mengembalikan null jika parsing gagal atau hasilnya kosong.
 */
export function parseKonsep(teks: string): ParsedConcept[] | null {
  if (!teks || typeof teks !== "string") {
    return null;
  }

  // 1. Bersihkan pagar markdown
  let cleaned = teks.replace(/```(?:json)?/gi, "").replace(/```/g, "").trim();

  // 2. Ambil substring antara kurung kurawal pertama { dan terakhir }
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    return null;
  }

  const jsonSubstring = cleaned.slice(firstBrace, lastBrace + 1);

  // 3. JSON.parse aman
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(jsonSubstring);
  } catch {
    return null;
  }

  // 4. Validasi struktur dasar
  const payloadResult = conceptsPayloadSchema.safeParse(parsedJson);
  if (!payloadResult.success) {
    return null;
  }

  const rawList = payloadResult.data.concepts;
  const result: ParsedConcept[] = [];
  const seenLowerNames = new Set<string>();

  for (const item of rawList) {
    const itemResult = conceptItemSchema.safeParse(item);
    if (!itemResult.success) {
      continue;
    }

    // Normalisasi name: trim & rapatkan spasi berlebih
    const rawName = itemResult.data.name;
    if (typeof rawName !== "string") continue;
    const normalizedName = rawName.trim().replace(/\s+/g, " ");

    if (normalizedName.length < 1 || normalizedName.length > 150) {
      continue;
    }

    // Cek duplikat case-insensitive
    const lowerName = normalizedName.toLowerCase();
    if (seenLowerNames.has(lowerName)) {
      continue;
    }

    // Normalisasi description: trim, potong max 300 char
    let normalizedDesc: string | null = null;
    if (itemResult.data.description && typeof itemResult.data.description === "string") {
      const trimmedDesc = itemResult.data.description.trim();
      if (trimmedDesc.length > 0) {
        normalizedDesc = trimmedDesc.length > 300 ? trimmedDesc.slice(0, 300) : trimmedDesc;
      }
    }

    seenLowerNames.add(lowerName);
    result.push({
      name: normalizedName,
      description: normalizedDesc,
    });

    // Batasi maksimal 8 konsep
    if (result.length >= 8) {
      break;
    }
  }

  if (result.length === 0) {
    return null;
  }

  return result;
}
