import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getToken, saveToken, clearToken } from "@/lib/auth";

describe("lib/auth.ts", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("mengembalikan null jika belum ada token tersimpan", () => {
    expect(getToken()).toBeNull();
  });

  it("menyimpan token ke localStorage dan dapat dibaca kembali", () => {
    saveToken("sample-jwt-token");
    expect(getToken()).toBe("sample-jwt-token");
    expect(localStorage.getItem("nalar_token")).toBe("sample-jwt-token");
  });

  it("menghapus token dari localStorage dengan clearToken", () => {
    saveToken("token-to-delete");
    expect(getToken()).toBe("token-to-delete");
    clearToken();
    expect(getToken()).toBeNull();
    expect(localStorage.getItem("nalar_token")).toBeNull();
  });
});
