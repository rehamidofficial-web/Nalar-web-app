import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NoteEditor } from "@/components/NoteEditor";
import * as api from "@/lib/api";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
  }),
}));

describe("components/NoteEditor", () => {
  beforeEach(() => {
    mockPush.mockReset();
    vi.restoreAllMocks();
  });

  it("judul kosong menampilkan pesan kesalahan dan tidak memanggil API", async () => {
    const apiSpy = vi.spyOn(api, "apiFetch");
    const user = userEvent.setup();

    render(<NoteEditor />);

    const contentInput = screen.getByLabelText(/Isi catatan/i);
    await user.type(contentInput, "Isi tanpa judul");

    await user.click(screen.getByRole("button", { name: "Simpan" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Judul wajib diisi");
    expect(apiSpy).not.toHaveBeenCalled();
  });

  it("isi kosong menampilkan pesan kesalahan dan tidak memanggil API", async () => {
    const apiSpy = vi.spyOn(api, "apiFetch");
    const user = userEvent.setup();

    render(<NoteEditor />);

    const titleInput = screen.getByLabelText(/Judul/i);
    await user.type(titleInput, "Judul Catatan");

    await user.click(screen.getByRole("button", { name: "Simpan" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Isi catatan wajib diisi");
    expect(apiSpy).not.toHaveBeenCalled();
  });

  it("manajemen tag: tambah dengan Enter dan koma, huruf kecil, duplikat diabaikan, hapus tag", async () => {
    const user = userEvent.setup();
    render(<NoteEditor />);

    const tagInput = screen.getByPlaceholderText("+ Tambah tag");

    // Tambah tag dengan Enter & huruf kapital (harus jadi lowercase)
    await user.type(tagInput, "React{Enter}");
    expect(screen.getByText("react")).toBeInTheDocument();

    // Tambah tag dengan koma
    await user.type(tagInput, "nextjs,");
    expect(screen.getByText("nextjs")).toBeInTheDocument();

    // Duplikat diabaikan
    await user.type(tagInput, "react{Enter}");
    const reactTags = screen.getAllByText("react");
    expect(reactTags).toHaveLength(1);

    // Hapus tag
    const deleteBtn = screen.getByRole("button", { name: "Hapus tag react" });
    await user.click(deleteBtn);
    expect(screen.queryByText("react")).not.toBeInTheDocument();
  });

  it("tag lebih dari 30 karakter ditolak dengan pesan kesalahan", async () => {
    const user = userEvent.setup();
    render(<NoteEditor />);

    const tagInput = screen.getByPlaceholderText("+ Tambah tag");
    const longTag = "a".repeat(31);
    await user.type(tagInput, `${longTag}{Enter}`);

    expect(screen.getByRole("alert")).toHaveTextContent("Tag maksimal 30 karakter");
  });

  it("penghitung kata dan karakter berjalan dengan benar", async () => {
    const user = userEvent.setup();
    render(<NoteEditor />);

    const contentInput = screen.getByLabelText(/Isi catatan/i);
    await user.type(contentInput, "Satu dua tiga");

    expect(screen.getByText(/3 kata/i)).toBeInTheDocument();
    expect(screen.getByText(/13 \/ 50.000/i)).toBeInTheDocument();
  });

  it("isi lebih dari 50.000 karakter menonaktifkan tombol Simpan", () => {
    const hugeContent = "x".repeat(50001);
    render(
      <NoteEditor initialData={{ title: "Catatan Besar", content: hugeContent }} />
    );

    const saveBtn = screen.getByRole("button", { name: "Simpan" });
    expect(saveBtn).toBeDisabled();
    expect(screen.getByText(/50.001 \/ 50.000/i)).toBeInTheDocument();
  });

  it("mode baru memanggil POST /notes dengan judul dan isi yang di-trim", async () => {
    const apiSpy = vi.spyOn(api, "apiFetch").mockResolvedValueOnce({
      ok: true,
      status: 201,
      message: "Sukses",
      data: { id: "new-id" },
    });

    const user = userEvent.setup();
    render(<NoteEditor />);

    await user.type(screen.getByLabelText(/Judul/i), "   Belajar Testing   ");
    await user.type(screen.getByLabelText(/Isi catatan/i), "   Konten pengujian   ");
    await user.click(screen.getByRole("button", { name: "Simpan" }));

    await waitFor(() => {
      expect(apiSpy).toHaveBeenCalledWith("/notes", {
        method: "POST",
        token: null,
        body: {
          title: "Belajar Testing",
          content: "Konten pengujian",
          tags: [],
        },
      });
      expect(mockPush).toHaveBeenCalledWith("/notes");
    });
  });

  it("mode ubah memanggil PATCH /notes/:id dan mendukung onSaveSuccess", async () => {
    const onSaveSuccess = vi.fn();
    const apiSpy = vi.spyOn(api, "apiFetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      message: "Berhasil diubah",
    });

    const user = userEvent.setup();
    render(
      <NoteEditor
        isEdit={true}
        initialData={{ id: "note-456", title: "Judul Lama", content: "Isi Lama", tags: ["lama"] }}
        onSaveSuccess={onSaveSuccess}
      />
    );

    const titleInput = screen.getByLabelText(/Judul/i);
    await user.clear(titleInput);
    await user.type(titleInput, "Judul Baru");

    await user.click(screen.getByRole("button", { name: "Simpan" }));

    await waitFor(() => {
      expect(apiSpy).toHaveBeenCalledWith("/notes/note-456", {
        method: "PATCH",
        token: null,
        body: {
          title: "Judul Baru",
          content: "Isi Lama",
          tags: ["lama"],
        },
      });
      expect(onSaveSuccess).toHaveBeenCalled();
    });
  });

  it("menampilkan pesan kesalahan dari API jika simpan gagal", async () => {
    vi.spyOn(api, "apiFetch").mockResolvedValueOnce({
      ok: false,
      status: 400,
      message: "Judul sudah dipakai",
    });

    const user = userEvent.setup();
    render(<NoteEditor />);

    await user.type(screen.getByLabelText(/Judul/i), "Judul");
    await user.type(screen.getByLabelText(/Isi catatan/i), "Isi");
    await user.click(screen.getByRole("button", { name: "Simpan" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Judul sudah dipakai");
    });
  });

  it("tombol Batal mengarahkan kembali ke /notes", async () => {
    const user = userEvent.setup();
    render(<NoteEditor />);

    await user.click(screen.getByRole("button", { name: "Batal" }));
    expect(mockPush).toHaveBeenCalledWith("/notes");
  });

  it("form catatan baru dengan key baru tidak menyimpan isi lama (reset state saat remount)", () => {
    const { rerender } = render(
      <NoteEditor key="form-1" initialData={{ title: "Catatan Satu", content: "Isi Satu" }} />
    );

    expect(screen.getByLabelText(/Judul/i)).toHaveValue("Catatan Satu");

    rerender(<NoteEditor key="form-2" />);
    expect(screen.getByLabelText(/Judul/i)).toHaveValue("");
    expect(screen.getByLabelText(/Isi catatan/i)).toHaveValue("");
  });
});
