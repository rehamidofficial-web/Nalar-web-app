import { describe, expect, it } from "vitest";
import {
  damerauLevenshtein,
  koreksiKalimat,
} from "../../src/lib/koreksiTypo.js";

const kamus = new Map<string, number>([
  ["await", 10],
  ["async", 8],
  ["callback", 5],
  ["index", 12],
  ["promise", 7],
  ["postgres", 9],
  ["database", 15],
  ["javascript", 20],
]);

describe("damerauLevenshtein", () => {
  it("menghitung transposisi, penambahan, penghapusan, dan penggantian satu huruf", () => {
    expect(damerauLevenshtein("awiat", "await")).toBe(1);
    expect(damerauLevenshtein("promis", "promise")).toBe(1);
    expect(damerauLevenshtein("awaits", "await")).toBe(1);
    expect(damerauLevenshtein("indek", "index")).toBe(1);
    expect(damerauLevenshtein("", "abc")).toBe(3);
    expect(damerauLevenshtein("abc", "")).toBe(3);
  });
});

describe("koreksiKalimat", () => {
  it.each([
    ["awiat", "await"],
    ["calback", "callback"],
    ["indek", "index"],
    ["promis", "promise"],
    ["asyc", "async"],
  ])("mengoreksi %s menjadi %s", (input, expected) => {
    expect(koreksiKalimat(input, kamus).dipakai).toBe(expected);
  });

  it("mempertahankan kata benar, kata umum, kata pendek, dan kata yang terlalu berbeda", () => {
    const hasil = koreksiKalimat("database yang dan api progasses", kamus);

    expect(hasil.dipakai).toBe("database yang dan api progasses");
    expect(hasil.perubahan).toEqual([]);
  });

  it("menjaga kapitalisasi awal dan tanda baca", () => {
    const hasil = koreksiKalimat("Awiat, asyc!", kamus);

    expect(hasil.dipakai).toBe("Await, async!");
    expect(hasil.perubahan).toEqual([
      { dari: "Awiat", ke: "Await" },
      { dari: "asyc", ke: "async" },
    ]);
  });

  it("aman untuk masukan kosong dan kamus kosong", () => {
    expect(koreksiKalimat("", kamus)).toEqual({
      asli: "",
      dipakai: "",
      perubahan: [],
    });
    expect(koreksiKalimat("awiat", new Map())).toEqual({
      asli: "awiat",
      dipakai: "awiat",
      perubahan: [],
    });
  });

  it("membatasi masukan sampai 1000 karakter", () => {
    const hasil = koreksiKalimat("x".repeat(1200), kamus);

    expect(hasil.asli).toHaveLength(1000);
    expect(hasil.dipakai).toHaveLength(1000);
  });
});
