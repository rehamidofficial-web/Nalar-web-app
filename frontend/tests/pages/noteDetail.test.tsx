import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import NoteDetailPage from "@/app/notes/[id]/page";
import * as api from "@/lib/api";

const mockPush = vi.fn();
const mockReplace = vi.fn();
const mockUser = {
  id: "user-1",
  name: "Pengguna Uji",
  email: "uji@example.com",
};
let isEditMode = false;

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "note-123" }),
  useSearchParams: () => new URLSearchParams(isEditMode ? "edit=true" : ""),
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
  }),
  usePathname: () => "/notes/note-123",
}));

vi.mock("@/lib/useRequireAuth", () => ({
  useRequireAuth: () => mockUser,
}));

describe("Halaman Detail Catatan (/notes/[id])", () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockReplace.mockReset();
    isEditMode = false;
    vi.restoreAllMocks();
  });

  it("menampilkan mode lihat: judul, tag sebagai link, dan jumlah kata", async () => {
    vi.spyOn(api, "apiFetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      message: "OK",
      data: {
        id: "note-123",
        title: "Konsep Dasar Docker",
        content: "Containerization memudahkan isolasi proses aplikasi secara portabel.",
        summary: "Docker adalah platform kontainerisasi.",
        tags: ["devops", "docker"],
        createdAt: "2026-11-20T10:00:00Z",
        updatedAt: "2026-11-20T10:00:00Z",
      },
    });

    render(<NoteDetailPage />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 1, name: "Konsep Dasar Docker" })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "devops" })).toHaveAttribute(
        "href",
        "/notes?tag=devops"
      );
      expect(screen.getByRole("link", { name: /Lihat di Graph/i })).toHaveAttribute(
        "href",
        "/graph?catatan=note-123"
      );
      expect(screen.getByText(/Containerization memudahkan isolasi/i)).toBeInTheDocument();
      expect(screen.getByText(/7 kata/i)).toBeInTheDocument();
    });
  });

  it("mencegah XSS: script atau gambar berbahaya di-render sebagai teks biasa, tidak dieksekusi", async () => {
    const maliciousPayload = `<script>window.__xss_vulnerable = true;</script><img src=x onerror="alert(1)" />`;

    vi.spyOn(api, "apiFetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      message: "OK",
      data: {
        id: "note-123",
        title: "Uji XSS Keamanan",
        content: maliciousPayload,
        summary: null,
        tags: [],
        createdAt: "2026-11-20T10:00:00Z",
        updatedAt: "2026-11-20T10:00:00Z",
      },
    });

    const { container } = render(<NoteDetailPage />);

    await waitFor(() => {
      expect(screen.getByText(maliciousPayload)).toBeInTheDocument();
    });

    // Pastikan tidak ada tag script atau img yang disuntikkan ke DOM
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("img")).toBeNull();
  });

  it("menampilkan 'Catatan tidak ditemukan' saat API merespons status 404", async () => {
    vi.spyOn(api, "apiFetch").mockResolvedValueOnce({
      ok: false,
      status: 404,
      message: "Catatan tidak ditemukan",
    });

    render(<NoteDetailPage />);

    await waitFor(() => {
      expect(screen.getByText("Catatan tidak ditemukan")).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Kembali ke Catatan Saya" })).toHaveAttribute(
        "href",
        "/notes"
      );
    });
  });

  it("tombol Ubah mengarahkan ke mode ubah ?edit=true", async () => {
    vi.spyOn(api, "apiFetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      message: "OK",
      data: {
        id: "note-123",
        title: "Catatan Judul",
        content: "Isi",
        summary: null,
        tags: [],
        createdAt: "2026-11-20T10:00:00Z",
        updatedAt: "2026-11-20T10:00:00Z",
      },
    });

    const user = userEvent.setup();
    render(<NoteDetailPage />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Ubah" })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Ubah" }));
    expect(mockPush).toHaveBeenCalledWith("/notes/note-123?edit=true");
  });

  it("mode ?edit=true menampilkan editor dengan isi catatan", async () => {
    isEditMode = true;
    vi.spyOn(api, "apiFetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      message: "OK",
      data: {
        id: "note-123",
        title: "Catatan Judul",
        content: "Isi yang sudah tersimpan",
        summary: null,
        tags: ["uji"],
        createdAt: "2026-11-20T10:00:00Z",
        updatedAt: "2026-11-20T10:00:00Z",
      },
    });

    render(<NoteDetailPage />);

    await waitFor(() => {
      expect(screen.getByRole("textbox", { name: "Judul" })).toHaveValue("Catatan Judul");
      expect(screen.getByRole("textbox", { name: "Isi catatan" })).toHaveValue(
        "Isi yang sudah tersimpan"
      );
      expect(screen.getByRole("link", { name: "Lihat catatan" })).toHaveAttribute(
        "href",
        "/notes/note-123"
      );
    });
  });

  it("menampilkan error umum dan mencoba memuat ulang catatan", async () => {
    const apiSpy = vi.spyOn(api, "apiFetch").mockResolvedValueOnce({
      ok: false,
      status: 500,
      message: "Server sedang bermasalah",
    });
    const user = userEvent.setup();

    render(<NoteDetailPage />);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Server sedang bermasalah");
    });

    apiSpy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      message: "OK",
      data: {
        id: "note-123",
        title: "Catatan Pulih",
        content: "Isi",
        summary: null,
        tags: [],
        createdAt: "2026-11-20T10:00:00Z",
        updatedAt: "2026-11-20T10:00:00Z",
      },
    });

    await user.click(screen.getByRole("button", { name: "Coba lagi" }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 1, name: "Catatan Pulih" })).toBeInTheDocument();
    });
    expect(apiSpy).toHaveBeenCalledTimes(2);
  });
});
