import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DashboardPage from "@/app/dashboard/page";
import * as api from "@/lib/api";

const mockPush = vi.fn();
const mockUser = {
  id: "user-1",
  name: "Ahmad Dahlan",
  email: "ahmad@example.com",
};

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
  }),
  usePathname: () => "/dashboard",
}));

vi.mock("@/lib/useRequireAuth", () => ({
  useRequireAuth: () => mockUser,
}));

describe("Halaman Dashboard", () => {
  beforeEach(() => {
    mockPush.mockReset();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("menampilkan judul Your Second Brain (tanpa sapaan) dan kartu statistik sukses", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-23T16:00:00")); // Mengunci tanggal supaya waktu relatif ("x jam lalu") stabil

    vi.spyOn(api, "apiFetch").mockImplementation((url) => {
      if (url.includes("/dashboard/stats")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          message: "OK",
          data: {
            totalNotes: 12,
            totalConcepts: 8,
            totalRelationships: 15,
            recentActivity: 5,
          },
        });
      }
      if (url.includes("/dashboard/recent-notes")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          message: "OK",
          data: {
            items: [
              {
                id: "note-1",
                title: "Belajar Next.js 15",
                summary: "Catatan mengenai SSR dan App Router",
                tags: ["web", "nextjs"],
                createdAt: "2026-11-23T10:00:00Z",
                updatedAt: "2026-11-23T10:00:00Z",
                contentPreview: "Preview isi catatan Next.js...",
              },
            ],
          },
        });
      }
      return Promise.resolve({ ok: false, status: 404, message: "" });
    });

    render(<DashboardPage />);

    expect(screen.getByRole("heading", { name: /Your Second Brain/i })).toBeInTheDocument();
    expect(screen.getByText(/Capture ideas, connect knowledge, and think deeper\./i)).toBeInTheDocument();
    // Sapaan "Selamat ..., nama!" sudah dihapus
    expect(screen.queryByText(/Selamat (pagi|siang|sore|malam)/i)).not.toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("12")).toBeInTheDocument(); // totalNotes
      expect(screen.getByText("8")).toBeInTheDocument();  // totalConcepts
      expect(screen.getByText("15")).toBeInTheDocument(); // totalRelationships
      expect(screen.getByText("Belajar Next.js 15")).toBeInTheDocument();
      expect(screen.getByText("web")).toBeInTheDocument();
      expect(screen.getByText(/baru saja|\d+ (menit|jam|hari) lalu/i)).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /Tanya Asisten AI/i })).toHaveAttribute(
        "href",
        "/assistant"
      );
    });
  }, 20000); // Diberi waktu lebih lama: render pertama di komputer yang sedang sibuk bisa lambat

  it("menampilkan kerangka saat data dashboard masih dimuat", () => {
    vi.spyOn(api, "apiFetch").mockImplementation(() => new Promise(() => {}));

    render(<DashboardPage />);

    expect(screen.getByRole("region", { name: "Catatan Terbaru" })).toHaveAttribute(
      "aria-busy",
      "true"
    );
  });

  it("menampilkan keadaan kosong jika belum ada catatan", async () => {
    vi.spyOn(api, "apiFetch").mockImplementation((url) => {
      if (url.includes("/dashboard/stats")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          message: "OK",
          data: { totalNotes: 0, totalConcepts: 0, totalRelationships: 0, recentActivity: 0 },
        });
      }
      if (url.includes("/dashboard/recent-notes")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          message: "OK",
          data: { items: [] },
        });
      }
      return Promise.resolve({ ok: false, status: 404, message: "" });
    });

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText("Belum ada catatan")).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /Tulis catatan pertama/i })).toHaveAttribute(
        "href",
        "/notes/new"
      );
    });
  });

  it("menampilkan pesan error dan tombol Coba lagi saat gagal memuat data", async () => {
    const apiSpy = vi.spyOn(api, "apiFetch").mockResolvedValue({
      ok: false,
      status: 500,
      message: "Server database bermasalah",
    });

    const user = userEvent.setup();
    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
      expect(screen.getByText("Server database bermasalah")).toBeInTheDocument();
    });

    const retryBtn = screen.getByRole("button", { name: "Coba lagi" });
    await user.click(retryBtn);

    expect(apiSpy).toHaveBeenCalledTimes(4); // 2 endpoint saat muat dan 2 lagi saat retry
  });

  it("kotak pencarian cepat mengarahkan ke /search?q=...", async () => {
    vi.spyOn(api, "apiFetch").mockResolvedValue({
      ok: true,
      status: 200,
      message: "OK",
      data: { totalNotes: 0, items: [] },
    });

    const user = userEvent.setup();
    render(<DashboardPage />);

    const searchInput = screen.getByPlaceholderText(/Cari catatanmu berdasarkan makna…/i);
    await user.type(searchInput, "Arsitektur Microservices{Enter}");

    expect(mockPush).toHaveBeenCalledWith("/search?q=Arsitektur%20Microservices");
  });
});
