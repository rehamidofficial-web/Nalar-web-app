import { damerauLevenshtein, koreksiKalimat } from "../src/lib/koreksiTypo.js";

function tes() {
  console.log("=== Tes Unit Koreksi Typo ===");

  // 1. Tes jarak Damerau-Levenshtein
  console.assert(damerauLevenshtein("async", "async") === 0, "Test 1 failed");
  console.assert(damerauLevenshtein("asyc", "async") === 1, "Test 2 failed");
  console.assert(damerauLevenshtein("awiat", "await") === 1, "Test 3 failed: transposisi");
  console.assert(damerauLevenshtein("poastgres", "postgres") === 1, "Test 4 failed");

  // 2. Buat kamus tiruan
  const kamus = new Map<string, number>([
    ["await", 10],
    ["async", 8],
    ["callback", 5],
    ["index", 12],
    ["promise", 7],
    ["postgres", 9],
    ["database", 15],
    ["javascript", 20],
  ]);

  // Kasus koreksi yang diharapkan
  const kasus = [
    { input: "awiat", expect: "await" },
    { input: "calback", expect: "callback" },
    { input: "indek", expect: "index" },
    { input: "promis", expect: "promise" },
    { input: "asyc", expect: "async" },
    { input: "poastgres", expect: "postgres" },
    // Kata yang sudah benar tidak boleh berubah
    { input: "database", expect: "database" },
    { input: "async", expect: "async" },
    // Kata asing yang tidak mirip apa pun tidak boleh diubah sembarangan
    { input: "progasses", expect: "progasses" },
    // Kata pendek dan kata umum tidak boleh diubah
    { input: "dan", expect: "dan" },
    { input: "apa", expect: "apa" },
    { input: "yang", expect: "yang" },
  ];

  let lolos = 0;
  for (const k of kasus) {
    const hasil = koreksiKalimat(k.input, kamus);
    if (hasil.dipakai === k.expect) {
      console.log(`✓ '${k.input}' -> '${hasil.dipakai}' (Lolos)`);
      lolos++;
    } else {
      console.error(`✗ '${k.input}' -> '${hasil.dipakai}' (Harusnya '${k.expect}')`);
    }
  }

  // Tes kalimat majemuk
  const kalimat = "belajar asyc awiat di javascript dengan indek database";
  const start = performance.now();
  const hasilKalimat = koreksiKalimat(kalimat, kamus);
  const durasi = performance.now() - start;

  console.log("\nTes Kalimat:");
  console.log("Asli   :", hasilKalimat.asli);
  console.log("Dipakai:", hasilKalimat.dipakai);
  console.log("Perubahan:", hasilKalimat.perubahan);
  console.log(`Durasi : ${durasi.toFixed(2)} ms (Target < 20 ms)`);

  if (lolos === kasus.length && durasi < 20) {
    console.log("\nSEMUA TES UNIT KOREKSI TYPO LOLOS!");
  } else {
    process.exit(1);
  }
}

tes();
