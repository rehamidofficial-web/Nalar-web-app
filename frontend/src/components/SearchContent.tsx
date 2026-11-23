"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useRequireAuth } from "@/lib/useRequireAuth";
import { AppShell } from "@/components/AppShell";
import { apiFetch, pesanError } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { Icon, PageHeader, cardClass, btnPrimary } from "@/components/ui";

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

  const [tagFilter, setTagFilter] = useState("");
  const [recent, setRecent] = useState<string[]>([]);

  // Muat riwayat pencarian dari browser (tanpa memblokir render pertama)
  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const raw = window.localStorage.getItem("nalar_recent_searches");
        const parsed: unknown = raw ? JSON.parse(raw) : [];
        if (Array.isArray(parsed)) {
          setRecent(parsed.filter((x): x is string => typeof x === "string").slice(0, 5));
        }
      } catch {
        // Riwayat tidak tersedia, abaikan.
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const simpanRiwayat = useCallback((q: string) => {
    setRecent((prev) => {
      const next = [q, ...prev.filter((x) => x !== q)].slice(0, 5);
      try {
        window.localStorage.setItem("nalar_recent_searches", JSON.stringify(next));
      } catch {
        // Abaikan bila penyimpanan penuh atau diblokir.
      }
      return next;
    });
  }, []);

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
      setTagFilter("");

      if (!res.ok) {
        setErrorMessage(pesanError(res));
        setResults([]);
        setKoreksi(null);
        return;
      }

      if (res.data) {
        simpanRiwayat(q);
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
  }, [urlQuery, simpanRiwayat]);

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

  const tagCounts = new Map<string, number>();
  results.forEach((r) => (r.tags ?? []).forEach((t) => tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1)));
  const tampil = tagFilter ? results.filter((r) => (r.tags ?? []).includes(tagFilter)) : results;
  const topResult = results[0];

  function labelRelevan(persen: number) {
    if (persen >= 85) return "Sangat relevan";
    if (persen >= 65) return "Relevan";
    return "Cukup relevan";
  }

  const chipBase =
    "inline-flex min-h-[40px] items-center rounded-full border px-4 text-sm font-semibold transition-colors";

  return (
    <AppShell user={user}>
      <div className="space-y-6">
        <PageHeader
          title="Pencarian"
          subtitle="Cari berdasarkan makna. Kamu tidak perlu mengetik kata yang persis sama dengan catatanmu."
        />

        <form onSubmit={handleSubmit} role="search">
          <div className="flex items-center gap-2 rounded-2xl bg-white p-2 pl-4 ring-1 ring-slate-200 shadow-[0_1px_2px_rgba(15,23,42,0.04)] focus-within:ring-2 focus-within:ring-indigo-500">
            <Icon name="search" className="h-5 w-5 shrink-0 text-slate-400" />
            <label htmlFor="search-input" className="sr-only">
              Kata kunci pencarian makna
            </label>
            <input
              id="search-input"
              type="text"
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              placeholder="Contoh: bagaimana sebuah website bicara dengan server"
              className="min-h-[44px] flex-1 bg-transparent px-1 text-base text-slate-900 placeholder-slate-400 outline-none"
            />
            <button
              type="submit"
              disabled={isLoading || inputQuery.trim().length < 2}
              className={btnPrimary}
            >
              {isLoading ? "Mencari…" : "Cari"}
            </button>
          </div>
        </form>

        {errorMessage && (
          <div
            role="alert"
            className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          >
            <p className="font-semibold">Pencarian belum berhasil</p>
            <p className="mt-0.5">{errorMessage}</p>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0 space-y-5">
            {!isLoading && hasSearched && mode === "kata" && (
              <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                <Icon name="alert" className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                <span>
                  {modeMessage ||
                    "Pencarian makna sedang tidak tersedia, jadi ditampilkan pencarian kata biasa."}
                </span>
              </div>
            )}

            {!isLoading && hasSearched && mode === "makna" && topResult && (
              <div className="flex items-start gap-3 rounded-2xl bg-indigo-50 p-4 text-sm text-indigo-800">
                <Icon name="sparkle" className="mt-0.5 h-5 w-5 shrink-0 text-indigo-600" />
                <p>
                  Nalar menemukan <strong className="font-semibold">{topResult.title}</strong> dari makna
                  pertanyaanmu, bukan hanya dari kata yang kamu ketik.
                </p>
              </div>
            )}

            {isLoading && (
              <div className="space-y-4" aria-busy="true">
                <p className="text-sm text-slate-500">Mencari di catatanmu…</p>
                {[1, 2, 3].map((n) => (
                  <div key={n} className={`${cardClass} animate-pulse p-5`}>
                    <div className="mb-3 h-5 w-1/3 rounded bg-slate-200" />
                    <div className="mb-2 h-4 w-full rounded bg-slate-100" />
                    <div className="h-4 w-2/3 rounded bg-slate-100" />
                  </div>
                ))}
              </div>
            )}

            {!isLoading && !hasSearched && (
              <div className={`${cardClass} p-8 text-center`}>
                <span className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
                  <Icon name="search" className="h-6 w-6" />
                </span>
                <h2 className="text-lg font-bold text-slate-900">Cari berdasarkan makna</h2>
                <p className="mx-auto mt-2 max-w-lg text-sm text-slate-500">
                  Tulis pertanyaan atau ide seperti kamu bertanya ke teman. Nalar mencocokkan artinya
                  dengan isi catatanmu.
                </p>
                <p className="mb-3 mt-6 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Coba contoh
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  {CONTOH_PENCARIAN.map((contoh) => (
                    <button
                      key={contoh}
                      type="button"
                      onClick={() => handlePilihContoh(contoh)}
                      className="inline-flex min-h-[40px] items-center rounded-full border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700"
                    >
                      &ldquo;{contoh}&rdquo;
                    </button>
                  ))}
                </div>
              </div>
            )}

            {!isLoading && hasSearched && (
              <div>
                {tagCounts.size > 0 && (
                  <div className="mb-4 flex flex-wrap gap-2" aria-label="Saring hasil menurut tag">
                    <button
                      type="button"
                      aria-pressed={!tagFilter}
                      onClick={() => setTagFilter("")}
                      className={`${chipBase} ${
                        !tagFilter
                          ? "border-indigo-600 bg-indigo-600 text-white"
                          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      Semua ({results.length})
                    </button>
                    {Array.from(tagCounts.entries()).map(([tag, n]) => (
                      <button
                        key={tag}
                        type="button"
                        aria-pressed={tagFilter === tag}
                        onClick={() => setTagFilter(tagFilter === tag ? "" : tag)}
                        className={`${chipBase} ${
                          tagFilter === tag
                            ? "border-indigo-600 bg-indigo-600 text-white"
                            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        {tag} ({n})
                      </button>
                    ))}
                  </div>
                )}

                <p className="mb-4 text-sm text-slate-500" aria-live="polite">
                  {tampil.length} catatan ditemukan untuk &ldquo;{activeQuery}&rdquo;, yang paling relevan
                  di atas
                </p>
                {koreksi && (
                  <p className="-mt-2 mb-4 text-xs text-slate-500">
                    Menampilkan hasil untuk &lsquo;{koreksi.dipakai}&rsquo; (kamu mengetik &lsquo;
                    {koreksi.asli}&rsquo;)
                  </p>
                )}

                {tampil.length === 0 ? (
                  <div className={`${cardClass} p-8 text-center`}>
                    <p className="text-sm text-slate-500">
                      Catatanmu belum membahas hal ini. Coba tulis dengan kata lain, atau tulis catatan
                      baru tentangnya.
                    </p>
                    <Link href="/notes/new" className={`${btnPrimary} mt-4`}>
                      Tulis catatan baru
                    </Link>
                  </div>
                ) : (
                  <ul className="space-y-4">
                    {tampil.map((item) => {
                      const persen =
                        item.similarity !== null ? Math.round(item.similarity * 100) : null;
                      return (
                        <li key={item.noteId}>
                          <Link
                            href={`/notes/${item.noteId}`}
                            className={`${cardClass} group block p-5 transition-shadow hover:shadow-md`}
                          >
                            <div className="flex items-center justify-between gap-3">
                              {item.tags?.[0] ? (
                                <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
                                  {item.tags[0]}
                                </span>
                              ) : (
                                <span />
                              )}
                              {persen !== null && (
                                <div className="flex items-center gap-2 text-xs text-slate-600">
                                  <span className="hidden sm:inline">{labelRelevan(persen)}</span>
                                  <span
                                    className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-100"
                                    role="img"
                                    aria-label={`Kecocokan ${persen} persen`}
                                  >
                                    <span
                                      className="block h-full rounded-full bg-indigo-600"
                                      style={{ width: `${Math.min(100, Math.max(0, persen))}%` }}
                                    />
                                  </span>
                                  <span className="w-9 text-right font-semibold">{persen}%</span>
                                </div>
                              )}
                            </div>
                            <h3 className="mt-3 text-lg font-bold text-slate-900 group-hover:text-indigo-700">
                              {item.title}
                            </h3>
                            <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-slate-500">
                              {item.cuplikan}
                            </p>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}

                {belumDiindeks > 0 && (
                  <p className="mt-6 text-center text-xs text-slate-500">
                    {belumDiindeks} catatan belum bisa dicari berdasarkan makna karena belum diindeks.
                  </p>
                )}
              </div>
            )}
          </div>

          <aside className="h-fit space-y-5">
            {recent.length > 0 && (
              <section className={`${cardClass} overflow-hidden`}>
                <h2 className="px-5 py-4 text-base font-bold text-slate-900">Pencarian terakhir</h2>
                <ul className="divide-y divide-slate-100 border-t border-slate-100">
                  {recent.map((q) => (
                    <li key={q}>
                      <button
                        type="button"
                        onClick={() => handlePilihContoh(q)}
                        className="w-full px-5 py-3 text-left text-sm text-slate-700 transition-colors hover:bg-slate-50"
                      >
                        {q}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            <section className={`${cardClass} p-5`}>
              <h2 className="text-base font-bold text-slate-900">Tips agar hasil lebih tepat</h2>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-500">
                <li>Tulis pertanyaan lengkap, seperti kamu bertanya ke teman.</li>
                <li>Jelaskan idenya, bukan judul yang persis.</li>
                <li>Pakai tombol tag untuk mempersempit daftar.</li>
              </ul>
            </section>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
