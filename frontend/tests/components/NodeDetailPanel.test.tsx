import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NodeDetailPanel } from "@/components/graph/NodeDetailPanel";
import { GraphNode, GraphEdge } from "@/types/graph";

describe("components/graph/NodeDetailPanel", () => {
  it("tanpa node menampilkan pesan ajakan 'Pilih sebuah titik'", () => {
    render(
      <NodeDetailPanel
        node={null}
        edges={[]}
        allNodes={[]}
        onSelectId={vi.fn()}
      />
    );

    expect(screen.getByText("Pilih sebuah titik")).toBeInTheDocument();
    expect(
      screen.getByText(/Klik salah satu titik di graph untuk melihat catatan itu terhubung ke mana saja/i)
    ).toBeInTheDocument();
  });

  it("dengan node menampilkan judul, jumlah hubungan, tag, dan tanggal", () => {
    const node: GraphNode = {
      id: "node-1",
      label: "Belajar Next.js",
      type: "note",
      tags: ["frontend", "react"],
      jumlahHubungan: 0,
      updatedAt: "2026-11-20T10:00:00.000Z",
      pusat: false,
    };

    render(
      <NodeDetailPanel
        node={node}
        edges={[]}
        allNodes={[node]}
        onSelectId={vi.fn()}
      />
    );

    expect(screen.getByRole("heading", { level: 2, name: "Belajar Next.js" })).toBeInTheDocument();
    expect(screen.getByText(/0 hubungan/i)).toBeInTheDocument();
    expect(screen.getByText(/#frontend, #react/i)).toBeInTheDocument();
  });

  it("daftar 'Terhubung ke' menampilkan tetangga dengan label 'Mirip N%' dan 'Konsep sama'", () => {
    const node: GraphNode = {
      id: "n1",
      label: "Catatan Utama",
      type: "note",
      tags: [],
      jumlahHubungan: 2,
      updatedAt: "",
    };
    const n2: GraphNode = {
      id: "n2",
      label: "Catatan Mirip",
      type: "note",
      tags: [],
      jumlahHubungan: 1,
      updatedAt: "",
    };
    const n3: GraphNode = {
      id: "n3",
      label: "Catatan Sekonsep",
      type: "note",
      tags: [],
      jumlahHubungan: 1,
      updatedAt: "",
    };

    const edges: GraphEdge[] = [
      { source: "n1", target: "n2", type: "similar", similarity: 0.85 },
      { source: "n1", target: "n3", type: "concept", similarity: null },
    ];

    render(
      <NodeDetailPanel
        node={node}
        edges={edges}
        allNodes={[node, n2, n3]}
        onSelectId={vi.fn()}
      />
    );

    expect(screen.getByText("Catatan Mirip")).toBeInTheDocument();
    expect(screen.getByText("Mirip 85%")).toBeInTheDocument();

    expect(screen.getByText("Catatan Sekonsep")).toBeInTheDocument();
    expect(screen.getByText("Konsep sama")).toBeInTheDocument();
  });

  it("klik tetangga memanggil onSelectId dengan ID yang benar", async () => {
    const onSelectId = vi.fn();
    const user = userEvent.setup();

    const node: GraphNode = {
      id: "n1",
      label: "Utama",
      type: "note",
      tags: [],
      jumlahHubungan: 1,
      updatedAt: "",
    };
    const n2: GraphNode = {
      id: "n2",
      label: "Tetangga Satu",
      type: "note",
      tags: [],
      jumlahHubungan: 1,
      updatedAt: "",
    };
    const edges: GraphEdge[] = [
      { source: "n1", target: "n2", type: "concept", similarity: null },
    ];

    render(
      <NodeDetailPanel
        node={node}
        edges={edges}
        allNodes={[node, n2]}
        onSelectId={onSelectId}
      />
    );

    await user.click(screen.getByRole("button", { name: /Tetangga Satu/i }));
    expect(onSelectId).toHaveBeenCalledWith("n2");
  });

  it("tautan 'Buka catatan ini' mengarah ke /notes/:id dan 'Tanya AI' membawa query ter-encode", () => {
    const node: GraphNode = {
      id: "n123",
      label: "Arsitektur Web",
      type: "note",
      tags: [],
      jumlahHubungan: 0,
      updatedAt: "",
    };

    render(
      <NodeDetailPanel
        node={node}
        edges={[]}
        allNodes={[node]}
        onSelectId={vi.fn()}
      />
    );

    const openLink = screen.getByRole("link", { name: "Buka catatan ini" });
    expect(openLink).toHaveAttribute("href", "/notes/n123");

    const askLink = screen.getByRole("link", { name: "Tanya AI tentang ini" });
    expect(askLink).toHaveAttribute(
      "href",
      `/assistant?tanya=${encodeURIComponent('Jelaskan isi dan hubungan catatan "Arsitektur Web"')}`
    );
  });
});
