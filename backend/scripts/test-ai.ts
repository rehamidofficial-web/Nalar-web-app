import "dotenv/config";
import { generateText } from "../src/services/ai.service.js";

async function main() {
  console.log("Memulai pengetesan koneksi AI...");
  try {
    const result = await generateText({
      system: "Kamu adalah asisten penguji yang ringkas.",
      user: "Katakan 'Halo Nalar, koneksi AI berhasil!' dalam 1 kalimat.",
      maxOutputTokens: 50,
    });

    console.log("\n--- HASIL PENGETESAN ---");
    console.log("Teks balasan :", result.text.trim());
    console.log("Model        :", result.model);
    console.log("Terpotong    :", result.terpotong);
    console.log("Usage        :", result.usage);
    console.log("------------------------");
    console.log("Pengetesan AI BERHASIL!");
  } catch (error: any) {
    console.error("\nPengetesan AI GAGAL:");
    console.error("Status:", error.status);
    console.error("Pesan User:", error.userMessage);
    console.error("Detail Error:", error.message);
  }
}

main();
