import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConfirmDialog } from "@/components/ConfirmDialog";

describe("components/ConfirmDialog", () => {
  it("tidak tampil saat isOpen=false", () => {
    const { container } = render(
      <ConfirmDialog
        isOpen={false}
        title="Konfirmasi Hapus"
        message="Apakah Anda yakin?"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it("tampil dengan judul dan pesan saat isOpen=true", () => {
    render(
      <ConfirmDialog
        isOpen={true}
        title="Hapus Catatan"
        message="Catatan ini akan dihapus permanen."
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Hapus Catatan" })).toBeInTheDocument();
    expect(screen.getByText("Catatan ini akan dihapus permanen.")).toBeInTheDocument();
  });

  it("fokus awal otomatis ke tombol Batal", () => {
    render(
      <ConfirmDialog
        isOpen={true}
        title="Hapus"
        message="Yakin?"
        cancelLabel="Batal"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    const cancelBtn = screen.getByRole("button", { name: "Batal" });
    expect(cancelBtn).toHaveFocus();
  });

  it("menekan tombol Escape menutup dialog melalui onCancel", () => {
    const onCancel = vi.fn();
    render(
      <ConfirmDialog
        isOpen={true}
        title="Hapus"
        message="Yakin?"
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />
    );

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("Escape tidak menutup dialog saat isLoading=true", () => {
    const onCancel = vi.fn();
    render(
      <ConfirmDialog
        isOpen={true}
        isLoading={true}
        title="Hapus"
        message="Yakin?"
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />
    );

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("klik di area latar luar dialog memanggil onCancel, sedangkan klik di dalam kotak dialog tidak", async () => {
    const onCancel = vi.fn();
    const user = userEvent.setup();

    render(
      <ConfirmDialog
        isOpen={true}
        title="Hapus"
        message="Yakin?"
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />
    );

    // Klik di dialog container (latar)
    const dialogBackdrop = screen.getByRole("dialog");
    await user.click(dialogBackdrop);
    expect(onCancel).toHaveBeenCalledTimes(1);

    onCancel.mockClear();
    // Klik di teks judul di dalam kotak dialog
    const title = screen.getByRole("heading", { level: 2, name: "Hapus" });
    await user.click(title);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("tombol konfirmasi dan batal memanggil fungsi callback yang sesuai", async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    const user = userEvent.setup();

    render(
      <ConfirmDialog
        isOpen={true}
        title="Hapus"
        message="Yakin?"
        confirmLabel="Ya, Hapus"
        cancelLabel="Jangan"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );

    await user.click(screen.getByRole("button", { name: "Jangan" }));
    expect(onCancel).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "Ya, Hapus" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("saat isLoading=true, kedua tombol nonaktif dan tombol konfirmasi menampilkan 'Memproses...'", () => {
    render(
      <ConfirmDialog
        isOpen={true}
        isLoading={true}
        title="Hapus"
        message="Yakin?"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    const cancelBtn = screen.getByRole("button", { name: "Batal" });
    const confirmBtn = screen.getByRole("button", { name: "Memproses..." });

    expect(cancelBtn).toBeDisabled();
    expect(confirmBtn).toBeDisabled();
  });
});
