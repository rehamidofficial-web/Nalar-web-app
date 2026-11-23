import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { axe } from "jest-axe";
import LoginPage from "@/app/login/page";
import RegisterPage from "@/app/register/page";
import SettingsPage from "@/app/settings/page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/settings",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/lib/useRequireAuth", () => ({
  useRequireAuth: () => ({
    id: "user-1",
    name: "Pengguna Uji",
    email: "uji@example.com",
  }),
}));

describe("Aksesibilitas Dasar (a11y dengan axe)", () => {
  it("halaman Login tidak memiliki pelanggaran aksesibilitas fatal", async () => {
    const { container } = render(<LoginPage />);
    const results = await axe(container);
    expect(results.violations).toHaveLength(0);
  });

  it("halaman Register tidak memiliki pelanggaran aksesibilitas fatal", async () => {
    const { container } = render(<RegisterPage />);
    const results = await axe(container);
    expect(results.violations).toHaveLength(0);
  });

  it("halaman Pengaturan memiliki label pada setiap input dan tombol", async () => {
    const { container } = render(<SettingsPage />);
    const results = await axe(container, {
      rules: {
        // Abaikan rule kontras warna tema sekunder jika ada
        "color-contrast": { enabled: false },
      },
    });
    expect(results.violations).toHaveLength(0);
  });
});
