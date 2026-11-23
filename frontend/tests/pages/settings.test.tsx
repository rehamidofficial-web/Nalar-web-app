import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SettingsPage from "@/app/settings/page";

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

  it("tombol ubah password dan hapus akun saat ini berstatus nonaktif (disabled)", () => {
    render(<SettingsPage />);

    expect(screen.getByRole("button", { name: /Ubah password/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Hapus akun/i })).toBeDisabled();
  });
});
