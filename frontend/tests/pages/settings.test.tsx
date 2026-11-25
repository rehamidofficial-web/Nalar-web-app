import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SettingsPage from "@/app/settings/page";
import * as api from "@/lib/api";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/settings",
}));

vi.mock("@/lib/useRequireAuth", () => ({
  useRequireAuth: () => ({
    id: "user-1",
    name: "Pengguna Uji",
    email: "uji@example.com",
  }),
}));

describe("Halaman Pengaturan (SettingsPage)", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
    vi.restoreAllMocks();
  });

  it("memilih tema Gelap memasang data-theme='dark' pada <html> dan menyimpan ke localStorage", async () => {
    const user = userEvent.setup();
    render(<SettingsPage />);

    const darkCardBtn = screen.getByRole("radio", { name: /Gelap/i });
    await user.click(darkCardBtn);

    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(localStorage.getItem("nalar_theme")).toBe("dark");
  });

  it("sakelar Mode gelap sinkron dengan preferensi tema", async () => {
    const user = userEvent.setup();
    render(<SettingsPage />);

    const toggle = screen.getByRole("switch", { name: "Mode gelap" });
    expect(toggle).toHaveAttribute("aria-checked", "false");

    await user.click(toggle);

    expect(toggle).toHaveAttribute("aria-checked", "true");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });

  it("preferensi AI tersimpan ke localStorage di kunci nalar_ai_prefs", async () => {
    const user = userEvent.setup();
    render(<SettingsPage />);

    const switchKonsep = screen.getByRole("switch", { name: "Cari konsep utama saat menyimpan" });
    await user.click(switchKonsep);

    const saved = JSON.parse(localStorage.getItem("nalar_ai_prefs") || "{}");
    expect(saved.cariKonsep).toBe(false);
  });

  it("data rusak di localStorage tidak menyebabkan halaman crash", () => {
    localStorage.setItem("nalar_ai_prefs", "invalid-json-structure{{{");
    expect(() => render(<SettingsPage />)).not.toThrow();
  });

  it("tombol ubah password aktif, tombol hapus akun masih nonaktif (disabled)", () => {
    render(<SettingsPage />);

    expect(screen.getByRole("button", { name: /Ubah password/i })).toBeEnabled();
    expect(screen.getByRole("button", { name: /Hapus akun/i })).toBeDisabled();
  });
});

describe("Ubah password (dialog di Pengaturan)", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  /** Membuka dialog lalu menunggu sampai kolom pertama siap (fokus). */
  async function bukaDialog() {
    const user = userEvent.setup();
    render(<SettingsPage />);
    await user.click(screen.getByRole("button", { name: /Ubah password/i }));
    await screen.findByRole("dialog", { name: /Ubah password/i });
    await waitFor(() => expect(screen.getByLabelText("Password saat ini")).toHaveFocus());
    return user;
  }

  async function isiForm(user: ReturnType<typeof userEvent.setup>, lama: string, baru: string, ulang: string) {
    await user.type(screen.getByLabelText("Password saat ini"), lama);
    await user.type(screen.getByLabelText("Password baru"), baru);
    await user.type(screen.getByLabelText("Ulangi password baru"), ulang);
  }

  it("membuka dialog dengan tiga kolom password dan memfokuskan kolom pertama", async () => {
    await bukaDialog();

    expect(screen.getByLabelText("Password saat ini")).toHaveAttribute("type", "password");
    expect(screen.getByLabelText("Password baru")).toHaveAttribute("autocomplete", "new-password");
    expect(screen.getByLabelText("Ulangi password baru")).toBeInTheDocument();
  });

  it("menekan Simpan dengan kolom kosong menampilkan galat dan tidak memanggil server", async () => {
    const apiSpy = vi.spyOn(api, "apiFetch");
    const user = await bukaDialog();

    await user.click(screen.getByRole("button", { name: "Simpan password" }));

    expect(await screen.findByText("Isi password saat ini.")).toBeInTheDocument();
    expect(screen.getByText("Isi password baru.")).toBeInTheDocument();
    expect(screen.getByText("Ketik ulang password baru.")).toBeInTheDocument();
    expect(apiSpy).not.toHaveBeenCalled();
  });

  it("password ulang yang berbeda ditolak di browser", async () => {
    const apiSpy = vi.spyOn(api, "apiFetch");
    const user = await bukaDialog();

    await isiForm(user, "lama12345", "baru12345", "beda12345");
    await user.click(screen.getByRole("button", { name: "Simpan password" }));

    expect(await screen.findByText("Password tidak sama.")).toBeInTheDocument();
    expect(apiSpy).not.toHaveBeenCalled();
  });

  it("password baru yang sama dengan yang lama ditolak di browser", async () => {
    const apiSpy = vi.spyOn(api, "apiFetch");
    const user = await bukaDialog();

    await isiForm(user, "sama12345", "sama12345", "sama12345");
    await user.click(screen.getByRole("button", { name: "Simpan password" }));

    expect(
      await screen.findByText("Password baru harus berbeda dari password saat ini."),
    ).toBeInTheDocument();
    expect(apiSpy).not.toHaveBeenCalled();
  });

  it("tombol mata menampilkan dan menyembunyikan password", async () => {
    const user = await bukaDialog();
    const kolom = screen.getByLabelText("Password baru");

    await user.click(screen.getByRole("button", { name: "Tampilkan password baru" }));
    expect(kolom).toHaveAttribute("type", "text");

    await user.click(screen.getByRole("button", { name: "Sembunyikan password baru" }));
    expect(kolom).toHaveAttribute("type", "password");
  });

  it("berhasil: mengirim PATCH /auth/password, menutup dialog, dan menampilkan pesan sukses", async () => {
    const apiSpy = vi
      .spyOn(api, "apiFetch")
      .mockResolvedValue({ ok: true, status: 200, message: "Password berhasil diubah" });
    const user = await bukaDialog();

    await isiForm(user, "lama12345", "baru12345", "baru12345");
    await user.click(screen.getByRole("button", { name: "Simpan password" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(apiSpy).toHaveBeenCalledWith(
      "/auth/password",
      expect.objectContaining({
        method: "PATCH",
        body: { currentPassword: "lama12345", newPassword: "baru12345" },
      }),
    );
    expect(screen.getByText("Password berhasil diubah.")).toBeInTheDocument();
  });

  it("password lama salah dari server: galat tampil di kolomnya dan dialog tetap terbuka", async () => {
    vi.spyOn(api, "apiFetch").mockResolvedValue({
      ok: false,
      status: 400,
      message: "Password saat ini salah",
      errors: [{ field: "currentPassword", message: "Password saat ini salah" }],
    });
    const user = await bukaDialog();

    await isiForm(user, "salah1234", "baru12345", "baru12345");
    await user.click(screen.getByRole("button", { name: "Simpan password" }));

    expect(await screen.findByText("Password saat ini salah")).toBeInTheDocument();
    expect(screen.getByLabelText("Password saat ini")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("jika endpoint belum ada di server (404) tampil pesan yang jelas", async () => {
    vi.spyOn(api, "apiFetch").mockResolvedValue({ ok: false, status: 404, message: "" });
    const user = await bukaDialog();

    await isiForm(user, "lama12345", "baru12345", "baru12345");
    await user.click(screen.getByRole("button", { name: "Simpan password" }));

    expect(await screen.findByText(/Fitur ubah password belum aktif di server/i)).toBeInTheDocument();
  });

  it("tombol Batal dan tombol Esc menutup dialog", async () => {
    const user = await bukaDialog();
    await user.click(screen.getByRole("button", { name: "Batal" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /Ubah password/i }));
    await screen.findByRole("dialog");
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
});
