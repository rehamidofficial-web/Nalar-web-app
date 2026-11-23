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
const dimensi = 1536;
let akunA: TestAccount;
let akunB: TestAccount;

beforeAll(async () => {
  await cleanupStaleTestAccounts();
});

beforeEach(async () => {
  akunA = await createTestAccount("Tes Merge A");
  akunB = await createTestAccount("Tes Merge B");
  emails.push(akunA.email, akunB.email);
  resetMockAi();
  resetMockBackgroundEmbedding();
});

afterAll(async () => {
  await cleanupTestAccounts(emails);
});

async function buatCatatan(
  userId: string,
  title: string,
  content: string,
  tags: string[] = []
): Promise<string> {
  const note = await prisma.note.create({
    data: { userId, title, content, tags },
    select: { id: true },
  });
  return note.id;
}

async function masukkanEmbedding(noteId: string): Promise<void> {
  const vector = Array.from({ length: dimensi }, (_, index) =>
    index === 0 ? 1 : 0
  );
  const teksVektor = `[${vector.join(",")}]`;
  await prisma.$executeRaw`
    INSERT INTO note_embeddings (note_id, embedding, model)
    VALUES (${noteId}::uuid, ${teksVektor}::vector, 'embedding-tiruan')`;
}

function denganToken(akun: TestAccount) {
  return { Authorization: `Bearer ${akun.token}` };
}

describe("penggabungan catatan", () => {
  it("menerima 2 sampai 5 sumber, menggabungkan tag, dan tidak menyimpan preview", async () => {
    const noteIds: string[] = [];
    for (let index = 0; index < 5; index += 1) {
      noteIds.push(
        await buatCatatan(
          akunA.id,
          `Catatan sumber ${index}`,
          `Isi sumber ${index}.`,
          ["tag-bersama", `tag-${index}-a`, `tag-${index}-b`, `tag-${index}-c`]
        )
      );
    }

    const countBefore = await prisma.note.count({
      where: { userId: akunA.id },
    });
    const previewTwo = await api
      .post("/api/v1/ai/merge-preview")
      .set(denganToken(akunA))
      .send({ noteIds: noteIds.slice(0, 2) });
    const previewFive = await api
      .post("/api/v1/ai/merge-preview")
      .set(denganToken(akunA))
      .send({ noteIds });

    expect(previewTwo.status).toBe(200);
    expect(previewTwo.body).toMatchObject({
      success: true,
      data: {
        title: "Catatan Gabungan",
        content: "Isi gabungan.",
        sumber: [
          { noteId: noteIds[0], title: "Catatan sumber 0" },
          { noteId: noteIds[1], title: "Catatan sumber 1" },
        ],
      },
    });
    expect(previewFive.status).toBe(200);
    expect(previewFive.body.data.sumber).toHaveLength(5);
    expect(previewFive.body.data.tags).toHaveLength(10);
    expect(new Set(previewFive.body.data.tags).size).toBe(10);
    expect(previewFive.body.data.tags[0]).toBe("tag-bersama");
    expect(
      await prisma.note.count({ where: { userId: akunA.id } })
    ).toBe(countBefore);
  });

  it("menolak jumlah sumber kurang dari dua atau lebih dari lima", async () => {
    const noteIds: string[] = [];
    for (let index = 0; index < 6; index += 1) {
      noteIds.push(
        await buatCatatan(akunA.id, `Catatan ${index}`, `Isi ${index}.`)
      );
    }

    const tooFew = await api
      .post("/api/v1/ai/merge-preview")
      .set(denganToken(akunA))
      .send({ noteIds: noteIds.slice(0, 1) });
    const tooMany = await api
      .post("/api/v1/ai/merge-preview")
      .set(denganToken(akunA))
      .send({ noteIds });

    expect(tooFew.status).toBe(422);
    expect(tooFew.body).toMatchObject({
      success: false,
      errors: expect.any(Array),
    });
    expect(tooMany.status).toBe(422);
    expect(tooMany.body).toMatchObject({
      success: false,
      errors: expect.any(Array),
    });
  });

  it("memberi 404 yang sama untuk sumber milik akun lain dan ID acak", async () => {
    const ownId = await buatCatatan(akunA.id, "Sumber sendiri", "Isi sendiri.");
    const foreignId = await buatCatatan(
      akunB.id,
      "Sumber asing",
      "Isi milik akun lain."
    );
    const foreign = await api
      .post("/api/v1/ai/merge-preview")
      .set(denganToken(akunA))
      .send({ noteIds: [ownId, foreignId] });
    const missing = await api
      .post("/api/v1/ai/merge-preview")
      .set(denganToken(akunA))
      .send({ noteIds: [ownId, randomUUID()] });

    expect(foreign.status).toBe(404);
    expect(missing.status).toBe(404);
    expect(foreign.body).toEqual(missing.body);
  });

  it("menolak total isi sumber yang melebihi 12.000 karakter", async () => {
    const firstId = await buatCatatan(
      akunA.id,
      "Catatan panjang satu",
      "a".repeat(6001)
    );
    const secondId = await buatCatatan(
      akunA.id,
      "Catatan panjang dua",
      "b".repeat(6001)
    );

    const response = await api
      .post("/api/v1/ai/merge-preview")
      .set(denganToken(akunA))
      .send({ noteIds: [firstId, secondId] });

    expect(response.status).toBe(422);
    expect(response.body).toMatchObject({
      success: false,
      errors: [
        expect.objectContaining({ field: "noteIds" }),
      ],
    });
  });

  it("menyimpan catatan gabungan dan mempertahankan sumber jika hapusAsli false", async () => {
    const sourceIds = [
      await buatCatatan(akunA.id, "Sumber satu", "Isi satu."),
      await buatCatatan(akunA.id, "Sumber dua", "Isi dua."),
    ];

    const response = await api
      .post("/api/v1/notes/merge")
      .set(denganToken(akunA))
      .send({
        title: "Catatan baru",
        content: "Konten gabungan",
        tags: ["gabungan", "tes"],
        sourceNoteIds: sourceIds,
        hapusAsli: false,
      });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      success: true,
      data: {
        title: "Catatan baru",
        content: "Konten gabungan",
        tags: ["gabungan", "tes"],
      },
    });
    expect(
      await prisma.note.count({
        where: { id: { in: sourceIds }, userId: akunA.id },
      })
    ).toBe(2);
    expect(
      await prisma.note.findUnique({
        where: { id: response.body.data.id as string },
      })
    ).not.toBeNull();
  });

  it("menghapus sumber beserta embedding dan relasi jika hapusAsli true", async () => {
    const sourceIds = [
      await buatCatatan(akunA.id, "Sumber hapus satu", "Isi satu."),
      await buatCatatan(akunA.id, "Sumber hapus dua", "Isi dua."),
    ];
    const neighborId = await buatCatatan(
      akunA.id,
      "Catatan tetangga",
      "Tetap disimpan."
    );
    await masukkanEmbedding(sourceIds[0]!);
    await masukkanEmbedding(sourceIds[1]!);
    await prisma.noteRelationship.createMany({
      data: [
        {
          sourceNoteId: sourceIds[0]!,
          targetNoteId: sourceIds[1]!,
          relationshipType: "similar",
          similarityScore: 0.8,
        },
        {
          sourceNoteId: sourceIds[1]!,
          targetNoteId: neighborId,
          relationshipType: "concept",
        },
      ],
    });

    const response = await api
      .post("/api/v1/notes/merge")
      .set(denganToken(akunA))
      .send({
        title: "Catatan pengganti",
        content: "Konten baru.",
        sourceNoteIds: sourceIds,
        hapusAsli: true,
      });

    expect(response.status).toBe(201);
    expect(
      await prisma.note.count({ where: { id: { in: sourceIds } } })
    ).toBe(0);
    expect(
      await prisma.noteEmbedding.count({
        where: { noteId: { in: sourceIds } },
      })
    ).toBe(0);
    expect(
      await prisma.noteRelationship.count({
        where: {
          OR: [
            { sourceNoteId: { in: sourceIds } },
            { targetNoteId: { in: sourceIds } },
          ],
        },
      })
    ).toBe(0);
    expect(
      await prisma.note.findUnique({ where: { id: neighborId } })
    ).not.toBeNull();
  });

  it("membatalkan pembuatan catatan gabungan jika penghapusan sumber gagal", async () => {
    const sourceIds = [
      await buatCatatan(akunA.id, "Sumber rollback satu", "Isi satu."),
      await buatCatatan(akunA.id, "Sumber rollback dua", "Isi dua."),
    ];
    const countBefore = await prisma.note.count({
      where: { userId: akunA.id },
    });
    const suffix = randomUUID().replace(/-/g, "");
    const functionName = `test_merge_fail_${suffix}`;
    const triggerName = `test_merge_fail_${suffix}`;
    let triggerCreated = false;

    try {
      await prisma.$executeRawUnsafe(`
        CREATE FUNCTION "${functionName}"() RETURNS trigger
        LANGUAGE plpgsql AS $$
        BEGIN
          RAISE EXCEPTION 'simulated merge delete failure';
        END;
        $$`);
      await prisma.$executeRawUnsafe(`
        CREATE TRIGGER "${triggerName}"
        BEFORE DELETE ON notes
        FOR EACH ROW EXECUTE FUNCTION "${functionName}"()`);
      triggerCreated = true;

      const response = await api
        .post("/api/v1/notes/merge")
        .set(denganToken(akunA))
        .send({
          title: "Catatan yang harus dibatalkan",
          content: "Tidak boleh tersimpan.",
          sourceNoteIds: sourceIds,
          hapusAsli: true,
        });

      expect(response.status).toBe(500);
      expect(
        await prisma.note.count({ where: { userId: akunA.id } })
      ).toBe(countBefore);
      expect(
        await prisma.note.count({
          where: { id: { in: sourceIds }, userId: akunA.id },
        })
      ).toBe(2);
      expect(
        await prisma.note.count({
          where: {
            userId: akunA.id,
            title: "Catatan yang harus dibatalkan",
          },
        })
      ).toBe(0);
    } finally {
      if (triggerCreated) {
        await prisma.$executeRawUnsafe(
          `DROP TRIGGER "${triggerName}" ON notes`
        );
      }
      await prisma.$executeRawUnsafe(
        `DROP FUNCTION IF EXISTS "${functionName}"()`
      );
    }
  });
});
