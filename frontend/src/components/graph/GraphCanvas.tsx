"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ForceGraph2D, {
  ForceGraphMethods,
  LinkObject as ForceLinkObject,
  NodeObject as ForceNodeObject,
} from "react-force-graph-2d";
import { GraphEdge, GraphNode } from "@/types/graph";
import { GRAPH_THEMES, GraphThemeName } from "@/lib/graphTheme";

interface GraphCanvasProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  selectedNodeId: string | null;
  searchQuery: string;
  themeName: GraphThemeName;
  onSelectNode: (node: GraphNode) => void;
  onFitGraphReady: (fit: () => void, reset: () => void) => void;
}

interface LabelCandidate {
  id: string;
  text: string;
  x: number;
  y: number;
  radius: number;
  priority: number;
}

interface LabelBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

interface PeripheralNode {
  id?: string | number;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
}

type PeripheralForce = ((alpha: number) => void) & {
  initialize?: (nodes: PeripheralNode[]) => void;
};

function getEndpointId(endpoint: GraphEdge["source"]) {
  return typeof endpoint === "string" ? endpoint : endpoint.id;
}

function nodeRadius(node: GraphNode, theme: (typeof GRAPH_THEMES)[GraphThemeName]) {
  return Math.min(
    theme.node.maxRadius,
    Math.max(
      theme.node.minRadius,
      theme.node.baseRadius + Math.max(0, node.jumlahHubungan) * theme.node.radiusPerRelation,
    ),
  );
}

function nodeColor(node: GraphNode, theme: (typeof GRAPH_THEMES)[GraphThemeName]) {
  if (node.pusat) return theme.node.centerFill;
  if (!node.tags.length) return theme.node.neutralFill;

  const tag = node.tags[0].toLocaleLowerCase();
  let hash = 0;
  for (let index = 0; index < tag.length; index += 1) {
    hash = (hash * 31 + tag.charCodeAt(index)) | 0;
  }
  return theme.node.tagColors[Math.abs(hash) % theme.node.tagColors.length];
}

function truncateText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  if (ctx.measureText(text).width <= maxWidth) return text;

  let low = 0;
  let high = text.length;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (ctx.measureText(`${text.slice(0, middle)}…`).width <= maxWidth) {
      low = middle;
    } else {
      high = middle - 1;
    }
  }
  return `${text.slice(0, low).trimEnd()}…`;
}

function endpointsOverlap(left: LabelBounds, right: LabelBounds) {
  return (
    left.left < right.right &&
    left.right > right.left &&
    left.top < right.bottom &&
    left.bottom > right.top
  );
}

export default function GraphCanvas({
  nodes,
  edges,
  selectedNodeId,
  searchQuery,
  themeName,
  onSelectNode,
  onFitGraphReady,
}: GraphCanvasProps) {
  const theme = GRAPH_THEMES[themeName];
  const graphRef = useRef<
    ForceGraphMethods<ForceNodeObject, ForceLinkObject<object, GraphEdge>> | undefined
  >(undefined);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const labelCandidatesRef = useRef<LabelCandidate[]>([]);
  const didInitialFitRef = useRef(false);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const isHeavyGraph = nodes.length >= theme.performance.heavyThreshold;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const width = Math.round(entry.contentRect.width);
      const height = Math.round(entry.contentRect.height);
      setCanvasSize((current) =>
        current.width === width && current.height === height
          ? current
          : { width, height },
      );
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const graphData = useMemo(() => {
    const connectedIds = new Set<string>();
    edges.forEach((edge) => {
      connectedIds.add(getEndpointId(edge.source));
      connectedIds.add(getEndpointId(edge.target));
    });
    const isolatedNodes = nodes.filter((node) => !connectedIds.has(node.id));
    const isolatedIds = new Set(isolatedNodes.map((node) => node.id));
    const connectedNodes = nodes.filter((node) => !isolatedIds.has(node.id));
    const positions = new Map<string, { x: number; y: number }>();

    connectedNodes.forEach((node, index) => {
      if (typeof node.x === "number" && typeof node.y === "number") {
        positions.set(node.id, { x: node.x, y: node.y });
        return;
      }
      const angle = index * 2.399963229728653;
      const distance = 35 + Math.sqrt(index + 1) * theme.physics.linkDistance * 0.28;
      positions.set(node.id, {
        x: Math.cos(angle) * distance,
        y: Math.sin(angle) * distance,
      });
    });

    isolatedNodes.forEach((node, index) => {
      if (typeof node.x === "number" && typeof node.y === "number") {
        positions.set(node.id, { x: node.x, y: node.y });
        return;
      }
      const angle = (index / Math.max(1, isolatedNodes.length)) * Math.PI * 2;
      const distance =
        theme.physics.isolatedRadius +
        Math.sqrt(index) * theme.physics.isolatedSpacing;
      positions.set(node.id, {
        x: Math.cos(angle) * distance,
        y: Math.sin(angle) * distance,
      });
    });

    return {
      nodes: nodes.map((node) => ({
        ...node,
        ...positions.get(node.id),
      })),
      links: edges.map((edge) => ({
        ...edge,
        source: typeof edge.source === "string" ? edge.source : edge.source.id,
        target: typeof edge.target === "string" ? edge.target : edge.target.id,
      })),
    };
  }, [edges, nodes, theme.physics.isolatedRadius, theme.physics.isolatedSpacing, theme.physics.linkDistance]);

  const neighboringNodeIds = useMemo(() => {
    if (!hoveredNodeId && !selectedNodeId) return new Set<string>();
    const focusId = hoveredNodeId || selectedNodeId;
    const neighbors = new Set<string>();
    edges.forEach((edge) => {
      const sourceId = typeof edge.source === "string" ? edge.source : edge.source.id;
      const targetId = typeof edge.target === "string" ? edge.target : edge.target.id;
      if (sourceId === focusId) neighbors.add(targetId);
      if (targetId === focusId) neighbors.add(sourceId);
    });
    return neighbors;
  }, [edges, hoveredNodeId, selectedNodeId]);

  const highestDegreeNodeId = useMemo(() => {
    if (!nodes.length) return null;
    return nodes.reduce((highest, node) =>
      node.jumlahHubungan > highest.jumlahHubungan ? node : highest,
    ).id;
  }, [nodes]);

  const peripheralForce = useMemo<PeripheralForce>(() => {
    let isolatedNodes: PeripheralNode[] = [];
    const force: PeripheralForce = (alpha) => {
      isolatedNodes.forEach((node, index) => {
        const angle = (index / Math.max(1, isolatedNodes.length)) * Math.PI * 2;
        const targetRadius =
          theme.physics.isolatedRadius +
          Math.sqrt(index) * theme.physics.isolatedSpacing;
        const currentRadius = Math.hypot(node.x || 0, node.y || 0) || 1;
        const adjustment = (targetRadius - currentRadius) * alpha * 0.018;
        node.vx = (node.vx || 0) + Math.cos(angle) * adjustment;
        node.vy = (node.vy || 0) + Math.sin(angle) * adjustment;
      });
    };
    force.initialize = (simulationNodes) => {
      const connectedIds = new Set<string>();
      edges.forEach((edge) => {
        connectedIds.add(getEndpointId(edge.source));
        connectedIds.add(getEndpointId(edge.target));
      });
      isolatedNodes = simulationNodes.filter(
        (node) => typeof node.id === "string" && !connectedIds.has(node.id),
      );
    };
    return force;
  }, [edges, theme.physics.isolatedRadius, theme.physics.isolatedSpacing]);

  const fitGraph = useCallback(() => {
    graphRef.current?.zoomToFit(500, theme.performance.fitPadding);
  }, [theme.performance.fitPadding]);

  const resetGraph = useCallback(() => {
    graphRef.current?.centerAt(0, 0, 500);
    graphRef.current?.zoom(1, 500);
  }, []);

  useEffect(() => {
    onFitGraphReady(fitGraph, resetGraph);
    return () => onFitGraphReady(() => undefined, () => undefined);
  }, [fitGraph, onFitGraphReady, resetGraph]);

  useEffect(() => {
    const graph = graphRef.current;
    if (!graph) return;
    graph.d3Force("charge")?.strength(theme.physics.chargeStrength);
    graph.d3Force("link")?.distance(theme.physics.linkDistance);
    graph.d3Force("center")?.strength(theme.physics.centerStrength);
    graph.d3Force("peripheral", peripheralForce);
    graph.d3ReheatSimulation();
  }, [canvasSize.height, canvasSize.width, peripheralForce, theme.physics]);

  const handleEngineStop = useCallback(() => {
    if (didInitialFitRef.current || !nodes.length) return;
    didInitialFitRef.current = true;
    fitGraph();
  }, [fitGraph, nodes.length]);

  const paintNode = useCallback(
    (nodeObject: object, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const node = nodeObject as GraphNode;
      const radius = nodeRadius(node, theme);
      const isHovered = hoveredNodeId === node.id;
      const isSelected = selectedNodeId === node.id;
      const isNeighbor = neighboringNodeIds.has(node.id);
      const isSearchMatch =
        searchQuery.trim().length > 0 &&
        node.label.toLocaleLowerCase().includes(searchQuery.trim().toLocaleLowerCase());
      const isFocused = isHovered || isSelected || isNeighbor || isSearchMatch;
      const hasFocus = Boolean(hoveredNodeId || selectedNodeId);
      const shouldShowLabel =
        isHovered ||
        isSelected ||
        isSearchMatch ||
        node.id === highestDegreeNodeId ||
        globalScale >= theme.performance.zoomToShowLabels;

      ctx.save();
      ctx.globalAlpha = hasFocus && !isFocused ? theme.node.dimmedOpacity : 1;
      if (!isHeavyGraph && (isHovered || isSelected || isNeighbor)) {
        ctx.shadowColor = isSelected || isHovered ? theme.node.centerHighlight : nodeColor(node, theme);
        ctx.shadowBlur = theme.performance.glowBlur;
      }
      ctx.beginPath();
      ctx.arc(node.x || 0, node.y || 0, radius, 0, Math.PI * 2);
      ctx.fillStyle = nodeColor(node, theme);
      ctx.fill();
      ctx.lineWidth = (isSelected || isHovered ? 2.5 : 1.25) / Math.max(globalScale, 0.1);
      ctx.strokeStyle =
        isSelected || isHovered
          ? theme.node.activeBorder
          : node.pusat
            ? theme.node.centerHighlight
            : theme.node.neutralBorder;
      ctx.stroke();
      ctx.restore();

      if (!shouldShowLabel || !node.label) return;
      const priority = isSelected ? 5 : isHovered ? 4 : isSearchMatch ? 3 : node.id === highestDegreeNodeId ? 2 : 1;
      labelCandidatesRef.current.push({
        id: node.id,
        text: node.label,
        x: node.x || 0,
        y: node.y || 0,
        radius,
        priority,
      });
    },
    [
      highestDegreeNodeId,
      hoveredNodeId,
      isHeavyGraph,
      neighboringNodeIds,
      searchQuery,
      selectedNodeId,
      theme,
    ],
  );

  const paintLink = useCallback(
    (linkObject: object, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const link = linkObject as GraphEdge;
      if (typeof link.source === "string" || typeof link.target === "string") return;
      const source = link.source;
      const target = link.target;
      const dx = (target.x || 0) - (source.x || 0);
      const dy = (target.y || 0) - (source.y || 0);
      const distance = Math.hypot(dx, dy);
      if (!distance) return;

      const sourceRadius = nodeRadius(source, theme);
      const targetRadius = nodeRadius(target, theme);
      const unitX = dx / distance;
      const unitY = dy / distance;
      const startX = (source.x || 0) + unitX * sourceRadius;
      const startY = (source.y || 0) + unitY * sourceRadius;
      const endX = (target.x || 0) - unitX * targetRadius;
      const endY = (target.y || 0) - unitY * targetRadius;
      const isFocusedLink =
        neighboringNodeIds.has(source.id) ||
        neighboringNodeIds.has(target.id) ||
        hoveredNodeId === source.id ||
        hoveredNodeId === target.id ||
        selectedNodeId === source.id ||
        selectedNodeId === target.id;
      const hasFocus = Boolean(hoveredNodeId || selectedNodeId);
      const isSimilar = link.type === "similar";
      const similarity = Math.min(1, Math.max(0, link.similarity || 0));
      const curvature = isSimilar
        ? theme.thread.curvature
        : theme.thread.conceptCurvature;
      const midpointX = (startX + endX) / 2;
      const midpointY = (startY + endY) / 2;
      const curveOffset = distance * curvature;
      const controlX = midpointX - unitY * curveOffset;
      const controlY = midpointY + unitX * curveOffset;

      ctx.save();
      ctx.globalAlpha = hasFocus && !isFocusedLink ? 0.16 : 0.8;
      ctx.strokeStyle = isSimilar
        ? isFocusedLink
          ? theme.thread.similarHighlight
          : theme.thread.similarColor
        : isFocusedLink
          ? theme.thread.conceptHighlight
          : theme.thread.conceptColor;
      const baseWidth = isSimilar
        ? theme.thread.similarMinWidth +
          (theme.thread.similarMaxWidth - theme.thread.similarMinWidth) * similarity
        : theme.thread.conceptWidth;
      ctx.lineWidth = baseWidth / Math.max(globalScale, 0.1);
      ctx.lineCap = "round";
      ctx.setLineDash(isSimilar ? [] : theme.thread.dashPattern);
      if (isFocusedLink && !isHeavyGraph) {
        ctx.shadowColor = ctx.strokeStyle;
        ctx.shadowBlur = theme.performance.glowBlur;
      }
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.quadraticCurveTo(controlX, controlY, endX, endY);
      ctx.stroke();
      ctx.restore();
    },
    [
      hoveredNodeId,
      isHeavyGraph,
      neighboringNodeIds,
      selectedNodeId,
      theme,
    ],
  );

  const drawLabels = useCallback(
    (ctx: CanvasRenderingContext2D, globalScale: number) => {
      const candidates = labelCandidatesRef.current;
      candidates.sort((left, right) => right.priority - left.priority || left.id.localeCompare(right.id));

      const fontSize = theme.node.labelFontSize / Math.max(globalScale, 0.1);
      const maxWidth = theme.node.labelMaxWidth / Math.max(globalScale, 0.1);
      const paddingX = 8 / Math.max(globalScale, 0.1);
      const paddingY = 4 / Math.max(globalScale, 0.1);
      const gap = theme.node.labelGap / Math.max(globalScale, 0.1);
      const cellSize = theme.performance.labelGridCell / Math.max(globalScale, 0.1);
      const grid = new Map<string, LabelBounds[]>();

      ctx.save();
      ctx.font = `600 ${fontSize}px ${theme.node.labelFontFamily}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";

      candidates.forEach((candidate) => {
        const text = truncateText(ctx, candidate.text, maxWidth);
        const textWidth = ctx.measureText(text).width;
        const bounds: LabelBounds = {
          left: candidate.x - textWidth / 2 - paddingX,
          top: candidate.y + candidate.radius + gap,
          right: candidate.x + textWidth / 2 + paddingX,
          bottom: candidate.y + candidate.radius + gap + fontSize + paddingY * 2,
        };
        const firstColumn = Math.floor(bounds.left / cellSize);
        const lastColumn = Math.floor(bounds.right / cellSize);
        const firstRow = Math.floor(bounds.top / cellSize);
        const lastRow = Math.floor(bounds.bottom / cellSize);
        const keys: string[] = [];
        for (let column = firstColumn; column <= lastColumn; column += 1) {
          for (let row = firstRow; row <= lastRow; row += 1) {
            keys.push(`${column}:${row}`);
          }
        }
        if (keys.some((key) => (grid.get(key) || []).some((placed) => endpointsOverlap(bounds, placed)))) {
          return;
        }
        keys.forEach((key) => {
          const placed = grid.get(key) || [];
          placed.push(bounds);
          grid.set(key, placed);
        });

        const cornerRadius = 5 / Math.max(globalScale, 0.1);
        ctx.beginPath();
        ctx.roundRect(
          bounds.left,
          bounds.top,
          bounds.right - bounds.left,
          bounds.bottom - bounds.top,
          cornerRadius,
        );
        ctx.fillStyle = theme.node.labelBackground;
        ctx.fill();
        ctx.strokeStyle = theme.node.labelBorder;
        ctx.lineWidth = 0.8 / Math.max(globalScale, 0.1);
        ctx.stroke();
        ctx.fillStyle = theme.node.labelText;
        ctx.fillText(text, candidate.x, bounds.top + paddingY, maxWidth);
      });
      labelCandidatesRef.current = [];
      ctx.restore();
    },
    [theme],
  );

  const handleNodeHover = useCallback((node: object | null) => {
    setHoveredNodeId(node ? (node as GraphNode).id : null);
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative min-h-0 min-w-0 flex-1 overflow-hidden touch-none"
      style={{
        backgroundColor: theme.board.background,
        backgroundImage: `radial-gradient(circle, ${theme.board.patternColor} 1px, transparent 1px)`,
        backgroundSize: "26px 26px",
      }}
      role="region"
      aria-label="Grafik hubungan antar catatan"
    >
      {canvasSize.width > 0 && canvasSize.height > 0 && (
        <ForceGraph2D
          ref={graphRef}
          graphData={graphData}
          width={canvasSize.width}
          height={canvasSize.height}
          backgroundColor={theme.board.background}
          cooldownTicks={180}
          d3AlphaDecay={0.035}
          d3VelocityDecay={theme.physics.velocityDecay}
          nodeId="id"
          nodeCanvasObject={paintNode}
          nodeCanvasObjectMode={() => "replace"}
          nodePointerAreaPaint={(node, color, ctx) => {
            const graphNode = node as GraphNode;
            ctx.save();
            ctx.beginPath();
            ctx.arc(graphNode.x || 0, graphNode.y || 0, nodeRadius(graphNode, theme) + 5, 0, Math.PI * 2);
            ctx.fillStyle = color;
            ctx.fill();
            ctx.restore();
          }}
          linkCanvasObject={paintLink}
          linkCanvasObjectMode={() => "replace"}
          onRenderFramePre={() => {
            labelCandidatesRef.current = [];
          }}
          onRenderFramePost={drawLabels}
          onNodeHover={handleNodeHover}
          onNodeClick={(node) => onSelectNode(node as GraphNode)}
          onBackgroundClick={() => setHoveredNodeId(null)}
          onEngineStop={handleEngineStop}
          enableNodeDrag
          enableZoomInteraction
          enablePanInteraction
          minZoom={0.25}
          maxZoom={8}
        />
      )}
      {isHeavyGraph && (
        <div className="pointer-events-none absolute bottom-2 left-3 rounded-full border border-white/10 bg-black/40 px-2.5 py-1 text-[10px] text-slate-300">
          Efek visual disederhanakan untuk menjaga kelancaran
        </div>
      )}
    </div>
  );
}
