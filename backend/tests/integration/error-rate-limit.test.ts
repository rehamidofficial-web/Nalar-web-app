import "../helpers/mockAi.js";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { randomUUID } from "node:crypto";
import { ipKeyGenerator } from "express-rate-limit";
import { prisma } from "../../src/lib/prisma.js";
import { batasAuth } from "../../src/middleware/rateLimit.js";
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
let akunA: TestAccount;
let akunB: TestAccount;

beforeAll(async () => {
  await cleanupStaleTestAccounts();
  akunA = await createTestAccount("Tes Rate Limit A");
  akunB = await createTestAccount("Tes Rate Limit B");
  emails.push(akunA.email, akunB.email);
});

beforeEach(() => {
  resetMockAi();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

afterAll(async () => {
  await cleanupTestAccounts(emails);
});

function denganToken(akun: TestAccount) {
  return { Authorization: `Bearer ${akun.token}` };
}

describe("error HTTP dan pembatas laju", () => {
  it("mengembalikan 404 standar untuk rute yang tidak dikenal", async () => {
    const response = await api.get("/api/v1/rute-yang-tidak-ada");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      success: false,
      message: "Alamat tidak ditemukan.",
    });
  });

  it("memetakan JSON rusak ke 400 dan body terlalu besar ke 413", async () => {
    const invalidJson = await api
      .post("/api/v1/notes")
      .set("Content-Type", "application/json")
      .send('{"title":');
    const oversizedBody = await api
      .post("/api/v1/notes")
      .send({ content: "x".repeat(1024 * 1024 + 1) });

    expect(invalidJson.status).toBe(400);
    expect(invalidJson.body).toEqual({
      success: false,
      message: "Format data yang dikirim tidak valid.",
    });
    expect(oversizedBody.status).toBe(413);
    expect(oversizedBody.body).toEqual({
      success: false,
      message: "Data yang dikirim terlalu besar.",
    });
  });

  it("tidak membocorkan detail error tak terduga dalam mode produksi", async () => {
    const querySpy = vi
      .spyOn(prisma, "$queryRaw")
      .mockRejectedValue(new Error("detail rahasia internal"));
    vi.stubEnv("NODE_ENV", "production");

    const response = await api.get("/api/v1/health/db");

    expect(querySpy).toHaveBeenCalled();
    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      success: false,
      message: "Terjadi kesalahan di server. Coba lagi nanti.",
    });
    expect(JSON.stringify(response.body)).not.toContain("detail rahasia internal");
    expect(JSON.stringify(response.body)).not.toContain("stack");
  });

  it("membatasi login dan mengirim header Retry-After", async () => {
    await batasAuth.resetKey(ipKeyGenerator("127.0.0.1"));
    await batasAuth.resetKey(ipKeyGenerator("::1"));

    const responses = [];
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const response = await api.post("/api/v1/auth/login").send({
        email: `tidak-ada-${attempt}@tes-nalar.invalid`,
        password: randomUUID(),
      });
      responses.push(response);
      if (response.status === 429) break;
    }

    const limited = responses.find((response) => response.status === 429);
    expect(responses.some((response) => response.status === 401)).toBe(true);
    expect(limited).toBeDefined();
    expect(Number(limited?.headers["retry-after"])).toBeGreaterThan(0);
    expect(limited?.body).toMatchObject({ success: false });
  });

  it("membatasi panggilan AI per akun dan tidak menjalankan embedding saat diblokir", async () => {
    const responses = [];
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const response = await api
        .post("/api/v1/ai/ask")
        .set(denganToken(akunA))
        .send({ question: `Pertanyaan akun A ${randomUUID()}` });
      responses.push(response);
      if (response.status === 429) break;
    }

    const limited = responses.find((response) => response.status === 429);
    const acceptedCount = responses.filter(
      (response) => response.status === 200
    ).length;
    expect(acceptedCount).toBeGreaterThan(0);
    expect(limited).toBeDefined();
    expect(Number(limited?.headers["retry-after"])).toBeGreaterThan(0);
    expect(mockCreateEmbedding).toHaveBeenCalledTimes(acceptedCount);
    expect(mockGenerateText).not.toHaveBeenCalled();

    const accountBResponse = await api
      .post("/api/v1/ai/ask")
      .set(denganToken(akunB))
      .send({ question: `Pertanyaan akun B ${randomUUID()}` });

    expect(accountBResponse.status).toBe(200);
    expect(mockCreateEmbedding).toHaveBeenCalledTimes(acceptedCount + 1);
    expect(mockGenerateText).not.toHaveBeenCalled();
  });
});
