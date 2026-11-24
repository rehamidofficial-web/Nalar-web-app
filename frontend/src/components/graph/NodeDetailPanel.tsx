"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { GraphNode, GraphEdge } from "@/types/graph";
import { btnPrimary, btnSecondary, cardClass } from "@/components/ui";

interface NodeDetailPanelProps {
  node: GraphNode | null;
  edges: GraphEdge[];
  allNodes: GraphNode[];
  onSelectId: (nodeId: string) => void;
  /** Hanya dipakai di layar kecil: tombol untuk kembali ke graph di atas. */
  onBackToGraph?: () => void;
}

export function NodeDetailPanel({ node, edges, allNodes, onSelectId, onBackToGraph }: NodeDetailPanelProps) {
  const nodeMap = useMemo(() => {
    const map = new Map<string, GraphNode>();
    allNodes.forEach((n) => map.set(n.id, n));
    return map;
  }, [allNodes]);

  const neighbors = useMemo(() => {
    if (!node) return [];
    const list: { id: string; label: string; type: "similar" | "concept"; similarity: number | null }[] = [];
    const seen = new Set<string>();
    edges.forEach((edge) => {
      const s = typeof edge.source === "object" ? (edge.source as GraphNode).id : edge.source;
      const t = typeof edge.target === "object" ? (edge.target as GraphNode).id : edge.target;
      const other = s === node.id ? t : t === node.id ? s : null;
      if (!other) return;
      const key = `${other}:${edge.type}`;
      if (seen.has(key)) return;
      seen.add(key);
      list.push({
        id: other,
        label: nodeMap.get(other)?.label ?? "Catatan",
        type: edge.type,
        similarity: edge.similarity,
      });
    });
    return list;
  }, [node, edges, nodeMap]);

  if (!node) {
    return (
      <aside className={`${cardClass} h-fit p-6`} aria-label="Detail catatan">
        <h2 className="text-lg font-bold text-slate-900">Pilih sebuah titik</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-500">
          Klik salah satu titik di graph untuk melihat catatan itu terhubung ke mana saja.
        </p>
      </aside>
    );
  }

  const tanggal = node.updatedAt
    ? new Date(node.updatedAt).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })
    : "";
  const jumlah = node.jumlahHubungan ?? neighbors.length;

  return (
    <aside className={`${cardClass} h-fit p-6`} aria-label="Detail catatan">
      <div className="flex items-center justify-between gap-3">
        <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
          {node.pusat ? "Catatan fokus" : "Catatan"}
        </span>
        <span className="text-xs text-slate-500">{jumlah} hubungan</span>
      </div>

      <h2 className="mt-4 break-words text-2xl font-bold leading-tight text-slate-900">{node.label}</h2>
      <p className="mt-3 text-sm leading-relaxed text-slate-500">
        {node.tags && node.tags.length > 0 ? `Tag: ${node.tags.map((t) => `#${t}`).join(", ")}. ` : ""}
        {tanggal ? `Terakhir diubah ${tanggal}.` : ""}
      </p>

      <p className="mb-2 mt-6 text-xs font-semibold uppercase tracking-wide text-slate-500">Terhubung ke</p>
      {neighbors.length === 0 ? (
        <p className="text-sm text-slate-500">Belum ada catatan yang terhubung langsung.</p>
      ) : (
        <ul className="max-h-64 space-y-2 overflow-y-auto pr-1">
          {neighbors.map((nb) => (
            <li key={`${nb.id}-${nb.type}`}>
              <button
                type="button"
                onClick={() => onSelectId(nb.id)}
                className="flex min-h-[44px] w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2 text-left transition-colors hover:border-indigo-300 hover:bg-indigo-50/40"
              >
                <span className="truncate text-sm font-semibold text-slate-900">{nb.label}</span>
                <span className="shrink-0 text-xs text-slate-500">
                  {nb.type === "similar"
                    ? nb.similarity !== null
                      ? `Mirip ${Math.round(nb.similarity * 100)}%`
                      : "Mirip"
                    : "Konsep sama"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-6 space-y-2">
        <Link href={`/notes/${node.id}`} className={`${btnPrimary} w-full`}>
          Buka catatan ini
        </Link>
        <Link
          href={`/assistant?tanya=${encodeURIComponent(`Jelaskan isi dan hubungan catatan "${node.label}"`)}`}
          className={`${btnSecondary} w-full`}
        >
          Tanya AI tentang ini
        </Link>
        {onBackToGraph && (
          <button type="button" onClick={onBackToGraph} className={`${btnSecondary} w-full lg:hidden`}>
            Kembali ke graph
          </button>
        )}
      </div>
    </aside>
  );
}
