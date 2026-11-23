import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import NewNotePage from "@/app/notes/new/page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
  usePathname: () => "/notes/new",
}));

let mockUser: { id: string; name: string; email: string } | null = {
  id: "user-1",
  name: "Pengguna Uji",
  email: "uji@example.com",
};

vi.mock("@/lib/useRequireAuth", () => ({
  useRequireAuth: () => mockUser,
}));

vi.mock("@/components/NoteEditor", () => ({
  NoteEditor: () => <div data-testid="mock-note-editor">Mock Note Editor</div>,
}));

describe("Halaman Catatan Baru (/notes/new)", () => {
  beforeEach(() => {
    mockUser = { id: "user-1", name: "Pengguna Uji", email: "uji@example.com" };
    vi.restoreAllMocks();
  });

  it("menampilkan pemuatan jika pengguna belum terautentikasi", () => {
    mockUser = null;
    render(<NewNotePage />);
    expect(screen.getByText("Memuat...")).toBeInTheDocument();
  });

  it("menampilkan form catatan baru beserta tips menulis jika terautentikasi", () => {
    render(<NewNotePage />);
    expect(screen.getByText("Catatan baru")).toBeInTheDocument();
    expect(screen.getByTestId("mock-note-editor")).toBeInTheDocument();
    expect(screen.getByText("Tips menulis")).toBeInTheDocument();
  });
});
