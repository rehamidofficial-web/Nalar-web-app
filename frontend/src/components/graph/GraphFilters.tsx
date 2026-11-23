"use client";

import React, { useState } from "react";
import { GRAPH_THEMES, GraphThemeName } from "@/lib/graphTheme";

export interface FilterState {
  tipe: "semua" | "similar" | "concept";
  skorMin: number; // 0 sampai 1
  tag: string;
  cariJudul: string;
}

interface GraphFiltersProps {
  filters: FilterState;
  themeName: GraphThemeName;
  availableTags: string[];
  totalCatatan: number;
  jumlahNode: number;
  jumlahEdge: number;
  terpotong: boolean;
  onFilterChange: (newFilters: Partial<FilterState>) => void;
  onResetFilters: () => void;
  onFitGraph?: () => void;
  onResetZoom?: () => void;
}

export function GraphFilters({
  filters,
  themeName,
  availableTags,
  totalCatatan,
  jumlahNode,
  jumlahEdge,
  terpotong,
  onFilterChange,
  onResetFilters,
  onFitGraph,
  onResetZoom,
}: GraphFiltersProps) {
  const [isCollapsedMobile, setIsCollapsedMobile] = useState(true);
  const theme = GRAPH_THEMES[themeName];

  return (
    <div
      className="select-none border-b p-3 text-sm sm:p-4"
      style={{ backgroundColor: theme.ui.panel, borderColor: theme.ui.border, color: theme.ui.text }}
    >
      {/* Baris Atas: Ringkasan info & Tombol kontrol tampilan & toggle HP */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium" style={{ color: theme.ui.text }}>
            {jumlahNode} catatan, {jumlahEdge} hubungan
          </span>

          {terpotong && (
            <span
              className="rounded-full border px-2 py-0.5 text-xs"
              style={{ color: theme.ui.text, backgroundColor: theme.ui.panelAlt, borderColor: theme.ui.border }}
              title={`Menampilkan ${jumlahNode} dari total ${totalCatatan} catatan terbaru. Gunakan filter tag untuk mempersempit.`}
            >
              Menampilkan {jumlahNode} dari {totalCatatan} (terpotong)
            </span>
          )}
        </div>

        {/* Tombol aksi cepat: Fit, Reset, Toggle Filter HP */}
        <div className="flex items-center gap-2">
          {onFitGraph && (
            <button
              type="button"
              onClick={onFitGraph}
              className="rounded-md border px-2.5 py-1 text-xs font-medium transition-colors"
              style={{ color: theme.ui.text, backgroundColor: theme.ui.control, borderColor: theme.ui.border }}
              title="Sesuaikan tampilan ke layar"
            >
              Pas ke Layar
            </button>
          )}

          {onResetZoom && (
            <button
              type="button"
              onClick={onResetZoom}
              className="rounded-md border px-2.5 py-1 text-xs font-medium transition-colors"
              style={{ color: theme.ui.text, backgroundColor: theme.ui.control, borderColor: theme.ui.border }}
              title="Setel ulang posisi dan perbesaran"
            >
              Setel Ulang
            </button>
          )}

          {/* Toggle filter di HP */}
          <button
            type="button"
            onClick={() => setIsCollapsedMobile(!isCollapsedMobile)}
            className="rounded-md border px-2.5 py-1 text-xs font-medium transition-colors sm:hidden"
            style={{ color: theme.ui.accentText, backgroundColor: theme.ui.selected, borderColor: theme.ui.border }}
          >
            {isCollapsedMobile ? "Buka Filter" : "Tutup Filter"}
          </button>
        </div>
      </div>

      {/* Baris Filter (Bisa dilipat di HP) */}
      <div
        className={`mt-3 grid grid-cols-1 items-end gap-3 border-t pt-3 transition-all sm:grid-cols-2 lg:grid-cols-4 ${
          isCollapsedMobile ? "hidden sm:grid" : "grid"
        }`}
        style={{ borderColor: theme.ui.border }}
      >
        {/* 1. Jenis Relasi */}
        <div>
          <label className="mb-1 block text-xs font-medium" style={{ color: theme.ui.muted }}>
            Jenis Hubungan
          </label>
          <select
            value={filters.tipe}
            onChange={(e) =>
              onFilterChange({
                tipe: e.target.value as "semua" | "similar" | "concept",
              })
            }
            className="w-full rounded-md border px-2.5 py-1.5 text-xs focus:outline-hidden focus:ring-2"
            style={{ backgroundColor: theme.ui.control, borderColor: theme.ui.border, color: theme.ui.text, accentColor: theme.ui.accent }}
          >
            <option value="semua">Semua Hubungan</option>
            <option value="similar">Makna Mirip</option>
            <option value="concept">Konsep Sama</option>
          </select>
        </div>

        {/* 2. Slider Skor Minimal */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="text-xs font-medium" style={{ color: theme.ui.muted }}>
              Skor Minimal
            </label>
            <span className="text-xs font-semibold" style={{ color: theme.ui.accentText }}>
              {Math.round(filters.skorMin * 100)}%
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={filters.skorMin}
            onChange={(e) =>
              onFilterChange({ skorMin: parseFloat(e.target.value) })
            }
            disabled={filters.tipe === "concept"}
            className="h-1.5 w-full cursor-pointer appearance-none rounded-lg disabled:opacity-40"
            style={{ accentColor: theme.ui.accent }}
            title={
              filters.tipe === "concept"
                ? "Hanya berlaku untuk hubungan Makna Mirip"
                : "Geser untuk menyaring kemiripan minimal"
            }
          />
        </div>

        {/* 3. Pilihan Tag */}
        <div>
          <label className="mb-1 block text-xs font-medium" style={{ color: theme.ui.muted }}>
            Saring Tag
          </label>
          <select
            value={filters.tag}
            onChange={(e) => onFilterChange({ tag: e.target.value })}
            className="w-full rounded-md border px-2.5 py-1.5 text-xs focus:outline-hidden focus:ring-2"
            style={{ backgroundColor: theme.ui.control, borderColor: theme.ui.border, color: theme.ui.text, accentColor: theme.ui.accent }}
          >
            <option value="">Semua Tag</option>
            {availableTags.map((t) => (
              <option key={t} value={t}>
                #{t}
              </option>
            ))}
          </select>
        </div>

        {/* 4. Cari Judul & Tombol Reset */}
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <label className="mb-1 block text-xs font-medium" style={{ color: theme.ui.muted }}>
              Cari Judul
            </label>
            <input
              type="text"
              placeholder="Sorot judul..."
              value={filters.cariJudul}
              onChange={(e) => onFilterChange({ cariJudul: e.target.value })}
              className="w-full rounded-md border px-2.5 py-1.5 text-xs placeholder:text-slate-400 focus:outline-hidden focus:ring-2"
              style={{ backgroundColor: theme.ui.control, borderColor: theme.ui.border, color: theme.ui.text, accentColor: theme.ui.accent }}
            />
          </div>

          <div className="self-end">
            <button
              type="button"
              onClick={onResetFilters}
              className="rounded-md border px-3 py-1.5 text-xs font-medium transition-colors"
              style={{ color: theme.ui.text, backgroundColor: theme.ui.control, borderColor: theme.ui.border }}
              title="Atur ulang semua filter"
            >
              Reset
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}