import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { waktuRelatif } from "@/lib/format";

describe("lib/format.ts - waktuRelatif", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-23T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("mengembalikan 'baru saja' bila selisih kurang dari 1 menit", () => {
    const time = new Date("2026-11-23T11:59:30.000Z").toISOString();
    expect(waktuRelatif(time)).toBe("baru saja");
  });

  it("mengembalikan format menit lalu jika selisih di bawah 60 menit", () => {
    const time = new Date("2026-11-23T11:45:00.000Z").toISOString();
    expect(waktuRelatif(time)).toBe("15 menit lalu");
  });

  it("mengembalikan format jam lalu jika selisih di bawah 24 jam", () => {
    const time = new Date("2026-11-23T08:00:00.000Z").toISOString();
    expect(waktuRelatif(time)).toBe("4 jam lalu");
  });

  it("mengembalikan format hari lalu jika selisih 1 sampai 7 hari", () => {
    const time = new Date("2026-11-20T12:00:00.000Z").toISOString();
    expect(waktuRelatif(time)).toBe("3 hari lalu");
  });

  it("mengembalikan format tanggal Indonesia jika lebih dari 7 hari", () => {
    const time = new Date("2026-11-10T12:00:00.000Z").toISOString();
    const formatted = waktuRelatif(time);
    // Contoh: "10 Nov 2026"
    expect(formatted).toMatch(/10\s+Nov\s+2026/);
  });

  it("mengembalikan string masukan apa adanya jika masukan rusak/invalid date", () => {
    expect(waktuRelatif("bukan-tanggal")).toBe("bukan-tanggal");
  });
});
