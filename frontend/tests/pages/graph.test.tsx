import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GraphContent } from "@/components/graph/GraphContent";
import * as api from "@/lib/api";

const mockPush = vi.fn();
let currentCatatanQuery = "";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(currentCatatanQuery ? `catatan=${currentCatatanQuery}` : ""),
  usePathname: () => "/graph",
}));

vi.mock("@/lib/useRequireAuth", () => ({
  useRequireAuth: () => ({
    id: "user-1",
    name: "Pengguna Uji",
    email: "uji@example.com",
  }),
}));

// Mock GraphCanvas agar tidak menjalankan react-force-graph-2d dan WebGL/Canvas sungguhan
vi.mock("@/components/graph/GraphCanvas", () => ({
  default: function MockGraphCanvas(props: {
    nodes: unknown[];
    onSelectNode: (node: unknown) => void;
    onBackgroundClick: () => void;
    onApiReady: (api: unknown) => void;
    onZoomChange: (z: number) => void;
  }) {
    return (
      <div data-testid="mock-graph-canvas">
        <button
          onClick={() =>
            props.onSelectNode({
              id: "node-2",
              label: "Node Dua",
              tags: ["test"],
              jumlahHubungan: 1,
              updatedAt: "",
            })
          }
        >
          Pilih Node Dua
        </button>
        <button onClick={() => props.onBackgroundClick()}>Klik Latar Belakang</button>
      </div>
    );
  },
}));

describe("Komponen Graph (GraphContent)", () => {
  beforeEach(() => {
    mockPush.mockReset();
    currentCatatanQuery = "";
    localStorage.setItem("nalar_token", "fake-token");
    vi.restoreAllMocks();
  });

  it("menampilkan status sukses dengan jumlah catatan dan hubungan di toolbar", async () => {
    vi.spyOn(api, "apiFetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      message: "OK",
      data: {
        nodes: [
          { id: "node-1", label: "Node Satu", tags: [], jumlahHubungan: 1, updatedAt: "" },
          { id: "node-2", label: "Node Dua", tags: [], jumlahHubungan: 1, updatedAt: "" },
        ],
        edges: [{ source: "node-1", target: "node-2", type: "similar", similarity: 0.9 }],
        meta: { totalCatatan: 2, jumlahNode: 2, jumlahEdge: 1, terpotong: false },
      },
    });

    render(<GraphContent />);

    await waitFor(() => {
      expect(screen.getByText(/2 catatan/i)).toBeInTheDocument();
      expect(screen.getByText(/1 hubungan/i)).toBeInTheDocument();
    });
  });

  it("memilih node dari kanvas menampilkan detail di NodeDetailPanel dan klik latar mengosongkan pilihan", async () => {
    vi.spyOn(api, "apiFetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      message: "OK",
      data: {
        nodes: [{ id: "node-2", label: "Node Dua", tags: ["test"], jumlahHubungan: 0, updatedAt: "" }],
        edges: [],
        meta: { totalCatatan: 1, jumlahNode: 1, jumlahEdge: 0, terpotong: false },
      },
    });

    const user = userEvent.setup();
    render(<GraphContent />);

    await waitFor(() => {
      expect(screen.getByTestId("mock-graph-canvas")).toBeInTheDocument();
    });

    // Awalnya belum ada node yang dipilih
    expect(screen.getByText("Pilih sebuah titik")).toBeInTheDocument();

    // Klik tombol pilih node
    await user.click(screen.getByText("Pilih Node Dua"));
    expect(screen.getByRole("heading", { level: 2, name: "Node Dua" })).toBeInTheDocument();

    // Klik latar belakang
    await user.click(screen.getByText("Klik Latar Belakang"));
    expect(screen.getByText("Pilih sebuah titik")).toBeInTheDocument();
  });

  it("mode fokus ?catatan=<id> memanggil /graph/<id> dan dapat kembali ke semua catatan", async () => {
    currentCatatanQuery = "note-fokus";

    const apiSpy = vi.spyOn(api, "apiFetch").mockResolvedValue({
      ok: true,
      status: 200,
      message: "OK",
      data: {
        nodes: [{ id: "note-fokus", label: "Fokus Catatan", tags: [], jumlahHubungan: 0, updatedAt: "" }],
        edges: [],
        meta: { totalCatatan: 1, jumlahNode: 1, jumlahEdge: 0, terpotong: false },
      },
    });

    render(<GraphContent />);

    await waitFor(() => {
      expect(apiSpy).toHaveBeenCalledWith("/graph/note-fokus", expect.any(Object));
    });

    await userEvent.setup().click(screen.getByRole("button", { name: "Semua catatan" }));
    expect(mockPush).toHaveBeenCalledWith("/graph");
  });
});
