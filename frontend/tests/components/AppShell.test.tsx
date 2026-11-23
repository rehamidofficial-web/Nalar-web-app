import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppShell } from "@/components/AppShell";

const mockReplace = vi.fn();
let currentPathname = "/dashboard";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: mockReplace,
    push: vi.fn(),
  }),
  usePathname: () => currentPathname,
}));

describe("components/AppShell", () => {
  const dummyUser = {
    id: "user-1",
    name: "John Doe",
    email: "john@example.com",
  };

  beforeEach(() => {
    mockReplace.mockReset();
    currentPathname = "/dashboard";
    localStorage.clear();
  });

  it("item menu aktif memakai aria-current='page' sesuai rute", () => {
    currentPathname = "/notes";
    const { rerender } = render(
      <AppShell user={dummyUser}>
        <div>Konten</div>
      </AppShell>
    );

    // Di sidebar dan bottom nav
    const notesLinks = screen.getAllByRole("link", { name: /Catatan Saya|Catatan/i });
    expect(notesLinks.some((l) => l.getAttribute("aria-current") === "page")).toBe(true);

    // Pindah ke /graph
    currentPathname = "/graph";
    rerender(
      <AppShell user={dummyUser}>
        <div>Konten</div>
      </AppShell>
    );
    const graphLinks = screen.getAllByRole("link", { name: /Knowledge Graph|Graph/i });
    expect(graphLinks.some((l) => l.getAttribute("aria-current") === "page")).toBe(true);

    // Pindah ke /settings
    currentPathname = "/settings";
    rerender(
      <AppShell user={dummyUser}>
        <div>Konten</div>
      </AppShell>
    );
    const settingsLink = screen.getByRole("link", { name: /Pengaturan/i });
    expect(settingsLink).toHaveAttribute("aria-current", "page");
  });

  it("tombol Keluar menghapus token dan mengalihkan ke /login", async () => {
    localStorage.setItem("nalar_token", "sample-token");
    const user = userEvent.setup();

    render(
      <AppShell user={dummyUser}>
        <div>Konten</div>
      </AppShell>
    );

    const logoutBtn = screen.getByRole("button", { name: "Keluar dari akun" });
    await user.click(logoutBtn);

    expect(localStorage.getItem("nalar_token")).toBeNull();
    expect(mockReplace).toHaveBeenCalledWith("/login");
  });

  it("tombol Catatan Baru mengarah ke /notes/new", () => {
    render(
      <AppShell user={dummyUser}>
        <div>Konten</div>
      </AppShell>
    );

    const newNoteLinks = screen.getAllByRole("link", { name: /Catatan Baru/i });
    expect(newNoteLinks[0]).toHaveAttribute("href", "/notes/new");
  });

  it("lembar menu akun layar kecil terbuka saat avatar diklik dan tertutup dengan Esc", async () => {
    const user = userEvent.setup();
    render(
      <AppShell user={dummyUser}>
        <div>Konten</div>
      </AppShell>
    );

    expect(screen.queryByRole("dialog", { name: "Menu akun" })).not.toBeInTheDocument();

    const openMenuBtn = screen.getByRole("button", { name: "Buka menu akun" });
    await user.click(openMenuBtn);

    expect(screen.getByRole("dialog", { name: "Menu akun" })).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Menu akun" })).not.toBeInTheDocument();
  });

  it("tombol tambah mengambang (FAB) disembunyikan di rute yang dikecualikan", () => {
    // Di /dashboard, tombol FAB harus ada
    currentPathname = "/dashboard";
    const { rerender } = render(
      <AppShell user={dummyUser}>
        <div>Konten</div>
      </AppShell>
    );
    expect(screen.getByLabelText("Catatan baru")).toBeInTheDocument();

    // Di /notes/new, FAB disembunyikan
    currentPathname = "/notes/new";
    rerender(
      <AppShell user={dummyUser}>
        <div>Konten</div>
      </AppShell>
    );
    expect(screen.queryByLabelText("Catatan baru")).not.toBeInTheDocument();

    // Di /assistant, FAB disembunyikan
    currentPathname = "/assistant";
    rerender(
      <AppShell user={dummyUser}>
        <div>Konten</div>
      </AppShell>
    );
    expect(screen.queryByLabelText("Catatan baru")).not.toBeInTheDocument();

    // Di /graph, FAB disembunyikan
    currentPathname = "/graph";
    rerender(
      <AppShell user={dummyUser}>
        <div>Konten</div>
      </AppShell>
    );
    expect(screen.queryByLabelText("Catatan baru")).not.toBeInTheDocument();
  });
});
