import "../helpers/mockAi.js";
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
import {
  hitungRelasiKonsep,
  hitungRelasiSimilar,
} from "../../src/services/relationship.service.js";
import { createTestClient } from "../helpers/client.js";
import {
  cleanupStaleTestAccounts,
  cleanupTestAccounts,
  createTestAccount,
  type TestAccount,
} from "../helpers/testData.js";
import { resetMockAi } from "../helpers/mockAi.js";

const api = createTestClient();
const emails: string[] = [];
let account: TestAccount;

beforeAll(async () => {
  await cleanupStaleTestAccounts();
  account = await createTestAccount("Tes Embedding");
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
    .set("Authorization", `Bearer ${account.token}`)
    .send({ title, content });

  expect(response.status).toBe(201);
  return response.body.data.id as string;
}

async function tungguEmbedding(noteIds: string[]): Promise<void> {
  const batasWaktu = Date.now() + 10_000;
  while (Date.now() < batasWaktu) {
    const embeddings = await prisma.noteEmbedding.findMany({
      where: { noteId: { in: noteIds } },
      select: { noteId: true },
    });
    if (embeddings.length === noteIds.length) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Embedding tiruan tidak tersimpan sebelum batas waktu.");
}

async function tungguRelasiSimilar(noteId: string, otherId: string) {
  const batasWaktu = Date.now() + 10_000;
  while (Date.now() < batasWaktu) {
    const relation = await prisma.noteRelationship.findFirst({
      where: {
        relationshipType: "similar",
        OR: [
          { sourceNoteId: noteId, targetNoteId: otherId },
          { sourceNoteId: otherId, targetNoteId: noteId },
        ],
      },
    });
    if (relation) return relation;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Relasi similar belum terbentuk sebelum batas waktu.");
}

async function simpanEmbedding(noteId: string, vektor: number[]): Promise<void> {
  const teksVektor = `[${vektor.join(",")}]`;
  await prisma.$executeRaw`
    INSERT INTO note_embeddings (note_id, embedding, model)
    VALUES (${noteId}::uuid, ${teksVektor}::vector, 'embedding-tiruan')`;
}

describe("embedding dan relasi", () => {
  it("membuat embedding tiruan dan relasi similar berpasangan kanonis", async () => {
    const firstId = await buatCatatan(
      "JavaScript callback promise",
      "Belajar JavaScript callback promise untuk aplikasi Nalar."
    );
    await tungguEmbedding([firstId]);
    const secondId = await buatCatatan(
      "JavaScript callback promise modern",
      "Belajar JavaScript callback promise pada layanan Nalar."
    );
    await tungguEmbedding([secondId]);

    const relation = await tungguRelasiSimilar(firstId, secondId);

    expect(relation.relationshipType).toBe("similar");
    expect(relation.similarityScore).toBeGreaterThan(0.58);
    expect(relation.sourceNoteId.localeCompare(relation.targetNoteId)).toBeLessThan(0);

    const deleted = await api
      .delete(`/api/v1/notes/${firstId}`)
      .set("Authorization", `Bearer ${account.token}`);
    const embeddings = await prisma.noteEmbedding.count({
      where: { noteId: firstId },
    });
    const relations = await prisma.noteRelationship.count({
      where: { OR: [{ sourceNoteId: firstId }, { targetNoteId: firstId }] },
    });

    expect(deleted.status).toBe(200);
    expect(embeddings).toBe(0);
    expect(relations).toBe(0);
  });

  it("membuat relasi concept dari konsep yang sama", async () => {
    const noteOne = await prisma.note.create({
      data: {
        userId: account.id,
        title: "Catatan domain alfa",
        content: "Isi sintetis untuk konsep bersama.",
      },
      select: { id: true },
    });
    const noteTwo = await prisma.note.create({
      data: {
        userId: account.id,
        title: "Catatan domain beta",
        content: "Isi sintetis berbeda untuk konsep bersama.",
      },
      select: { id: true },
    });
    const concept = await prisma.concept.create({
      data: { userId: account.id, name: `Konsep-${randomUUID().slice(0, 8)}` },
      select: { id: true },
    });
    await prisma.noteConcept.createMany({
      data: [
        { noteId: noteOne.id, conceptId: concept.id },
        { noteId: noteTwo.id, conceptId: concept.id },
      ],
    });

    const created = await hitungRelasiKonsep(account.id, noteOne.id);
    const relation = await prisma.noteRelationship.findFirst({
      where: {
        relationshipType: "concept",
        OR: [
          { sourceNoteId: noteOne.id, targetNoteId: noteTwo.id },
          { sourceNoteId: noteTwo.id, targetNoteId: noteOne.id },
        ],
      },
    });

    expect(created).toBe(1);
    expect(relation).not.toBeNull();
    expect(relation?.similarityScore).toBeNull();
    expect(relation?.sourceNoteId.localeCompare(relation.targetNoteId)).toBeLessThan(0);
  });

  it("membatasi relasi similar maksimal lima per catatan", async () => {
    const noteIds: string[] = [];
    const vector = Array.from({ length: 1536 }, (_, index) =>
      index === 0 ? 1 : 0
    );

    for (let index = 0; index < 7; index += 1) {
      const note = await prisma.note.create({
        data: {
          userId: account.id,
          title: `Catatan padat ${index}`,
          content: `Konten sama untuk relasi ${index}`,
        },
        select: { id: true },
      });
      noteIds.push(note.id);
      await simpanEmbedding(note.id, vector);
    }

    for (const noteId of noteIds) {
      await hitungRelasiSimilar(account.id, noteId);
    }

    const relations = await prisma.noteRelationship.findMany({
      where: {
        relationshipType: "similar",
        OR: [
          { sourceNoteId: { in: noteIds } },
          { targetNoteId: { in: noteIds } },
        ],
      },
      select: { sourceNoteId: true, targetNoteId: true },
    });
    const degree = new Map(noteIds.map((id) => [id, 0]));
    for (const relation of relations) {
      degree.set(relation.sourceNoteId, (degree.get(relation.sourceNoteId) ?? 0) + 1);
      degree.set(relation.targetNoteId, (degree.get(relation.targetNoteId) ?? 0) + 1);
    }

    expect(Math.max(...degree.values())).toBeLessThanOrEqual(5);
  });
});
