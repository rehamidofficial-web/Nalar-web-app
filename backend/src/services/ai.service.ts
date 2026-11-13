import OpenAI from "openai";

// Batas panjang teks karakter sebelum dipotong (Task 3.5 & Task 3.3)
export const MAKSIMAL_KARAKTER_INPUT = 12000;

// Batas konservatif untuk model Gemini yang menerima maksimal 2048 token.
export const MAKSIMAL_KARAKTER_EMBEDDING = 4000;

// Dimensi vektor embedding yang disimpan di PostgreSQL vector(1536)
export const EMBEDDING_DIMENSI = 1536;

/**
 * Custom Error untuk AI dengan status HTTP dan pesan ramah pengguna.
 */
export class AiError extends Error {
  public status: number;
  public userMessage: string;
  public providerStatus: number | undefined;

  constructor(
    status: number,
    userMessage: string,
    originalMessage?: string,
    providerStatus?: number
  ) {
    super(originalMessage || userMessage);
    this.name = "AiError";
    this.status = status;
    this.userMessage = userMessage;
    this.providerStatus = providerStatus;
  }
}

// Instance klien OpenAI dibuat secara "lazy" (hanya dibuat saat fungsi pertama kali dipanggil)
let aiClientInstance: OpenAI | null = null;

function getAiClient(): OpenAI {
  if (aiClientInstance) {
    return aiClientInstance;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new AiError(
      500,
      "Layanan AI belum dikonfigurasi di server.",
      "OPENAI_API_KEY belum disetel di file .env"
    );
  }

  const baseURL = process.env.OPENAI_BASE_URL || undefined;

  aiClientInstance = new OpenAI({
    apiKey,
    baseURL,
    timeout: 30000, // 30 detik
    maxRetries: 1,
  });

  return aiClientInstance;
}

/**
 * Memetakan error SDK/Jaringan ke AiError standar
 */
function handleApiError(error: any): never {
  console.error("[AI Error]", error?.name, error?.status ?? error?.code ?? "unknown");

  if (error instanceof AiError) {
    throw error;
  }

  const status = error?.status;

  // 401 / 403: Key salah / akses ditolak
  if (status === 401 || status === 403) {
    throw new AiError(
      500,
      "Layanan AI belum dikonfigurasi dengan benar di server.",
      error?.message,
      status
    );
  }

  // 429: Rate limit / kuota habis
  if (status === 429) {
    throw new AiError(
      502,
      "Layanan AI sedang sibuk atau kuotanya habis. Coba lagi nanti.",
      error?.message,
      status
    );
  }

  // Timeout atau masalah koneksi jaringan
  if (
    error?.code === "ETIMEDOUT" ||
    error?.name === "APIConnectionTimeoutError" ||
    error?.name === "TimeoutError" ||
    error?.name === "AbortError"
  ) {
    throw new AiError(
      502,
      "Layanan AI tidak merespons. Coba lagi sebentar lagi.",
      error?.message
    );
  }

  // Error lainnya (5xx atau error 400 format)
  throw new AiError(
    502,
    "Terjadi kesalahan pada layanan AI.",
    error?.message
  );
}

/**
 * Memotong teks jika melebihi batas maksimal karakter.
 */
export function potongTeks(
  teks: string,
  maksimal = MAKSIMAL_KARAKTER_INPUT
): { teks: string; terpotong: boolean } {
  if (teks.length <= maksimal) {
    return { teks, terpotong: false };
  }

  return {
    teks: teks.slice(0, maksimal),
    terpotong: true,
  };
}

export interface GenerateTextOptions {
  system: string;
  user: string;
  json?: boolean;
  maxOutputTokens?: number;
}

export interface GenerateTextResult {
  text: string;
  model: string;
  terpotong: boolean;
  usage?: {
    input: number;
    output: number;
  } | undefined;
}

/**
 * Menghasilkan teks dengan memanggil LLM (OpenAI atau Gemini OpenAI-compatible).
 */
export async function generateText(
  opsi: GenerateTextOptions
): Promise<GenerateTextResult> {
  const model = process.env.OPENAI_CHAT_MODEL;
  if (!model) {
    throw new AiError(
      500,
      "Layanan AI belum dikonfigurasi di server.",
      "OPENAI_CHAT_MODEL belum disetel di file .env"
    );
  }

  const client = getAiClient();
  const pemotongan = potongTeks(opsi.user);

  try {
    const requestParams: OpenAI.Chat.ChatCompletionCreateParamsNonStreaming = {
      model,
      messages: [
        { role: "system", content: opsi.system },
        { role: "user", content: pemotongan.teks },
      ],
      max_tokens: opsi.maxOutputTokens ?? 600,
    };

    if (opsi.json) {
      requestParams.response_format = { type: "json_object" };
    }

    const response = await client.chat.completions.create(requestParams);

    const choice = response.choices[0];
    const outputText = choice?.message?.content || "";

    const usage = response.usage
      ? {
          input: response.usage.prompt_tokens,
          output: response.usage.completion_tokens,
        }
      : undefined;

    // Log aman di server (tidak mencetak API key atau isi teks)
    console.log(
      `[AI] model=${model}, masuk=${usage?.input ?? "?"} token, keluar=${usage?.output ?? "?"} token`
    );

    return {
      text: outputText,
      model,
      terpotong: pemotongan.terpotong,
      usage,
    };
  } catch (error: any) {
    handleApiError(error);
  }
}

export interface CreateEmbeddingResult {
  embedding: number[];
  model: string;
  terpotong: boolean;
}

/**
 * Membuat representasi vector embedding (1536 dimensi) dari teks masukan.
 */
export async function createEmbedding(teks: string): Promise<CreateEmbeddingResult> {
  const model = process.env.OPENAI_EMBEDDING_MODEL;
  if (!model) {
    throw new AiError(
      500,
      "Layanan AI belum dikonfigurasi di server.",
      "OPENAI_EMBEDDING_MODEL belum disetel di file .env"
    );
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new AiError(
      500,
      "Layanan AI belum dikonfigurasi di server.",
      "OPENAI_API_KEY belum disetel di file .env"
    );
  }

  const pemotongan = potongTeks(teks, MAKSIMAL_KARAKTER_EMBEDDING);

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:embedContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          content: { parts: [{ text: pemotongan.teks }] },
          taskType: "RETRIEVAL_DOCUMENT",
          outputDimensionality: EMBEDDING_DIMENSI,
        }),
        signal: AbortSignal.timeout(30000),
      }
    );

    if (!response.ok) {
      const error = new Error("Gemini embedding API request failed");
      Object.assign(error, { status: response.status });
      throw error;
    }

    const result = (await response.json()) as {
      embedding?: { values?: unknown };
      usageMetadata?: { promptTokenCount?: number };
    };
    const embeddingData = result.embedding?.values;

    if (
      !Array.isArray(embeddingData) ||
      !embeddingData.every((value) => typeof value === "number" && Number.isFinite(value))
    ) {
      throw new AiError(
        502,
        "Layanan AI tidak mengembalikan data embedding.",
        "Response embedding kosong atau bukan larik angka"
      );
    }

    if (embeddingData.length !== EMBEDDING_DIMENSI) {
      throw new AiError(
        500,
        "Layanan AI belum dikonfigurasi dengan benar di server.",
        `Dimensi embedding (${embeddingData.length}) tidak sesuai dengan EMBEDDING_DIMENSI (${EMBEDDING_DIMENSI})`
      );
    }

    const tokens = result.usageMetadata?.promptTokenCount ?? "?";
    console.log(`[AI] embedding model=${model}, dimensi=${embeddingData.length}, token=${tokens}`);

    return {
      embedding: embeddingData,
      model,
      terpotong: pemotongan.terpotong,
    };
  } catch (error: any) {
    handleApiError(error);
  }
}

/**
 * Helper untuk mengirim response error AI ke client Express.
 */
export function kirimErrorAi(res: any, err: any) {
  if (err instanceof AiError) {
    res.status(err.status).json({
      success: false,
      message: err.userMessage,
      errors: [],
    });
    return;
  }

  res.status(502).json({
    success: false,
    message: "Terjadi kesalahan pada layanan AI.",
    errors: [],
  });
  return;
}
