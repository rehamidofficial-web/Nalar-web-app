import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Pagination } from "@/components/Pagination";

describe("components/Pagination", () => {
  it("tidak tampil bila totalPages <= 1", () => {
    const { container } = render(
      <Pagination
        page={1}
        totalPages={1}
        total={5}
        limit={10}
        onPageChange={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it("menampilkan teks 'Halaman X dari Y'", () => {
    render(
      <Pagination
        page={2}
        totalPages={5}
        total={50}
        limit={10}
        onPageChange={vi.fn()}
      />
    );
    expect(screen.getByText("Halaman 2 dari 5")).toBeInTheDocument();
  });

  it("Sebelumnya nonaktif di halaman 1 dan Berikutnya aktif", () => {
    render(
      <Pagination
        page={1}
        totalPages={3}
        total={30}
        limit={10}
        onPageChange={vi.fn()}
      />
    );

    const prevBtn = screen.getByRole("button", { name: "Sebelumnya" });
    const nextBtn = screen.getByRole("button", { name: "Berikutnya" });

    expect(prevBtn).toBeDisabled();
    expect(nextBtn).toBeEnabled();
  });

  it("Berikutnya nonaktif di halaman terakhir dan Sebelumnya aktif", () => {
    render(
      <Pagination
        page={3}
        totalPages={3}
        total={30}
        limit={10}
        onPageChange={vi.fn()}
      />
    );

    const prevBtn = screen.getByRole("button", { name: "Sebelumnya" });
    const nextBtn = screen.getByRole("button", { name: "Berikutnya" });

    expect(prevBtn).toBeEnabled();
    expect(nextBtn).toBeDisabled();
  });

  it("kedua tombol nonaktif bila disabled=true", () => {
    render(
      <Pagination
        page={2}
        totalPages={4}
        total={40}
        limit={10}
        disabled={true}
        onPageChange={vi.fn()}
      />
    );

    expect(screen.getByRole("button", { name: "Sebelumnya" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Berikutnya" })).toBeDisabled();
  });

  it("klik tombol Sebelumnya dan Berikutnya memanggil onPageChange dengan nomor yang benar", async () => {
    const onPageChange = vi.fn();
    const user = userEvent.setup();

    render(
      <Pagination
        page={2}
        totalPages={4}
        total={40}
        limit={10}
        onPageChange={onPageChange}
      />
    );

    await user.click(screen.getByRole("button", { name: "Sebelumnya" }));
    expect(onPageChange).toHaveBeenCalledWith(1);

    await user.click(screen.getByRole("button", { name: "Berikutnya" }));
    expect(onPageChange).toHaveBeenCalledWith(3);
  });
});
