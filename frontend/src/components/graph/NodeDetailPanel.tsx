"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { GraphNode, GraphEdge } from "@/types/graph";
import { GRAPH_THEME } from "@/lib/graphTheme";

interface NodeDetailPanelProps {
  node: GraphNode;
  edges: GraphEdge[];
  allNodes: GraphNode[];
  isFocusMode: boolean;
  onClose: () => void;
  onFocusNode: (nodeId: string) => void;
  onResetFocus: () => void;
}

export function NodeDetailPanel({
  node,
  edges,
  allNodes,
  isFocusMode,
  onClose,
  onFocusNode,
  onResetFocus,
}: NodeDetailPanelProps) {
  // Buat map id -> GraphNode untuk lookup cepat
  const nodeMap = useMemo(() => {
    const map = new Map<string, GraphNode>();
    allNodes.forEach((n) => map.set(n.id, n));
    return map;
  }, [allNodes]);

  // Cari tetangga-tetangga dari node ini beserta info relasinya
  const neighbors = useMemo(() => {
    const list: {
      id: string;
      label: string;
      type: "similar" | "concept";
      similarity: number | null;
    }[] = [];

    edges.forEach((edge) => {
      const sourceId = typeof edge.source === "object" ? (edge.source as GraphNode).id : edge.source;
      const targetId = typeof edge.target === "object" ? (edge.target as GraphNode).id : edge.target;

      let neighborId: string | null = null;
      if (sourceId === node.id) {
        neighborId = targetId;
      } else if (targetId === node.id) {
        neighborId = sourceId;
      }

      if (neighborId) {
        const neighborNode = nodeMap.get(neighborId);
        list.push({
          id: neighborId,
          label: neighborNode ? neighborNode.label : "Catatan",
          type: edge.type,
          similarity: edge.similarity,
        });
      }
    });

    return list;
  }, [node.id, edges, nodeMap]);

  // Format tanggal updatedAt
  const tanggalFormat = useMemo(() => {
    if (!node.updatedAt) return "-";
    try {
      const d = new Date(node.updatedAt);
      return d.toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    } catch {
      return node.updatedAt;
    }
  }, [node.updatedAt]);

  return (
    <aside
      className="w-full md:w-80 lg:w-96 bg-white border-t md:border-t-0 md:border-l border-slate-200 flex flex-col h-auto md:h-full max-h-[50vh] md:max-h-full overflow-y-auto shadow-sm z-10 transition-all"
      aria-label="Detail Simpul Catatan"
    >
      {/* Header panel */}
      <div className="p-4 border-b border-slate-100 flex items-start justify-between gap-2 sticky top-0 bg-white/95 backdrop-blur-xs z-10">
        <div>
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full">
            <span
              className="w-2 h-2 rounded-full"
              style={{
                backgroundColor: node.pusat
                  ? GRAPH_THEME.node.centerHighlight
                  : GRAPH_THEME.node.defaultColor,
              }}
            />
            {node.pusat ? "Catatan Fokus" : "Detail Catatan"}
          </span>
          <h2 className="mt-1 text-base font-semibold text-slate-800 line-clamp-2">
            {node.label}
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-100 transition-colors"
          aria-label="Tutup panel detail"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Body panel */}
      <div className="p-4 space-y-4 flex-1">
        {/* Info Meta */}
        <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-3 rounded-lg border border-slate-100">
          <div>
            <p className="text-slate-500">Hubungan</p>
            <p className="font-semibold text-slate-800">{node.jumlahHubungan ?? neighbors.length} relasi</p>
          </div>
          <div>
            <p className="text-slate-500">Terakhir diubah</p>
            <p className="font-semibold text-slate-800">{tanggalFormat}</p>
          </div>
        </div>

        {/* Tag */}
        {node.tags && node.tags.length > 0 && (
          <div>
            <h3 className="text-xs font-medium text-slate-500 mb-1.5">Tag</h3>
            <div className="flex flex-wrap gap-1.5">
              {node.tags.map((tag) => (
                <span
                  key={tag}
                  className="text-xs px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200"
                >
                  #{tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Tombol Aksi */}
        <div className="space-y-2 pt-2">
          <Link
            href={`/notes/${node.id}`}
            className="flex items-center justify-center gap-2 w-full py-2 px-3 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-xs"
          >
            <span>Buka Catatan</span>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </Link>

          {isFocusMode ? (
            <button
              type="button"
              onClick={onResetFocus}
              className="flex items-center justify-center gap-1.5 w-full py-2 px-3 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors border border-slate-200"
            >
              <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
              </svg>
              <span>Kembali ke semua catatan</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onFocusNode(node.id)}
              className="flex items-center justify-center gap-1.5 w-full py-2 px-3 text-sm font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors border border-indigo-100"
            >
              <svg className="w-4 h-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
              </svg>
              <span>Fokus ke sini</span>
            </button>
          )}
        </div>

        {/* Daftar Tetangga Terhubung */}
        <div className="pt-2">
          <h3 className="text-xs font-medium text-slate-500 mb-2 uppercase tracking-wider">
            Tetangga Terhubung ({neighbors.length})
          </h3>
          {neighbors.length === 0 ? (
            <p className="text-xs text-slate-400 italic">Belum ada catatan yang terhubung langsung.</p>
          ) : (
            <ul className="space-y-2">
              {neighbors.map((nb, i) => (
                <li
                  key={`${nb.id}-${i}`}
                  className="p-2.5 rounded-lg border border-slate-100 bg-slate-50 hover:bg-indigo-50/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-medium text-slate-800 line-clamp-2">
                      {nb.label}
                    </p>
                    {nb.type === "similar" ? (
                      <span className="shrink-0 text-[10px] font-medium text-indigo-700 bg-indigo-100/70 px-1.5 py-0.5 rounded">
                        {nb.similarity !== null ? `${Math.round(nb.similarity * 100)}% mirip` : "Mirip"}
                      </span>
                    ) : (
                      <span className="shrink-0 text-[10px] font-medium text-sky-700 bg-sky-100/70 px-1.5 py-0.5 rounded">
                        Konsep sama
                      </span>
                    )}
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[11px]">
                    <Link
                      href={`/notes/${nb.id}`}
                      className="text-indigo-600 hover:text-indigo-800 font-medium"
                    >
                      Buka catatan &rarr;
                    </Link>
                    <button
                      type="button"
                      onClick={() => onFocusNode(nb.id)}
                      className="text-slate-500 hover:text-slate-700"
                    >
                      Fokus
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </aside>
  );
}