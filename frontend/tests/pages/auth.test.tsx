import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LoginPage from "@/app/login/page";
import RegisterPage from "@/app/register/page";
import * as api from "@/lib/api";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
  }),
}));

describe("Halaman Login & Register", () => {
  beforeEach(() => {
    mockPush.mockReset();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  describe("LoginPage", () => {
    it("login sukses menyimpan token di localStorage dan menuju /dashboard", async () => {
      const apiSpy = vi.spyOn(api, "apiFetch").mockResolvedValueOnce({
        ok: true,
        status: 200,
        message: "Login sukses",
        data: { accessToken: "jwt-super-secret" },
      });

      const user = userEvent.setup();
      render(<LoginPage />);

      await user.type(screen.getByLabelText("Email"), "user@example.com");
      await user.type(screen.getByLabelText("Password"), "rahasia123");
      await user.click(screen.getByRole("button", { name: "Masuk" }));

      expect(apiSpy).toHaveBeenCalledWith("/auth/login", {
        method: "POST",
        body: { email: "user@example.com", password: "rahasia123" },
      });

      await waitFor(() => {
        expect(localStorage.getItem("nalar_token")).toBe("jwt-super-secret");
        expect(mockPush).toHaveBeenCalledWith("/dashboard");
      });
    });

    it("login gagal menampilkan pesan error", async () => {
      vi.spyOn(api, "apiFetch").mockResolvedValueOnce({
        ok: false,
        status: 401,
        message: "Email atau password salah",
      });

      const user = userEvent.setup();
      render(<LoginPage />);

      await user.type(screen.getByLabelText("Email"), "user@example.com");
      await user.type(screen.getByLabelText("Password"), "salah");
      await user.click(screen.getByRole("button", { name: "Masuk" }));

      await waitFor(() => {
        expect(screen.getByRole("alert")).toHaveTextContent("Email atau password salah");
      });
      expect(mockPush).not.toHaveBeenCalled();
    });

    it("tombol dinonaktifkan saat sedang memproses", async () => {
      let resolvePromise: (value: api.ApiResult<unknown>) => void = () => {};
      vi.spyOn(api, "apiFetch").mockReturnValueOnce(
        new Promise<api.ApiResult<unknown>>((resolve) => {
          resolvePromise = resolve;
        })
      );

      const user = userEvent.setup();
      render(<LoginPage />);

      await user.type(screen.getByLabelText("Email"), "user@example.com");
      await user.type(screen.getByLabelText("Password"), "rahasia123");

      const submitBtn = screen.getByRole("button", { name: "Masuk" });
      await user.click(submitBtn);

      expect(submitBtn).toBeDisabled();
      expect(screen.getByText("Memproses…")).toBeInTheDocument();

      resolvePromise({ ok: true, status: 200, message: "OK", data: { accessToken: "token" } });
    });

    it("memiliki tautan ke halaman pendaftaran /register", () => {
      render(<LoginPage />);
      const regLink = screen.getByRole("link", { name: "Daftar" });
      expect(regLink).toHaveAttribute("href", "/register");
    });
  });

  describe("RegisterPage", () => {
    it("menampilkan pesan tanpa memanggil API jika konfirmasi password berbeda", async () => {
      const apiSpy = vi.spyOn(api, "apiFetch");
      const user = userEvent.setup();

      render(<RegisterPage />);

      await user.type(screen.getByLabelText("Nama"), "Budi");
      await user.type(screen.getByLabelText("Email"), "budi@example.com");
      await user.type(screen.getByLabelText(/Password \(minimal 8 karakter\)/i), "password123");
      await user.type(screen.getByLabelText("Ulangi password"), "password456");

      await user.click(screen.getByRole("button", { name: "Daftar" }));

      expect(screen.getByRole("alert")).toHaveTextContent("Konfirmasi password tidak sama");
      expect(apiSpy).not.toHaveBeenCalled();
    });

    it("pendaftaran sukses mengarahkan ke /login", async () => {
      const apiSpy = vi.spyOn(api, "apiFetch").mockResolvedValueOnce({
        ok: true,
        status: 201,
        message: "Akun berhasil dibuat",
      });

      const user = userEvent.setup();
      render(<RegisterPage />);

      await user.type(screen.getByLabelText("Nama"), "Budi");
      await user.type(screen.getByLabelText("Email"), "budi@example.com");
      await user.type(screen.getByLabelText(/Password \(minimal 8 karakter\)/i), "password123");
      await user.type(screen.getByLabelText("Ulangi password"), "password123");

      await user.click(screen.getByRole("button", { name: "Daftar" }));

      expect(apiSpy).toHaveBeenCalledWith("/auth/register", {
        method: "POST",
        body: { name: "Budi", email: "budi@example.com", password: "password123" },
      });

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith("/login");
      });
    });

    it("memiliki tautan ke halaman login /login", () => {
      render(<RegisterPage />);
      const loginLink = screen.getByRole("link", { name: "Masuk" });
      expect(loginLink).toHaveAttribute("href", "/login");
    });
  });
});
