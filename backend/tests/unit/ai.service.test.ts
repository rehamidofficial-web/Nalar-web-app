import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type ChatMockResponse = {
  choices: { message?: { content?: string | null } | null }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number } | null;
};

type EmbeddingMockResponse = {
  data?: { embedding?: number[] | null }[] | null;
  usage?: { prompt_tokens?: number } | null;
};

const mocks = vi.hoisted(() => ({
  chatCreate: vi.fn(
    async (_params: Record<string, unknown>): Promise<ChatMockResponse> => ({
      choices: [{ message: { content: "Jawaban tiruan." } }],
      usage: { prompt_tokens: 4, completion_tokens: 2 },
    })
  ),
  embeddingCreate: vi.fn(
    async (_params: Record<string, unknown>): Promise<EmbeddingMockResponse> => ({
      data: [{ embedding: Array.from({ length: 1536 }, () => 0) }],
      usage: { prompt_tokens: 5 },
    })
  ),
}));

vi.mock("openai", () => ({
  default: class OpenAI {
    chat = { completions: { create: mocks.chatCreate } };
    embeddings = { create: mocks.embeddingCreate };

    constructor(_options: unknown) {}
  },
}));

import {
  AiError,
  createEmbedding,
  EMBEDDING_DIMENSI,
  kirimErrorAi,
  MAKSIMAL_KARAKTER_EMBEDDING,
  netralkanPenandaCatatan,
  potongTeks,
  generateText,
} from "../../src/services/ai.service.js";

function buatResponse() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
}

beforeEach(() => {
  mocks.chatCreate.mockReset().mockImplementation(async () => ({
    choices: [{ message: { content: "Jawaban tiruan." } }],
    usage: { prompt_tokens: 4, completion_tokens: 2 },
  }));
  mocks.embeddingCreate.mockReset().mockImplementation(async () => ({
    data: [{ embedding: Array.from({ length: EMBEDDING_DIMENSI }, () => 0) }],
    usage: { prompt_tokens: 5 },
  }));
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("utilitas teks AI", () => {
  it("menghapus penanda catatan yang ditanam di dalam teks", () => {
    expect(
      netralkanPenandaCatatan(
        "<catatan>isi <<<CATATAN dan CATATAN>>> akhir</catatan>"
      )
    ).toBe("isi  dan  akhir");
  });

  it("memotong teks hanya ketika melebihi batas", () => {
    expect(potongTeks("empat", 5)).toEqual({
      teks: "empat",
      terpotong: false,
    });
    expect(potongTeks("enam!!", 5)).toEqual({
      teks: "enam!",
      terpotong: true,
    });
  });
});

describe("generateText", () => {
  it("mengirim prompt, format JSON, batas token, dan metadata penggunaan", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-api-key");
    vi.stubEnv("OPENAI_CHAT_MODEL", "model-tiruan");

    const result = await generateText({
      system: "Aturan sistem.",
      user: "Pertanyaan pengguna.",
      json: true,
      maxOutputTokens: 123,
    });

    expect(mocks.chatCreate).toHaveBeenCalledWith({
      model: "model-tiruan",
      messages: [
        { role: "system", content: "Aturan sistem." },
        { role: "user", content: "Pertanyaan pengguna." },
      ],
      max_tokens: 123,
      response_format: { type: "json_object" },
    });
    expect(result).toEqual({
      text: "Jawaban tiruan.",
      model: "model-tiruan",
      terpotong: false,
      usage: { input: 4, output: 2 },
    });
  });

  it("memotong prompt panjang dan memakai batas token bawaan", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-api-key");
    vi.stubEnv("OPENAI_CHAT_MODEL", "model-tiruan");
    mocks.chatCreate.mockResolvedValueOnce({
      choices: [{ message: { content: null } }],
    });

    const result = await generateText({
      system: "Aturan sistem.",
      user: "x".repeat(12_001),
    });
    const params = mocks.chatCreate.mock.calls[0]?.[0];
    const messages = params?.messages as { role: string; content: string }[];

    expect(messages[1]?.content).toHaveLength(12_000);
    expect(params?.max_tokens).toBe(600);
    expect(params?.response_format).toBeUndefined();
    expect(result.text).toBe("");
    expect(result.terpotong).toBe(true);
    expect(result.usage).toBeUndefined();
  });

  it("menolak pemanggilan jika model chat belum dikonfigurasi", async () => {
    vi.stubEnv("OPENAI_CHAT_MODEL", "");

    await expect(
      generateText({ system: "Sistem", user: "Pertanyaan" })
    ).rejects.toMatchObject({
      status: 500,
      userMessage: "Layanan AI belum dikonfigurasi di server.",
    });
  });

  it.each([
    [{ status: 401, message: "Unauthorized" }, 500, "Layanan AI belum dikonfigurasi dengan benar di server."],
    [{ status: 403, message: "Forbidden" }, 500, "Layanan AI belum dikonfigurasi dengan benar di server."],
    [{ status: 429, message: "Quota" }, 502, "Layanan AI sedang sibuk atau kuotanya habis. Coba lagi nanti."],
    [{ code: "ETIMEDOUT", message: "Timeout" }, 504, "AI terlalu lama menjawab. Coba lagi."],
    [{ status: 400, message: "Bad request" }, 502, "Terjadi kesalahan pada layanan AI."],
  ])("memetakan error provider ke error layanan yang aman", async (providerError, status, message) => {
    vi.stubEnv("OPENAI_API_KEY", "test-api-key");
    vi.stubEnv("OPENAI_CHAT_MODEL", "model-tiruan");
    mocks.chatCreate.mockRejectedValueOnce(providerError);

    await expect(
      generateText({ system: "Sistem", user: "Pertanyaan" })
    ).rejects.toMatchObject({ status, userMessage: message });
  });

  it("meneruskan AiError tanpa mengubah status atau pesan", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-api-key");
    vi.stubEnv("OPENAI_CHAT_MODEL", "model-tiruan");
    const error = new AiError(429, "Kuota berhenti.");
    mocks.chatCreate.mockRejectedValueOnce(error);

    await expect(
      generateText({ system: "Sistem", user: "Pertanyaan" })
    ).rejects.toBe(error);
  });
});

describe("createEmbedding", () => {
  it("mengirim embedding dengan dimensi yang benar dan mencatat hasil pemotongan", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-api-key");
    vi.stubEnv("OPENAI_EMBEDDING_MODEL", "embedding-tiruan");

    const result = await createEmbedding("x".repeat(MAKSIMAL_KARAKTER_EMBEDDING + 1));
    const params = mocks.embeddingCreate.mock.calls[0]?.[0];

    expect(params).toMatchObject({
      model: "embedding-tiruan",
      dimensions: EMBEDDING_DIMENSI,
    });
    expect(params?.input).toHaveLength(MAKSIMAL_KARAKTER_EMBEDDING);
    expect(result.embedding).toHaveLength(EMBEDDING_DIMENSI);
    expect(result.model).toBe("embedding-tiruan");
    expect(result.terpotong).toBe(true);
  });

  it("menolak data embedding kosong atau berdimensi salah", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-api-key");
    vi.stubEnv("OPENAI_EMBEDDING_MODEL", "embedding-tiruan");
    mocks.embeddingCreate.mockResolvedValueOnce({ data: [] });

    await expect(createEmbedding("pertanyaan")).rejects.toMatchObject({
      status: 502,
      userMessage: "Layanan AI tidak mengembalikan data embedding.",
    });

    mocks.embeddingCreate.mockResolvedValueOnce({
      data: [{ embedding: [0, 1] }],
    });
    await expect(createEmbedding("pertanyaan")).rejects.toMatchObject({
      status: 500,
      userMessage: "Layanan AI belum dikonfigurasi dengan benar di server.",
    });
  });

  it("menolak pemanggilan jika model embedding belum dikonfigurasi", async () => {
    vi.stubEnv("OPENAI_EMBEDDING_MODEL", "");

    await expect(createEmbedding("pertanyaan")).rejects.toMatchObject({
      status: 500,
      userMessage: "Layanan AI belum dikonfigurasi di server.",
    });
  });
});

describe("kirimErrorAi", () => {
  it.each([
    [429, "Kuota AI habis."],
    [504, "AI terlalu lama menjawab."],
    [502, "Format JSON dari AI rusak."],
  ])("mengirim status %i dan pesan yang sesuai", (status, message) => {
    const response = buatResponse();

    kirimErrorAi(response, new AiError(status, message));

    expect(response.status).toHaveBeenCalledWith(status);
    expect(response.json).toHaveBeenCalledWith({
      success: false,
      message,
      errors: [],
    });
  });

  it("mengirim error umum dengan status 502", () => {
    const response = buatResponse();

    kirimErrorAi(response, new Error("detail internal"));

    expect(response.status).toHaveBeenCalledWith(502);
    expect(response.json).toHaveBeenCalledWith({
      success: false,
      message: "Terjadi kesalahan pada layanan AI.",
      errors: [],
    });
  });
});
