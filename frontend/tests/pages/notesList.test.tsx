import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NotesList } from "@/components/NotesList";
import * as api from "@/lib/api";

const mockPush = vi.fn();
let currentSearch = "";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(currentSearch),
  usePathname: () => "/notes",
}));

vi.mock("@/lib/useRequireAuth", () => ({
  useRequireAuth: () => ({
    id: "user-1",
    name: "Pengguna Uji",
    email: "uji@example.com",
  }),
}));

describe("Komponen Catatan Saya (NotesList)", () => {
  beforeEach(() => {
    mockPush.mockReset();
    currentSearch = "";
    vi.restoreAllMocks();
  });

  it("menampilkan daftar catatan dari data tiruan", async () => {
    vi.spyOn(api, "apiFetch").mockImplementation((url) => {
      if (url.includes("/notes/tags")) {
        return Promise.resolve({ ok: true, status: 200, message: "OK", data: { tags: [] } });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        message: "OK",
        data: {
          items: [
            {
              id: "n-1",
              title: "Catatan Arsitektur",
              summary: "Ringkasan arsitektur",
              tags: ["arsitektur"],
              createdAt: "2026-11-20T10:00:00Z",
              updatedAt: "2026-11-20T10:00:00Z",
              contentPreview: "Prinsip clean architecture...",
            },
          ],
          pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
        },
      });
    });

    render(<NotesList />);

    await waitFor(() => {
      expect(screen.getByText("Catatan Arsitektur")).toBeInTheDocument();
      expect(screen.getByText("arsitektur")).toBeInTheDocument();
    });
  });

  it("menampilkan ajakan buat catatan saat data kosong tanpa filter", async () => {
    vi.spyOn(api, "apiFetch").mockResolvedValue({
      ok: true,
      status: 200,
      message: "OK",
      data: {
        items: [],
        pagination: { page: 1, limit: 10, total: 0, totalPages: 1 },
      },
    });

    render(<NotesList />);

    await waitFor(() => {
      expect(screen.getByText("Belum ada catatan")).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Tulis catatan pertama" })).toHaveAttribute(
        "href",
        "/notes/new"
      );
    });
  });

  it("menampilkan pesan error dan tombol Coba lagi saat gagal memuat daftar", async () => {
    const apiSpy = vi.spyOn(api, "apiFetch").mockResolvedValue({
      ok: false,
      status: 500,
      message: "Gagal mengambil catatan",
    });

    const user = userEvent.setup();
    render(<NotesList />);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Gagal mengambil catatan");
    });

    const retryBtn = screen.getByRole("button", { name: "Coba lagi" });
    await user.click(retryBtn);

    expect(apiSpy).toHaveBeenCalled();
  });

  it("dapat beralih antara tampilan Kartu dan Daftar", async () => {
    vi.spyOn(api, "apiFetch").mockResolvedValue({
      ok: true,
      status: 200,
      message: "OK",
      data: {
        items: [
          {
            id: "n-1",
            title: "Catatan Satu",
            summary: null,
            tags: [],
            createdAt: "2026-11-20T10:00:00Z",
            updatedAt: "2026-11-20T10:00:00Z",
            contentPreview: "Isi",
          },
        ],
        pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
      },
    });

    const user = userEvent.setup();
    render(<NotesList />);

    await waitFor(() => {
      expect(screen.getByText("Catatan Satu")).toBeInTheDocument();
    });

    const listBtn = screen.getByRole("button", { name: "Daftar" });
    await user.click(listBtn);
    expect(listBtn).toHaveAttribute("aria-pressed", "true");

    const cardBtn = screen.getByRole("button", { name: "Kartu" });
    await user.click(cardBtn);
    expect(cardBtn).toHaveAttribute("aria-pressed", "true");
  });

  it("pencarian men-debounce input sebelum memperbarui URL", async () => {
    vi.useFakeTimers();

    vi.spyOn(api, "apiFetch").mockResolvedValue({
      ok: true,
      status: 200,
      message: "OK",
      data: { items: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 1 } },
    });

    render(<NotesList />);

    const searchInput = screen.getByPlaceholderText(/Cari di catatanmu/i);
    try {
      fireEvent.change(searchInput, { target: { value: "Docker" } });

      // Sebelum 400ms belum dipush
      act(() => vi.advanceTimersByTime(200));
      expect(mockPush).not.toHaveBeenCalled();

      // Setelah 400ms
      act(() => vi.advanceTimersByTime(250));
      expect(mockPush).toHaveBeenCalledWith(expect.stringContaining("search=Docker"));
    } finally {
      vi.useRealTimers();
    }
  });
});
