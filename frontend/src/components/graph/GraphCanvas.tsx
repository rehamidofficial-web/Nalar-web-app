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

  const isHeavyGraph = nodes.length > GRAPH_THEME.performance.heavyThreshold;

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

  // Konfigurasi D3 Force Simulation agar kartu memiliki gaya tolak dan ruang yang cukup
  useEffect(() => {
    if (!fgRef.current) return;
    const fg = fgRef.current;

    // Atur gaya tolak manyBody (charge)
    interface ForceWithStrength {
      strength: (val: number) => void;
    }
    interface ForceWithDistance {
      distance: (val: number) => void;
    }

    const charge = fg.d3Force("charge") as unknown as ForceWithStrength | undefined;
    if (charge && typeof charge.strength === "function") {
      charge.strength(GRAPH_THEME.physics.chargeStrength);
    }

    // Atur jarak pegas relasi (link)
    const linkForce = fg.d3Force("link") as unknown as ForceWithDistance | undefined;
    if (linkForce && typeof linkForce.distance === "function") {
      linkForce.distance(GRAPH_THEME.physics.linkDistance);
    }

    // Hangatkan simulasi sesaat
    fg.d3ReheatSimulation();
  }, [nodes.length, edges.length]);

  // Set tetangga dari node yang sedang di-hover atau selected
  const activeFocusId = hoveredNodeId || selectedNodeId;
  const connectedNeighbors = useMemo(() => {
    const neighbors = new Set<string>();
    if (!activeFocusId) return neighbors;

    edges.forEach((edge) => {
      const sourceId = typeof edge.source === "object" ? (edge.source as GraphNode).id : edge.source;
      const targetId = typeof edge.target === "object" ? (edge.target as GraphNode).id : edge.target;

      if (sourceId === activeFocusId) {
        neighbors.add(targetId);
      } else if (targetId === activeFocusId) {
        neighbors.add(sourceId);
      }
    });

    return neighbors;
  }, [activeFocusId, edges]);

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

  // Auto zoomToFit saat awal data termuat
  useEffect(() => {
    if (nodes.length > 0 && fgRef.current) {
      const timer = setTimeout(() => {
        fgRef.current?.zoomToFit(400, 50);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [nodes]);

  // Hitung dimensi kartu kertas berdasarkan jumlah relasi
  const getCardDimensions = useCallback((node: GraphNode) => {
    const count = node.jumlahHubungan || 0;
    const baseW = GRAPH_THEME.card.baseWidth;
    const width = Math.min(
      Math.max(baseW + count * 2.8, GRAPH_THEME.card.minWidth),
      GRAPH_THEME.card.maxWidth
    );
    const height = width * GRAPH_THEME.card.heightRatio;
    return { width, height };
  }, []);

  // Helper menggambar rounded rect di kanvas
  const drawRoundedRect = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number
  ) => {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  };

  // Custom node canvas paint: Kartu Catatan Kertas + Penjepit/Pin
  const paintNode = useCallback(
    (nodeObj: NodeObject<GraphNode>, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const node = nodeObj as GraphNode;
      const nodeX = node.x ?? 0;
      const nodeY = node.y ?? 0;
      const { width, height } = getCardDimensions(node);

      const isSelected = selectedNodeId === node.id;
      const isHovered = hoveredNodeId === node.id;
      const isConnected = connectedNeighbors.has(node.id);
      const isSearched =
        searchQuery.trim().length > 0 &&
        node.label.toLowerCase().includes(searchQuery.toLowerCase().trim());
      const isExplicitlyHighlighted = highlightedNodeIds?.has(node.id);

      const isFocused = isSelected || isHovered || isExplicitlyHighlighted;
      const hasActiveContext = Boolean(activeFocusId);
      const isDimmed = hasActiveContext && !isFocused && !isConnected;

      const cardLeft = nodeX - width / 2;
      const cardTop = nodeY - height / 2;

      ctx.save();

      // Bayangan kartu (jika tidak sedang grafik berat)
      if (!isHeavyGraph && !isDimmed) {
        ctx.shadowColor = isFocused ? "rgba(225, 29, 72, 0.45)" : GRAPH_THEME.card.shadowColor;
        ctx.shadowBlur = isFocused ? 10 : GRAPH_THEME.card.shadowBlur;
        ctx.shadowOffsetY = isFocused ? 4 : 2;
      }

      // Warna isi kertas
      let cardBg = GRAPH_THEME.card.defaultBg;
      if (node.pusat) {
        cardBg = GRAPH_THEME.card.centerBg;
      } else if (node.jumlahHubungan === 0) {
        cardBg = GRAPH_THEME.card.isolatedBg;
      }

      if (isFocused) {
        cardBg = GRAPH_THEME.card.selectedBg;
      } else if (isDimmed) {
        cardBg = GRAPH_THEME.card.dimmedBg;
      }

      // 1. Gambar Lembaran Kertas Kartu
      drawRoundedRect(ctx, cardLeft, cardTop, width, height, GRAPH_THEME.card.radius);
      ctx.fillStyle = cardBg;
      ctx.fill();

      // Matikan bayangan untuk stroke & elemen detail di atasnya
      ctx.shadowColor = "transparent";

      // Border kertas
      ctx.lineWidth = isFocused ? 2 : 1;
      ctx.strokeStyle = isFocused
        ? GRAPH_THEME.card.borderHighlight
        : isSearched
        ? "#f59e0b"
        : isDimmed
        ? "rgba(255, 255, 255, 0.08)"
        : GRAPH_THEME.card.borderColor;
      ctx.stroke();

      // 2. Gambar Penjepit Kertas / Pin Detektif di bagian atas kartu
      const pinX = nodeX;
      const pinY = cardTop + 1;

      // Klip Kertas Logam (U-clip)
      ctx.beginPath();
      ctx.strokeStyle = isFocused ? GRAPH_THEME.card.paperclipHighlight : GRAPH_THEME.card.paperclipColor;
      ctx.lineWidth = 1.4;
      ctx.roundRect(pinX - 4, pinY - 4, 8, 10, 3);
      ctx.stroke();

      // Pin Merah Bundar di tengah klip (identitas Benang Merah Nalar)
      ctx.beginPath();
      ctx.arc(pinX, pinY - 2, GRAPH_THEME.card.pinRadius, 0, 2 * Math.PI, false);
      ctx.fillStyle = isDimmed
        ? "#78350f"
        : node.pusat
        ? GRAPH_THEME.card.pinCenterColor
        : isFocused
        ? GRAPH_THEME.card.pinHighlight
        : GRAPH_THEME.card.pinColor;
      ctx.fill();
      ctx.lineWidth = 0.8;
      ctx.strokeStyle = "rgba(255, 255, 255, 0.7)";
      ctx.stroke();

      // 3. Teks Judul Catatan di dalam Kertas
      const rawTitle = node.label || "";
      // Potong judul agar muat rapi di kartu kecil
      const maxChars = width > 75 ? 20 : 13;
      const displayTitle = rawTitle.length > maxChars ? rawTitle.slice(0, maxChars - 1) + "…" : rawTitle;

      const fontSize = Math.max(9 / Math.max(globalScale, 0.8), 7.5);
      ctx.font = `600 ${fontSize}px ${GRAPH_THEME.card.fontFamily}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      ctx.fillStyle = isDimmed
        ? GRAPH_THEME.card.textDimmedColor
        : isFocused
        ? "#0f172a"
        : GRAPH_THEME.card.textColor;

      // Gambar judul di tengah kartu
      ctx.fillText(displayTitle, nodeX, nodeY + 3);

      ctx.restore();
    },
    [
      getCardDimensions,
      selectedNodeId,
      hoveredNodeId,
      activeFocusId,
      connectedNeighbors,
      searchQuery,
      highlightedNodeIds,
      isHeavyGraph,
    ]
  );

  // Custom link canvas paint: Benang Merah Detektif (Melengkung) & Benang Putus-Putus
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

      const isConnectedToFocus =
        activeFocusId && (sourceId === activeFocusId || targetId === activeFocusId);
      const hasActiveContext = Boolean(activeFocusId);
      const isDimmed = hasActiveContext && !isConnectedToFocus;

      ctx.save();

      const isSimilar = link.type === "similar";

      // Warna & Ketebalan Benang
      let strokeColor: string;
      let lineWidth: number;

      if (isSimilar) {
        // Benang merah
        if (isConnectedToFocus) {
          strokeColor = GRAPH_THEME.thread.similarHighlight;
          lineWidth = Math.max(2.2, (link.similarity || 0.6) * GRAPH_THEME.thread.similarMaxWidth + 1.2);
          if (!isHeavyGraph) {
            ctx.shadowColor = "rgba(225, 29, 72, 0.8)";
            ctx.shadowBlur = 6;
          }
        } else if (isDimmed) {
          strokeColor = GRAPH_THEME.thread.similarDimmed;
          lineWidth = GRAPH_THEME.thread.similarMinWidth * 0.8;
        } else {
          strokeColor = GRAPH_THEME.thread.similarColor;
          lineWidth = Math.max(
            GRAPH_THEME.thread.similarMinWidth,
            (link.similarity || 0.5) * GRAPH_THEME.thread.similarMaxWidth
          );
        }
      } else {
        // Benang konsep (biru/kapur putus-putus)
        if (isConnectedToFocus) {
          strokeColor = GRAPH_THEME.thread.conceptHighlight;
          lineWidth = GRAPH_THEME.thread.conceptWidth + 1;
        } else if (isDimmed) {
          strokeColor = GRAPH_THEME.thread.conceptDimmed;
          lineWidth = GRAPH_THEME.thread.conceptWidth * 0.7;
        } else {
          strokeColor = GRAPH_THEME.thread.conceptColor;
          lineWidth = GRAPH_THEME.thread.conceptWidth;
        }
      }

      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = lineWidth;

      if (!isSimilar) {
        ctx.setLineDash(GRAPH_THEME.thread.dashPattern);
      } else {
        ctx.setLineDash([]);
      }

      // Garis sedikit melengkung (lengkungan menggantung khas benang di papan)
      const dx = targetX - sourceX;
      const dy = targetY - sourceY;
      const curvature = isSimilar ? GRAPH_THEME.thread.curvature : GRAPH_THEME.thread.conceptCurvature;

      // Titik kontrol kurva Bézier kuadratik
      const midX = (sourceX + targetX) / 2 - dy * curvature;
      const midY = (sourceY + targetY) / 2 + dx * curvature;

      ctx.beginPath();
      ctx.moveTo(sourceX, sourceY);
      ctx.quadraticCurveTo(midX, midY, targetX, targetY);
      ctx.stroke();

      ctx.restore();
    },
    [activeFocusId, isHeavyGraph]
  );

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full min-h-[480px] overflow-hidden select-none"
      style={{ backgroundColor: GRAPH_THEME.board.background }}
      role="region"
      aria-label="Kanvas Knowledge Graph interaktif bertema Papan Detektif. Gunakan tab Daftar untuk alternatif teks."
    >
      <ForceGraph2D
        ref={fgRef}
        width={dimensions.width}
        height={dimensions.height}
        graphData={graphData}
        nodeRelSize={GRAPH_THEME.card.baseWidth / 2}
        nodeCanvasObject={paintNode}
        nodePointerAreaPaint={(nodeObj, color, ctx) => {
          const node = nodeObj as GraphNode;
          const { width, height } = getCardDimensions(node);
          ctx.fillStyle = color;
          drawRoundedRect(
            ctx,
            (node.x ?? 0) - width / 2 - 2,
            (node.y ?? 0) - height / 2 - 2,
            width + 4,
            height + 4,
            GRAPH_THEME.card.radius
          );
          ctx.fill();
        }}
        linkCanvasObject={paintLink}
        backgroundColor={GRAPH_THEME.board.background}
        cooldownTicks={120}
        d3VelocityDecay={GRAPH_THEME.physics.velocityDecay}
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
