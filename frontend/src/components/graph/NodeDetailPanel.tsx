"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { GraphNode, GraphEdge } from "@/types/graph";
import { GRAPH_THEMES, GraphThemeName } from "@/lib/graphTheme";

interface NodeDetailPanelProps {
  node: GraphNode;
  edges: GraphEdge[];
  allNodes: GraphNode[];
  themeName: GraphThemeName;
  isFocusMode: boolean;
  onClose: () => void;
  onFocusNode: (nodeId: string) => void;
  onResetFocus: () => void;
}

export function NodeDetailPanel({
  node,
  edges,
  allNodes,
  themeName,
  isFocusMode,
  onClose,
  onFocusNode,
  onResetFocus,
}: NodeDetailPanelProps) {
  const theme = GRAPH_THEMES[themeName];
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
      className="z-10 flex h-auto max-h-[50vh] w-full flex-col overflow-y-auto border-t shadow-sm transition-all md:h-full md:max-h-full md:w-80 md:border-l md:border-t-0 lg:w-96"
      style={{ backgroundColor: theme.ui.panel, borderColor: theme.ui.border, color: theme.ui.text }}
      aria-label="Detail Simpul Catatan"
    >
      {/* Header panel */}
      <div className="sticky top-0 z-10 flex items-start justify-between gap-2 border-b p-4 backdrop-blur-xs" style={{ backgroundColor: theme.ui.panel, borderColor: theme.ui.border }}>
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium" style={{ color: theme.ui.accentText, backgroundColor: theme.ui.selected }}>
            <span
              className="w-2 h-2 rounded-full"
              style={{
                backgroundColor: node.pusat ? theme.node.centerHighlight : theme.node.defaultColor,
              }}
            />
            {node.pusat ? "Catatan Fokus" : "Detail Catatan"}
          </span>
          <h2 className="mt-1 line-clamp-2 text-base font-semibold" style={{ color: theme.ui.text }}>
            {node.label}
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1 transition-colors"
          style={{ color: theme.ui.muted }}
          aria-label="Tutup panel detail"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Body panel */}
      <div className="flex-1 space-y-4 p-4">
        {/* Info Meta */}
        <div className="grid grid-cols-2 gap-2 rounded-lg border p-3 text-xs" style={{ backgroundColor: theme.ui.panelAlt, borderColor: theme.ui.border }}>
          <div>
            <p style={{ color: theme.ui.muted }}>Hubungan</p>
            <p className="font-semibold" style={{ color: theme.ui.text }}>{node.jumlahHubungan ?? neighbors.length} relasi</p>
          </div>
          <div>
            <p style={{ color: theme.ui.muted }}>Terakhir diubah</p>
            <p className="font-semibold" style={{ color: theme.ui.text }}>{tanggalFormat}</p>
          </div>
        </div>

        {/* Tag */}
        {node.tags && node.tags.length > 0 && (
          <div>
            <h3 className="mb-1.5 text-xs font-medium" style={{ color: theme.ui.muted }}>Tag</h3>
            <div className="flex flex-wrap gap-1.5">
              {node.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-md border px-2 py-0.5 text-xs"
                  style={{ backgroundColor: theme.ui.control, color: theme.ui.text, borderColor: theme.ui.border }}
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
            className="flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium shadow-xs transition-colors"
            style={{ backgroundColor: theme.ui.accent, color: theme.ui.accentText }}
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
              className="flex w-full items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors"
              style={{ backgroundColor: theme.ui.control, color: theme.ui.text, borderColor: theme.ui.border }}
            >
              <svg className="h-4 w-4" style={{ color: theme.ui.muted }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
              </svg>
              <span>Kembali ke semua catatan</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onFocusNode(node.id)}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors"
              style={{ backgroundColor: theme.ui.selected, color: theme.ui.accentText, borderColor: theme.ui.border }}
            >
              <svg className="h-4 w-4" style={{ color: theme.ui.accentText }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
              </svg>
              <span>Fokus ke sini</span>
            </button>
          )}
        </div>

        {/* Daftar Tetangga Terhubung */}
        <div className="pt-2">
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wider" style={{ color: theme.ui.muted }}>
            Tetangga Terhubung ({neighbors.length})
          </h3>
          {neighbors.length === 0 ? (
            <p className="text-xs italic" style={{ color: theme.ui.muted }}>Belum ada catatan yang terhubung langsung.</p>
          ) : (
            <ul className="space-y-2">
              {neighbors.map((nb, i) => (
                <li
                  key={`${nb.id}-${i}`}
                  className="rounded-lg border p-2.5 transition-colors"
                  style={{ backgroundColor: theme.ui.panelAlt, borderColor: theme.ui.border }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="line-clamp-2 text-xs font-medium" style={{ color: theme.ui.text }}>
                      {nb.label}
                    </p>
                    {nb.type === "similar" ? (
                      <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium" style={{ color: theme.thread.similarHighlight, backgroundColor: theme.ui.control }}>
                        {nb.similarity !== null ? `${Math.round(nb.similarity * 100)}% mirip` : "Mirip"}
                      </span>
                    ) : (
                      <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium" style={{ color: theme.thread.conceptHighlight, backgroundColor: theme.ui.control }}>
                        Konsep sama
                      </span>
                    )}
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[11px]">
                    <Link
                      href={`/notes/${nb.id}`}
                      className="font-medium"
                      style={{ color: theme.ui.accentText }}
                    >
                      Buka catatan &rarr;
                    </Link>
                    <button
                      type="button"
                      onClick={() => onFocusNode(nb.id)}
                      className="text-xs"
                      style={{ color: theme.ui.muted }}
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