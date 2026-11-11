"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRequireAuth } from "@/lib/useRequireAuth";
import { AppShell } from "@/components/AppShell";
import { apiFetch, pesanError } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { waktuRelatif } from "@/lib/format";

interface DashboardStats {
  totalNotes: number;
  totalConcepts: number;
  totalRelationships: number;
  recentActivity: number;
}

interface RecentNote {
  id: string;
  title: string;
  summary: string | null;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
  contentPreview: string;
}

export default function DashboardPage() {
  const user = useRequireAuth();

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentNotes, setRecentNotes] = useState<RecentNote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const fetchData = useCallback(async () => {
    if (!user) return;

    setIsLoading(true);
    setErrorMessage("");
    const token = getToken();

    try {
      const [statsRes, notesRes] = await Promise.all([
        apiFetch<DashboardStats>("/dashboard/stats", { token }),
        apiFetch<{ items: RecentNote[] }>("/dashboard/recent-notes?limit=5", { token }),
      ]);

      if (statsRes.ok && statsRes.data && notesRes.ok && notesRes.data) {
        setStats(statsRes.data);
        setRecentNotes(notesRes.data.items);
      } else {
        const errorText = !statsRes.ok
          ? pesanError(statsRes)
          : pesanError(notesRes);
        setErrorMessage(errorText || "Gagal memuat data dashboard.");
      }
    } catch {
      setErrorMessage("Tidak bisa terhubung ke server. Pastikan backend sedang menyala.");
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    let isCancelled = false;
    const token = getToken();

    Promise.all([
      apiFetch<DashboardStats>("/dashboard/stats", { token }),
      apiFetch<{ items: RecentNote[] }>("/dashboard/recent-notes?limit=5", { token }),
    ])
      .then(([statsRes, notesRes]) => {
        if (isCancelled) return;
        if (statsRes.ok && statsRes.data && notesRes.ok && notesRes.data) {
          setStats(statsRes.data);
          setRecentNotes(notesRes.data.items);
        } else {
          const errorText = !statsRes.ok
            ? pesanError(statsRes)
            : pesanError(notesRes);
          setErrorMessage(errorText || "Gagal memuat data dashboard.");
        }
      })
      .catch(() => {
        if (!isCancelled) {
          setErrorMessage("Tidak bisa terhubung ke server. Pastikan backend sedang menyala.");
        }
      })
      .finally(() => {
        if (!isCancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [user]);

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-slate-500">Memuat...</p>
      </div>
    );
  }

  return (
    <AppShell user={user}>
      <div className="space-y-8">
        {/* Header Dashboard */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-200">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Halo, {user.name}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Ini ringkasan pengetahuanmu hari ini.
            </p>
          </div>
          <div>
            <Link
              href="/notes/new"
              className="inline-flex min-h-[44px] w-full sm:w-auto items-center justify-center rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 transition-colors focus:ring-2 focus:ring-indigo-500"
            >
              + Catatan Baru
            </Link>
          </div>
        </div>

        {/* Pesan Error */}
        {errorMessage && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl bg-red-50 p-4 text-sm text-red-700">
            <span>{errorMessage}</span>
            <button
              type="button"
              onClick={fetchData}
              className="inline-flex items-center justify-center rounded-lg bg-red-100 px-3 py-1.5 text-xs font-semibold text-red-800 hover:bg-red-200"
            >
              Coba lagi
            </button>
          </div>
        )}

        {/* 1. Empat Kartu Statistik */}
        <div>
          <h2 className="text-base font-semibold text-slate-900 mb-3">
            Statistik Pengetahuan
          </h2>

          {isLoading ? (
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="animate-pulse rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 space-y-2"
                >
                  <div className="h-4 w-20 rounded bg-slate-200" />
                  <div className="h-8 w-12 rounded bg-slate-300" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {/* Kartu 1: Total Catatan */}
              <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                <span className="text-xs font-medium text-slate-500">
                  Total Catatan
                </span>
                <p className="mt-2 text-3xl font-extrabold text-slate-900">
                  {stats?.totalNotes ?? 0}
                </p>
              </div>

              {/* Kartu 2: Konsep */}
              <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 flex flex-col justify-between">
                <div>
                  <span className="text-xs font-medium text-slate-500">
                    Konsep
                  </span>
                  <p className="mt-2 text-3xl font-extrabold text-slate-900">
                    {stats?.totalConcepts ?? 0}
                  </p>
                </div>
                {(stats?.totalConcepts ?? 0) === 0 && (
                  <p className="mt-2 text-[11px] text-slate-400">
                    Terisi otomatis saat fitur AI aktif
                  </p>
                )}
              </div>

              {/* Kartu 3: Relasi */}
              <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 flex flex-col justify-between">
                <div>
                  <span className="text-xs font-medium text-slate-500">
                    Relasi
                  </span>
                  <p className="mt-2 text-3xl font-extrabold text-slate-900">
                    {stats?.totalRelationships ?? 0}
                  </p>
                </div>
                {(stats?.totalRelationships ?? 0) === 0 && (
                  <p className="mt-2 text-[11px] text-slate-400">
                    Terisi otomatis saat fitur AI aktif
                  </p>
                )}
              </div>

              {/* Kartu 4: Aktivitas 7 Hari */}
              <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                <span className="text-xs font-medium text-slate-500">
                  Aktivitas 7 Hari
                </span>
                <p className="mt-2 text-3xl font-extrabold text-slate-900">
                  {stats?.recentActivity ?? 0}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* 2. Daftar Catatan Terbaru */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-slate-900">
              Catatan Terbaru
            </h2>
            <Link
              href="/notes"
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
            >
              Lihat semua &rarr;
            </Link>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="animate-pulse rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 space-y-2"
                >
                  <div className="h-5 w-1/3 rounded bg-slate-200" />
                  <div className="h-4 w-2/3 rounded bg-slate-100" />
                </div>
              ))}
            </div>
          ) : recentNotes.length === 0 && !errorMessage ? (
            /* Keadaan Kosong (Belum ada catatan) */
            <div className="rounded-2xl bg-white p-8 sm:p-10 text-center ring-1 ring-slate-200">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="h-6 w-6"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10"
                  />
                </svg>
              </div>
              <h3 className="mt-3 text-base font-semibold text-slate-900">
                Belum ada catatan
              </h3>
              <p className="mt-1 text-sm text-slate-500 max-w-sm mx-auto">
                Mulai tulis catatan pertamamu untuk melihat ringkasan pengetahuan di sini.
              </p>
              <div className="mt-5">
                <Link
                  href="/notes/new"
                  className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 transition-colors"
                >
                  + Catatan Baru
                </Link>
              </div>
            </div>
          ) : (
            /* Daftar List Catatan Terbaru */
            <div className="divide-y divide-slate-100 rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 overflow-hidden">
              {recentNotes.map((note) => (
                <Link
                  key={note.id}
                  href={`/notes/${note.id}`}
                  className="block p-4 sm:p-5 hover:bg-slate-50 transition-colors group"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                    <h3 className="text-base font-bold text-slate-900 group-hover:text-indigo-600 transition-colors line-clamp-1">
                      {note.title}
                    </h3>
                    <span className="text-xs text-slate-400 whitespace-nowrap">
                      {waktuRelatif(note.updatedAt)}
                    </span>
                  </div>

                  <p className="mt-1.5 text-sm text-slate-600 line-clamp-2">
                    {note.summary || note.contentPreview || "Tidak ada isi teks."}
                  </p>

                  {note.tags && note.tags.length > 0 && (
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {note.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
