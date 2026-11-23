"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useRequireAuth } from "@/lib/useRequireAuth";
import { AppShell } from "@/components/AppShell";
import { apiFetch, pesanError } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { GraphNode, GraphEdge, GraphMeta, GraphResponseData } from "@/types/graph";
import { GraphFilters, FilterState } from "@/components/graph/GraphFilters";
import { NodeDetailPanel } from "@/components/graph/NodeDetailPanel";
import { GraphList } from "@/components/graph/GraphList";
import { GRAPH_THEMES, GraphThemeName } from "@/lib/graphTheme";

// Muat GraphCanvas dengan next/dynamic { ssr: false } agar tidak dirender di server
const GraphCanvas = dynamic(
  () => import("@/components/graph/GraphCanvas"),
  {
    ssr: false,
    loading: () => (
      <div className="flex-1 w-full h-full min-h-0 flex items-center justify-center bg-[#111318]">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-3 border-indigo-400 border-t-transparent rounded-full animate-spin mb-2" />
          <p className="text-sm text-slate-300">Menyiapkan kanvas graph...</p>
        </div>
      </div>
    ),
  }
);

export function GraphContent() {
  const user = useRequireAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Mode fokus dari URL param: ?catatan=<id>
  const urlCatatanId = searchParams.get("catatan") || "";
  const [prevUrlCatatanId, setPrevUrlCatatanId] = useState(urlCatatanId);
  const [focusNoteId, setFocusNoteId] = useState<string | null>(urlCatatanId || null);

  // Sinkronisasi state saat URL berubah (pola render phase sync)
  if (prevUrlCatatanId !== urlCatatanId) {
    setPrevUrlCatatanId(urlCatatanId);
    setFocusNoteId(urlCatatanId || null);
  }

  // Tab: "graph" atau "list"
  const [activeTab, setActiveTab] = useState<"graph" | "list">("graph");

  // State Filter
  const [filters, setFilters] = useState<FilterState>({
    tipe: "semua",
    skorMin: 0,
    tag: "",
    cariJudul: "",
  });
  const [themeName, setThemeName] = useState<GraphThemeName>("modern");
  const theme = GRAPH_THEMES[themeName];

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const savedTheme = window.localStorage.getItem("nalar:graph-theme");
        if (savedTheme === "modern" || savedTheme === "detective") {
          setThemeName(savedTheme);
        }
      } catch (error) {
        console.warn("Tema graph tersimpan tidak dapat dibaca.", error);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const handleThemeChange = (nextTheme: GraphThemeName) => {
    setThemeName(nextTheme);
    try {
      window.localStorage.setItem("nalar:graph-theme", nextTheme);
    } catch (error) {
      console.warn("Tema graph tidak dapat disimpan di browser.", error);
    }
  };

  // Data Graph
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [meta, setMeta] = useState<GraphMeta>({
    totalCatatan: 0,
    jumlahNode: 0,
    jumlahEdge: 0,
    terpotong: false,
  });

  // State Interaksi
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);

  // Status API
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  // Race condition ref
  const requestIdRef = useRef(0);

  // Callback dari GraphCanvas untuk aksi zoom/fit
  const fitGraphFnRef = useRef<(() => void) | null>(null);
  const resetZoomFnRef = useRef<(() => void) | null>(null);

  const handleRegisterCanvasFns = useCallback((fitFn: () => void, resetFn: () => void) => {
    fitGraphFnRef.current = fitFn;
    resetZoomFnRef.current = resetFn;
  }, []);

  // Fungsi fetch data graph
  const fetchData = useCallback(async () => {
    const token = getToken();
    if (!token) return;

    setIsLoading(true);
    setErrorMessage("");

    const currentReqId = ++requestIdRef.current;

    try {
      let endpoint = "";
      if (focusNoteId) {
        // Mode fokus satu catatan: GET /graph/:noteId
        const params = new URLSearchParams();
        if (filters.tipe !== "semua") params.set("tipe", filters.tipe);
        if (filters.skorMin > 0) params.set("skorMin", filters.skorMin.toString());
        const qs = params.toString();
        endpoint = `/graph/${focusNoteId}${qs ? `?${qs}` : ""}`;
      } else {
        // Mode seluruh graph: GET /graph
        const params = new URLSearchParams();
        params.set("batas", "200");
        if (filters.tipe !== "semua") params.set("tipe", filters.tipe);
        if (filters.skorMin > 0) params.set("skorMin", filters.skorMin.toString());
        if (filters.tag) params.set("tag", filters.tag);
        endpoint = `/graph?${params.toString()}`;
      }

      const res = await apiFetch<GraphResponseData>(endpoint, { token });

      // Hanya proses jika ini request terbaru
      if (currentReqId !== requestIdRef.current) return;

      if (!res.ok) {
        setErrorMessage(pesanError(res));
        setIsLoading(false);
        return;
      }

      if (res.data) {
        const fetchedNodes = res.data.nodes || [];
        const fetchedEdges = res.data.edges || [];
        const fetchedMeta = res.data.meta || {
          totalCatatan: fetchedNodes.length,
          jumlahNode: fetchedNodes.length,
          jumlahEdge: fetchedEdges.length,
          terpotong: false,
        };

        setNodes(fetchedNodes);
        setEdges(fetchedEdges);
        setMeta(fetchedMeta);

        // Jika fokus ke catatan tertentu, sinkronkan selectedNode
        if (focusNoteId) {
          const center = fetchedNodes.find((n) => n.id === focusNoteId || n.pusat);
          if (center) {
            setSelectedNode(center);
          }
        } else {
          // Cari apakah node yang dipilih sebelumnya masih ada di data baru
          setSelectedNode((prevSelected) => {
            if (!prevSelected) return null;
            return fetchedNodes.find((n) => n.id === prevSelected.id) || null;
          });
        }
      }
    } catch {
      if (currentReqId === requestIdRef.current) {
        setErrorMessage("Gagal menghubungkan ke server.");
      }
    } finally {
      if (currentReqId === requestIdRef.current) {
        setIsLoading(false);
      }
    }
  }, [filters.tipe, filters.skorMin, filters.tag, focusNoteId]);

  // Efek debounce pemanggilan API saat filter berubah
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchData();
    }, 250);

    return () => clearTimeout(timer);
  }, [fetchData]);

  // Daftar tag unik dari seluruh node yang ada
  const availableTags = useMemo(() => {
    const tagSet = new Set<string>();
    nodes.forEach((n) => {
      if (n.tags && Array.isArray(n.tags)) {
        n.tags.forEach((t) => tagSet.add(t));
      }
    });
    return Array.from(tagSet).sort();
  }, [nodes]);

  // Handler pergantian filter
  const handleFilterChange = (newFilters: Partial<FilterState>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
  };

  const handleResetFilters = () => {
    setFilters({
      tipe: "semua",
      skorMin: 0,
      tag: "",
      cariJudul: "",
    });
  };

  // Handler fokus dan reset fokus
  const handleFocusNode = (nodeId: string) => {
    setFocusNoteId(nodeId);
    router.push(`/graph?catatan=${nodeId}`);
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

  return (
    <AppShell user={user}>
      <div
        className="flex h-full min-h-0 flex-col overflow-hidden"
        style={{ backgroundColor: theme.board.background, color: theme.ui.text }}
      >
        {/* Header Tab dan Info Halaman */}
        <div
          className="flex shrink-0 flex-col justify-between gap-3 border-b px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center"
          style={{ backgroundColor: theme.ui.panel, borderColor: theme.ui.border }}
        >
          <div>
            <h1 className="text-lg font-bold" style={{ color: theme.ui.text }}>Knowledge Graph</h1>
            <p className="text-xs" style={{ color: theme.ui.muted }}>
              Visualisasi hubungan dan keterkaitan antar catatan ide Anda.
            </p>
          </div>

          {/* Tab Selector & Legenda */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <div className="flex rounded-lg border p-0.5" style={{ backgroundColor: theme.ui.control, borderColor: theme.ui.border }} role="group" aria-label="Pilih tema graph">
              {([
                ["modern", "Modern"],
                ["detective", "Detektif"],
              ] as const).map(([value, label]) => {
                const isSelected = themeName === value;
                return (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => handleThemeChange(value)}
                    className="rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors"
                    style={{
                      backgroundColor: isSelected ? theme.ui.accent : "transparent",
                      color: isSelected ? theme.ui.accentText : theme.ui.muted,
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            {/* Legenda ringkas tema detektif */}
            <div className="hidden items-center gap-3 rounded-lg border px-3 py-1.5 text-xs lg:flex" style={{ color: theme.ui.text, backgroundColor: theme.ui.panelAlt, borderColor: theme.ui.border }}>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-0.5 w-3.5" style={{ backgroundColor: theme.thread.similarColor }} />
                Benang Merah (Makna Mirip)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-3.5 border-t-2 border-dashed" style={{ borderColor: theme.thread.conceptColor }} />
                Benang Biru (Konsep Sama)
              </span>
            </div>

            {/* Tab Navigasi */}
            <div className="flex rounded-lg border p-0.5" style={{ backgroundColor: theme.ui.control, borderColor: theme.ui.border }} role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "graph"}
                onClick={() => setActiveTab("graph")}
                className="rounded-md px-3 py-1.5 text-xs font-medium transition-all"
                style={{
                  backgroundColor: activeTab === "graph" ? theme.ui.accent : "transparent",
                  color: activeTab === "graph" ? theme.ui.accentText : theme.ui.muted,
                }}
              >
                Graph
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "list"}
                onClick={() => setActiveTab("list")}
                className="rounded-md px-3 py-1.5 text-xs font-medium transition-all"
                style={{
                  backgroundColor: activeTab === "list" ? theme.ui.accent : "transparent",
                  color: activeTab === "list" ? theme.ui.accentText : theme.ui.muted,
                }}
              >
                Daftar
              </button>
            </div>
          </div>
        </div>

        {/* Filter Bar */}
        <GraphFilters
          filters={filters}
          themeName={themeName}
          availableTags={availableTags}
          totalCatatan={meta.totalCatatan}
          jumlahNode={meta.jumlahNode}
          jumlahEdge={meta.jumlahEdge}
          terpotong={meta.terpotong}
          onFilterChange={handleFilterChange}
          onResetFilters={handleResetFilters}
          onFitGraph={() => fitGraphFnRef.current?.()}
          onResetZoom={() => resetZoomFnRef.current?.()}
        />

        {/* Banner Mode Fokus */}
        {focusNoteId && (
          <div className="flex items-center justify-between gap-3 border-b px-4 py-2 text-xs" style={{ backgroundColor: theme.ui.selected, borderColor: theme.ui.border, color: theme.ui.text }}>
            <span>
              Mode fokus: Menampilkan catatan pusat dan tetangga terdekatnya.
            </span>
            <button
              type="button"
              onClick={handleResetFocus}
              className="shrink-0 font-medium underline"
              style={{ color: theme.ui.accentText }}
            >
              Kembali ke semua catatan
            </button>
          </div>
        )}

        {/* Konten Utama: Error, Loading, Kosong, atau Graph/List */}
        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden md:flex-row" style={{ backgroundColor: theme.board.background }}>
          {isLoading && nodes.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="inline-block w-8 h-8 border-3 border-indigo-400 border-t-transparent rounded-full animate-spin mb-3" />
                <p className="text-sm font-medium" style={{ color: theme.ui.text }}>Memuat graph...</p>
                <p className="mt-1 text-xs" style={{ color: theme.ui.muted }}>Mengambil data relasi catatan Anda</p>
              </div>
            </div>
          ) : errorMessage ? (
            <div className="flex-1 flex items-center justify-center p-6">
              <div className="max-w-md w-full bg-white rounded-xl border border-rose-200 p-6 text-center shadow-xs">
                <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-600 mx-auto flex items-center justify-center mb-3">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h3 className="text-sm font-semibold text-slate-800 mb-1">Gagal Memuat Graph</h3>
                <p className="text-xs text-rose-600 mb-4">{errorMessage}</p>
                <button
                  type="button"
                  onClick={fetchData}
                  className="px-4 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors"
                >
                  Coba lagi
                </button>
              </div>
            </div>
          ) : nodes.length === 0 ? (
            <div className="flex-1 flex items-center justify-center p-6">
              <div className="max-w-md w-full bg-white rounded-xl border border-slate-200 p-6 text-center shadow-xs">
                {meta.totalCatatan === 0 ? (
                  <>
                    <h3 className="text-sm font-semibold text-slate-800 mb-1">Belum Ada Catatan</h3>
                    <p className="text-xs text-slate-500 mb-4">
                      Belum ada catatan. Tulis beberapa catatan dan Nalar akan menghubungkannya di sini.
                    </p>
                    <Link
                      href="/notes/new"
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors"
                    >
                      <span>Tulis Catatan Baru</span>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </Link>
                  </>
                ) : (
                  <>
                    <h3 className="text-sm font-semibold text-slate-800 mb-1">Tidak Ada yang Cocok</h3>
                    <p className="text-xs text-slate-500 mb-4">
                      Tidak ada catatan atau hubungan yang cocok dengan filter saat ini.
                    </p>
                    <button
                      type="button"
                      onClick={handleResetFilters}
                      className="px-4 py-2 text-xs font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
                    >
                      Atur Ulang Filter
                    </button>
                  </>
                )}
              </div>
            </div>
          ) : (
            <>
              {/* Jika ada catatan tapi hubungan 0 sama sekali */}
              {edges.length === 0 && !filters.tag && filters.tipe === "semua" && (
                <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 max-w-md w-11/12 bg-white/95 backdrop-blur-xs border border-amber-200 p-3 rounded-lg shadow-sm text-center">
                  <p className="text-xs text-amber-800 font-medium">
                    Belum ada hubungan antar catatan. Hubungan dibuat otomatis setelah catatan diindeks dan punya topik yang berdekatan.
                  </p>
                </div>
              )}

              {/* Tampilan Tab: Graph atau Tab: Daftar */}
              {activeTab === "graph" ? (
                <div className="flex-1 w-full h-full relative flex overflow-hidden">
                  <GraphCanvas
                    nodes={nodes}
                    edges={edges}
                    themeName={themeName}
                    selectedNodeId={selectedNode?.id || null}
                    searchQuery={filters.cariJudul}
                    onSelectNode={(node) => setSelectedNode(node)}
                    onFitGraphReady={handleRegisterCanvasFns}
                  />

                  {/* Panel Detail (kanan di desktop, bawah di mobile) */}
                  {selectedNode && (
                    <NodeDetailPanel
                      node={selectedNode}
                      edges={edges}
                      allNodes={nodes}
                      themeName={themeName}
                      isFocusMode={Boolean(focusNoteId)}
                      onClose={() => setSelectedNode(null)}
                      onFocusNode={handleFocusNode}
                      onResetFocus={handleResetFocus}
                    />
                  )}
                </div>
              ) : (
                <div className="flex-1 w-full h-full overflow-y-auto">
                  <GraphList
                    nodes={nodes}
                    edges={edges}
                    searchQuery={filters.cariJudul}
                    onFocusNode={(nodeId) => {
                      handleFocusNode(nodeId);
                      setActiveTab("graph");
                    }}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </AppShell>
  );
}