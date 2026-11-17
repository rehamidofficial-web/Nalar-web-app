"use client";

import React, { useRef, useEffect, useState, useCallback, useMemo } from "react";
import ForceGraph2D, { ForceGraphMethods, NodeObject, LinkObject } from "react-force-graph-2d";
import { GraphNode, GraphEdge } from "@/types/graph";
import { GRAPH_THEME } from "@/lib/graphTheme";

interface GraphCanvasProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  selectedNodeId: string | null;
  highlightedNodeIds?: Set<string>;
  searchQuery?: string;
  onSelectNode: (node: GraphNode | null) => void;
  onFitGraphReady?: (fitFn: () => void, resetFn: () => void) => void;
}

export default function GraphCanvas({
  nodes,
  edges,
  selectedNodeId,
  highlightedNodeIds,
  searchQuery = "",
  onSelectNode,
  onFitGraphReady,
}: GraphCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const fgRef = useRef<ForceGraphMethods<NodeObject<GraphNode>, LinkObject<GraphNode, GraphEdge>> | undefined>(undefined);
  const [dimensions, setDimensions] = useState({ width: 600, height: 500 });
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  // ResizeObserver untuk menyesuaikan kanvas dengan ukuran wadah
  useEffect(() => {
    if (!containerRef.current) return;

    const updateSize = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth || 600,
          height: containerRef.current.clientHeight || 500,
        });
      }
    };

    updateSize();

    const resizeObserver = new ResizeObserver(() => {
      updateSize();
    });

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  // Set tetangga dari node yang sedang di-hover
  const hoveredNeighbors = useMemo(() => {
    const neighbors = new Set<string>();
    if (!hoveredNodeId) return neighbors;

    edges.forEach((edge) => {
      const sourceId = typeof edge.source === "object" ? (edge.source as GraphNode).id : edge.source;
      const targetId = typeof edge.target === "object" ? (edge.target as GraphNode).id : edge.target;

      if (sourceId === hoveredNodeId) {
        neighbors.add(targetId);
      } else if (targetId === hoveredNodeId) {
        neighbors.add(sourceId);
      }
    });

    return neighbors;
  }, [hoveredNodeId, edges]);

  // Siapkan fungsi fit dan reset untuk parent component
  const handleFit = useCallback(() => {
    if (fgRef.current) {
      fgRef.current.zoomToFit(400, 50);
    }
  }, []);

  const handleReset = useCallback(() => {
    if (fgRef.current) {
      fgRef.current.centerAt(0, 0, 400);
      fgRef.current.zoom(1, 400);
    }
  }, []);

  useEffect(() => {
    if (onFitGraphReady) {
      onFitGraphReady(handleFit, handleReset);
    }
  }, [onFitGraphReady, handleFit, handleReset]);

  // Format data untuk react-force-graph
  const graphData = useMemo(() => {
    return {
      nodes: nodes.map((n) => ({ ...n })),
      links: edges.map((e) => ({ ...e })),
    };
  }, [nodes, edges]);

  // Auto zoomToFit sekali saat data dimuat
  useEffect(() => {
    if (nodes.length > 0 && fgRef.current) {
      const timer = setTimeout(() => {
        fgRef.current?.zoomToFit(400, 50);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [nodes]);

  // Hitung radius node berdasarkan jumlahHubungan
  const getNodeRadius = useCallback((node: GraphNode) => {
    if (node.pusat) return GRAPH_THEME.node.maxRadius + 2;
    const count = node.jumlahHubungan || 0;
    const r = GRAPH_THEME.node.baseRadius + count * 1.2;
    return Math.min(Math.max(r, GRAPH_THEME.node.minRadius), GRAPH_THEME.node.maxRadius);
  }, []);

  // Custom node canvas paint
  const paintNode = useCallback(
    (nodeObj: NodeObject<GraphNode>, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const node = nodeObj as GraphNode;
      const nodeX = node.x ?? 0;
      const nodeY = node.y ?? 0;
      const r = getNodeRadius(node);
      const isSelected = selectedNodeId === node.id;
      const isHovered = hoveredNodeId === node.id;
      const isNeighborOfHovered = hoveredNeighbors.has(node.id);
      const isSearched =
        searchQuery.trim().length > 0 &&
        node.label.toLowerCase().includes(searchQuery.toLowerCase().trim());
      const isExplicitlyHighlighted = highlightedNodeIds?.has(node.id);

      // Tentukan warna
      let fillColor = GRAPH_THEME.node.defaultColor;

      if (node.pusat) {
        fillColor = GRAPH_THEME.node.centerHighlight;
      } else if (node.jumlahHubungan === 0) {
        fillColor = GRAPH_THEME.node.isolatedColor;
      }

      if (isSelected || isExplicitlyHighlighted) {
        fillColor = GRAPH_THEME.node.highlightColor;
      } else if (hoveredNodeId) {
        if (isHovered) {
          fillColor = GRAPH_THEME.node.highlightColor;
        } else if (isNeighborOfHovered) {
          fillColor = GRAPH_THEME.node.defaultColor;
        } else {
          fillColor = GRAPH_THEME.node.dimmedColor;
        }
      }

      // Gambar lingkaran luar jika dicari / dipilih
      if (isSearched || isSelected || isHovered) {
        ctx.beginPath();
        ctx.arc(nodeX, nodeY, r + 3, 0, 2 * Math.PI, false);
        ctx.fillStyle = isSearched ? "rgba(245, 158, 11, 0.35)" : "rgba(225, 29, 72, 0.25)";
        ctx.fill();
      }

      // Gambar lingkaran node
      ctx.beginPath();
      ctx.arc(nodeX, nodeY, r, 0, 2 * Math.PI, false);
      ctx.fillStyle = fillColor;
      ctx.fill();

      // Border lingkaran
      ctx.lineWidth = isSelected || isHovered ? 2 : 1;
      ctx.strokeStyle = isSelected || isHovered ? "#ffffff" : "rgba(255, 255, 255, 0.6)";
      ctx.stroke();

      // Label teks: tampilkan jika zoom cukup dekat atau node disorot/dipilih/dicari
      const shouldDrawLabel =
        globalScale > 1.4 || isSelected || isHovered || isNeighborOfHovered || isSearched || node.pusat;

      if (shouldDrawLabel) {
        const fullLabel = node.label || "";
        const label = fullLabel.length > 24 ? fullLabel.slice(0, 22) + "…" : fullLabel;
        const fontSize = Math.max(10 / globalScale, 3);
        ctx.font = `${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";

        const textY = nodeY + r + 3;

        // Background label agar terbaca jelas
        const textWidth = ctx.measureText(label).width;
        ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
        ctx.fillRect(
          nodeX - textWidth / 2 - 2,
          textY - 1,
          textWidth + 4,
          fontSize + 2
        );

        ctx.fillStyle =
          hoveredNodeId && !isHovered && !isNeighborOfHovered
            ? GRAPH_THEME.node.textDimmedColor
            : GRAPH_THEME.node.textColor;
        ctx.fillText(label, nodeX, textY);
      }
    },
    [
      getNodeRadius,
      selectedNodeId,
      hoveredNodeId,
      hoveredNeighbors,
      searchQuery,
      highlightedNodeIds,
    ]
  );

  // Custom link canvas paint
  const paintLink = useCallback(
    (linkObj: LinkObject<GraphNode, GraphEdge>, ctx: CanvasRenderingContext2D) => {
      const link = linkObj as unknown as {
        source: GraphNode | string;
        target: GraphNode | string;
        type: "similar" | "concept";
        similarity: number | null;
      };

      const sourceNode = typeof link.source === "object" ? link.source : null;
      const targetNode = typeof link.target === "object" ? link.target : null;

      const sourceId = sourceNode ? sourceNode.id : (link.source as string);
      const targetId = targetNode ? targetNode.id : (link.target as string);

      const sourceX = sourceNode?.x ?? 0;
      const sourceY = sourceNode?.y ?? 0;
      const targetX = targetNode?.x ?? 0;
      const targetY = targetNode?.y ?? 0;

      const isConnectedToHovered =
        hoveredNodeId && (sourceId === hoveredNodeId || targetId === hoveredNodeId);
      const isConnectedToSelected =
        selectedNodeId && (sourceId === selectedNodeId || targetId === selectedNodeId);

      let strokeColor =
        link.type === "similar"
          ? GRAPH_THEME.edge.similarColor
          : GRAPH_THEME.edge.conceptColor;
      let lineWidth =
        link.type === "similar"
          ? Math.max(
              GRAPH_THEME.edge.similarMinWidth,
              (link.similarity || 0.5) * GRAPH_THEME.edge.similarMaxWidth
            )
          : GRAPH_THEME.edge.conceptWidth;

      if (hoveredNodeId) {
        if (isConnectedToHovered) {
          strokeColor = GRAPH_THEME.edge.highlightColor;
          lineWidth += 1;
        } else {
          strokeColor = GRAPH_THEME.edge.dimmedColor;
        }
      } else if (isConnectedToSelected) {
        strokeColor = GRAPH_THEME.edge.highlightColor;
        lineWidth += 0.8;
      }

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(sourceX, sourceY);
      ctx.lineTo(targetX, targetY);
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = lineWidth;

      if (link.type === "concept") {
        ctx.setLineDash(GRAPH_THEME.edge.dashPattern);
      } else {
        ctx.setLineDash([]);
      }

      ctx.stroke();
      ctx.restore();
    },
    [hoveredNodeId, selectedNodeId]
  );

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full min-h-[480px] bg-slate-50 overflow-hidden select-none"
      role="region"
      aria-label="Kanvas Knowledge Graph interaktif. Gunakan tab Daftar untuk alternatif teks."
    >
      <ForceGraph2D
        ref={fgRef}
        width={dimensions.width}
        height={dimensions.height}
        graphData={graphData}
        nodeRelSize={GRAPH_THEME.node.baseRadius}
        nodeCanvasObject={paintNode}
        nodePointerAreaPaint={(nodeObj, color, ctx) => {
          const node = nodeObj as GraphNode;
          const r = getNodeRadius(node);
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(node.x ?? 0, node.y ?? 0, r + 4, 0, 2 * Math.PI, false);
          ctx.fill();
        }}
        linkCanvasObject={paintLink}
        backgroundColor={GRAPH_THEME.background}
        cooldownTicks={100}
        onNodeClick={(node) => {
          onSelectNode(node as GraphNode);
        }}
        onBackgroundClick={() => {
          onSelectNode(null);
        }}
        onNodeHover={(node) => {
          setHoveredNodeId(node ? (node as GraphNode).id : null);
        }}
        enableNodeDrag={true}
        enableZoomInteraction={true}
        enablePanInteraction={true}
      />
    </div>
  );
}