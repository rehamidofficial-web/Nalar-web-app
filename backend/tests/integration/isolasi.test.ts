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
import { mockCreateEmbedding, mockGenerateText, resetMockAi } from "../helpers/mockAi.js";
import { resetMockBackgroundEmbedding } from "../helpers/mockBackgroundEmbedding.js";

const api = createTestClient();
const emails: string[] = [];
let akunA: TestAccount;
let akunB: TestAccount;
let noteAId: string;
let noteBId: string;
let conversationAId: string;
let markerA: string;
let markerB: string;
let tagA: string;

beforeAll(async () => {
  await cleanupStaleTestAccounts();
  akunA = await createTestAccount("Akun Isolasi A");
  akunB = await createTestAccount("Akun Isolasi B");
  emails.push(akunA.email, akunB.email);

  const suffix = randomUUID().replace(/-/g, "");
  markerA = `pribadi-a-${suffix}`;
  markerB = `pribadi-b-${suffix}`;
  tagA = `tag-a-${suffix.slice(0, 8)}`;

  const noteA = await api
    .post("/api/v1/notes")
    .set("Authorization", `Bearer ${akunA.token}`)
    .send({
      title: markerA,
      content: `Catatan async pribadi milik A ${suffix}.`,
      tags: [tagA],
    });
  const noteB = await api
    .post("/api/v1/notes")
    .set("Authorization", `Bearer ${akunB.token}`)
    .send({
      title: markerB,
      content: `Catatan privat milik B ${suffix}.`,
      tags: [`tag-b-${suffix.slice(0, 8)}`],
    });

  noteAId = noteA.body.data.id as string;
  noteBId = noteB.body.data.id as string;
  await prisma.note.update({
    where: { id: noteAId },
    data: { summary: `Ringkasan rahasia ${markerA}` },
  });
  const concept = await prisma.concept.create({
    data: {
      userId: akunA.id,
      name: `Konsep ${suffix.slice(0, 8)}`,
      description: `Konsep privat ${markerA}`,
    },
  });
  await prisma.noteConcept.create({
    data: { noteId: noteAId, conceptId: concept.id },
  });
  const conversation = await prisma.aiConversation.create({
    data: { userId: akunA.id, title: `Percakapan ${markerA}` },
  });
  conversationAId = conversation.id;
  await prisma.aiMessage.create({
    data: {
      conversationId: conversationAId,
      role: "user",
      content: `Pertanyaan privat ${markerA}`,
    },
  });
});

beforeEach(() => {
  resetMockAi();
  resetMockBackgroundEmbedding();
});

afterAll(async () => {
  await cleanupTestAccounts(emails);
});

function denganTokenB(request: ReturnType<typeof api.get>) {
  return request.set("Authorization", `Bearer ${akunB.token}`);
}

describe("isolasi data antar pengguna", () => {
  it("memberi 404 yang sama untuk catatan asing dan ID acak", async () => {
    const randomId = randomUUID();
    const getForeign = await denganTokenB(api.get(`/api/v1/notes/${noteAId}`));
    const getMissing = await denganTokenB(api.get(`/api/v1/notes/${randomId}`));
    const patchForeign = await denganTokenB(
      api.patch(`/api/v1/notes/${noteAId}`).send({ title: "Tidak boleh berubah" })
    );
    const patchMissing = await denganTokenB(
      api.patch(`/api/v1/notes/${randomId}`).send({ title: "Tidak boleh berubah" })
    );
    const deleteForeign = await denganTokenB(api.delete(`/api/v1/notes/${noteAId}`));
    const deleteMissing = await denganTokenB(api.delete(`/api/v1/notes/${randomId}`));

    for (const [foreign, missing] of [
      [getForeign, getMissing],
      [patchForeign, patchMissing],
      [deleteForeign, deleteMissing],
    ] as const) {
      expect(foreign.status).toBe(404);
      expect(missing.status).toBe(404);
      expect(foreign.body).toEqual(missing.body);
    }

    expect(await prisma.note.findUnique({ where: { id: noteAId } })).not.toBeNull();
  });

  it("menolak akses graph, ringkasan, konsep, dan merge sebelum memanggil AI", async () => {
    const randomId = randomUUID();
    const graphForeign = await denganTokenB(api.get(`/api/v1/graph/${noteAId}`));
    const graphMissing = await denganTokenB(api.get(`/api/v1/graph/${randomId}`));
    const summaryForeign = await denganTokenB(
      api.post("/api/v1/ai/summarize").send({ noteId: noteAId })
    );
    const summaryMissing = await denganTokenB(
      api.post("/api/v1/ai/summarize").send({ noteId: randomId })
    );
    const conceptsForeign = await denganTokenB(
      api.post("/api/v1/ai/extract-concepts").send({ noteId: noteAId })
    );
    const conceptsMissing = await denganTokenB(
      api.post("/api/v1/ai/extract-concepts").send({ noteId: randomId })
    );
    const previewForeign = await denganTokenB(
      api.post("/api/v1/ai/merge-preview").send({ noteIds: [noteAId, randomId] })
    );
    const previewMissing = await denganTokenB(
      api.post("/api/v1/ai/merge-preview").send({
        noteIds: [randomUUID(), randomUUID()],
      })
    );
    const mergeBody = {
      title: "Gabungan B",
      content: "Isi gabungan akun B.",
      sourceNoteIds: [noteAId, randomId],
      hapusAsli: false,
    };
    const mergeForeign = await denganTokenB(api.post("/api/v1/notes/merge").send(mergeBody));
    const mergeMissing = await denganTokenB(
      api.post("/api/v1/notes/merge").send({
        ...mergeBody,
        sourceNoteIds: [randomUUID(), randomUUID()],
      })
    );

    for (const [foreign, missing] of [
      [graphForeign, graphMissing],
      [summaryForeign, summaryMissing],
      [conceptsForeign, conceptsMissing],
      [previewForeign, previewMissing],
      [mergeForeign, mergeMissing],
    ] as const) {
      expect(foreign.status).toBe(404);
      expect(missing.status).toBe(404);
      expect(foreign.body).toEqual(missing.body);
    }
    expect(mockCreateEmbedding).not.toHaveBeenCalled();
    expect(mockGenerateText).not.toHaveBeenCalled();
    expect(await prisma.note.findUnique({ where: { id: noteAId } })).not.toBeNull();
  });

  it("menyamakan akses percakapan asing dengan ID yang tidak ada", async () => {
    const randomId = randomUUID();
    const detailForeign = await denganTokenB(
      api.get(`/api/v1/ai/conversations/${conversationAId}`)
    );
    const detailMissing = await denganTokenB(
      api.get(`/api/v1/ai/conversations/${randomId}`)
    );
    const deleteForeign = await denganTokenB(
      api.delete(`/api/v1/ai/conversations/${conversationAId}`)
    );
    const deleteMissing = await denganTokenB(
      api.delete(`/api/v1/ai/conversations/${randomId}`)
    );
    const askForeign = await denganTokenB(
      api.post("/api/v1/ai/ask").send({
        conversationId: conversationAId,
        question: "Pertanyaan tes",
      })
    );
    const askMissing = await denganTokenB(
      api.post("/api/v1/ai/ask").send({
        conversationId: randomId,
        question: "Pertanyaan tes",
      })
    );

    for (const [foreign, missing] of [
      [detailForeign, detailMissing],
      [deleteForeign, deleteMissing],
      [askForeign, askMissing],
    ] as const) {
      expect(foreign.status).toBe(404);
      expect(missing.status).toBe(404);
      expect(foreign.body).toEqual(missing.body);
    }
    expect(mockCreateEmbedding).not.toHaveBeenCalled();
    expect(mockGenerateText).not.toHaveBeenCalled();
  });

  it("tidak membocorkan catatan A melalui daftar, pencarian, graph, dashboard, tag, atau koreksi typo B", async () => {
    const auth = { Authorization: `Bearer ${akunB.token}` };
    const list = await api.get("/api/v1/notes").set(auth);
    const keywordList = await api
      .get(`/api/v1/notes?search=${encodeURIComponent(markerA)}`)
      .set(auth);
    const search = await api
      .get(`/api/v1/search?q=${encodeURIComponent(markerA)}`)
      .set(auth);
    const graph = await api.get("/api/v1/graph").set(auth);
    const dashboard = await api.get("/api/v1/dashboard/stats").set(auth);
    const recent = await api.get("/api/v1/dashboard/recent-notes").set(auth);
    const tags = await api.get("/api/v1/notes/tags").set(auth);
    const typo = await api.get("/api/v1/search?q=asyc").set(auth);
    const conversations = await api.get("/api/v1/ai/conversations").set(auth);

    expect(list.status).toBe(200);
    expect(keywordList.status).toBe(200);
    expect(keywordList.body.data.items).toHaveLength(0);
    expect(search.status).toBe(200);
    expect(search.body.data.results.map((item: { noteId: string }) => item.noteId)).not.toContain(
      noteAId
    );
    expect(graph.status).toBe(200);
    expect(graph.body.data.nodes.map((item: { id: string }) => item.id)).toEqual([noteBId]);
    expect(JSON.stringify(graph.body)).not.toContain(markerA);
    expect(dashboard.status).toBe(200);
    expect(dashboard.body.data.totalNotes).toBe(1);
    expect(recent.status).toBe(200);
    expect(JSON.stringify(recent.body)).not.toContain(markerA);
    expect(tags.status).toBe(200);
    expect(tags.body.data.tags.map((item: { tag: string }) => item.tag)).not.toContain(tagA);
    expect(typo.status).toBe(200);
    expect(typo.body.data.koreksi).toBeNull();
    expect(conversations.status).toBe(200);
    expect(JSON.stringify(conversations.body)).not.toContain(markerA);
  });
});
