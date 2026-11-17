"use client";

import React, { useState } from "react";

export interface FilterState {
  tipe: "semua" | "similar" | "concept";
  skorMin: number; // 0 sampai 1
  tag: string;
  cariJudul: string;
}

interface GraphFiltersProps {
  filters: FilterState;
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

  return (
    <div className="bg-white border-b border-slate-200 p-3 sm:p-4 text-sm select-none">
      {/* Baris Atas: Ringkasan info & Tombol kontrol tampilan & toggle HP */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-slate-700">
            {jumlahNode} catatan, {jumlahEdge} hubungan
          </span>

          {terpotong && (
            <span
              className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full"
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
              className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md border border-slate-200 transition-colors"
              title="Sesuaikan tampilan ke layar"
            >
              Pas ke Layar
            </button>
          )}

          {onResetZoom && (
            <button
              type="button"
              onClick={onResetZoom}
              className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md border border-slate-200 transition-colors"
              title="Setel ulang posisi dan perbesaran"
            >
              Setel Ulang
            </button>
          )}

          {/* Toggle filter di HP */}
          <button
            type="button"
            onClick={() => setIsCollapsedMobile(!isCollapsedMobile)}
            className="sm:hidden px-2.5 py-1 text-xs font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-md border border-indigo-100 transition-colors"
          >
            {isCollapsedMobile ? "Buka Filter" : "Tutup Filter"}
          </button>
        </div>
      </div>

      {/* Baris Filter (Bisa dilipat di HP) */}
      <div
        className={`mt-3 pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end transition-all ${
          isCollapsedMobile ? "hidden sm:grid" : "grid"
        }`}
      >
        {/* 1. Jenis Relasi */}
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Jenis Hubungan
          </label>
          <select
            value={filters.tipe}
            onChange={(e) =>
              onFilterChange({
                tipe: e.target.value as "semua" | "similar" | "concept",
              })
            }
            className="w-full text-xs rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="semua">Semua Hubungan</option>
            <option value="similar">Makna Mirip</option>
            <option value="concept">Konsep Sama</option>
          </select>
        </div>

        {/* 2. Slider Skor Minimal */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="text-xs font-medium text-slate-600">
              Skor Minimal
            </label>
            <span className="text-xs font-semibold text-indigo-600">
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
            className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600 disabled:opacity-40"
            title={
              filters.tipe === "concept"
                ? "Hanya berlaku untuk hubungan Makna Mirip"
                : "Geser untuk menyaring kemiripan minimal"
            }
          />
        </div>

        {/* 3. Pilihan Tag */}
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Saring Tag
          </label>
          <select
            value={filters.tag}
            onChange={(e) => onFilterChange({ tag: e.target.value })}
            className="w-full text-xs rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
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
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Cari Judul
            </label>
            <input
              type="text"
              placeholder="Sorot judul..."
              value={filters.cariJudul}
              onChange={(e) => onFilterChange({ cariJudul: e.target.value })}
              className="w-full text-xs rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-slate-700 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          <div className="self-end">
            <button
              type="button"
              onClick={onResetFilters}
              className="py-1.5 px-3 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-md border border-slate-200 transition-colors"
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