"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { GraphNode, GraphEdge } from "@/types/graph";

interface GraphListProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  searchQuery?: string;
  onFocusNode: (nodeId: string) => void;
}

export function GraphList({
  nodes,
  edges,
  searchQuery = "",
  onFocusNode,
}: GraphListProps) {
  // Buat lookup map catatan
  const nodeMap = useMemo(() => {
    const map = new Map<string, GraphNode>();
    nodes.forEach((n) => map.set(n.id, n));
    return map;
  }, [nodes]);

  // Petakan tiap node ke relasi-relasinya
  const nodeRelations = useMemo(() => {
    const rels = new Map<
      string,
      {
        neighborId: string;
        neighborTitle: string;
        type: "similar" | "concept";
        similarity: number | null;
      }[]
    >();

    nodes.forEach((n) => rels.set(n.id, []));

    edges.forEach((edge) => {
      const sourceId = typeof edge.source === "object" ? (edge.source as GraphNode).id : edge.source;
      const targetId = typeof edge.target === "object" ? (edge.target as GraphNode).id : edge.target;

      const sourceNode = nodeMap.get(sourceId);
      const targetNode = nodeMap.get(targetId);

      if (sourceNode && targetNode) {
        rels.get(sourceId)?.push({
          neighborId: targetId,
          neighborTitle: targetNode.label,
          type: edge.type,
          similarity: edge.similarity,
        });
        rels.get(targetId)?.push({
          neighborId: sourceId,
          neighborTitle: sourceNode.label,
          type: edge.type,
          similarity: edge.similarity,
        });
      }
    });

    return rels;
  }, [nodes, edges, nodeMap]);

  // Filter berdasarkan pencarian judul
  const filteredNodes = useMemo(() => {
    if (!searchQuery.trim()) return nodes;
    const q = searchQuery.toLowerCase().trim();
    return nodes.filter((n) => n.label.toLowerCase().includes(q));
  }, [nodes, searchQuery]);

  if (filteredNodes.length === 0) {
    return (
      <div className="p-8 text-center bg-white rounded-lg border border-slate-200 m-4">
        <p className="text-sm text-slate-500">Tidak ada catatan yang cocok dengan filter atau pencarian.</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-5xl mx-auto overflow-y-auto max-h-full">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredNodes.map((node) => {
          const neighbors = nodeRelations.get(node.id) || [];
          return (
            <div
              key={node.id}
              className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-all"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-slate-800 text-sm line-clamp-2">
                    {node.label}
                  </h3>
                  <span className="text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full shrink-0">
                    {neighbors.length} relasi
                  </span>
                </div>

                {node.tags && node.tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {node.tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-[10px] bg-slate-50 text-slate-600 px-1.5 py-0.5 rounded border border-slate-100"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Hubungan Terhubung */}
                <div className="mt-3 pt-3 border-t border-slate-100">
                  <p className="text-xs font-medium text-slate-500 mb-1.5">
                    Terhubung dengan:
                  </p>
                  {neighbors.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">
                      Belum memiliki hubungan.
                    </p>
                  ) : (
                    <ul className="space-y-1 text-xs">
                      {neighbors.slice(0, 4).map((nb, i) => (
                        <li
                          key={`${nb.neighborId}-${i}`}
                          className="flex items-center justify-between text-slate-700 bg-slate-50 px-2 py-1 rounded"
                        >
                          <span className="truncate pr-2">{nb.neighborTitle}</span>
                          <span className="text-[10px] text-slate-500 shrink-0">
                            {nb.type === "similar"
                              ? `${Math.round((nb.similarity || 0) * 100)}% mirip`
                              : "Konsep sama"}
                          </span>
                        </li>
                      ))}
                      {neighbors.length > 4 && (
                        <li className="text-[11px] text-slate-400 italic pt-0.5">
                          + {neighbors.length - 4} catatan lainnya
                        </li>
                      )}
                    </ul>
                  )}
                </div>
              </div>

              {/* Aksi footer */}
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <Link
                  href={`/notes/${node.id}`}
                  className="text-indigo-600 hover:text-indigo-800 font-medium"
                >
                  Buka Catatan &rarr;
                </Link>
                <button
                  type="button"
                  onClick={() => onFocusNode(node.id)}
                  className="px-2.5 py-1 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-md font-medium transition-colors"
                >
                  Fokus di Graph
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}