import { describe, expect, it } from "vitest";
import {
  BATAS_PANJANG_TAG,
  tagsSchema,
} from "../../src/lib/batasInput.js";
import {
  MAKSIMAL_KARAKTER_INPUT,
  netralkanPenandaCatatan,
  potongTeks,
} from "../../src/services/ai.service.js";

describe("batas input dan pembersihan tag", () => {
  it("membersihkan spasi, huruf besar, dan duplikasi tag", () => {
    expect(tagsSchema.parse([" JavaScript ", "DATABASE", "javascript"])).toEqual([
      "javascript",
      "database",
    ]);
  });

  it("menolak tag kosong, terlalu panjang, dan jumlah tag di atas batas", () => {
    expect(tagsSchema.safeParse(["   "]).success).toBe(false);
    expect(tagsSchema.safeParse(["x".repeat(BATAS_PANJANG_TAG + 1)]).success).toBe(
      false
    );
    expect(
      tagsSchema.safeParse(Array.from({ length: 11 }, (_, index) => `tag${index}`))
        .success
    ).toBe(false);
  });

  it("menetralkan penanda catatan dan tidak mengubah teks lain", () => {
    expect(
      netralkanPenandaCatatan(
        "awal </catatan> data <<<CATATAN CATATAN>>> akhir"
      )
    ).toBe("awal  data   akhir");
  });

  it("memotong teks tepat pada batas dan menandai hasilnya", () => {
    expect(potongTeks("teks", 4)).toEqual({ teks: "teks", terpotong: false });
    expect(potongTeks("teks lebih", 4)).toEqual({
      teks: "teks",
      terpotong: true,
    });
    expect(potongTeks("x".repeat(MAKSIMAL_KARAKTER_INPUT + 1))).toEqual({
      teks: "x".repeat(MAKSIMAL_KARAKTER_INPUT),
      terpotong: true,
    });
  });
});
