import "dotenv/config";
import { prisma } from "../src/lib/prisma.js";

const sampleNotes = [
  {
    title: "[Contoh] Pengenalan JavaScript Modern (ES6+)",
    content:
      "JavaScript telah berkembang pesat sejak rilis ES6 di tahun 2015. Fitur-fitur seperti arrow functions, destructuring, template literals, dan async/await telah merevolusi cara developer menulis kode yang bersih dan mudah dipahami.",
    tags: ["javascript", "dasar", "web"],
  },
  {
    title: "[Contoh] Menguasai Flexbox dan Grid di CSS",
    content:
      "Tata letak halaman web menjadi sangat mudah dan fleksibel menggunakan CSS Flexbox untuk tata letak satu dimensi dan CSS Grid untuk tata letak dua dimensi yang lebih kompleks. Menguasai keduanya adalah fondasi kuat frontend modern.",
    tags: ["css", "frontend", "dasar"],
  },
  {
    title: "[Contoh] Dasar-dasar Relational Database dan SQL",
    content:
      "Database relasional seperti PostgreSQL mengorganisir data dalam bentuk tabel dengan baris dan kolom. Penggunaan foreign key memastikan integritas referensial dan memungkinkan kueri gabungan (JOIN) yang kuat.",
    tags: ["database", "sql", "backend"],
  },
  {
    title: "[Contoh] Mengapa Memilih PostgreSQL dan Neon?",
    content:
      "PostgreSQL adalah sistem database relasional open-source paling canggih di dunia. Neon membawanya ke arsitektur serverless, memisahkan storage dan compute, serta mendukung percabangan data layaknya Git.",
    tags: ["database", "postgres", "cloud"],
  },
  {
    title: "[Contoh] Komponen dan State dalam React",
    content:
      "React berpusat pada paradigma antarmuka berbasis komponen. State adalah memori internal komponen yang memungkinkan UI bereaksi secara otomatis ketika data berubah.",
    tags: ["react", "javascript", "frontend"],
  },
  {
    title: "[Contoh] Memahami Next.js App Router",
    content:
      "App Router di Next.js memperkenalkan arsitektur React Server Components (RSC). Ini memungkinkan rendering komponen secara optimal di server, mempercepat loading dan memangkas ukuran JavaScript yang dikirim ke browser.",
    tags: ["nextjs", "react", "frontend"],
  },
  {
    title: "[Contoh] Desain RESTful API yang Efisien",
    content:
      "REST API yang baik memanfaatkan metode HTTP yang tepat (GET, POST, PATCH, DELETE), status code yang seragam, penanganan error yang jelas, serta konsistensi struktur payload JSON.",
    tags: ["backend", "api", "dasar"],
  },
  {
    title: "[Contoh] Autentikasi Menggunakan JWT dan Bcrypt",
    content:
      "Mengamankan kredensial pengguna dimulai dengan hashing password satu arah menggunakan Bcrypt. Setelah kredensial terverifikasi, token JWT ditandatangani untuk otorisasi sesi tanpa perlu query database berulang.",
    tags: ["auth", "keamanan", "backend"],
  },
  {
    title: "[Contoh] Validasi Data Kuat dengan Zod",
    content:
      "Zod adalah pustaka deklarasi dan validasi skema TypeScript-first. Dengan Zod, kita dapat memvalidasi input di runtime sekaligus mendapatkan pengetikan tipe statis otomatis tanpa duplikasi kode.",
    tags: ["typescript", "zod", "backend"],
  },
  {
    title: "[Contoh] Memulai Personal Knowledge Management (PKM)",
    content:
      "PKM adalah metode terstruktur untuk mengumpulkan, menghubungkan, dan merefleksikan ide serta wawasan dari waktu ke waktu. Tujuannya adalah membangun 'otak kedua' yang membantu daya ingat dan kreativitas.",
    tags: ["ide", "produktivitas", "pkm"],
  },
  {
    title: "[Contoh] Konsep Zettelkasten dalam Menulis Catatan",
    content:
      "Metode Zettelkasten menekankan catatan atomik (satu ide per catatan) dan membuat tautan antar catatan yang saling melengkapi daripada hanya mengandalkan struktur hierarki folder.",
    tags: ["ide", "pkm", "menulis"],
  },
  {
    title: "[Contoh] Peran AI dalam Ekstraksi Pengetahuan",
    content:
      "Model bahasa besar (LLM) dapat membantu menganalisis teks panjang, meringkas poin-poin inti, serta mengekstrak entitas dan konsep penting untuk dihubungkan secara otomatis.",
    tags: ["ai", "ide", "pkm"],
  },
  {
    title: "[Contoh] Pengenalan Vektor dan Vector Search",
    content:
      "Pencarian berbasis vektor membandingkan kedekatan makna (semantik) dari dokumen daripada pencarian teks harfiah. Ekstensi pgvector di PostgreSQL memungkinkan pencarian embedding berdimensi tinggi dengan cepat.",
    tags: ["ai", "database", "postgres"],
  },
  {
    title: "[Contoh] Tips Menggunakan Tailwind CSS Efektif",
    content:
      "Tailwind mempercepat alur kerja pembuatan antarmuka dengan utility-first classes. Gunakan pola komponen yang konsisten dan manfaatkan arbitary values bila benar-benar dibutuhkan saja.",
    tags: ["css", "frontend", "tips"],
  },
  {
    title: "[Contoh] Manajemen State di Client Component",
    content:
      "Gunakan useState untuk nilai sederhana di dalam komponen, atau custom hooks untuk mengekstrak logika state yang berulang seperti autentikasi atau filter data.",
    tags: ["react", "javascript", "frontend"],
  },
  {
    title: "[Contoh] Panduan Clean Code untuk Pemula",
    content:
      "Kode yang bersih adalah kode yang mudah dibaca oleh manusia lain. Berikan nama variabel dan fungsi yang jelas mendeskripsikan tujuan, serta jaga agar setiap fungsi hanya melakukan satu tugas spesifik.",
    tags: ["tips", "dasar", "programming"],
  },
  {
    title: "[Contoh] Memahami Asynchronous JavaScript",
    content:
      "Event loop, Promise, dan async/await adalah pilar pemrograman non-blocking di JavaScript. Mengetahui cara kerja microtask queue membantu menghindari bug race condition.",
    tags: ["javascript", "dasar", "backend"],
  },
  {
    title: "[Contoh] Praktik Keamanan Web Dasar (OWASP)",
    content:
      "Selalu lakukan sanitasi dan validasi input untuk mencegah SQL Injection dan XSS. Gunakan header keamanan seperti Helmet dan batasi ukuran payload request.",
    tags: ["keamanan", "backend", "web"],
  },
  {
    title: "[Contoh] Manfaat Pemrograman Deklaratif",
    content:
      "Dalam pendekatan deklaratif, kita mendeskripsikan 'apa yang diinginkan' daripada instruksi berurutan 'bagaimana cara melakukannya'. React dan SQL adalah contoh nyata gaya deklaratif.",
    tags: ["programming", "react", "sql"],
  },
  {
    title: "[Contoh] Strategi Pengujian Perangkat Lunak",
    content:
      "Piramida pengujian terdiri dari unit tests di bagian dasar, integration tests di tengah, dan end-to-end tests di puncak. Fokus awal yang baik adalah menguji jalur kritis bisnis.",
    tags: ["testing", "tips", "programming"],
  },
  {
    title: "[Contoh] Bekerja dengan Git dan Version Control",
    content:
      "Git mencatat riwayat perubahan berkas. Membuat commit kecil dengan pesan yang jelas mempermudah kolaborasi dan penelusuran jika terjadi regresi bug.",
    tags: ["git", "tips", "dasar"],
  },
  {
    title: "[Contoh] Mengoptimalkan Kueri Database dengan Index",
    content:
      "Index mempercepat pencarian data pada kolom yang sering digunakan dalam klausa WHERE atau ORDER BY, meskipun memiliki sedikit trade-off pada kecepatan penulisan (INSERT/UPDATE).",
    tags: ["database", "postgres", "sql"],
  },
  {
    title: "[Contoh] Prinsip Desain Antarmuka Mobile-First",
    content:
      "Merancang antarmuka untuk layar ponsel terlebih dahulu memaksa kita memprioritaskan konten yang paling esensial sebelum memperluasnya untuk layar desktop yang lebih lebar.",
    tags: ["frontend", "css", "tips"],
  },
  {
    title: "[Contoh] Dasar-dasar TypeScript untuk Proyek Web",
    content:
      "TypeScript menambahkan pengetikan statis opsional pada JavaScript. Ini membantu mendeteksi kesalahan pengetikan di saat coding sebelum kode dijalankan di browser atau server.",
    tags: ["typescript", "javascript", "dasar"],
  },
  {
    title: "[Contoh] Membangun Kebiasaan Belajar Konsisten",
    content:
      "Konsistensi mengalahkan intensitas singkat. Belajar pemrograman 1 jam setiap hari jauh lebih berdampak daripada maraton 7 jam hanya di akhir pekan.",
    tags: ["ide", "produktivitas", "tips"],
  },
];

async function main() {
  const args = process.argv.slice(2);
  const email = args[0];
  const isDelete = args.includes("--hapus");

  if (!email || email.startsWith("--")) {
    console.error("Gunakan: npx tsx scripts/seed-notes.ts email@pemilik.com [--hapus]");
    process.exit(1);
  }

  const user = await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
  });

  if (!user) {
    console.error(`Error: Pengguna dengan email "${email}" tidak ditemukan di database.`);
    process.exit(1);
  }

  if (isDelete) {
    const deleted = await prisma.note.deleteMany({
      where: {
        userId: user.id,
        title: { startsWith: "[Contoh]" },
      },
    });
    console.log(`Berhasil menghapus ${deleted.count} catatan contoh untuk ${email}`);
    return;
  }

  console.log(`Membuat 25 catatan contoh untuk pengguna: ${user.name} (${email})...`);

  let count = 0;
  for (const item of sampleNotes) {
    await prisma.note.create({
      data: {
        userId: user.id,
        title: item.title,
        content: item.content,
        tags: item.tags,
      },
    });
    count++;
  }

  console.log(`Selesai! Berhasil membuat ${count} catatan contoh.`);
}

main()
  .catch((e) => {
    console.error("Terjadi error saat menjalankan seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
