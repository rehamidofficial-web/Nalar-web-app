import { parseKonsep } from "../src/lib/parseKonsep.js";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ GAGAL: ${message}`);
    process.exit(1);
  } else {
    console.log(`✅ LULUS: ${message}`);
  }
}

console.log("=== Pengujian parseKonsep ===");

// 1. JSON bersih
const case1 = JSON.stringify({
  concepts: [
    { name: "TypeScript", description: "Bahasa pemrograman dengan tipe data statis" },
    { name: "Express", description: "Framework web minimalis untuk Node.js" },
  ],
});
const res1 = parseKonsep(case1);
assert(res1 !== null && res1.length === 2, "Kasus 1: JSON bersih berhasil diurai");
assert(Boolean(res1 && res1[0]?.name === "TypeScript"), "Kasus 1: Nama konsep sesuai");

// 2. JSON di dalam pagar kode markdown
const case2 = "```json\n" + case1 + "\n```";
const res2 = parseKonsep(case2);
assert(res2 !== null && res2.length === 2, "Kasus 2: JSON dalam pagar markdown berhasil diurai");

// 3. JSON dengan teks pembuka & penutup
const case3 = "Halo, berikut konsepnya:\n" + case1 + "\nSemoga membantu!";
const res3 = parseKonsep(case3);
assert(res3 !== null && res3.length === 2, "Kasus 3: JSON dengan teks pengantar berhasil diurai");

// 4. JSON rusak / invalid
const case4 = "{ concepts: [ { name: 'rusak' ";
const res4 = parseKonsep(case4);
assert(res4 === null, "Kasus 4: JSON rusak mengembalikan null");

// 5. Entri tanpa name atau format salah dilewati
const case5 = JSON.stringify({
  concepts: [
    { description: "Tanpa name" },
    { name: "Valid Concept", description: "Ada nama" },
    { name: "", description: "Nama kosong" },
    null,
    "bukan objek",
  ],
});
const res5 = parseKonsep(case5);
assert(res5 !== null && res5.length === 1, "Kasus 5: Entri tidak valid berhasil dilewati");
assert(Boolean(res5 && res5[0]?.name === "Valid Concept"), "Kasus 5: Hanya konsep valid yang diambil");

// 6. Lebih dari 8 konsep (harus dipotong menjadi 8)
const case6 = JSON.stringify({
  concepts: Array.from({ length: 15 }, (_, i) => ({
    name: `Konsep ${i + 1}`,
    description: `Deskripsi ${i + 1}`,
  })),
});
const res6 = parseKonsep(case6);
assert(res6 !== null && res6.length === 8, "Kasus 6: Konsep lebih dari 8 dipotong menjadi tepat 8");

// 7. Nama ganda beda huruf besar kecil (case-insensitive deduplication)
const case7 = JSON.stringify({
  concepts: [
    { name: "JavaScript", description: "Deskripsi pertama" },
    { name: "javascript", description: "Deskripsi huruf kecil" },
    { name: "JAVASCRIPT", description: "Deskripsi huruf kapital" },
    { name: "Python", description: "Bahasa Python" },
  ],
});
const res7 = parseKonsep(case7);
assert(res7 !== null && res7.length === 2, "Kasus 7: Deduplikasi case-insensitive berhasil (hanya 2 konsep)");
assert(Boolean(res7 && res7[0]?.name === "JavaScript"), "Kasus 7: Mengambil nama konsep yang pertama");

// 8. Description sangat panjang (> 300 karakter) dipotong
const longDesc = "A".repeat(400);
const case8 = JSON.stringify({
  concepts: [{ name: "Long Desc", description: longDesc }],
});
const res8 = parseKonsep(case8);
assert(Boolean(res8 && res8[0]?.description?.length === 300), "Kasus 8: Deskripsi > 300 karakter dipotong menjadi 300");

console.log("\n🎉 SEMUA PENGUJIAN parseKonsep BERHASIL!");
