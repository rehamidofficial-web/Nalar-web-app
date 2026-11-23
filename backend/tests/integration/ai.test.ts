import "../helpers/mockAi.js";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";
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
  mockGenerateText,
  resetMockAi,
} from "../helpers/mockAi.js";

const api = createTestClient();
const emails: string[] = [];
let account: TestAccount;
const auth = () => ({ Authorization: `Bearer ${account.token}` });
const contentPanjang =
  "Catatan sintetis ini membahas proses belajar, gagasan utama, dan hubungan antar konsep. ".repeat(
    2
  );

beforeAll(async () => {
  await cleanupStaleTestAccounts();
  account = await createTestAccount("Tes AI");
  emails.push(account.email);
});

beforeEach(() => {
  resetMockAi();
  mockCreateEmbedding.mockRejectedValue(new Error("Embedding sengaja gagal di tes."));
});

afterAll(async () => {
  await cleanupTestAccounts(emails);
});

async function buatCatatan(title: string) {
  const response = await api
    .post("/api/v1/notes")
    .set(auth())
    .send({ title, content: contentPanjang });
  expect(response.status).toBe(201);
  return response.body.data.id as string;
}

describe("ringkasan dan konsep dengan AI tiruan", () => {
  it("menyimpan ringkasan hasil mock dan mengembalikannya", async () => {
    const noteId = await buatCatatan("Catatan Ringkasan");

    const response = await api
      .post("/api/v1/ai/summarize")
      .set(auth())
      .send({ noteId });
    const saved = await prisma.note.findUniqueOrThrow({ where: { id: noteId } });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      data: { noteId, summary: "Jawaban tiruan untuk tes.", model: "chat-tiruan" },
    });
    expect(saved.summary).toBe("Jawaban tiruan untuk tes.");
    expect(mockGenerateText).toHaveBeenCalledTimes(1);
  });

  it("membersihkan nama konsep, menghapus duplikat, dan menyimpan relasinya", async () => {
    const noteId = await buatCatatan("Catatan Konsep");
    mockGenerateText.mockResolvedValueOnce({
      text: JSON.stringify({
        concepts: [
          { name: "  JavaScript   Aman ", description: " Deskripsi aman. " },
          { name: "javascript aman", description: "Duplikat." },
          { name: "Testing", description: " Tes unit. " },
        ],
      }),
      model: "chat-tiruan",
      terpotong: false,
    });

    const response = await api
      .post("/api/v1/ai/extract-concepts")
      .set(auth())
      .send({ noteId });
    const savedConcepts = await prisma.noteConcept.findMany({
      where: { noteId },
      include: { concept: true },
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      data: {
        concepts: [
          { name: "JavaScript Aman", description: "Deskripsi aman." },
          { name: "Testing", description: "Tes unit." },
        ],
      },
    });
    expect(savedConcepts).toHaveLength(2);
    expect(savedConcepts.map((item) => item.concept.name).sort()).toEqual([
      "JavaScript Aman",
      "Testing",
    ]);
  });

  it("memetakan kuota habis dan JSON rusak ke error standar tanpa mengubah catatan", async () => {
    const noteId = await buatCatatan("Catatan AI Gagal");
    mockGenerateText.mockRejectedValueOnce(
      new AiError(429, "Kuota AI habis.")
    );

    const quota = await api
      .post("/api/v1/ai/summarize")
      .set(auth())
      .send({ noteId });
    mockGenerateText.mockResolvedValueOnce({
      text: "{ JSON rusak",
      model: "chat-tiruan",
      terpotong: false,
    });
    const malformedJson = await api
      .post("/api/v1/ai/extract-concepts")
      .set(auth())
      .send({ noteId });
    const saved = await prisma.note.findUniqueOrThrow({ where: { id: noteId } });

    expect(quota.status).toBe(429);
    expect(quota.body).toMatchObject({ success: false, message: "Kuota AI habis." });
    expect(malformedJson.status).toBe(502);
    expect(malformedJson.body).toMatchObject({
      success: false,
      message: "AI tidak menghasilkan konsep yang valid. Coba lagi.",
      errors: [],
    });
    expect(saved.summary).toBeNull();
    expect(
      await prisma.noteConcept.count({ where: { noteId } })
    ).toBe(0);
  });

  it("tetap menyimpan catatan ketika pembuatan embedding gagal", async () => {
    const response = await api
      .post("/api/v1/notes")
      .set(auth())
      .send({ title: "Catatan Tanpa Embedding", content: "Isi tetap tersimpan." });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(
      await prisma.note.findUnique({ where: { id: response.body.data.id } })
    ).not.toBeNull();
    expect(mockCreateEmbedding).toHaveBeenCalled();
  });
});
