"use client";

import { useEffect, useState, useCallback, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRequireAuth } from "@/lib/useRequireAuth";
import { AppShell } from "@/components/AppShell";
import { Icon, cardClass, btnPrimary, inputClass } from "@/components/ui";
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

function sapaan() {
  const jam = new Date().getHours();
  if (jam < 11) return "Selamat pagi";
  if (jam < 15) return "Selamat siang";
  if (jam < 18) return "Selamat sore";
  return "Selamat malam";
}

const AKSI_CEPAT = [
  {
    href: "/notes/new",
    icon: "plus" as const,
    judul: "Tulis catatan baru",
    isi: "Simpan sesuatu yang baru kamu pelajari",
  },
  {
    href: "/assistant",
    icon: "sparkle" as const,
    judul: "Tanya Asisten AI",
    isi: "Dapatkan jawaban dari catatanmu sendiri",
  },
  {
    href: "/graph",
    icon: "graph" as const,
    judul: "Jelajahi graph",
    isi: "Lihat bagaimana ide-idemu terhubung",
  },
  {
    href: "/search",
    icon: "search" as const,
    judul: "Cari berdasarkan makna",
    isi: "Temukan catatan tanpa kata yang persis sama",
  },
];

export default function DashboardPage() {
  const user = useRequireAuth();
  const router = useRouter();

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentNotes, setRecentNotes] = useState<RecentNote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [query, setQuery] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const retry = useCallback(() => {
    setIsLoading(true);
    setErrorMessage("");
    setReloadKey((k) => k + 1);
  }, []);

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
          const errorText = !statsRes.ok ? pesanError(statsRes) : pesanError(notesRes);
          setErrorMessage(errorText || "Gagal memuat data dashboard.");
        }
      })
      .catch(() => {
        if (!isCancelled) {
          setErrorMessage("Tidak bisa terhubung ke server. Pastikan backend sedang menyala.");
        }
      })
      .finally(() => {
        if (!isCancelled) setIsLoading(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [user, reloadKey]);

  function cari(e: FormEvent) {
    e.preventDefault();
    const q = query.trim();
    router.push(q ? `/search?q=${encodeURIComponent(q)}` : "/search");
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-slate-500">Memuat...</p>
      </div>
    );
  }

  const namaDepan = user.name.trim().split(/\s+/)[0] || user.name;

  const kartuStat = [
    {
      href: "/notes",
      icon: "notes" as const,
      angka: stats?.totalNotes ?? 0,
      label: "Catatan",
      ket: `${stats?.recentActivity ?? 0} aktivitas dalam 7 hari`,
    },
    {
      href: "/graph",
      icon: "sparkle" as const,
      angka: stats?.totalConcepts ?? 0,
      label: "Konsep ditemukan",
      ket: "Ide utama yang dikenali AI",
    },
    {
      href: "/graph",
      icon: "graph" as const,
      angka: stats?.totalRelationships ?? 0,
      label: "Hubungan",
      ket: "Tautan antar catatan terkait",
    },
  ];

  return (
    <AppShell user={user}>
      <div className="space-y-6">
        {/* Sapaan + pencarian cepat */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <h1 className="text-[28px] font-bold leading-tight tracking-tight text-slate-900 sm:text-[34px]">
              {sapaan()}, {namaDepan}!
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Ini ringkasan singkat ruang pengetahuanmu.
            </p>
          </div>
          <form onSubmit={cari} className="relative w-full lg:max-w-sm" role="search">
            <Icon
              name="search"
              className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari catatanmu berdasarkan makna…"
              aria-label="Cari catatan berdasarkan makna"
              className={`${inputClass} pl-11`}
            />
          </form>
        </div>

        {errorMessage && (
          <div
            role="alert"
            className="flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="text-sm font-semibold text-red-700">Data dashboard belum bisa dimuat</p>
              <p className="mt-0.5 text-sm text-red-700/90">{errorMessage}</p>
            </div>
            <button
              type="button"
              onClick={retry}
              className="inline-flex min-h-[40px] items-center justify-center self-start rounded-xl border border-red-200 bg-white px-4 text-sm font-semibold text-red-700 hover:bg-red-50"
            >
              Coba lagi
            </button>
          </div>
        )}

        {/* Kartu statistik */}
        <div className="grid grid-cols-3 gap-3 sm:gap-5">
          {isLoading
            ? [1, 2, 3].map((i) => (
                <div key={i} className={`${cardClass} animate-pulse space-y-3 p-4 sm:p-6`}>
                  <div className="h-8 w-12 rounded bg-slate-200" />
                  <div className="h-4 w-20 rounded bg-slate-100" />
                </div>
              ))
            : kartuStat.map((k) => (
                <Link
                  key={k.label}
                  href={k.href}
                  className={`${cardClass} group flex items-center gap-4 p-4 transition-shadow hover:shadow-md sm:p-6`}
                >
                  <span className="hidden h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 sm:inline-flex">
                    <Icon name={k.icon} className="h-6 w-6" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[28px] font-bold leading-none text-slate-900 sm:text-[34px]">
                      {k.angka.toLocaleString("id-ID")}
                    </p>
                    <p className="mt-1.5 text-sm font-semibold text-slate-900">{k.label}</p>
                    <p className="mt-0.5 hidden text-xs text-slate-500 sm:block">{k.ket}</p>
                  </div>
                </Link>
              ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          {/* Catatan terbaru */}
          <section
            className={`${cardClass} overflow-hidden`}
            aria-labelledby="judul-terbaru"
            aria-busy={isLoading}
          >
            <div className="flex items-center justify-between px-5 py-4 sm:px-6">
              <h2 id="judul-terbaru" className="text-lg font-bold text-slate-900">
                Catatan Terbaru
              </h2>
              <Link href="/notes" className="text-sm font-semibold text-indigo-700 hover:underline">
                Lihat semua
              </Link>
            </div>

            {isLoading ? (
              <div className="divide-y divide-slate-100 border-t border-slate-100">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="animate-pulse space-y-2 px-5 py-4 sm:px-6">
                    <div className="h-5 w-1/3 rounded bg-slate-200" />
                    <div className="h-4 w-2/3 rounded bg-slate-100" />
                  </div>
                ))}
              </div>
            ) : recentNotes.length === 0 && !errorMessage ? (
              <div className="border-t border-slate-100 px-6 py-12 text-center">
                <span className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
                  <Icon name="edit" className="h-6 w-6" />
                </span>
                <h3 className="mt-3 text-base font-semibold text-slate-900">Belum ada catatan</h3>
                <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">
                  Tulis catatan pertamamu. Nalar akan merangkumnya dan menghubungkannya dengan
                  ide-idemu yang lain.
                </p>
                <Link href="/notes/new" className={`${btnPrimary} mt-5`}>
                  <Icon name="plus" className="h-5 w-5" />
                  Tulis catatan pertama
                </Link>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100 border-t border-slate-100">
                {recentNotes.map((note) => (
                  <li key={note.id}>
                    <Link
                      href={`/notes/${note.id}`}
                      className="group flex items-start justify-between gap-4 px-5 py-4 transition-colors hover:bg-slate-50 sm:px-6"
                    >
                      <div className="min-w-0">
                        <h3 className="line-clamp-1 text-[15px] font-semibold text-slate-900 group-hover:text-indigo-700">
                          {note.title}
                        </h3>
                        <p className="mt-0.5 line-clamp-1 text-sm text-slate-500">
                          {note.summary || note.contentPreview || "Tidak ada isi teks."}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1.5 sm:flex-row sm:items-center sm:gap-3">
                        {note.tags && note.tags[0] && (
                          <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
                            {note.tags[0]}
                          </span>
                        )}
                        <span className="whitespace-nowrap text-xs text-slate-500">
                          {waktuRelatif(note.updatedAt)}
                        </span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Aksi cepat */}
          <section className={`${cardClass} h-fit p-5 sm:p-6`} aria-labelledby="judul-aksi">
            <h2 id="judul-aksi" className="text-lg font-bold text-slate-900">
              Aksi Cepat
            </h2>
            <ul className="mt-3 space-y-1">
              {AKSI_CEPAT.map((a) => (
                <li key={a.href}>
                  <Link
                    href={a.href}
                    className="flex items-center gap-4 rounded-xl p-2 transition-colors hover:bg-slate-50"
                  >
                    <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                      <Icon name={a.icon} className="h-5 w-5" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-slate-900">{a.judul}</span>
                      <span className="block text-xs text-slate-500">{a.isi}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
