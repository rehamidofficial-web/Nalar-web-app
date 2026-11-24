"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useRequireAuth } from "@/lib/useRequireAuth";
import { AppShell } from "@/components/AppShell";
import { apiFetch, pesanError } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { GraphNode, GraphEdge, GraphMeta, GraphResponseData } from "@/types/graph";
import { NodeDetailPanel } from "@/components/graph/NodeDetailPanel";
import type { GraphCanvasApi } from "@/components/graph/GraphCanvas";
import { Icon, PageHeader, Spinner, btnPrimary, btnSecondary, cardClass } from "@/components/ui";

// Kanvas hanya dimuat di browser (tidak dirender di server)
const GraphCanvas = dynamic(() => import("@/components/graph/GraphCanvas"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full min-h-[360px] items-center justify-center bg-[#0b1020] text-sm text-slate-300">
      <Spinner className="mr-2 h-5 w-5" /> Menyiapkan graph…
    </div>
  ),
});

export function GraphContent() {
  const user = useRequireAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Mode fokus dari URL: ?catatan=<id>
  const urlCatatanId = searchParams.get("catatan") || "";
  const [prevUrlCatatanId, setPrevUrlCatatanId] = useState(urlCatatanId);
  const [focusNoteId, setFocusNoteId] = useState<string | null>(urlCatatanId || null);
  if (prevUrlCatatanId !== urlCatatanId) {
    setPrevUrlCatatanId(urlCatatanId);
    setFocusNoteId(urlCatatanId || null);
  }

  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [meta, setMeta] = useState<GraphMeta>({
    totalCatatan: 0,
    jumlahNode: 0,
    jumlahEdge: 0,
    terpotong: false,
  });
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [zoomPercent, setZoomPercent] = useState(100);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const requestIdRef = useRef(0);
  const canvasApiRef = useRef<GraphCanvasApi | null>(null);
  const graphBoxRef = useRef<HTMLElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const handleApiReady = useCallback((api: GraphCanvasApi) => {
    canvasApiRef.current = api;
  }, []);

  const fetchData = useCallback(async () => {
    const token = getToken();
    if (!token) return;

    setIsLoading(true);
    setErrorMessage("");
    const currentReqId = ++requestIdRef.current;

    try {
      const endpoint = focusNoteId ? `/graph/${focusNoteId}` : "/graph?batas=200";
      const res = await apiFetch<GraphResponseData>(endpoint, { token });
      if (currentReqId !== requestIdRef.current) return;

      if (!res.ok) {
        setErrorMessage(pesanError(res));
        setIsLoading(false);
        return;
      }

      if (res.data) {
        const fetchedNodes = res.data.nodes || [];
        const fetchedEdges = res.data.edges || [];
        setNodes(fetchedNodes);
        setEdges(fetchedEdges);
        setMeta(
          res.data.meta || {
            totalCatatan: fetchedNodes.length,
            jumlahNode: fetchedNodes.length,
            jumlahEdge: fetchedEdges.length,
            terpotong: false,
          },
        );

        if (focusNoteId) {
          const center = fetchedNodes.find((n) => n.id === focusNoteId || n.pusat);
          if (center) setSelectedNode(center);
        } else {
          setSelectedNode((prev) => (prev ? fetchedNodes.find((n) => n.id === prev.id) || null : null));
        }
      }
    } catch {
      if (currentReqId === requestIdRef.current) {
        setErrorMessage("Tidak bisa terhubung ke server. Pastikan backend sedang menyala.");
      }
    } finally {
      if (currentReqId === requestIdRef.current) setIsLoading(false);
    }
  }, [focusNoteId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchData();
    }, 150);
    return () => clearTimeout(timer);
  }, [fetchData]);

  // Di layar kecil panel detail ada di bawah graph, jadi gulir ke sana saat titik diketuk
  const handleCanvasSelect = (node: GraphNode) => {
    setSelectedNode(node);
    const kecil = typeof window !== "undefined" && window.matchMedia?.("(max-width: 1023px)")?.matches;
    if (kecil) {
      requestAnimationFrame(() => {
        panelRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
      });
    }
  };

  const handleBackToGraph = () => {
    graphBoxRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  };

  const handleSelectId = (id: string) => {
    const found = nodes.find((n) => n.id === id);
    if (found) setSelectedNode(found);
  };

  const handleResetFocus = () => {
    setFocusNoteId(null);
    setSelectedNode(null);
    router.push("/graph");
  };

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-slate-500">Memuat...</p>
      </div>
    );
  }

  const zoomBtn =
    "inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-lg font-semibold text-slate-800 transition-colors hover:bg-slate-50";

  return (
    <AppShell user={user}>
      <PageHeader
        title="Knowledge Graph"
        subtitle="Setiap titik adalah satu catatan. Setiap garis menunjukkan dua catatan yang saling terhubung."
      />

      {errorMessage ? (
        <div role="alert" className={`${cardClass} mx-auto max-w-lg p-8 text-center`}>
          <h2 className="text-lg font-bold text-slate-900">Graph belum bisa dimuat</h2>
          <p className="mt-2 text-sm text-slate-500">{errorMessage} Catatanmu aman.</p>
          <button type="button" onClick={fetchData} className={`${btnPrimary} mt-5`}>
            Coba lagi
          </button>
        </div>
      ) : isLoading && nodes.length === 0 ? (
        <div className={`${cardClass} flex h-[480px] items-center justify-center gap-2 text-sm text-slate-500`} aria-busy="true">
          <Spinner className="h-5 w-5 text-indigo-600" /> Memuat graph…
        </div>
      ) : nodes.length === 0 ? (
        <div className={`${cardClass} mx-auto max-w-lg p-10 text-center`}>
          <h2 className="text-lg font-bold text-slate-900">Belum ada catatan</h2>
          <p className="mt-2 text-sm text-slate-500">
            Tulis beberapa catatan dan Nalar akan menghubungkannya di sini.
          </p>
          <Link href="/notes/new" className={`${btnPrimary} mt-5`}>
            Tulis catatan baru
          </Link>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <section
            ref={graphBoxRef}
            className={`${cardClass} scroll-mt-20 overflow-hidden lg:scroll-mt-0`}
            aria-label="Graph catatan"
          >
            {/* Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-3.5">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-600">
                <span className="inline-flex items-center gap-2">
                  <span className="inline-block h-3.5 w-5 rounded-md bg-violet-500" aria-hidden="true" />
                  Catatan
                </span>
                <span>
                  {meta.jumlahNode} catatan · {meta.jumlahEdge} hubungan
                </span>
                {meta.terpotong && <span className="text-amber-600">Sebagian catatan tidak ditampilkan</span>}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {focusNoteId && (
                  <button type="button" onClick={handleResetFocus} className={`${btnSecondary} !min-h-[44px]`}>
                    Semua catatan
                  </button>
                )}
                <button type="button" onClick={() => canvasApiRef.current?.zoomOut()} className={zoomBtn} aria-label="Perkecil">
                  <Icon name="minus" className="h-4 w-4" />
                </button>
                <span className="w-12 text-center text-sm font-semibold text-slate-900" aria-live="polite">
                  {zoomPercent}%
                </span>
                <button type="button" onClick={() => canvasApiRef.current?.zoomIn()} className={zoomBtn} aria-label="Perbesar">
                  <Icon name="plus" className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => canvasApiRef.current?.fit()} className={`${btnSecondary} !px-4`}>
                  Atur ulang
                </button>
              </div>
            </div>

            <div className="h-[60dvh] max-h-[560px] min-h-[360px] bg-[#0b1020] lg:h-[520px]">
              <GraphCanvas
                nodes={nodes}
                edges={edges}
                selectedNodeId={selectedNode?.id || null}
                onSelectNode={handleCanvasSelect}
                onBackgroundClick={() => setSelectedNode(null)}
                onZoomChange={setZoomPercent}
                onApiReady={handleApiReady}
              />
            </div>

            <p className="border-t border-slate-200 px-5 py-3.5 text-sm text-slate-500">
              Geser untuk memindahkan graph. Pakai + dan – untuk zoom. Klik sebuah titik untuk melihat
              hubungannya.
            </p>
            <p className="border-t border-slate-200 px-5 py-3 text-xs text-slate-500 lg:hidden">
              Di HP, sentuh area graph untuk menggeser graph. Untuk menggulir halaman, sentuh di luar graph.
            </p>
          </section>

          <div ref={panelRef} className="scroll-mt-20 lg:scroll-mt-0">
            <NodeDetailPanel
              node={selectedNode}
              edges={edges}
              allNodes={nodes}
              onSelectId={handleSelectId}
              onBackToGraph={handleBackToGraph}
            />
          </div>
        </div>
      )}
    </AppShell>
  );
}
