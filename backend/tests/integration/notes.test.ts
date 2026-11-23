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
import { createTestClient } from "../helpers/client.js";
import {
  cleanupStaleTestAccounts,
  cleanupTestAccounts,
  createTestAccount,
  type TestAccount,
} from "../helpers/testData.js";
import { resetMockAi } from "../helpers/mockAi.js";
import { resetMockBackgroundEmbedding } from "../helpers/mockBackgroundEmbedding.js";

const api = createTestClient();
const emails: string[] = [];
let account: TestAccount;

beforeAll(async () => {
  await cleanupStaleTestAccounts();
  account = await createTestAccount("Tes Catatan");
  emails.push(account.email);
});

beforeEach(() => {
  resetMockAi();
  resetMockBackgroundEmbedding();
});

afterAll(async () => {
  await cleanupTestAccounts(emails);
});

async function buatCatatan(
  body: Record<string, unknown>,
  token = account.token
) {
  return api.post("/api/v1/notes").set("Authorization", `Bearer ${token}`).send(body);
}

describe("API catatan", () => {
  it("membuat dan mengambil catatan; field mass assignment diabaikan", async () => {
    const injectedId = randomUUID();
    const response = await buatCatatan({
      title: "Catatan Mass Assignment",
      content: "Isi sintetis untuk menguji catatan.",
      tags: [" Aman "],
      id: injectedId,
      userId: randomUUID(),
      embedding: Array.from({ length: 4 }, () => 1),
    });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      success: true,
      data: {
        title: "Catatan Mass Assignment",
        content: "Isi sintetis untuk menguji catatan.",
        tags: ["aman"],
      },
    });
    expect(response.body.data.id).not.toBe(injectedId);
    expect(response.body.data).not.toHaveProperty("userId");
    expect(response.body.data).not.toHaveProperty("embedding");

    const saved = await prisma.note.findUniqueOrThrow({
      where: { id: response.body.data.id },
    });
    expect(saved.userId).toBe(account.id);

    const detail = await api
      .get(`/api/v1/notes/${saved.id}`)
      .set("Authorization", `Bearer ${account.token}`);
    expect(detail.status).toBe(200);
    expect(detail.body).toMatchObject({
      success: true,
      data: { id: saved.id, title: "Catatan Mass Assignment", concepts: [] },
    });
  });

  it("mendukung pagination, filter tag, pencarian kata, dan pengurutan yang diizinkan", async () => {
    const marker = `daftar-${randomUUID()}`;
    const filterTag = `filter-${randomUUID().slice(0, 8)}`;
    for (const title of ["zulu", "alpha", "beta"]) {
      const response = await buatCatatan({
        title: `${marker}-${title}`,
        content: `Isi ${marker} untuk pencarian.`,
        tags: title === "zulu" ? [filterTag] : [filterTag, "umum"],
      });
      expect(response.status).toBe(201);
    }

    const pageOne = await api
      .get(`/api/v1/notes?search=${marker}&page=1&limit=2&sort=judul`)
      .set("Authorization", `Bearer ${account.token}`);
    const pageTwo = await api
      .get(`/api/v1/notes?search=${marker}&page=2&limit=2&sort=judul`)
      .set("Authorization", `Bearer ${account.token}`);
    const filtered = await api
      .get(`/api/v1/notes?tag=${filterTag}`)
      .set("Authorization", `Bearer ${account.token}`);
    const invalidSort = await api
      .get(`/api/v1/notes?sort=${encodeURIComponent("judul;DROP TABLE notes")}`)
      .set("Authorization", `Bearer ${account.token}`);

    expect(pageOne.status).toBe(200);
    expect(pageOne.body).toMatchObject({
      success: true,
      data: {
        items: [
          { title: `${marker}-alpha` },
          { title: `${marker}-beta` },
        ],
        pagination: { page: 1, limit: 2, total: 3, totalPages: 2 },
      },
    });
    expect(pageTwo.status).toBe(200);
    expect(pageTwo.body.data.items.map((item: { title: string }) => item.title)).toEqual([
      `${marker}-zulu`,
    ]);
    expect(filtered.status).toBe(200);
    expect(filtered.body.data.pagination.total).toBe(3);
    expect(invalidSort.status).toBe(422);
    expect(invalidSort.body).toMatchObject({ success: false, errors: expect.any(Array) });
  });

  it("membersihkan tag dan menghapus embedding lama saat judul berubah", async () => {
    const created = await buatCatatan({
      title: "Catatan Embedding Lama",
      content: "Isi awal yang akan diperbarui.",
      tags: ["awal"],
    });
    const noteId = created.body.data.id as string;
    const vektor = `[${Array.from({ length: 1536 }, () => "0").join(",")}]`;
    await prisma.note.update({
      where: { id: noteId },
      data: { summary: "Ringkasan lama" },
    });
    await prisma.$executeRaw`
      INSERT INTO note_embeddings (note_id, embedding, model)
      VALUES (${noteId}::uuid, ${vektor}::vector, 'tes')`;

    const updateTag = await api
      .patch(`/api/v1/notes/${noteId}`)
      .set("Authorization", `Bearer ${account.token}`)
      .send({ tags: [" Baru ", "BARU"] });
    const updateJudul = await api
      .patch(`/api/v1/notes/${noteId}`)
      .set("Authorization", `Bearer ${account.token}`)
      .send({ title: "Judul Baru" });
    const embeddings = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) AS count FROM note_embeddings WHERE note_id = ${noteId}::uuid`;

    expect(updateTag.status).toBe(200);
    expect(updateTag.body.data.tags).toEqual(["baru"]);
    expect(updateJudul.status).toBe(200);
    expect(updateJudul.body.data.title).toBe("Judul Baru");
    expect(Number(embeddings[0]?.count ?? 0)).toBe(0);
  });

  it("mengembalikan tag milik pengguna dan menghapus catatan dengan 200 JSON", async () => {
    const tag = `hapus-${randomUUID().slice(0, 8)}`;
    const created = await buatCatatan({
      title: "Catatan Hapus",
      content: "Catatan yang akan dihapus.",
      tags: [tag],
    });
    const noteId = created.body.data.id as string;

    const tags = await api
      .get("/api/v1/notes/tags")
      .set("Authorization", `Bearer ${account.token}`);
    const deleted = await api
      .delete(`/api/v1/notes/${noteId}`)
      .set("Authorization", `Bearer ${account.token}`);
    const tagsAfterDelete = await api
      .get("/api/v1/notes/tags")
      .set("Authorization", `Bearer ${account.token}`);

    expect(tags.status).toBe(200);
    expect(tags.body).toMatchObject({ success: true, data: { tags: expect.any(Array) } });
    expect(tags.body.data.tags.map((item: { tag: string }) => item.tag)).toContain(tag);
    expect(deleted.status).toBe(200);
    expect(deleted.body).toEqual({ success: true, message: "Catatan berhasil dihapus" });
    expect(tagsAfterDelete.status).toBe(200);
    expect(tagsAfterDelete.body.data.tags.map((item: { tag: string }) => item.tag)).not.toContain(tag);
  });

  it("menolak input catatan, tag, query, dan ID di luar batas", async () => {
    const invalidTitle = await buatCatatan({ title: " ", content: "Isi valid" });
    const longTitle = await buatCatatan({ title: "x".repeat(256), content: "Isi valid" });
    const longContent = await buatCatatan({
      title: "Judul valid",
      content: "x".repeat(50_001),
    });
    const tooManyTags = await buatCatatan({
      title: "Judul tag",
      content: "Isi valid",
      tags: Array.from({ length: 11 }, (_, index) => `tag-${index}`),
    });
    const blankTag = await buatCatatan({
      title: "Judul tag kosong",
      content: "Isi valid",
      tags: ["   "],
    });
    const badPage = await api
      .get("/api/v1/notes?page=10001")
      .set("Authorization", `Bearer ${account.token}`);
    const badLimit = await api
      .get("/api/v1/notes?limit=51")
      .set("Authorization", `Bearer ${account.token}`);
    const badSearch = await api
      .get(`/api/v1/notes?search=${"x".repeat(101)}`)
      .set("Authorization", `Bearer ${account.token}`);
    const invalidId = await api
      .get("/api/v1/notes/bukan-uuid")
      .set("Authorization", `Bearer ${account.token}`);

    for (const response of [
      invalidTitle,
      longTitle,
      longContent,
      tooManyTags,
      blankTag,
      badPage,
      badLimit,
      badSearch,
    ]) {
      expect(response.status).toBe(422);
      expect(response.body).toMatchObject({ success: false, errors: expect.any(Array) });
    }
    expect(invalidId.status).toBe(404);
    expect(invalidId.body).toEqual({
      success: false,
      message: "Catatan tidak ditemukan",
      errors: [],
    });
  });
});
