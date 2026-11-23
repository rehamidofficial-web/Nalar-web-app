import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SummaryPanel } from "@/components/SummaryPanel";
import { ConceptPanel } from "@/components/ConceptPanel";
import * as api from "@/lib/api";

describe("components/SummaryPanel & ConceptPanel", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("SummaryPanel", () => {
    it("menampilkan teks tombol 'Ringkas dengan AI' bila belum ada ringkasan", () => {
      render(
        <SummaryPanel
          noteId="note-1"
          summary={null}
          onSummaryUpdated={vi.fn()}
        />
      );
      expect(
        screen.getByRole("button", { name: "Ringkas dengan AI" })
      ).toBeInTheDocument();
      expect(screen.getByText("Belum ada ringkasan.")).toBeInTheDocument();
    });

    it("menampilkan teks tombol 'Buat ulang ringkasan' bila sudah ada ringkasan", () => {
      render(
        <SummaryPanel
          noteId="note-1"
          summary="Ringkasan yang sudah ada"
          onSummaryUpdated={vi.fn()}
        />
      );
      expect(
        screen.getByRole("button", { name: "Buat ulang ringkasan" })
      ).toBeInTheDocument();
      expect(screen.getByText("Ringkasan yang sudah ada")).toBeInTheDocument();
    });

    it("menonaktifkan tombol dan menampilkan peringatan bila isDirty=true", () => {
      render(
        <SummaryPanel
          noteId="note-1"
          summary={null}
          isDirty={true}
          onSummaryUpdated={vi.fn()}
        />
      );

      const btn = screen.getByRole("button", { name: "Ringkas dengan AI" });
      expect(btn).toBeDisabled();
      expect(
        screen.getByText(/Simpan perubahan dulu agar ringkasan memakai isi catatan terbaru/i)
      ).toBeInTheDocument();
    });

    it("memanggil /ai/summarize, aria-busy saat memuat, dan menampilkan ringkasan baru beserta catatan kaki jika terpotong", async () => {
      const onSummaryUpdated = vi.fn();
      const apiSpy = vi.spyOn(api, "apiFetch").mockResolvedValueOnce({
        ok: true,
        status: 200,
        message: "OK",
        data: {
          noteId: "note-1",
          summary: "Hasil ringkasan dari model AI",
          model: "gemini-flash",
          terpotong: true,
        },
      });

      const user = userEvent.setup();
      const { rerender } = render(
        <SummaryPanel
          noteId="note-1"
          summary={null}
          onSummaryUpdated={onSummaryUpdated}
        />
      );

      const btn = screen.getByRole("button", { name: "Ringkas dengan AI" });
      await user.click(btn);

      expect(apiSpy).toHaveBeenCalledWith("/ai/summarize", {
        method: "POST",
        token: null,
        body: { noteId: "note-1" },
      });

      await waitFor(() => {
        expect(onSummaryUpdated).toHaveBeenCalledWith(
          "Hasil ringkasan dari model AI"
        );
      });

      // Update prop summary
      rerender(
        <SummaryPanel
          noteId="note-1"
          summary="Hasil ringkasan dari model AI"
          onSummaryUpdated={onSummaryUpdated}
        />
      );

      expect(screen.getByText("Hasil ringkasan dari model AI")).toBeInTheDocument();
      expect(
        screen.getByText(/Catatan terlalu panjang, hanya bagian awalnya yang diringkas/i)
      ).toBeInTheDocument();
    });

    it("menampilkan pesan error dan tombol 'Coba lagi' saat API gagal", async () => {
      const apiSpy = vi.spyOn(api, "apiFetch").mockResolvedValueOnce({
        ok: false,
        status: 500,
        message: "AI sedang sibuk",
      });

      const user = userEvent.setup();
      render(
        <SummaryPanel
          noteId="note-1"
          summary={null}
          onSummaryUpdated={vi.fn()}
        />
      );

      await user.click(screen.getByRole("button", { name: "Ringkas dengan AI" }));

      await waitFor(() => {
        expect(screen.getByRole("alert")).toHaveTextContent("AI sedang sibuk");
      });

      // Uji Coba lagi
      apiSpy.mockResolvedValueOnce({
        ok: true,
        status: 200,
        message: "OK",
        data: {
          noteId: "note-1",
          summary: "Berhasil coba lagi",
          model: "gemini-flash",
          terpotong: false,
        },
      });

      await user.click(screen.getByRole("button", { name: "Coba lagi" }));
      expect(apiSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe("ConceptPanel", () => {
    it("menampilkan 'Ekstrak Konsep dengan AI' bila belum ada konsep", () => {
      render(
        <ConceptPanel
          noteId="note-1"
          concepts={[]}
          onConceptsUpdated={vi.fn()}
        />
      );
      expect(
        screen.getByRole("button", { name: "Ekstrak Konsep dengan AI" })
      ).toBeInTheDocument();
      expect(screen.getByText("Belum ada konsep.")).toBeInTheDocument();
    });

    it("menampilkan 'Ekstrak ulang konsep' dan daftar chip konsep bila ada", () => {
      const concepts = [
        { id: "c1", name: "TypeScript", description: "Bahasa pemrograman dengan tipe" },
        { id: "c2", name: "Vitest", description: "Framework pengetesan kilat" },
      ];

      render(
        <ConceptPanel
          noteId="note-1"
          concepts={concepts}
          onConceptsUpdated={vi.fn()}
        />
      );

      expect(
        screen.getByRole("button", { name: "Ekstrak ulang konsep" })
      ).toBeInTheDocument();
      expect(screen.getByText("TypeScript")).toBeInTheDocument();
      expect(screen.getByText("Vitest")).toBeInTheDocument();
    });

    it("memanggil /ai/extract-concepts dan memperbarui konsep", async () => {
      const onConceptsUpdated = vi.fn();
      vi.spyOn(api, "apiFetch").mockResolvedValueOnce({
        ok: true,
        status: 200,
        message: "OK",
        data: {
          noteId: "note-1",
          concepts: [
            { id: "c1", name: "Next.js", description: "Framework React" },
          ],
          model: "gemini-flash",
          terpotong: false,
        },
      });

      const user = userEvent.setup();
      render(
        <ConceptPanel
          noteId="note-1"
          concepts={[]}
          onConceptsUpdated={onConceptsUpdated}
        />
      );

      await user.click(screen.getByRole("button", { name: "Ekstrak Konsep dengan AI" }));

      await waitFor(() => {
        expect(onConceptsUpdated).toHaveBeenCalledWith([
          { id: "c1", name: "Next.js", description: "Framework React" },
        ]);
      });
    });
  });
});
