import "dotenv/config";
import { prisma } from "../src/lib/prisma.js";
import {
  RELASI_AMBANG,
  RELASI_MAKS_PER_CATATAN,
  hitungSemuaRelasiCatatan,
} from "../src/services/relationship.service.js";
import { cariCatatanMiripDenganCatatan } from "../src/services/vector.service.js";

interface ArgumenOpsi {
  email?: string | undefined;
  lihat: boolean;
  ambang: number;
}

function parseArgumen(): ArgumenOpsi {
  const args = process.argv.slice(2);
  let email: string | undefined = undefined;
  let lihat = false;
  let ambang = RELASI_AMBANG;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--lihat") {
      lihat = true;
    } else if (arg === "--email") {
      email = args[i + 1]?.trim().toLowerCase();
      i++;
    } else if (arg === "--ambang") {
      const val = args[i + 1];
      const parsed = val !== undefined ? parseFloat(val) : NaN;
      if (!isNaN(parsed) && parsed >= 0 && parsed <= 1) {
        ambang = parsed;
      } else {
        console.error("Ambang harus berupa angka antara 0 dan 1");
        process.exit(1);
      }
      i++;
    }
  }

  return { email, lihat, ambang };
}

async function main() {
  const { email, lihat, ambang } = parseArgumen();

  console.log("=== Penghitung Relasi Antar Catatan ===");
  console.log(`Mode: ${lihat ? "LIHAT (Dry-run, tanpa menulis ke DB)" : "TULIS (Menghitung & menyimpan relasi)"}`);
  console.log(`Ambang Kemiripan (similar): ${ambang}`);
  if (email) console.log(`Filter Pengguna: ${email}`);
  console.log("----------------------------------------");

  // Cari user yang sesuai
  const users = await prisma.user.findMany({
    where: email ? { email } : {},
    select: { id: true, email: true },
  });

  if (users.length === 0) {
    console.log("Tidak ada pengguna yang ditemukan.");
    process.exit(0);
  }

  let totalSimilarDibuat = 0;
  let totalConceptDibuat = 0;
  let totalCatatanDiproses = 0;
  let totalCatatanDilewati = 0;

  for (const user of users) {
    console.log(`\nMemproses pengguna: ${user.email}`);

    // Ambil semua catatan milik pengguna
    const notes = await prisma.note.findMany({
      where: { userId: user.id },
      select: {
        id: true,
        title: true,
        embedding: { select: { noteId: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    if (notes.length === 0) {
      console.log("  Tidak ada catatan.");
      continue;
    }

    if (lihat) {
      // MODE LIHAT (Analisis distribusi dan tetangga)
      console.log(`\nAnalisis Tetangga Terdekat (Ambang = ${ambang}, Maks = ${RELASI_MAKS_PER_CATATAN}):`);
      console.log("--------------------------------------------------------------------------------");

      const distribusiTetangga = { 0: 0, "1-2": 0, "3-5": 0 };
      const semuaSkorTeratas: number[] = [];
      let minSkor = 1;
      let maxSkor = 0;

      for (const note of notes) {
        if (!note.embedding) {
          totalCatatanDilewati++;
          continue;
        }

        totalCatatanDiproses++;
        const tetangga = await cariCatatanMiripDenganCatatan({
          userId: user.id,
          noteId: note.id,
          batas: RELASI_MAKS_PER_CATATAN,
          ambang: 0, // Ambil semua untuk analisis statistik
        });

        const tetanggaDiAtasAmbang = tetangga.filter((t) => t.similarity >= ambang);
        const jumlahDiAtasAmbang = tetanggaDiAtasAmbang.length;

        if (jumlahDiAtasAmbang === 0) distribusiTetangga[0]++;
        else if (jumlahDiAtasAmbang <= 2) distribusiTetangga["1-2"]++;
        else distribusiTetangga["3-5"]++;

        if (tetangga.length > 0 && tetangga[0]) {
          const topScore = tetangga[0].similarity;
          semuaSkorTeratas.push(topScore);
          for (const t of tetangga) {
            if (t.similarity < minSkor) minSkor = t.similarity;
            if (t.similarity > maxSkor) maxSkor = t.similarity;
          }
        }

        const potongJudul = note.title.length > 40 ? note.title.slice(0, 37) + "..." : note.title;
        console.log(`\nCatatan: "${potongJudul}"`);
        if (tetangga.length === 0) {
          console.log("  (Tidak ada catatan lain untuk dibandingkan)");
        } else {
          for (const t of tetangga.slice(0, 5)) {
            const tanda = t.similarity >= ambang ? "✓" : "x";
            const potongTetangga = t.title.length > 35 ? t.title.slice(0, 32) + "..." : t.title;
            console.log(`  [${tanda}] ${t.similarity.toFixed(4)} -> "${potongTetangga}"`);
          }
        }
      }

      console.log("\n--- Ringkasan Distribusi & Rekomendasi Ambang ---");
      const rataRataTop =
        semuaSkorTeratas.length > 0
          ? (semuaSkorTeratas.reduce((a, b) => a + b, 0) / semuaSkorTeratas.length).toFixed(4)
          : "N/A";
      console.log(`Total Catatan dengan Embedding : ${totalCatatanDiproses}`);
      console.log(`Catatan tanpa Embedding        : ${totalCatatanDilewati}`);
      console.log(`Skor Kemiripan Terkecil - Terbesar: ${minSkor.toFixed(4)} - ${maxSkor.toFixed(4)}`);
      console.log(`Rata-rata Skor Tetangga Teratas: ${rataRataTop}`);
      console.log(`Jumlah Catatan dengan Tetangga di Atas Ambang (${ambang}):`);
      console.log(`  - 0 tetangga   : ${distribusiTetangga[0]}`);
      console.log(`  - 1-2 tetangga : ${distribusiTetangga["1-2"]}`);
      console.log(`  - 3-5 tetangga : ${distribusiTetangga["3-5"]}`);
    } else {
      // MODE TULIS (Hitung dan simpan ke database)
      for (const note of notes) {
        if (!note.embedding) {
          totalCatatanDilewati++;
          // Catatan tanpa embedding tetap bisa dihitung relasi konsepnya
          const { hitungRelasiKonsep } = await import("../src/services/relationship.service.js");
          const c = await hitungRelasiKonsep(user.id, note.id);
          totalConceptDibuat += c;
          continue;
        }

        totalCatatanDiproses++;
        const { similar, concept } = await hitungSemuaRelasiCatatan(user.id, note.id, ambang);
        totalSimilarDibuat += similar;
        totalConceptDibuat += concept;
        process.stdout.write(".");
      }
      console.log("");
    }
  }

  console.log("\n========================================");
  if (lihat) {
    console.log("Selesai mode LIHAT. Tidak ada data yang diubah di database.");
  } else {
    console.log("Perhitungan relasi selesai:");
    console.log(`- Catatan diproses   : ${totalCatatanDiproses}`);
    console.log(`- Catatan dilewati   : ${totalCatatanDilewati}`);
    console.log(`- Relasi 'similar'   : ${totalSimilarDibuat} baris dibuat`);
    console.log(`- Relasi 'concept'   : ${totalConceptDibuat} baris dibuat`);
  }
  console.log("========================================");

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Terjadi error fatal:", err);
  process.exit(1);
});
