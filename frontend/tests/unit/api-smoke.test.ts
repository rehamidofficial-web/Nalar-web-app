import { describe, it, expect } from "vitest";
import { pesanError } from "@/lib/api";

describe("pesanError (Smoke Test)", () => {
  it("mengembalikan pesan ramah untuk status 404 ketika message kosong", () => {
    const hasil = pesanError({
      ok: false,
      status: 404,
      message: "",
    });
    expect(hasil).toBe("Data atau halaman tidak ditemukan.");
  });
});
