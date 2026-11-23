import { vi } from "vitest";

const mocks = vi.hoisted(() => {
  const buatVektor = (teks: string): number[] => {
    const dimensi = 1536;
    const vektor = Array.from({ length: dimensi }, () => 0);
    const kata = teks.toLowerCase().match(/[a-z0-9]+/g) ?? [];

    for (const item of kata) {
      let hash = 2166136261;
      for (let index = 0; index < item.length; index += 1) {
        hash = Math.imul(hash ^ item.charCodeAt(index), 16777619) >>> 0;
      }
      vektor[hash % dimensi] = (vektor[hash % dimensi] ?? 0) + (hash & 1 ? 1 : -1);
    }

    const panjang = Math.sqrt(vektor.reduce((jumlah, nilai) => jumlah + nilai ** 2, 0));
    return panjang === 0 ? vektor : vektor.map((nilai) => nilai / panjang);
  };

  const buatEmbedding = async (teks: string) => ({
    embedding: buatVektor(teks),
    model: "embedding-tiruan",
    terpotong: false,
  });

  const buatTeks = async (
    opsi: { json?: boolean; system?: string; user: string }
  ) => ({
    text: opsi.json
      ? opsi.system?.includes("Gabungkan catatan")
        ? JSON.stringify({ title: "Catatan Gabungan", content: "Isi gabungan." })
        : JSON.stringify({
            concepts: [{ name: "Konsep Tes", description: "Deskripsi tes." }],
          })
      : "Jawaban tiruan untuk tes.",
    model: "chat-tiruan",
    terpotong: false,
  });

  const createEmbedding = vi.fn(buatEmbedding);
  const generateText = vi.fn(buatTeks);

  return {
    createEmbedding,
    generateText,
    reset() {
      createEmbedding.mockReset().mockImplementation(buatEmbedding);
      generateText.mockReset().mockImplementation(buatTeks);
    },
  };
});

vi.mock("../../src/services/ai.service.js", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../src/services/ai.service.js")>();
  return {
    ...actual,
    createEmbedding: mocks.createEmbedding,
    generateText: mocks.generateText,
  };
});

export const mockCreateEmbedding = mocks.createEmbedding;
export const mockGenerateText = mocks.generateText;
export const resetMockAi = () => mocks.reset();
