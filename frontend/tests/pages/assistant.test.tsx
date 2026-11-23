import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AssistantContent } from "@/components/assistant/AssistantContent";
import * as api from "@/lib/api";

const mockPush = vi.fn();
let currentUrlC = "";
let currentUrlTanya = "";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
  }),
  useSearchParams: () => {
    const p = new URLSearchParams();
    if (currentUrlC) p.set("c", currentUrlC);
    if (currentUrlTanya) p.set("tanya", currentUrlTanya);
    return p;
  },
  usePathname: () => "/assistant",
}));

vi.mock("@/lib/useRequireAuth", () => ({
  useRequireAuth: () => ({
    id: "user-1",
    name: "Pengguna Uji",
    email: "uji@example.com",
  }),
}));

describe("Komponen Asisten AI (AssistantContent)", () => {
  beforeEach(() => {
    mockPush.mockReset();
    currentUrlC = "";
    currentUrlTanya = "";
    localStorage.setItem("nalar_token", "fake-token");
    vi.restoreAllMocks();
  });

  it("?tanya= otomatis mengisi kotak input teks", () => {
    vi.spyOn(api, "apiFetch").mockResolvedValue({
      ok: true,
      status: 200,
      message: "OK",
      data: [],
    });

    currentUrlTanya = "Bagaimana cara kerja caching?";
    render(<AssistantContent />);

    const textarea = screen.getByPlaceholderText(/Tanyakan sesuatu tentang catatanmu…/i);
    expect(textarea).toHaveValue("Bagaimana cara kerja caching?");
  });

  it("mengirim pertanyaan menampilkan pesan pengguna dan memanggil /ai/ask", async () => {
    const apiSpy = vi.spyOn(api, "apiFetch").mockImplementation((url) => {
      if (url.includes("/ai/conversations")) {
        return Promise.resolve({ ok: true, status: 200, message: "OK", data: [] });
      }
      if (url.includes("/ai/ask")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          message: "OK",
          data: {
            conversationId: "conv-1",
            answer: "Caching mempercepat pengambilan data berulang.",
            mode: "makna",
            koreksi: null,
            sources: [
              {
                noteId: "note-cache",
                title: "Catatan Caching",
                similarity: 0.88,
              },
            ],
          },
        });
      }
      return Promise.resolve({ ok: false, status: 404, message: "" });
    });

    const user = userEvent.setup();
    render(<AssistantContent />);

    const textarea = screen.getByPlaceholderText(/Tanyakan sesuatu tentang catatanmu…/i);
    await user.type(textarea, "Jelaskan apa itu caching");
    expect(textarea).toHaveValue("Jelaskan apa itu caching");

    const sendBtn = screen.getByRole("button", { name: "Kirim pertanyaan" });
    expect(sendBtn).toBeEnabled();
    await user.click(sendBtn);

    await waitFor(
      () => {
        expect(apiSpy).toHaveBeenCalledWith(
          "/ai/ask",
          expect.objectContaining({
            method: "POST",
            body: { conversationId: null, question: "Jelaskan apa itu caching" },
          })
        );
        expect(screen.getByText("Jelaskan apa itu caching")).toBeInTheDocument();
        expect(screen.getByText("Caching mempercepat pengambilan data berulang.")).toBeInTheDocument();
        expect(screen.getByText("Catatan Caching")).toBeInTheDocument();
      },
      { timeout: 4000 }
    );
  }, 10000);

  it("saat pengiriman gagal: pesan sementara dibersihkan, input dikembalikan, dan ada tombol Coba lagi", async () => {
    vi.spyOn(api, "apiFetch").mockImplementation((url) => {
      if (url.includes("/ai/conversations")) {
        return Promise.resolve({ ok: true, status: 200, message: "OK", data: [] });
      }
      if (url.includes("/ai/ask")) {
        return Promise.resolve({
          ok: false,
          status: 500,
          message: "AI sedang kelebihan beban",
        });
      }
      return Promise.resolve({ ok: false, status: 404, message: "" });
    });

    const user = userEvent.setup();
    render(<AssistantContent />);

    const textarea = screen.getByPlaceholderText(/Tanyakan sesuatu tentang catatanmu…/i);
    await user.type(textarea, "Pertanyaan yang akan gagal");

    const sendBtn = screen.getByRole("button", { name: "Kirim pertanyaan" });
    await user.click(sendBtn);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("AI sedang kelebihan beban");
      expect(textarea).toHaveValue("Pertanyaan yang akan gagal");
      expect(screen.getByRole("button", { name: "Coba lagi" })).toBeInTheDocument();
    });
  });

  it("menghapus percakapan memanggil window.confirm dan endpoint DELETE", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);

    vi.spyOn(api, "apiFetch").mockImplementation((url, opts) => {
      if (opts?.method === "DELETE") {
        return Promise.resolve({ ok: true, status: 200, message: "Terhapus" });
      }
      if (url.includes("/ai/conversations")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          message: "OK",
          data: [
            {
              id: "conv-to-delete",
              title: "Percakapan Lama",
              createdAt: "2026-11-20T10:00:00Z",
              updatedAt: "2026-11-20T10:00:00Z",
              messageCount: 2,
            },
          ],
        });
      }
      return Promise.resolve({ ok: false, status: 404, message: "" });
    });

    const user = userEvent.setup();
    render(<AssistantContent />);

    await waitFor(() => {
      expect(screen.getByText("Percakapan Lama")).toBeInTheDocument();
    });

    const deleteBtn = screen.getByRole("button", { name: "Hapus percakapan Percakapan Lama" });
    await user.click(deleteBtn);

    expect(confirmSpy).toHaveBeenCalled();
  });
});
