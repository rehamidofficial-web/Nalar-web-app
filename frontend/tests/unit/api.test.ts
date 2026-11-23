import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { pesanError, apiFetch } from "@/lib/api";

describe("lib/api.ts", () => {
  describe("pesanError", () => {
    it("menggunakan pesan dari server jika ada dan tidak kosong", () => {
      const msg = pesanError({
        ok: false,
        status: 400,
        message: "Email sudah digunakan.",
      });
      expect(msg).toBe("Email sudah digunakan.");
    });

    it("menggabungkan rincian errors dari validasi jika message kosong", () => {
      const msg = pesanError({
        ok: false,
        status: 422,
        message: "",
        errors: [
          { field: "email", message: "Email wajib diisi" },
          { field: "password", message: "Password minimal 6 karakter" },
        ],
      });
      expect(msg).toBe("Email wajib diisi. Password minimal 6 karakter");
    });

    it("memetakan status 0 (koneksi terputus)", () => {
      expect(pesanError({ ok: false, status: 0, message: "" })).toBe(
        "Tidak bisa terhubung. Periksa koneksi internetmu lalu coba lagi."
      );
    });

    it("memetakan status 400", () => {
      expect(pesanError({ ok: false, status: 400, message: "" })).toBe(
        "Format data yang dikirim tidak valid."
      );
    });

    it("memetakan status 401", () => {
      expect(pesanError({ ok: false, status: 401, message: "" })).toBe(
        "Sesi tidak valid atau sudah berakhir. Silakan masuk lagi."
      );
    });

    it("memetakan status 403", () => {
      expect(pesanError({ ok: false, status: 403, message: "" })).toBe(
        "Kamu tidak memiliki akses untuk tindakan ini."
      );
    });

    it("memetakan status 404", () => {
      expect(pesanError({ ok: false, status: 404, message: "" })).toBe(
        "Data atau halaman tidak ditemukan."
      );
    });

    it("memetakan status 409", () => {
      expect(pesanError({ ok: false, status: 409, message: "" })).toBe(
        "Data sudah ada atau terjadi konflik."
      );
    });

    it("memetakan status 413", () => {
      expect(pesanError({ ok: false, status: 413, message: "" })).toBe(
        "Data yang dikirim terlalu besar."
      );
    });

    it("memetakan status 422 tanpa errors", () => {
      expect(pesanError({ ok: false, status: 422, message: "" })).toBe(
        "Validasi data gagal. Periksa kembali isian formulir."
      );
    });

    it("memetakan status 429 dengan retryAfter", () => {
      expect(
        pesanError({ ok: false, status: 429, message: "", retryAfter: 45 })
      ).toBe("Terlalu banyak permintaan. Coba lagi sekitar 45 detik lagi.");
    });

    it("memetakan status 429 tanpa retryAfter", () => {
      expect(pesanError({ ok: false, status: 429, message: "" })).toBe(
        "Terlalu banyak permintaan. Coba lagi sebentar lagi."
      );
    });

    it("memetakan status 503 dan 504", () => {
      expect(pesanError({ ok: false, status: 503, message: "" })).toBe(
        "Layanan sedang sibuk, coba lagi sebentar."
      );
      expect(pesanError({ ok: false, status: 504, message: "" })).toBe(
        "Layanan sedang sibuk, coba lagi sebentar."
      );
    });

    it("memetakan status 5xx lainnya", () => {
      expect(pesanError({ ok: false, status: 500, message: "" })).toBe(
        "Terjadi kesalahan di server. Coba lagi nanti."
      );
      expect(pesanError({ ok: false, status: 502, message: "" })).toBe(
        "Terjadi kesalahan di server. Coba lagi nanti."
      );
    });

    it("memetakan status lain di luar daftar", () => {
      expect(pesanError({ ok: false, status: 418, message: "" })).toBe(
        "Terjadi kesalahan tak terduga."
      );
    });
  });

  describe("apiFetch", () => {
    const originalFetch = global.fetch;

    beforeEach(() => {
      global.fetch = vi.fn();
    });

    afterEach(() => {
      global.fetch = originalFetch;
    });

    it("menyertakan header Authorization hanya jika token diberikan", async () => {
      (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => ({ success: true, message: "OK", data: { id: 1 } }),
      });

      await apiFetch("/test", { token: "secret-token" });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/test"),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer secret-token",
            "Content-Type": "application/json",
          }),
        })
      );
    });

    it("tidak menyertakan header Authorization jika token null/undefined", async () => {
      (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => ({ success: true, message: "OK" }),
      });

      await apiFetch("/test");

      const callArgs = (global.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1];
      expect(callArgs.headers.Authorization).toBeUndefined();
    });

    it("mengirim body sebagai JSON string", async () => {
      (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => ({ success: true }),
      });

      await apiFetch("/create", {
        method: "POST",
        body: { title: "Halo", tags: ["a"] },
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/create"),
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ title: "Halo", tags: ["a"] }),
        })
      );
    });

    it("mengembalikan status 0 jika fetch melempar error jaringan", async () => {
      (global.fetch as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error("Network failed")
      );

      const res = await apiFetch("/offline");
      expect(res.ok).toBe(false);
      expect(res.status).toBe(0);
      expect(res.message).toBe(
        "Tidak bisa terhubung. Periksa koneksi internetmu lalu coba lagi."
      );
    });

    it("tetap aman dan tidak crash saat respons server bukan JSON (misal HTML 500)", async () => {
      (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        status: 500,
        headers: new Headers(),
        json: async () => {
          throw new Error("Unexpected token < in JSON at position 0");
        },
      });

      const res = await apiFetch("/error-html");
      expect(res.ok).toBe(false);
      expect(res.status).toBe(500);
      expect(res.message).toBe("Terjadi kesalahan di server. Coba lagi nanti.");
    });

    it("tetap aman saat respons server bukan JSON pada status 429", async () => {
      const headers = new Headers();
      headers.set("Retry-After", "30");

      (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers,
        json: async () => {
          throw new Error("Invalid JSON");
        },
      });

      const res = await apiFetch("/rate-limited");
      expect(res.ok).toBe(false);
      expect(res.status).toBe(429);
      expect(res.retryAfter).toBe(30);
      expect(res.message).toBe("Terlalu banyak permintaan. Coba lagi sebentar lagi.");
    });

    it("membaca Retry-After header dengan benar", async () => {
      const headers = new Headers();
      headers.set("Retry-After", "60");

      (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers,
        json: async () => ({ message: "Rate limit exceeded" }),
      });

      const res = await apiFetch("/rate-limited");
      expect(res.retryAfter).toBe(60);
      expect(res.message).toBe("Rate limit exceeded");
    });

    it("menghapus token dan mengalihkan ke /login saat menerima status 401 selain di rute auth", async () => {
      localStorage.setItem("nalar_token", "fake-token");

      delete (window as { location?: unknown }).location;
      (window as unknown as { location: unknown }).location = {
        pathname: "/dashboard",
        href: "/dashboard",
      };

      (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        status: 401,
        headers: new Headers(),
        json: async () => ({ message: "Unauthorized" }),
      });

      await apiFetch("/notes");

      expect(localStorage.getItem("nalar_token")).toBeNull();
      expect(window.location.href).toBe("/login");
    });

    it("tidak mengalihkan bila rute 401 adalah /auth/login atau /auth/register", async () => {
      delete (window as { location?: unknown }).location;
      (window as unknown as { location: unknown }).location = {
        pathname: "/login",
        href: "/login",
      };

      (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        status: 401,
        headers: new Headers(),
        json: async () => ({ message: "Email atau password salah" }),
      });

      await apiFetch("/auth/login", { method: "POST" });
      expect(window.location.href).toBe("/login");
    });
  });
});
