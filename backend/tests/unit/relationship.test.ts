import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock, cariCatatanMock } = vi.hoisted(() => ({
  prismaMock: {
    note: { findFirst: vi.fn() },
    noteRelationship: { deleteMany: vi.fn() },
  },
  cariCatatanMock: vi.fn(),
}));

vi.mock("../../src/lib/prisma.js", () => ({ prisma: prismaMock }));
vi.mock("../../src/services/vector.service.js", () => ({
  cariCatatanMiripDenganCatatan: cariCatatanMock,
}));

import {
  hitungRelasiSimilar,
  RELASI_AMBANG,
  urutkanPasangan,
} from "../../src/services/relationship.service.js";

describe("relasi catatan", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.note.findFirst.mockResolvedValue({ id: "catatan-1" });
    prismaMock.noteRelationship.deleteMany.mockResolvedValue({ count: 0 });
    cariCatatanMock.mockResolvedValue([]);
  });

  it("mengurutkan pasangan secara kanonis dan menormalkan huruf", () => {
    expect(urutkanPasangan("B", "a")).toEqual({ source: "a", target: "b" });
    expect(urutkanPasangan("a", "B")).toEqual({ source: "a", target: "b" });
  });

  it("memakai ambang relasi baku dan meneruskan ambang pilihan", async () => {
    await hitungRelasiSimilar("user-1", "catatan-1");

    expect(cariCatatanMock).toHaveBeenLastCalledWith({
      userId: "user-1",
      noteId: "catatan-1",
      batas: 5,
      ambang: RELASI_AMBANG,
    });

    await hitungRelasiSimilar("user-1", "catatan-1", 0.7);

    expect(cariCatatanMock).toHaveBeenLastCalledWith({
      userId: "user-1",
      noteId: "catatan-1",
      batas: 5,
      ambang: 0.7,
    });
  });
});
