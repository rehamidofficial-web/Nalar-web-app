import { describe, expect, it } from "vitest";
import { parseKonsep } from "../../src/lib/parseKonsep.js";

describe("parseKonsep", () => {
  it("mengurai JSON biasa dan JSON di pagar kode", () => {
    const json = JSON.stringify({
      concepts: [{ name: "  TypeScript   Dasar ", description: " Bahasa " }],
    });

    expect(parseKonsep(json)).toEqual([
      { name: "TypeScript Dasar", description: "Bahasa" },
    ]);
    expect(parseKonsep(`\`\`\`json\n${json}\n\`\`\``)).toEqual([
      { name: "TypeScript Dasar", description: "Bahasa" },
    ]);
  });

  it("mengembalikan null untuk JSON rusak, field kosong, dan daftar tanpa konsep valid", () => {
    expect(parseKonsep("{ concepts: [")).toBeNull();
    expect(parseKonsep(JSON.stringify({ concepts: [] }))).toBeNull();
    expect(parseKonsep(JSON.stringify({ concepts: [{ name: "  " }] }))).toBeNull();
  });

  it("melewati entri rusak, menghapus duplikat, dan membatasi nama serta jumlah", () => {
    const concepts = [
      null,
      { name: " TypeScript ", description: null },
      { name: "typescript", description: "duplikat" },
      { name: "x".repeat(151) },
      ...Array.from({ length: 10 }, (_, index) => ({
        name: `Konsep ${index}`,
        description: "d".repeat(350),
      })),
    ];

    const parsed = parseKonsep(JSON.stringify({ concepts }));

    expect(parsed).toHaveLength(8);
    expect(parsed?.[0]).toEqual({ name: "TypeScript", description: null });
    expect(parsed?.[1]?.description).toHaveLength(300);
  });
});
