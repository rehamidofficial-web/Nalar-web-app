import "dotenv/config";
import { prisma } from "../src/lib/prisma.js";
import { createEmbedding } from "../src/services/ai.service.js";
import {
  cariCatatanMirip,
  cariCatatanMiripDenganCatatan,
} from "../src/services/vector.service.js";

function tampilkanBantuan(): void {
  console.log(`
Penggunaan:
  npx tsx scripts/tes-vektor.ts <email> "<kalimat pencarian>"
  npx tsx scripts/tes-vektor.ts <email> --mirip "<judul sebagian>"
  npx tsx scripts/tes-vektor.ts <email> "<kalimat>" --isolasi <email_kedua>
`);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    tampilkanBantuan();
    process.exit(1);
  }

  const emailArg = args[0];
  if (!emailArg || emailArg.startsWith("--")) {
    tampilkanBantuan();
    process.exit(1);
  }
  const email = emailArg.trim().toLowerCase();

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, name: true, email: true },
  });

  if (!user) {
    console.error(`Pengguna dengan email "${email}" tidak ditemukan.`);
    process.exit(1);
  }

  const opsiMiripIndex = args.indexOf("--mirip");
  const opsiIsolasiIndex = args.indexOf("--isolasi");

  // Mode 1: --mirip "<judul sebagian>"
  if (opsiMiripIndex !== -1) {
    const kataKunciJudul = args[opsiMiripIndex + 1];
    if (!kataKunciJudul) {
      console.error("Harap tentukan judul catatan setelah --mirip.");
      process.exit(1);
    }

    const targetNote = await prisma.note.findFirst({
      where: {
        userId: user.id,
        title: { contains: kataKunciJudul, mode: "insensitive" },
      },
      select: { id: true, title: true },
    });

    if (!targetNote) {
      console.error(
        `Catatan milik ${email} yang mengandung judul "${kataKunciJudul}" tidak ditemukan.`
      );
      process.exit(1);
    }

    console.log(`\nMencari catatan yang mirip dengan catatan: "${targetNote.title}" (${targetNote.id})`);
    const hasil = await cariCatatanMiripDenganCatatan({
      userId: user.id,
      noteId: targetNote.id,
      ambang: 0,
      batas: 10,
    });

    if (hasil.length === 0) {
      console.log("Tidak ada catatan mirip atau catatan belum memiliki embedding.");
      return;
    }

    console.log("\nHasil Kemiripan:");
    console.log("No | Kemiripan | Judul Catatan");
    console.log("---+-----------+------------------------------------------------------------");
    hasil.forEach((h, i) => {
      const nomor = String(i + 1).padStart(2, " ");
      const skor = h.similarity.toFixed(4);
      const judul = h.title.length > 60 ? h.title.slice(0, 57) + "..." : h.title;
      console.log(`${nomor} |   ${skor}  | ${judul}`);
    });
    return;
  }

  // Ambil kalimat pencarian
  let queryText = "";
  for (let i = 1; i < args.length; i += 1) {
    const candidate = args[i];
    if (candidate === "--isolasi") {
      i += 1;
      continue;
    }
    if (candidate) {
      queryText = candidate;
      break;
    }
  }

  if (!queryText) {
    console.error("Harap tentukan kalimat pencarian.");
    process.exit(1);
  }

  console.log(`\nMembuat embedding untuk teks kueri: "${queryText}"...`);
  const { embedding } = await createEmbedding(queryText);

  console.log(`Mencari catatan untuk ${user.email} (ambang: 0)...`);
  const hasilUser1 = await cariCatatanMirip({
    userId: user.id,
    embedding,
    ambang: 0,
    batas: 10,
  });

  console.log("\nHasil Pencarian Kemiripan:");
  console.log("No | Kemiripan | Judul Catatan");
  console.log("---+-----------+------------------------------------------------------------");
  hasilUser1.forEach((h, i) => {
    const nomor = String(i + 1).padStart(2, " ");
    const skor = h.similarity.toFixed(4);
    const judul = h.title.length > 60 ? h.title.slice(0, 57) + "..." : h.title;
    console.log(`${nomor} |   ${skor}  | ${judul}`);
  });

  // Mode 2: --isolasi <email_kedua>
  if (opsiIsolasiIndex !== -1) {
    const rawEmail2 = args[opsiIsolasiIndex + 1];
    if (!rawEmail2) {
      console.error("Harap tentukan email kedua setelah --isolasi.");
      process.exit(1);
    }
    const email2 = rawEmail2.trim().toLowerCase();

    const user2 = await prisma.user.findUnique({
      where: { email: email2 },
      select: { id: true, email: true },
    });

    if (!user2) {
      console.error(`Pengguna kedua dengan email "${email2}" tidak ditemukan.`);
      process.exit(1);
    }

    console.log(`\nMenjalankan uji isolasi dengan pengguna kedua: ${user2.email}...`);
    const hasilUser2 = await cariCatatanMirip({
      userId: user2.id,
      embedding,
      ambang: 0,
      batas: 10,
    });

    const set1 = new Set(hasilUser1.map((h) => h.noteId));
    const bocor = hasilUser2.filter((h) => set1.has(h.noteId));

    console.log("\n--- HASIL UJI ISOLASI DATA ANTAR PENGGUNA ---");
    if (bocor.length === 0) {
      console.log("✅ STATUS: LULUS (Tidak ada catatan yang bocor antar pengguna)");
    } else {
      console.log(`❌ STATUS: GAGAL (${bocor.length} catatan bocor ke pengguna lain!)`);
    }
  }
}

main()
  .catch((err) => {
    console.error("Terjadi error pada skrip tes-vektor:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
