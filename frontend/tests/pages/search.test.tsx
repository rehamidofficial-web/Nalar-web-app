import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SearchContent } from "@/components/SearchContent";
import * as api from "@/lib/api";

const mockPush = vi.fn();
let currentQ = "";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(currentQ ? `q=${currentQ}` : ""),
  usePathname: () => "/search",
}));

vi.mock("@/lib/useRequireAuth", () => ({
  useRequireAuth: () => ({
    id: "user-1",
    name: "Pengguna Uji",
    email: "uji@example.com",
  }),
}));

describe("Komponen Pencarian (SearchContent)", () => {
  beforeEach(() => {
    mockPush.mockReset();
    currentQ = "";
    localStorage.clear();
    localStorage.setItem("nalar_token", "fake-token");
    vi.restoreAllMocks();
  });

  it("kurang dari 2 huruf tidak memicu pencarian ke API", async () => {
    const apiSpy = vi.spyOn(api, "apiFetch");
    const user = userEvent.setup();

    render(<SearchContent />);

    const input = screen.getByPlaceholderText(/Contoh: bagaimana sebuah website bicara dengan server/i);
    await user.type(input, "a{Enter}");

    expect(apiSpy).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("mencari lewat URL ?q= dan menampilkan hasil pencarian dengan persentase relevansi", async () => {
    currentQ = "arsitektur";

    vi.spyOn(api, "apiFetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      message: "OK",
      data: {
        mode: "makna",
        query: "arsitektur",
        koreksi: null,
        results: [
          {
            noteId: "note-1",
            title: "Clean Architecture",
            cuplikan: "Pemisahan domain layer dan data layer...",
            tags: ["arsitektur", "design-pattern"],
            similarity: 0.92,
            updatedAt: "2026-11-20T10:00:00Z",
          },
        ],
        belumDiindeks: 0,
      },
    });

    render(<SearchContent />);

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { level: 3, name: "Clean Architecture" })
      ).toBeInTheDocument();
      expect(screen.getByText("92%")).toBeInTheDocument();
      expect(screen.getByText("Sangat relevan")).toBeInTheDocument();
    });
  });

  it("menampilkan teks koreksi kata bila AI mengoreksi typo", async () => {
    currentQ = "pyton";

    vi.spyOn(api, "apiFetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      message: "OK",
      data: {
        mode: "makna",
        query: "python",
        koreksi: {
          asli: "pyton",
          dipakai: "python",
          perubahan: [{ dari: "pyton", ke: "python" }],
        },
        results: [],
        belumDiindeks: 0,
      },
    });

    render(<SearchContent />);

    await waitFor(() => {
      const correction = screen.getByText(
        (_, element) =>
          element?.tagName === "P" && Boolean(element.textContent?.includes("Menampilkan hasil untuk"))
      );
      expect(correction).toHaveTextContent("python");
      expect(correction).toHaveTextContent("pyton");
    });
  });

  it("menampilkan hasil cadangan kata, ajakan menulis, dan jumlah catatan belum diindeks", async () => {
    currentQ = "nalar";
    vi.spyOn(api, "apiFetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      message: "Pencarian kata biasa digunakan.",
      data: {
        mode: "kata",
        query: "nalar",
        koreksi: null,
        results: [],
        belumDiindeks: 2,
      },
    });

    render(<SearchContent />);

    await waitFor(() => {
      expect(screen.getByText("Pencarian kata biasa digunakan.")).toBeInTheDocument();
      expect(screen.getByText(/Catatanmu belum membahas hal ini/i)).toBeInTheDocument();
      expect(
        screen.getByRole("link", { name: "Tulis catatan baru" })
      ).toHaveAttribute("href", "/notes/new");
      expect(screen.getByText(/2 catatan belum bisa dicari/i)).toBeInTheDocument();
    });
  });

  it("menyaring hasil berdasarkan tag dan memperbarui jumlah hasil", async () => {
    currentQ = "arsitektur";
    vi.spyOn(api, "apiFetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      message: "OK",
      data: {
        mode: "makna",
        query: "arsitektur",
        koreksi: null,
        results: [
          {
            noteId: "note-1",
            title: "Catatan Arsitektur",
            cuplikan: "Pemisahan komponen aplikasi.",
            tags: ["arsitektur"],
            similarity: 0.9,
            updatedAt: "2026-11-20T10:00:00Z",
          },
          {
            noteId: "note-2",
            title: "Catatan Docker",
            cuplikan: "Container untuk layanan.",
            tags: ["devops"],
            similarity: 0.8,
            updatedAt: "2026-11-20T10:00:00Z",
          },
        ],
        belumDiindeks: 0,
      },
    });

    const user = userEvent.setup();
    render(<SearchContent />);

    await waitFor(() => {
      expect(screen.getByText("2 catatan ditemukan untuk “arsitektur”, yang paling relevan di atas")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "arsitektur (1)" }));

    expect(screen.getByText("1 catatan ditemukan untuk “arsitektur”, yang paling relevan di atas")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "Catatan Arsitektur" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 3, name: "Catatan Docker" })).not.toBeInTheDocument();
  });

  it("menyimpan pencarian baru dan membatasi riwayat maksimal lima", async () => {
    currentQ = "graphql";
    localStorage.setItem(
      "nalar_recent_searches",
      JSON.stringify(["react", "vue", "svelte", "angular", "solid"])
    );

    let resolveSearch: ((value: {
      ok: boolean;
      status: number;
      message: string;
      data: {
        mode: "makna";
        query: string;
        koreksi: null;
        results: [];
        belumDiindeks: number;
      };
    }) => void) | undefined;
    vi.spyOn(api, "apiFetch").mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSearch = resolve;
        })
    );

    render(<SearchContent />);

    await screen.findByRole("button", { name: "react" });
    resolveSearch?.({
      ok: true,
      status: 200,
      message: "OK",
      data: {
        mode: "makna",
        query: "graphql",
        koreksi: null,
        results: [],
        belumDiindeks: 0,
      },
    });

    await waitFor(() => {
      expect(JSON.parse(localStorage.getItem("nalar_recent_searches") ?? "[]")).toEqual([
        "graphql",
        "react",
        "vue",
        "svelte",
        "angular",
      ]);
    });
  });

  it("tidak menggandakan pencarian yang sama di riwayat", async () => {
    currentQ = "react";
    localStorage.setItem(
      "nalar_recent_searches",
      JSON.stringify(["react", "vue", "svelte"])
    );
    vi.spyOn(api, "apiFetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      message: "OK",
      data: {
        mode: "makna",
        query: "react",
        koreksi: null,
        results: [],
        belumDiindeks: 0,
      },
    });

    render(<SearchContent />);

    await waitFor(() => {
      expect(screen.getByText(/0 catatan ditemukan untuk “react”/)).toBeInTheDocument();
    });

    const recent = JSON.parse(localStorage.getItem("nalar_recent_searches") ?? "[]") as string[];
    expect(recent.filter((query) => query === "react")).toHaveLength(1);
  });

  it("menyimpan riwayat pencarian di localStorage dan bisa diklik untuk mencari ulang", async () => {
    localStorage.setItem(
      "nalar_recent_searches",
      JSON.stringify(["react hooks", "state management"])
    );

    const user = userEvent.setup();
    render(<SearchContent />);

    await waitFor(() => {
      expect(screen.getByText("react hooks")).toBeInTheDocument();
      expect(screen.getByText("state management")).toBeInTheDocument();
    });

    await user.click(screen.getByText("react hooks"));
    expect(mockPush).toHaveBeenCalledWith("/search?q=react+hooks");
  });
});
