import { prisma } from "./prisma.js";

/**
 * Toleransi Salah Ketik (Typo Tolerance) Berbasis Kamus Catatan Pengguna.
 * Tanpa panggilan AI / 0 panggilan Gemini.
 */

// Cache kamus memori: userId -> { kamus: Map<string, number>, timestamp: number }
interface CacheKamus {
  kamus: Map<string, number>; // kata -> frekuensi
  timestamp: number;
}

const KAMUS_TTL_MS = 10 * 60 * 1000; // 10 menit

// Kamus hanya dibangun dari catatan terbaru supaya tetap cepat dan hemat data
// walau pengguna punya ribuan catatan (kamus penuh bisa berukuran beberapa MB).
export const BATAS_CATATAN_KAMUS = 500;
const cacheKamusUser = new Map<string, CacheKamus>();

// Daftar kata umum (stop words) bahasa Indonesia & Inggris sederhana yang dilewati
const KATA_UMUM = new Set([
  // Tanya & Penghubung Indonesia
  "apa",
  "apakah",
  "bagaimana",
  "mengapa",
  "kenapa",
  "siapa",
  "kapan",
  "dimana",
  "kemana",
  "dari",
  "yang",
  "untuk",
  "pada",
  "dalam",
  "dengan",
  "dan",
  "atau",
  "tetapi",
  "tapi",
  "karena",
  "sebab",
  "oleh",
  "tentang",
  "seperti",
  "yaitu",
  "yakni",
  "adalah",
  "merupakan",
  "bisa",
  "dapat",
  "akan",
  "sudah",
  "telah",
  "sedang",
  "lagi",
  "harus",
  "wajib",
  "tidak",
  "bukan",
  "hanya",
  "saja",
  "saya",
  "kami",
  "kita",
  "kamu",
  "anda",
  "mereka",
  "dia",
  "beliau",
  "ini",
  "itu",
  // English common words
  "what",
  "when",
  "where",
  "which",
  "who",
  "whom",
  "whose",
  "why",
  "how",
  "this",
  "that",
  "these",
  "those",
  "then",
  "there",
  "here",
  "and",
  "but",
  "for",
  "nor",
  "or",
  "so",
  "yet",
  "with",
  "about",
  "against",
  "between",
  "into",
  "through",
  "during",
  "before",
  "after",
  "above",
  "below",
  "from",
  "have",
  "has",
  "had",
  "having",
  "does",
  "done",
  "doing",
  "can",
  "could",
  "shall",
  "should",
  "will",
  "would",
  "must",
]);

/**
 * Menghitung jarak Damerau-Levenshtein antara dua kata string.
 * Termasuk operasi substitusi, penambahan, penghapusan, dan transposisi 2 huruf bersebelahan.
 */
export function damerauLevenshtein(a: string, b: string): number {
  const al = a.length;
  const bl = b.length;
  if (al === 0) return bl;
  if (bl === 0) return al;

  const lebar = bl + 1;
  // Satu array datar (bukan array di dalam array) supaya TypeScript tidak protes
  const m: number[] = new Array((al + 1) * lebar).fill(0);
  const ambil = (i: number, j: number): number => m[i * lebar + j] ?? 0;

  for (let i = 0; i <= al; i++) m[i * lebar] = i;
  for (let j = 0; j <= bl; j++) m[j] = j;

  for (let i = 1; i <= al; i++) {
    for (let j = 1; j <= bl; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;

      let min = Math.min(
        ambil(i - 1, j) + 1, // hapus
        ambil(i, j - 1) + 1, // tambah
        ambil(i - 1, j - 1) + cost, // ganti
      );

      // Tukar 2 huruf bertetangga
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        min = Math.min(min, ambil(i - 2, j - 2) + 1);
      }

      m[i * lebar + j] = min;
    }
  }

  return ambil(al, bl);
}

/**
 * Membersihkan cache kamus seorang pengguna (misal saat catatan diubah / dihapus).
 */
export function hapusCacheKamus(userId: string): void {
  cacheKamusUser.delete(userId);
}

/**
 * Mengambil atau membangun kamus kata dari catatan terbaru pengguna (maks. BATAS_CATATAN_KAMUS).
 * Kriteria kata:
 * - Huruf kecil, panjang >= 4
 * - Berasal dari judul, tag, nama konsep, dan kata dalam isi catatan (muncul >= 2x).
 * - Maksimal 3.000 kata berbobot.
 */
export async function ambilKamus(userId: string): Promise<Map<string, number>> {
  const cached = cacheKamusUser.get(userId);
  if (cached && Date.now() - cached.timestamp < KAMUS_TTL_MS) {
    return cached.kamus;
  }

  const kamus = new Map<string, number>();

  try {
    // 1. Ambil catatan milik user: judul, tags, dan content
    const notes = await prisma.note.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      take: BATAS_CATATAN_KAMUS,
      select: { title: true, tags: true, content: true },
    });

    // 2. Ambil konsep milik user
    const concepts = await prisma.concept.findMany({
      where: { userId },
      select: { name: true },
    });

    const ekstrakKata = (teks: string): string[] => {
      // Ambil token kata latin/alfanumerik tanpa tanda baca
      const match = teks.toLowerCase().match(/[a-z]{4,}/g);
      return match || [];
    };

    // Judul & Tag & Konsep langsung berbobot tinggi (prioritas)
    for (const note of notes) {
      for (const w of ekstrakKata(note.title)) {
        kamus.set(w, (kamus.get(w) || 0) + 5);
      }
      for (const tag of note.tags) {
        for (const w of ekstrakKata(tag)) {
          kamus.set(w, (kamus.get(w) || 0) + 5);
        }
      }
    }

    for (const concept of concepts) {
      for (const w of ekstrakKata(concept.name)) {
        kamus.set(w, (kamus.get(w) || 0) + 5);
      }
    }

    // Isi catatan: hitung frekuensi kemunculan (syarat: muncul minimal 2 kali)
    const frekuensiIsi = new Map<string, number>();
    for (const note of notes) {
      const kataList = ekstrakKata(note.content || "");
      const unikDiCatatan = new Set(kataList);
      for (const w of unikDiCatatan) {
        frekuensiIsi.set(w, (frekuensiIsi.get(w) || 0) + 1);
      }
    }

    for (const [w, count] of frekuensiIsi.entries()) {
      if (count >= 2) {
        kamus.set(w, (kamus.get(w) || 0) + count);
      }
    }

    // Batasi maksimal 3.000 kata frekuensi tertinggi
    if (kamus.size > 3000) {
      const entries = Array.from(kamus.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3000);
      const kamusRamping = new Map<string, number>(entries);
      cacheKamusUser.set(userId, {
        kamus: kamusRamping,
        timestamp: Date.now(),
      });
      return kamusRamping;
    }

    cacheKamusUser.set(userId, { kamus, timestamp: Date.now() });
    return kamus;
  } catch (error) {
    // Toleran: Jika DB gagal, kembalikan kamus kosong
    return kamus;
  }
}

export interface HasilKoreksi {
  asli: string;
  dipakai: string;
  perubahan: { dari: string; ke: string }[];
}

/**
 * Mengoreksi salah ketik pada kalimat menggunakan kamus pengguna.
 * Aturan batas edit:
 * - Panjang 4-6 huruf: max jarak 1
 * - Panjang >= 7 huruf: max jarak 2
 */
export function koreksiKalimat(
  kalimat: string,
  kamus: Map<string, number>,
): HasilKoreksi {
  const teksAsli = kalimat || "";
  if (!teksAsli.trim() || kamus.size === 0) {
    return { asli: teksAsli, dipakai: teksAsli, perubahan: [] };
  }

  // Batasi panjang masukan maks 1000 karakter
  const dipotong = teksAsli.length > 1000 ? teksAsli.slice(0, 1000) : teksAsli;

  // Split dengan mempertahankan separator spasi & tanda baca
  const tokens = dipotong.split(/(\s+|[^\w\s]+)/);
  const perubahanMap = new Map<string, string>(); // dari -> ke

  const hasilTokens = tokens.map((token) => {
    // Jika token bukan kata biasa (misal spasi atau tanda baca), biarkan
    if (!/^[a-zA-Z]+$/.test(token)) {
      return token;
    }

    const kataLower = token.toLowerCase();

    // Lewati jika panjang < 4 huruf, kata umum, atau sudah ada persis di kamus
    if (
      kataLower.length < 4 ||
      KATA_UMUM.has(kataLower) ||
      kamus.has(kataLower)
    ) {
      return token;
    }

    const batasJarak = kataLower.length <= 6 ? 1 : 2;
    let kandidatTerbaik: string | null = null;
    let jarakTerbaik = Infinity;
    let frekuensiTertinggi = -1;

    for (const [kataKamus, frekuensi] of kamus.entries()) {
      // Optimasi cepat: selisih panjang huruf tidak boleh melebihi batasJarak
      if (Math.abs(kataKamus.length - kataLower.length) > batasJarak) {
        continue;
      }

      const jarak = damerauLevenshtein(kataLower, kataKamus);
      if (jarak <= batasJarak) {
        if (jarak < jarakTerbaik) {
          jarakTerbaik = jarak;
          kandidatTerbaik = kataKamus;
          frekuensiTertinggi = frekuensi;
        } else if (jarak === jarakTerbaik && frekuensi > frekuensiTertinggi) {
          kandidatTerbaik = kataKamus;
          frekuensiTertinggi = frekuensi;
        }
      }
    }

    if (kandidatTerbaik && kandidatTerbaik !== kataLower) {
      // Sesuaikan kapitalisasi jika kata asli diawali huruf kapital
      const awal = token.charAt(0);
      const kedua = token.charAt(1);
      const isCapital =
        token.length > 1 &&
        awal === awal.toUpperCase() &&
        kedua === kedua.toLowerCase();
      const kataKoreksi = isCapital
        ? kandidatTerbaik.charAt(0).toUpperCase() + kandidatTerbaik.slice(1)
        : kandidatTerbaik;

      perubahanMap.set(token, kataKoreksi);
      return kataKoreksi;
    }

    return token;
  });

  const dipakai = hasilTokens.join("");
  const perubahan: { dari: string; ke: string }[] = [];
  for (const [dari, ke] of perubahanMap.entries()) {
    perubahan.push({ dari, ke });
  }

  return {
    asli: dipotong,
    dipakai,
    perubahan,
  };
}
