"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ForceGraph2D, {
  ForceGraphMethods,
  LinkObject as ForceLinkObject,
  NodeObject as ForceNodeObject,
} from "react-force-graph-2d";
import { GraphEdge, GraphNode } from "@/types/graph";

export interface GraphCanvasApi {
  zoomIn: () => void;
  zoomOut: () => void;
  fit: () => void;
}

interface GraphCanvasProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  selectedNodeId: string | null;
  onSelectNode: (node: GraphNode) => void;
  onBackgroundClick: () => void;
  onZoomChange: (percent: number) => void;
  onApiReady: (api: GraphCanvasApi) => void;
}

/* Warna persis dari desain "Knowledge Graph (dark)" */
const C = {
  bg: "#0b1020",
  dot: "rgba(129, 140, 248, 0.13)",
  nodeFill: "#1c2347",
  nodeStroke: "#6a73e0",
  noteFill: "#2a2060",
  noteStroke: "#a78bfa",
  selectedFill: "#818cf8",
  selectedText: "#0b1020",
  text: "#e6eaf5",
  link: "rgba(129, 140, 248, 0.2)",
  linkActive: "#818cf8",
  dimmedAlpha: 0.28,
};

const FONT = '600 12px "Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif';
const NODE_H = 30;
const MAX_LABEL_CHARS = 22;

function getEndpointId(endpoint: GraphEdge["source"]) {
  return typeof endpoint === "string" ? endpoint : endpoint.id;
}

function labelOf(node: GraphNode) {
  const text = node.label || "Tanpa judul";
  return text.length > MAX_LABEL_CHARS ? `${text.slice(0, MAX_LABEL_CHARS - 1).trimEnd()}…` : text;
}

function nodeWidth(node: GraphNode) {
  return Math.max(54, labelOf(node).length * 6.8 + 30);
}

interface SimNode {
  id?: string | number;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  label?: string;
}

type CollideForce = ((alpha: number) => void) & {
  initialize?: (nodes: SimNode[]) => void;
};

export default function GraphCanvas({
  nodes,
  edges,
  selectedNodeId,
  onSelectNode,
  onBackgroundClick,
  onZoomChange,
  onApiReady,
}: GraphCanvasProps) {
  const graphRef = useRef<
    ForceGraphMethods<ForceNodeObject, ForceLinkObject<object, GraphEdge>> | undefined
  >(undefined);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const didInitialFitRef = useRef(false);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const width = Math.round(entry.contentRect.width);
      const height = Math.round(entry.contentRect.height);
      setCanvasSize((cur) => (cur.width === width && cur.height === height ? cur : { width, height }));
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const graphData = useMemo(
    () => ({
      nodes: nodes.map((node, index) => {
        if (typeof node.x === "number" && typeof node.y === "number") return { ...node };
        const angle = index * 2.399963229728653;
        const distance = 60 + Math.sqrt(index + 1) * 55;
        return { ...node, x: Math.cos(angle) * distance, y: Math.sin(angle) * distance };
      }),
      links: edges.map((edge) => ({
        ...edge,
        source: getEndpointId(edge.source),
        target: getEndpointId(edge.target),
      })),
    }),
    [edges, nodes],
  );

  const focusId = hoveredNodeId || selectedNodeId;
  const neighborIds = useMemo(() => {
    const set = new Set<string>();
    if (!focusId) return set;
    edges.forEach((edge) => {
      const s = getEndpointId(edge.source);
      const t = getEndpointId(edge.target);
      if (s === focusId) set.add(t);
      if (t === focusId) set.add(s);
    });
    return set;
  }, [edges, focusId]);

  // Gaya tabrakan: dorong kotak catatan yang saling menimpa supaya teks tetap terbaca
  // eslint-disable-next-line react-hooks/immutability
  const collideForce = useMemo<CollideForce>(() => {
    let list: SimNode[] = [];
    const force: CollideForce = (alpha) => {
      for (let i = 0; i < list.length; i += 1) {
        const a = list[i]!;
        for (let j = i + 1; j < list.length; j += 1) {
          const b = list[j]!;
          const wa = Math.max(54, Math.min((a.label ?? "").length, MAX_LABEL_CHARS) * 6.8 + 30);
          const wb = Math.max(54, Math.min((b.label ?? "").length, MAX_LABEL_CHARS) * 6.8 + 30);
          const dx = (b.x ?? 0) - (a.x ?? 0);
          const dy = (b.y ?? 0) - (a.y ?? 0);
          const overlapX = (wa + wb) / 2 + 14 - Math.abs(dx);
          const overlapY = NODE_H + 14 - Math.abs(dy);
          if (overlapX > 0 && overlapY > 0) {
            const pushX = overlapX < overlapY;
            const amount = (pushX ? overlapX : overlapY) * 0.5 * Math.min(1, alpha * 4 + 0.1);
            const sign = (pushX ? dx : dy) >= 0 ? 1 : -1;
            if (pushX) {
              a.vx = (a.vx ?? 0) - sign * amount;
              b.vx = (b.vx ?? 0) + sign * amount;
            } else {
              a.vy = (a.vy ?? 0) - sign * amount;
              b.vy = (b.vy ?? 0) + sign * amount;
            }
          }
        }
      }
    };
    force.initialize = (simNodes) => {
      list = simNodes;
    };
    return force;
  }, []);

  const fit = useCallback(() => {
    graphRef.current?.zoomToFit(450, 60);
  }, []);
  const zoomBy = useCallback((factor: number) => {
    const g = graphRef.current;
    if (!g) return;
    g.zoom(Math.min(6, Math.max(0.2, g.zoom() * factor)), 250);
  }, []);

  useEffect(() => {
    onApiReady({ zoomIn: () => zoomBy(1.3), zoomOut: () => zoomBy(1 / 1.3), fit });
  }, [onApiReady, zoomBy, fit]);

  // eslint-disable-next-line react-hooks/immutability
  useEffect(() => {
    const g = graphRef.current;
    if (!g) return;
    g.d3Force("charge")?.strength(-520);
    g.d3Force("link")?.distance(150);
    g.d3Force("center")?.strength(0.06);
    g.d3Force("collide", collideForce);
    g.d3ReheatSimulation();
  }, [canvasSize.width, canvasSize.height, collideForce]);

  const handleEngineStop = useCallback(() => {
    if (didInitialFitRef.current || !nodes.length) return;
    didInitialFitRef.current = true;
    fit();
  }, [fit, nodes.length]);

  const paintNode = useCallback(
    (obj: object, ctx: CanvasRenderingContext2D, scale: number) => {
      const node = obj as GraphNode;
      const x = node.x ?? 0;
      const y = node.y ?? 0;
      const w = nodeWidth(node);
      const h = NODE_H;
      const isSelected = selectedNodeId === node.id;
      const isHover = hoveredNodeId === node.id;
      const isNeighbor = neighborIds.has(node.id);
      const hasFocus = Boolean(focusId);
      const dim = hasFocus && !isSelected && !isHover && !isNeighbor;

      ctx.save();
      ctx.globalAlpha = dim ? C.dimmedAlpha : 1;
      if (isSelected || isHover) {
        ctx.shadowColor = "rgba(129, 140, 248, 0.55)";
        ctx.shadowBlur = 14;
      }
      ctx.beginPath();
      ctx.roundRect(x - w / 2, y - h / 2, w, h, h / 2);
      ctx.fillStyle = isSelected ? C.selectedFill : isNeighbor || node.pusat ? C.noteFill : C.nodeFill;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.lineWidth = (isSelected ? 2 : 1.5) / Math.max(scale, 0.4);
      ctx.strokeStyle = isSelected ? "#c7d2fe" : isNeighbor || node.pusat ? C.noteStroke : C.nodeStroke;
      ctx.stroke();
      ctx.font = FONT;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = isSelected ? C.selectedText : C.text;
      ctx.fillText(labelOf(node), x, y + 0.5);
      ctx.restore();
    },
    [focusId, hoveredNodeId, neighborIds, selectedNodeId],
  );

  const paintLink = useCallback(
    (obj: object, ctx: CanvasRenderingContext2D, scale: number) => {
      const link = obj as GraphEdge;
      if (typeof link.source === "string" || typeof link.target === "string") return;
      const s = link.source;
      const t = link.target;
      const active = Boolean(focusId) && (s.id === focusId || t.id === focusId);
      const dim = Boolean(focusId) && !active;
      ctx.save();
      ctx.globalAlpha = dim ? 0.35 : 1;
      ctx.strokeStyle = active ? C.linkActive : C.link;
      ctx.lineWidth = (active ? 2.2 : 1.2) / Math.max(scale, 0.4);
      ctx.lineCap = "round";
      ctx.setLineDash(link.type === "concept" && !active ? [5, 5] : []);
      ctx.beginPath();
      ctx.moveTo(s.x ?? 0, s.y ?? 0);
      ctx.lineTo(t.x ?? 0, t.y ?? 0);
      ctx.stroke();
      ctx.restore();
    },
    [focusId],
  );

  return (
    <div
      ref={containerRef}
      className="relative h-full min-h-[360px] w-full touch-none overflow-hidden"
      style={{
        backgroundColor: C.bg,
        backgroundImage: `radial-gradient(circle, ${C.dot} 1px, transparent 1px)`,
        backgroundSize: "24px 24px",
      }}
      role="img"
      aria-label="Graph hubungan antar catatan. Klik sebuah titik untuk melihat detailnya di panel."
    >
      {canvasSize.width > 0 && canvasSize.height > 0 && (
        <ForceGraph2D
          ref={graphRef}
          graphData={graphData}
          width={canvasSize.width}
          height={canvasSize.height}
          backgroundColor="rgba(0,0,0,0)"
          cooldownTicks={200}
          d3AlphaDecay={0.03}
          d3VelocityDecay={0.4}
          nodeId="id"
          nodeCanvasObject={paintNode}
          nodeCanvasObjectMode={() => "replace"}
          nodePointerAreaPaint={(node, color, ctx) => {
            const n = node as GraphNode;
            const w = nodeWidth(n);
            ctx.fillStyle = color;
            ctx.fillRect((n.x ?? 0) - w / 2, (n.y ?? 0) - NODE_H / 2, w, NODE_H);
          }}
          linkCanvasObject={paintLink}
          linkCanvasObjectMode={() => "replace"}
          onNodeHover={(node) => setHoveredNodeId(node ? (node as GraphNode).id : null)}
          onNodeClick={(node) => onSelectNode(node as GraphNode)}
          onBackgroundClick={() => {
            setHoveredNodeId(null);
            onBackgroundClick();
          }}
          onZoom={({ k }) => onZoomChange(Math.round(k * 100))}
          onEngineStop={handleEngineStop}
          enableNodeDrag
          enableZoomInteraction
          enablePanInteraction
          minZoom={0.2}
          maxZoom={6}
        />
      )}
    </div>
  );
}
