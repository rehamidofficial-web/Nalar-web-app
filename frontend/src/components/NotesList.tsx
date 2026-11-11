"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useRequireAuth } from "@/lib/useRequireAuth";
import { AppShell } from "@/components/AppShell";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Pagination } from "@/components/Pagination";
import { apiFetch, pesanError } from "@/lib/api";
import { getToken } from "@/lib/auth";

interface NoteItem {
  id: string;
  title: string;
  summary: string | null;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
  contentPreview: string;
}

interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface TagCount {
  tag: string;
  count: number;
}

export function NotesList() {
  const user = useRequireAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Ambil state dari URL search params
  const paramPage = Number(searchParams.get("page")) || 1;
  const paramSearch = searchParams.get("search") || "";
  const paramTag = searchParams.get("tag") || "";
  const paramSort = searchParams.get("sort") || "terbaru";

  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: paramPage,
    limit: 10,
    total: 0,
    totalPages: 1,
  });

  const [availableTags, setAvailableTags] = useState<TagCount[]>([]);

  // State pencarian dan tracking query sebelumnya (sesuai rekomendasi React Docs: Adjusting some state when a prop changes)
  const [prevParamSearch, setPrevParamSearch] = useState(paramSearch);
  const [searchInput, setSearchInput] = useState(paramSearch);

  if (prevParamSearch !== paramSearch) {
    setPrevParamSearch(paramSearch);
    setSearchInput(paramSearch);
  }

  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Hapus catatan modal state
  const [noteToDelete, setNoteToDelete] = useState<NoteItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Counter untuk cegah balapan respons (race condition)
  const requestIdRef = useRef(0);

  // Fungsi pembantu memperbarui search params di URL
  const updateQueryParams = useCallback(
    (updates: { page?: number; search?: string; tag?: string; sort?: string }) => {
      const current = new URLSearchParams(searchParams.toString());

      if (updates.page !== undefined) {
        if (updates.page > 1) current.set("page", updates.page.toString());
        else current.delete("page");
      }

      if (updates.search !== undefined) {
        if (updates.search.trim()) current.set("search", updates.search.trim());
        else current.delete("search");
      }

      if (updates.tag !== undefined) {
        if (updates.tag) current.set("tag", updates.tag);
        else current.delete("tag");
      }

      if (updates.sort !== undefined) {
        if (updates.sort && updates.sort !== "terbaru") current.set("sort", updates.sort);
        else current.delete("sort");
      }

      const queryString = current.toString();
      router.push(queryString ? `/notes?${queryString}` : "/notes");
    },
    [router, searchParams]
  );

  // Debounce input pencarian 400ms
  useEffect(() => {
    const handler = setTimeout(() => {
      if (searchInput !== paramSearch) {
        updateQueryParams({ search: searchInput, page: 1 });
      }
    }, 400);

    return () => clearTimeout(handler);
  }, [searchInput, paramSearch, updateQueryParams]);

  // Ambil daftar tags milik user
  const fetchTags = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    const res = await apiFetch<{ tags: TagCount[] }>("/notes/tags", { token });
    if (res.ok && res.data) {
      setAvailableTags(res.data.tags);
    }
  }, []);

  // Ambil data catatan
  const fetchNotes = useCallback(async () => {
    if (!user) return;

    const currentRequestId = ++requestIdRef.current;
    setIsFetching(true);
    setErrorMessage("");

    const token = getToken();
    const query = new URLSearchParams({
      page: paramPage.toString(),
      limit: "10",
      sort: paramSort,
      ...(paramSearch ? { search: paramSearch } : {}),
      ...(paramTag ? { tag: paramTag } : {}),
    });

    try {
      const res = await apiFetch<{
        items: NoteItem[];
        pagination: PaginationMeta;
      }>(`/notes?${query.toString()}`, { token });

      // Jika ada request baru yang sudah dikirim setelah ini, abaikan respons lama
      if (currentRequestId !== requestIdRef.current) return;

      if (res.ok && res.data) {
        setNotes(res.data.items);
        setPagination(res.data.pagination);
      } else {
        setErrorMessage(pesanError(res));
      }
    } catch {
      if (currentRequestId === requestIdRef.current) {
        setErrorMessage("Tidak bisa terhubung ke server. Pastikan backend sedang menyala.");
      }
    } finally {
      if (currentRequestId === requestIdRef.current) {
        setIsFetching(false);
        setIsInitialLoading(false);
      }
    }
  }, [user, paramPage, paramSearch, paramTag, paramSort]);

  useEffect(() => {
    if (!user) return;

    let isCancelled = false;
    const token = getToken();

    if (token) {
      apiFetch<{ tags: TagCount[] }>("/notes/tags", { token }).then((res) => {
        if (!isCancelled && res.ok && res.data) {
          setAvailableTags(res.data.tags);
        }
      });
    }

    const currentRequestId = ++requestIdRef.current;
    const query = new URLSearchParams({
      page: paramPage.toString(),
      limit: "10",
      sort: paramSort,
      ...(paramSearch ? { search: paramSearch } : {}),
      ...(paramTag ? { tag: paramTag } : {}),
    });

    apiFetch<{
      items: NoteItem[];
      pagination: PaginationMeta;
    }>(`/notes?${query.toString()}`, { token })
      .then((res) => {
        if (isCancelled || currentRequestId !== requestIdRef.current) return;
        if (res.ok && res.data) {
          setNotes(res.data.items);
          setPagination(res.data.pagination);
        } else {
          setErrorMessage(pesanError(res));
        }
      })
      .catch(() => {
        if (!isCancelled && currentRequestId === requestIdRef.current) {
          setErrorMessage("Tidak bisa terhubung ke server. Pastikan backend sedang menyala.");
        }
      })
      .finally(() => {
        if (!isCancelled && currentRequestId === requestIdRef.current) {
          setIsFetching(false);
          setIsInitialLoading(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [user, paramPage, paramSearch, paramTag, paramSort]);

  // Handle konfirmasi hapus catatan
  async function handleConfirmDelete() {
    if (!noteToDelete) return;

    const token = getToken();
    setIsDeleting(true);

    try {
      const res = await apiFetch(`/notes/${noteToDelete.id}`, {
        method: "DELETE",
        token,
      });

      if (res.ok) {
        setNoteToDelete(null);
        await fetchTags();

        // Jika catatan yang dihapus adalah satu-satunya di halaman saat ini dan bukan hal 1, mundur
        if (notes.length === 1 && paramPage > 1) {
          updateQueryParams({ page: paramPage - 1 });
        } else {
          fetchNotes();
        }
      } else {
        alert(pesanError(res));
      }
    } finally {
      setIsDeleting(false);
    }
  }

  function formatDate(isoString: string) {
    try {
      const date = new Date(isoString);
      return new Intl.DateTimeFormat("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }).format(date);
    } catch {
      return isoString;
    }
  }

  const hasFilterActive = Boolean(paramSearch || paramTag || paramSort !== "terbaru");

  function resetFilter() {
    setSearchInput("");
    router.push("/notes");
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-slate-500">Memuat...</p>
      </div>
    );
  }

  return (
    <AppShell user={user}>
      <div>
        {/* Header Bagian Atas */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-6 border-b border-slate-200">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Catatan Saya
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Kelola semua ide dan catatan pengetahuan pribadimu.
            </p>
          </div>
          <div>
            <Link
              href="/notes/new"
              className="inline-flex min-h-[44px] w-full sm:w-auto items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 transition-colors"
            >
              + Catatan Baru
            </Link>
          </div>
        </div>

        {/* Kontrol Pencarian, Urutan & Filter Tag */}
        <div className="mt-6 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {/* Input Cari */}
            <div className="relative flex-1">
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Cari judul atau isi catatan..."
                className="w-full min-h-[44px] rounded-lg border border-slate-300 bg-white pl-10 pr-4 py-2 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
              />
              <svg
                className="absolute left-3.5 top-3 h-5 w-5 text-slate-400"
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

            {/* Select Urutan */}
            <div className="flex items-center gap-2 sm:w-auto">
              <label htmlFor="sort" className="text-xs font-medium text-slate-500 whitespace-nowrap">
                Urutkan:
              </label>
              <select
                id="sort"
                value={paramSort}
                onChange={(e) => updateQueryParams({ sort: e.target.value, page: 1 })}
                className="min-h-[44px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
              >
                <option value="terbaru">Terbaru</option>
                <option value="terlama">Terlama</option>
                <option value="judul">Judul (A-Z)</option>
              </select>
            </div>
          </div>

          {/* Deretan Chip Filter Tag */}
          {availableTags.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <button
                type="button"
                onClick={() => updateQueryParams({ tag: "", page: 1 })}
                className={`inline-flex min-h-[32px] items-center rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  !paramTag
                    ? "bg-indigo-600 text-white font-semibold"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                Semua
              </button>

              {availableTags.map((t) => {
                const isActive = paramTag === t.tag;
                return (
                  <button
                    key={t.tag}
                    type="button"
                    onClick={() => updateQueryParams({ tag: isActive ? "" : t.tag, page: 1 })}
                    className={`inline-flex min-h-[32px] items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                      isActive
                        ? "bg-indigo-600 text-white font-semibold"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    <span>#{t.tag}</span>
                    <span
                      className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                        isActive ? "bg-indigo-800 text-white" : "bg-slate-200 text-slate-600"
                      }`}
                    >
                      {t.count}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Kotak Error */}
        {errorMessage && (
          <div className="mt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-lg bg-red-50 p-4 text-sm text-red-700">
            <span>{errorMessage}</span>
            <button
              type="button"
              onClick={fetchNotes}
              className="inline-flex items-center justify-center rounded-md bg-red-100 px-3 py-1.5 text-xs font-semibold text-red-800 hover:bg-red-200"
            >
              Coba lagi
            </button>
          </div>
        )}

        {/* Konten Daftar Catatan */}
        {isInitialLoading ? (
          /* Kartu Kerangka Skeleton Berdenyut */
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {[1, 2, 3, 4].map((n) => (
              <div
                key={n}
                className="animate-pulse rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 space-y-3"
              >
                <div className="h-5 w-3/4 rounded bg-slate-200" />
                <div className="space-y-2">
                  <div className="h-3.5 w-full rounded bg-slate-100" />
                  <div className="h-3.5 w-5/6 rounded bg-slate-100" />
                </div>
                <div className="flex gap-2 pt-2">
                  <div className="h-4 w-12 rounded-full bg-slate-100" />
                  <div className="h-4 w-16 rounded-full bg-slate-100" />
                </div>
              </div>
            ))}
          </div>
        ) : notes.length === 0 && !errorMessage ? (
          hasFilterActive ? (
            /* Keadaan Kosong karena Filter */
            <div className="mt-8 rounded-2xl bg-white p-8 text-center ring-1 ring-slate-200 sm:p-12">
              <h3 className="text-base font-semibold text-slate-900">
                Tidak ada catatan yang cocok
              </h3>
              <p className="mt-1 text-sm text-slate-500 max-w-sm mx-auto">
                Tidak ada catatan yang cocok dengan filter atau kata kunci pencarian ini.
              </p>
              <div className="mt-6">
                <button
                  type="button"
                  onClick={resetFilter}
                  className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-slate-300 bg-white px-5 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition-colors"
                >
                  Hapus filter
                </button>
              </div>
            </div>
          ) : (
            /* Keadaan Kosong Belum Memiliki Catatan */
            <div className="mt-8 rounded-2xl bg-white p-8 text-center ring-1 ring-slate-200 sm:p-12">
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
              <h3 className="mt-4 text-base font-semibold text-slate-900">
                Belum ada catatan
              </h3>
              <p className="mt-1 text-sm text-slate-500 max-w-sm mx-auto">
                Mulai tulis catatan pertamamu untuk menghubungkan ide dan pengetahuan.
              </p>
              <div className="mt-6">
                <Link
                  href="/notes/new"
                  className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 transition-colors"
                >
                  Tulis Catatan Pertama
                </Link>
              </div>
            </div>
          )
        ) : (
          /* Grid Kartu Catatan (pudar jika sedang mengambil data baru) */
          <div
            className={`mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 transition-opacity duration-200 ${
              isFetching ? "opacity-60" : "opacity-100"
            }`}
          >
            {notes.map((note) => (
              <div
                key={note.id}
                className="flex flex-col justify-between rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 transition hover:shadow-md"
              >
                <div>
                  <h2 className="text-lg font-bold text-slate-900 line-clamp-1">
                    {note.title}
                  </h2>

                  <p className="mt-2 text-sm text-slate-600 line-clamp-3 whitespace-pre-wrap">
                    {note.summary || note.contentPreview || "Tidak ada isi teks."}
                  </p>

                  {note.tags && note.tags.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {note.tags.map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => updateQueryParams({ tag, page: 1 })}
                          className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                        >
                          #{tag}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-3">
                  <span className="text-xs text-slate-400">
                    {formatDate(note.updatedAt)}
                  </span>

                  <div className="flex items-center gap-2">
                    <Link
                      href={`/notes/${note.id}`}
                      className="inline-flex min-h-[36px] items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                    >
                      Ubah
                    </Link>
                    <button
                      type="button"
                      onClick={() => setNoteToDelete(note)}
                      className="inline-flex min-h-[36px] items-center justify-center rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 hover:border-red-300"
                    >
                      Hapus
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Kontrol Pagination */}
        <Pagination
          page={pagination.page}
          totalPages={pagination.totalPages}
          total={pagination.total}
          limit={pagination.limit}
          disabled={isFetching}
          onPageChange={(newPage) => updateQueryParams({ page: newPage })}
        />
      </div>

      {/* Dialog Konfirmasi Hapus */}
      <ConfirmDialog
        isOpen={Boolean(noteToDelete)}
        title="Hapus catatan?"
        message="Catatan ini akan dihapus permanen dan tidak dapat dikembalikan."
        confirmLabel="Hapus"
        cancelLabel="Batal"
        isLoading={isDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setNoteToDelete(null)}
      />
    </AppShell>
  );
}
