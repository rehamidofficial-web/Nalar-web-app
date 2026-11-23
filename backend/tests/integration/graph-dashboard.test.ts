import "../helpers/mockAi.js";
import "../helpers/mockBackgroundEmbedding.js";
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
} from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "../../src/lib/prisma.js";
import { urutkanPasangan } from "../../src/services/relationship.service.js";
import { createTestClient } from "../helpers/client.js";
import {
  cleanupStaleTestAccounts,
  cleanupTestAccounts,
  createTestAccount,
  type TestAccount,
} from "../helpers/testData.js";

const api = createTestClient();
const emails: string[] = [];
let account: TestAccount;
let noteOneId: string;
let noteTwoId: string;
let noteThreeId: string;
let tagOne: string;
let tagTwo: string;

beforeAll(async () => {
  await cleanupStaleTestAccounts();
  account = await createTestAccount("Tes Graph");
  emails.push(account.email);
  const suffix = randomUUID().slice(0, 8);
  tagOne = `graph-a-${suffix}`;
  tagTwo = `graph-b-${suffix}`;

  const createNote = async (title: string, tags: string[]) => {
    const response = await api
      .post("/api/v1/notes")
      .set("Authorization", `Bearer ${account.token}`)
      .send({ title, content: `Isi ${title}`, tags });
    expect(response.status).toBe(201);
    return response.body.data.id as string;
  };

  noteOneId = await createNote("Graph Satu", [tagOne]);
  noteTwoId = await createNote("Graph Dua", [tagTwo]);
  noteThreeId = await createNote("Graph Tiga", [tagOne, tagTwo]);

  const concept = await prisma.concept.create({
    data: { userId: account.id, name: `Konsep Graph ${suffix}` },
    select: { id: true },
  });
  await prisma.noteConcept.createMany({
    data: [
      { noteId: noteOneId, conceptId: concept.id },
      { noteId: noteThreeId, conceptId: concept.id },
    ],
  });
  const similarPair = urutkanPasangan(noteOneId, noteTwoId);
  const conceptPair = urutkanPasangan(noteOneId, noteThreeId);
  await prisma.noteRelationship.createMany({
    data: [
      {
        sourceNoteId: similarPair.source,
        targetNoteId: similarPair.target,
        relationshipType: "similar",
        similarityScore: 0.7,
      },
      {
        sourceNoteId: conceptPair.source,
        targetNoteId: conceptPair.target,
        relationshipType: "concept",
      },
    ],
  });
});

afterAll(async () => {
  await cleanupTestAccounts(emails);
});

const auth = () => ({ Authorization: `Bearer ${account.token}` });

describe("graph dan dashboard", () => {
  it("menampilkan graph milik pengguna dengan filter jenis, skor, dan tag", async () => {
    const graph = await api.get("/api/v1/graph").set(auth());
    const onlySimilar = await api
      .get("/api/v1/graph?tipe=similar&skorMin=0.75")
      .set(auth());
    const byTag = await api
      .get(`/api/v1/graph?tag=${tagOne}`)
      .set(auth());

    expect(graph.status).toBe(200);
    expect(graph.body).toMatchObject({
      success: true,
      data: {
        meta: { totalCatatan: 3, jumlahNode: 3, jumlahEdge: 2 },
      },
    });
    expect(graph.body.data.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "similar", similarity: 0.7 }),
        expect.objectContaining({ type: "concept", similarity: null }),
      ])
    );
    expect(onlySimilar.status).toBe(200);
    expect(onlySimilar.body.data.edges).toHaveLength(0);
    expect(byTag.status).toBe(200);
    expect(byTag.body.data.nodes.map((node: { id: string }) => node.id).sort()).toEqual(
      [noteOneId, noteThreeId].sort()
    );
  });

  it("memuat subgraph catatan pusat beserta tetangga yang sesuai filter", async () => {
    const response = await api
      .get(`/api/v1/graph/${noteOneId}?tipe=concept`)
      .set(auth());

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      data: {
        pusat: noteOneId,
        meta: { jumlahNode: 2, jumlahEdge: 1 },
      },
    });
    expect(response.body.data.nodes.map((node: { id: string }) => node.id).sort()).toEqual(
      [noteOneId, noteThreeId].sort()
    );
  });

  it("menghitung dashboard sebelum dan sesudah catatan dihapus", async () => {
    const before = await api.get("/api/v1/dashboard/stats").set(auth());
    const deleted = await api
      .delete(`/api/v1/notes/${noteTwoId}`)
      .set(auth());
    const after = await api.get("/api/v1/dashboard/stats").set(auth());
    const recent = await api.get("/api/v1/dashboard/recent-notes").set(auth());

    expect(before.status).toBe(200);
    expect(before.body).toMatchObject({
      success: true,
      data: { totalNotes: 3, totalConcepts: 1, totalRelationships: 2 },
    });
    expect(deleted.status).toBe(200);
    expect(after.status).toBe(200);
    expect(after.body).toMatchObject({
      success: true,
      data: { totalNotes: 2, totalConcepts: 1, totalRelationships: 1 },
    });
    expect(recent.status).toBe(200);
    expect(recent.body.data.items.map((item: { id: string }) => item.id)).not.toContain(
      noteTwoId
    );
  });
});
