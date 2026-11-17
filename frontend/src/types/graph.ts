export interface GraphNode {
  id: string;
  label: string;
  type: string;
  tags: string[];
  jumlahHubungan: number;
  updatedAt: string;
  pusat?: boolean;
  // Properti simulasi force graph (diisi otomatis oleh react-force-graph)
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
}

export interface GraphEdge {
  source: string | GraphNode;
  target: string | GraphNode;
  type: "similar" | "concept";
  similarity: number | null;
}

export interface GraphMeta {
  totalCatatan: number;
  jumlahNode: number;
  jumlahEdge: number;
  terpotong: boolean;
  pusat?: string;
}

export interface GraphResponseData {
  pusat?: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  meta: GraphMeta;
}
