import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Avatar, PageHeader, Icon, NalarMark } from "@/components/ui";

describe("components/ui.tsx", () => {
  it("Avatar menampilkan huruf pertama kapital dari nama", () => {
    render(<Avatar name="budi santoso" />);
    expect(screen.getByText("B")).toBeInTheDocument();
  });

  it("Avatar aman dan menampilkan '?' jika nama kosong atau spasi saja", () => {
    const { rerender } = render(<Avatar name="" />);
    expect(screen.getByText("?")).toBeInTheDocument();

    rerender(<Avatar name="   " />);
    expect(screen.getByText("?")).toBeInTheDocument();
  });

  it("PageHeader menampilkan judul, subjudul, dan aksi", () => {
    render(
      <PageHeader
        title="Daftar Catatan"
        subtitle="Kelola semua catatanmu di sini"
        action={<button>Tambah Baru</button>}
      />
    );

    expect(screen.getByRole("heading", { level: 1, name: "Daftar Catatan" })).toBeInTheDocument();
    expect(screen.getByText("Kelola semua catatanmu di sini")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tambah Baru" })).toBeInTheDocument();
  });

  it("Icon memiliki atribut aria-hidden='true' sehingga tidak dibaca pembaca layar", () => {
    const { container } = render(<Icon name="notes" />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("aria-hidden", "true");
  });

  it("NalarMark memiliki role='img' dan aria-label='Nalar'", () => {
    render(<NalarMark />);
    expect(screen.getByRole("img", { name: "Nalar" })).toBeInTheDocument();
  });
});
