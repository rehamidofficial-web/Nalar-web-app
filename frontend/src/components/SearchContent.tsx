"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useRequireAuth } from "@/lib/useRequireAuth";
import { AppShell } from "@/components/AppShell";
import { apiFetch, pesanError } from "@/lib/api";
import { getToken } from "@/lib/auth";

interface SearchResultItem {
  noteId: string;
  title: string;
  cuplikan: string;
  tags: string[];
  similarity: number | null;
  updatedAt: string;
}

interface InfoKoreksi {
  asli: string;
  dipakai: string;
  perubahan: { dari: string; ke: string }[];
}

interface SearchResponseData {
  mode: "makna" | "kata";
  query: string;
  koreksi?: InfoKoreksi | null;
  results: SearchResultItem[];
  belumDiindeks: number;
}

const CONTOH_PENCARIAN = [
  "cara kerja async di JavaScript",
  "alur kerja embedding dan vektor",
  "manajemen catatan pribadi",
];

export function SearchContent() {
  const user = useRequireAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const urlQuery = searchParams.get("q") || "";

  // State sinkronisasi URL search params seperti di NotesList
  const [prevUrlQuery, setPrevUrlQuery] = useState(urlQuery);
  const [inputQuery, setInputQuery] = useState(urlQuery);

  if (prevUrlQuery !== urlQuery) {
    setPrevUrlQuery(urlQuery);
    setInputQuery(urlQuery);
  }

  const [activeQuery, setActiveQuery] = useState(urlQuery);
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [mode, setMode] = useState<"makna" | "kata">("makna");
  const [modeMessage, setModeMessage] = useState("");
  const [koreksi, setKoreksi] = useState<InfoKoreksi | null>(null);
  const [belumDiindeks, setBelumDiindeks] = useState(0);

  const [hasSearched, setHasSearched] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Tracking query untuk balapan request (race condition)
  const requestIdRef = useRef(0);

  // Jika URL memiliki parameter ?q= saat dimuat atau URL berubah, jalankan pencarian secara asinkron
  useEffect(() => {
    let isCancelled = false;
    const q = urlQuery.trim();

    if (q.length < 2) {
      return;
    }

    const token = getToken();
    if (!token) return;

    const currentReqId = ++requestIdRef.current;

    apiFetch<SearchResponseData>(
      `/search?q=${encodeURIComponent(q)}&limit=10`,
      { token }
    ).then((res) => {
      if (isCancelled || currentReqId !== requestIdRef.current) return;

      setIsLoading(false);
      setHasSearched(true);
      setActiveQuery(q);

      if (!res.ok) {
        setErrorMessage(pesanError(res));
        setResults([]);
        setKoreksi(null);
        return;
      }

      if (res.data) {
        setResults(res.data.results || []);
        setMode(res.data.mode);
        setModeMessage(res.message || "");
        setKoreksi(res.data.koreksi || null);
        setBelumDiindeks(res.data.belumDiindeks || 0);
      }
    });

    return () => {
      isCancelled = true;
    };
  }, [urlQuery]);

  // Submit pencarian (Enter atau Klik Cari)
  function handleSubmit(e?: React.FormEvent) {
    if (e) e.preventDefault();
    const q = inputQuery.trim();
    if (q.length < 2 || isLoading) return;

    // Perbarui URL params
    const params = new URLSearchParams();
    params.set("q", q);
    router.push(`/search?${params.toString()}`);
  }

  // Pilih contoh pencarian
  function handlePilihContoh(contoh: string) {
    setInputQuery(contoh);
    const params = new URLSearchParams();
    params.set("q", contoh);
    router.push(`/search?${params.toString()}`);
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-slate-500">Memuat halaman pencarian...</p>
      </div>
    );
  }

  return (
    <AppShell user={user}>
      <div className="space-y-6">
        {/* Header Halaman */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Pencarian
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Temukan catatan berdasarkan makna konteks, bukan sekadar kecocokan kata.
          </p>
        </div>

        {/* Form Input Pencarian */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <label htmlFor="search-input" className="sr-only">
              Kata kunci pencarian makna
            </label>
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
              <svg
                className="h-5 w-5 text-slate-400"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
                />
              </svg>
            </div>
            <input
              id="search-input"
              type="text"
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              placeholder="Cari berdasarkan makna, misal: cara kerja async di JavaScript"
              className="block w-full rounded-xl border border-slate-300 bg-white py-3 pl-11 pr-4 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600"
            />
          </div>
          <button
            type="submit"
            disabled={isLoading || inputQuery.trim().length < 2}
            className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2"
          >
            {isLoading ? "Mencari..." : "Cari"}
          </button>
        </form>

        {/* Pesan Error */}
        {errorMessage && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {errorMessage}
          </div>
        )}

        {/* Spanduk Peringatan Mode Kata Biasa (Cadangan) */}
        {!isLoading && hasSearched && mode === "kata" && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            <div className="flex items-center gap-2">
              <svg
                className="h-5 w-5 text-amber-600 shrink-0"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
                  clipRule="evenodd"
                />
              </svg>
              <span>{modeMessage || "Pencarian makna sedang tidak tersedia, menampilkan pencarian kata biasa."}</span>
            </div>
          </div>
        )}

        {/* Loading State (Skeleton) */}
        {isLoading && (
          <div className="space-y-4">
            <p className="text-sm text-slate-500">Mencari catatan...</p>
            <div className="space-y-3">
              {[1, 2, 3].map((n) => (
                <div
                  key={n}
                  className="animate-pulse rounded-xl border border-slate-200 bg-white p-5 ring-1 ring-slate-200/60"
                >
                  <div className="h-5 w-1/3 rounded bg-slate-200 mb-3" />
                  <div className="h-4 w-full rounded bg-slate-100 mb-2" />
                  <div className="h-4 w-2/3 rounded bg-slate-100" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Keadaan Awal (Belum Mencari) */}
        {!isLoading && !hasSearched && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 text-center ring-1 ring-slate-200/60 shadow-sm">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50 text-indigo-600 mb-4">
              <svg
                className="h-6 w-6"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
                />
              </svg>
            </div>
            <h2 className="text-base font-semibold text-slate-900 sm:text-lg">
              Cari Berdasarkan Makna
            </h2>
            <p className="mx-auto mt-2 max-w-lg text-sm text-slate-600">
              Pencarian memahami makna pertanyaan atau ide catatanmu, bukan sekadar mencocokkan kata yang sama persis.
            </p>

            <div className="mt-6">
              <p className="text-xs font-medium uppercase tracking-wider text-slate-400 mb-3">
                Coba contoh pencarian:
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {CONTOH_PENCARIAN.map((contoh) => (
                  <button
                    key={contoh}
                    type="button"
                    onClick={() => handlePilihContoh(contoh)}
                    className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-700 transition"
                  >
                    &ldquo;{contoh}&rdquo;
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Hasil Pencarian */}
        {!isLoading && hasSearched && (
          <div>
            <div className="mb-4">
              <p className="text-sm font-medium text-slate-700">
                {results.length} hasil untuk &ldquo;{activeQuery}&rdquo;
              </p>
              {koreksi && (
                <p className="mt-1 text-xs text-slate-500">
                  Menampilkan hasil untuk &apos;{koreksi.dipakai}&apos; (kamu mengetik &apos;{koreksi.asli}&apos;)
                </p>
              )}
            </div>

            {results.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center ring-1 ring-slate-200/60 shadow-sm">
                <p className="text-sm text-slate-600">
                  Tidak ada catatan yang cukup nyambung dengan pencarianmu. Coba kata lain atau lebih umum.
                </p>
              </div>
            ) : (
              <ul className="space-y-3" role="list">
                {results.map((item) => {
                  const persen =
                    item.similarity !== null
                      ? Math.round(item.similarity * 100)
                      : null;

                  return (
                    <li key={item.noteId}>
                      <Link
                        href={`/notes/${item.noteId}`}
                        className="group block rounded-xl border border-slate-200 bg-white p-5 ring-1 ring-slate-200/60 transition hover:border-indigo-300 hover:shadow-sm"
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="flex-1 min-w-0">
                            <h3 className="text-base font-semibold text-slate-900 group-hover:text-indigo-600 transition">
                              {item.title}
                            </h3>
                            <p className="mt-1 text-sm text-slate-600 line-clamp-2">
                              {item.cuplikan}
                            </p>

                            {/* Tag */}
                            {item.tags && item.tags.length > 0 && (
                              <div className="mt-3 flex flex-wrap gap-1.5">
                                {item.tags.map((tag) => (
                                  <span
                                    key={tag}
                                    className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600"
                                  >
                                    #{tag}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Skor Kecocokan (hanya untuk mode makna) */}
                          {persen !== null && (
                            <div className="shrink-0 sm:text-right">
                              <span className="text-xs font-semibold text-indigo-600">
                                Kecocokan {persen}%
                              </span>
                              <div className="mt-1 h-1.5 w-24 overflow-hidden rounded-full bg-slate-100">
                                <div
                                  className="h-full rounded-full bg-indigo-600 transition-all duration-300"
                                  style={{ width: `${Math.min(100, Math.max(0, persen))}%` }}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}

            {/* Catatan Belum Diindeks */}
            {belumDiindeks > 0 && (
              <p className="mt-6 text-center text-xs text-slate-400">
                {belumDiindeks} catatan belum bisa dicari berdasarkan makna karena belum diindeks.
              </p>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
