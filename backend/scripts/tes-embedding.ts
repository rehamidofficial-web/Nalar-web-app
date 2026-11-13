import "dotenv/config";
import { createEmbedding, EMBEDDING_DIMENSI } from "../src/services/ai.service.js";

async function main() {
  console.log("Memulai pengetesan createEmbedding...");
  try {
    const result = await createEmbedding("Contoh kalimat tentang belajar JavaScript dan AI di Nalar.");

    console.log("\n--- HASIL PENGETESAN EMBEDDING ---");
    console.log("Model          :", result.model);
    console.log("Panjang Larik  :", result.embedding.length);
    console.log("Target Dimensi :", EMBEDDING_DIMENSI);
    console.log("3 Angka Pertama:", result.embedding.slice(0, 3));
    console.log("Terpotong      :", result.terpotong);
    console.log("----------------------------------");

    if (result.embedding.length === EMBEDDING_DIMENSI) {
      console.log("🎉 Pengetesan Embedding BERHASIL dan cocok dengan vector(1536)!");
    } else {
      console.error("❌ Dimensi TIDAK cocok!");
      process.exit(1);
    }
  } catch (error: any) {
    console.error("❌ Pengetesan Embedding GAGAL:");
    console.error("Status:", error?.status);
    console.error("Pesan User:", error?.userMessage);
    console.error("Detail Error:", error?.message);
    process.exit(1);
  }
}

main();
