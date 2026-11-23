import jwt from "jsonwebtoken";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  signToken,
  validateJwtSecretConfiguration,
  verifyToken,
} from "../../src/lib/jwt.js";

const secretCukup = "a".repeat(32);

describe("JWT", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("membuat dan memverifikasi token", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("JWT_SECRET", secretCukup);

    const token = signToken("user-123");

    expect(verifyToken(token)).toMatchObject({ userId: "user-123" });
  });

  it("menolak token rusak dan kedaluwarsa", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("JWT_SECRET", secretCukup);
    const expiredToken = jwt.sign({ userId: "user-123" }, secretCukup, {
      expiresIn: -1,
    });

    expect(() => verifyToken("token.rusak")).toThrow();
    expect(() => verifyToken(expiredToken)).toThrow();
  });

  it("mewajibkan secret minimal 32 karakter di produksi", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("JWT_SECRET", "terlalu-pendek");

    expect(() => signToken("user-123")).toThrow(
      "JWT_SECRET minimal harus 32 karakter di mode produksi."
    );
    expect(() => {
      vi.stubEnv("JWT_SECRET", secretCukup);
      validateJwtSecretConfiguration();
    }).not.toThrow();
  });

  it("menghentikan aplikasi saat secret produksi kurang dari 32 karakter", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("JWT_SECRET", "terlalu-pendek");
    const exit = vi
      .spyOn(process, "exit")
      .mockImplementation(() => {
        throw new Error("process.exit");
      });
    vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => validateJwtSecretConfiguration()).toThrow("process.exit");
    expect(exit).toHaveBeenCalledWith(1);
  });
});
