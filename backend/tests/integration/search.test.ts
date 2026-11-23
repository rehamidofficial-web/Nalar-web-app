import "../helpers/mockAi.js";
import "../helpers/mockBackgroundEmbedding.js";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "../../src/lib/prisma.js";
import { AiError } from "../../src/services/ai.service.js";
import { createTestClient } from "../helpers/client.js";
import {
  cleanupStaleTestAccounts,
  cleanupTestAccounts,
  createTestAccount,
  type TestAccount,
} from "../helpers/testData.js";
import {
  mockCreateEmbedding,
  resetMockAi,
} from "../helpers/mockAi.js";

const api = createTestClient();
const emails: string[] = [];
let account: TestAccount;
const auth = () => ({ Authorization: `Bearer ${account.token}` });
const dimensions = 1536;

beforeAll(async () => {
  await cleanupStaleTestAccounts();
  account = await createTestAccount("Tes Pencarian");
  emails.push(account.email);
});

beforeEach(() => {
  resetMockAi();
});

afterAll(async () => {
  await cleanupTestAccounts(emails);
});

async function buatCatatan(title: string, content: string): Promise<string> {
  const response = await api
    .post("/api/v1/notes")
    .set(auth())
    .send({ title, content });
  expect(response.status).toBe(201);
  return response.body.data.id as string;
}

async function masukkanVektor(noteId: string, vector: number[]): Promise<void> {
  const value = `[${vector.join(",")}]`;
  await prisma.$executeRaw`
    INSERT INTO note_embeddings (note_id, embedding, model)
    VALUES (${noteId}::uuid, ${value}::vector, 'embedding-tiruan')`;
}

describe("pencarian catatan", () => {
  it("mengurutkan hasil makna berdasarkan skor dan menghitung catatan belum diindeks", async () => {
    const marker = randomUUID().slice(0, 8);
    const exactId = await buatCatatan(`Makna exact ${marker}`, "Isi pertama.");
    const closeId = await buatCatatan(`Makna dekat ${marker}`, "Isi kedua.");
    await buatCatatan(`Makna tanpa indeks ${marker}`, "Isi ketiga.");
    const exactVector = Array.from({ length: dimensions }, (_, index) =>
      index === 0 ? 1 : 0
    );
    const closeVector = Array.from({ length: dimensions }, (_, index) =>
      index === 0 ? 0.8 : index === 1 ? 0.6 : 0
    );
    await masukkanVektor(exactId, exactVector);
    await masukkanVektor(closeId, closeVector);
    mockCreateEmbedding.mockResolvedValueOnce({
      embedding: exactVector,
      model: "embedding-tiruan",
      terpotong: false,
    });

    const response = await api
      .get(`/api/v1/search?q=${encodeURIComponent(`makna ${marker}`)}`)
      .set(auth());

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      data: { mode: "makna", belumDiindeks: 1 },
    });
    expect(response.body.data.results.map((item: { noteId: string }) => item.noteId)).toEqual([
      exactId,
      closeId,
    ]);
    expect(response.body.data.results[0].similarity).toBeGreaterThan(
      response.body.data.results[1].similarity
    );
  });

  it("beralih ke pencarian kata saat embedding gagal", async () => {
    const marker = `fallback-${randomUUID().slice(0, 8)}`;
    const noteId = await buatCatatan(`Judul ${marker}`, `Isi ${marker}.`);
    mockCreateEmbedding.mockRejectedValueOnce(
      new AiError(429, "Kuota AI habis.")
    );

    const response = await api
      .get(`/api/v1/search?q=${encodeURIComponent(marker)}`)
      .set(auth());

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      message: "Pencarian makna sedang tidak tersedia, menampilkan pencarian kata biasa.",
      data: { mode: "kata", koreksi: null },
    });
    expect(response.body.data.results[0].noteId).toBe(noteId);
  });

  it("mengoreksi typo dari kamus pengguna dan memberi null jika tidak ada perubahan", async () => {
    await buatCatatan(
      "Async callbacks",
      "Async callback membantu mengatur proses. Async digunakan bersama callback."
    );

    const corrected = await api.get("/api/v1/search?q=asyc").set(auth());
    const unchanged = await api.get("/api/v1/search?q=async").set(auth());

    expect(corrected.status).toBe(200);
    expect(corrected.body.data.koreksi).toMatchObject({
      asli: "asyc",
      dipakai: "async",
      perubahan: [{ dari: "asyc", ke: "async" }],
    });
    expect(unchanged.status).toBe(200);
    expect(unchanged.body.data.koreksi).toBeNull();
  });

  it("menggunakan cache embedding untuk kueri yang sama", async () => {
    const query = `cache-${randomUUID().slice(0, 8)}`;

    const first = await api
      .get(`/api/v1/search?q=${encodeURIComponent(query)}`)
      .set(auth());
    const second = await api
      .get(`/api/v1/search?q=${encodeURIComponent(query)}`)
      .set(auth());

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(mockCreateEmbedding).toHaveBeenCalledTimes(1);
  });

  it("menolak kueri kosong dan terlalu panjang sebelum membuat embedding", async () => {
    const empty = await api.get("/api/v1/search?q=").set(auth());
    const long = await api
      .get(`/api/v1/search?q=${"x".repeat(201)}`)
      .set(auth());

    expect(empty.status).toBe(422);
    expect(empty.body).toMatchObject({ success: false, errors: expect.any(Array) });
    expect(long.status).toBe(422);
    expect(long.body).toMatchObject({ success: false, errors: expect.any(Array) });
    expect(mockCreateEmbedding).not.toHaveBeenCalled();
  });
});
