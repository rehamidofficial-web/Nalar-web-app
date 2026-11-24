"use client";

import { useEffect, useState, useRef, useCallback, type KeyboardEvent as ReactKeyboardEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createPortal } from "react-dom";
import { useRequireAuth } from "@/lib/useRequireAuth";
import { AppShell } from "@/components/AppShell";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Pagination } from "@/components/Pagination";
import { Icon, PageHeader, cardClass, btnPrimary, btnSecondary, inputClass } from "@/components/ui";
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

  // State untuk mode pilih catatan (Merge Catatan)
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedNoteIds, setSelectedNoteIds] = useState<string[]>([]);

  const [viewMode, setViewMode] = useState<"cards" | "list">("cards");
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ left: number; top: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const menuItemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Hapus catatan modal state
  const [noteToDelete, setNoteToDelete] = useState<NoteItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Counter untuk cegah balapan respons (race condition)
  const requestIdRef = useRef(0);

  const selectionContext = `${paramPage}|${paramSearch}|${paramTag}|${paramSort}`;
  const [previousSelectionContext, setPreviousSelectionContext] = useState(selectionContext);
  if (previousSelectionContext !== selectionContext) {
    setPreviousSelectionContext(selectionContext);
    setIsSelectionMode(false);
    setSelectedNoteIds([]);
    setOpenMenuId(null);
  }

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

  // Daftar tag cukup diambil sekali saat halaman dibuka (dan setelah hapus catatan),
  // bukan setiap pindah halaman, ganti urutan, atau mengetik pencarian.
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

    return () => {
      isCancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (!user) return;

    let isCancelled = false;
    const token = getToken();

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

  useEffect(() => {
    if (!openMenuId) return;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;
      if (
        target instanceof Node &&
        !menuRef.current?.contains(target) &&
        !menuTriggerRef.current?.contains(target)
      ) {
        setOpenMenuId(null);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpenMenuId(null);
        menuTriggerRef.current?.focus();
      }
    }

    // Menu memakai posisi tetap di layar, jadi tutup saat halaman digulir (penting di HP)
    const awalGulir = window.scrollY;
    function handleScroll() {
      if (Math.abs(window.scrollY - awalGulir) > 8) setOpenMenuId(null);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", handleScroll);
    };
  }, [openMenuId]);

  useEffect(() => {
    if (openMenuId) {
      menuItemRefs.current[0]?.focus();
    }
  }, [openMenuId, menuPosition]);

  // Fungsi toggle pilihan catatan untuk gabung
  function toggleSelectNote(id: string) {
    setSelectedNoteIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((item) => item !== id);
      }
      if (prev.length >= 5) {
        return prev;
      }
      return [...prev, id];
    });
  }

  function toggleNoteMenu(noteId: string, trigger: HTMLButtonElement) {
    if (openMenuId === noteId) {
      setOpenMenuId(null);
      return;
    }

    const rect = trigger.getBoundingClientRect();
    const menuWidth = 208;
    const menuHeight = 152;
    const margin = 8;
    const left = Math.max(
      margin,
      Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - margin),
    );
    let top = rect.bottom + margin;
    if (top + menuHeight > window.innerHeight - margin) {
      top = Math.max(margin, rect.top - menuHeight - margin);
    }

    menuTriggerRef.current = trigger;
    setMenuPosition({ left, top });
    setOpenMenuId(noteId);
  }

  function handleMenuKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    const items = menuItemRefs.current.filter(
      (item): item is HTMLButtonElement => item !== null,
    );
    const currentIndex = items.indexOf(document.activeElement as HTMLButtonElement);

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const direction = event.key === "ArrowDown" ? 1 : -1;
      const nextIndex = (currentIndex + direction + items.length) % items.length;
      items[nextIndex]?.focus();
    } else if (event.key === "Home") {
      event.preventDefault();
      items[0]?.focus();
    } else if (event.key === "End") {
      event.preventDefault();
      items[items.length - 1]?.focus();
    }
  }

  function startSelectionWith(noteId: string) {
    setSelectedNoteIds([noteId]);
    setIsSelectionMode(true);
    setOpenMenuId(null);
  }

  function leaveSelectionMode() {
    setSelectedNoteIds([]);
    setIsSelectionMode(false);
  }

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
        const remainingSelections = selectedNoteIds.filter((id) => id !== noteToDelete.id);
        setSelectedNoteIds(remainingSelections);
        if (remainingSelections.length === 0) {
          setIsSelectionMode(false);
        }
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
  const openMenuNote = notes.find((note) => note.id === openMenuId);

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

  const chipBase =
    "inline-flex min-h-[40px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-4 text-sm font-semibold transition-colors";
  const chipOn = "border-indigo-600 bg-indigo-600 text-white";
  const chipOff = "border-slate-200 bg-white text-slate-700 hover:bg-slate-50";

  const awalTampil = pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1;
  const akhirTampil = Math.min(pagination.page * pagination.limit, pagination.total);

  function renderCard(note: NoteItem) {
    const isSelected = selectedNoteIds.includes(note.id);
    const reachedLimit = selectedNoteIds.length >= 5 && !isSelected;
    const tagUtama = note.tags?.[0];

    return (
      <div
        key={note.id}
        className={`relative flex flex-col rounded-2xl bg-white p-5 ring-1 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition hover:shadow-md ${
          isSelected ? "ring-2 ring-indigo-600" : "ring-slate-200"
        } ${viewMode === "list" ? "sm:flex-row sm:items-center sm:gap-5" : "min-h-[200px]"}`}
      >
        {isSelectionMode ? (
          <button
            type="button"
            disabled={reachedLimit}
            aria-label={`${isSelected ? "Batalkan pilihan" : "Pilih"} catatan ${note.title}`}
            aria-pressed={isSelected}
            onClick={() => toggleSelectNote(note.id)}
            className="absolute inset-0 z-0 rounded-2xl disabled:cursor-not-allowed"
          />
        ) : (
          <Link
            href={`/notes/${note.id}`}
            aria-label={`Buka catatan ${note.title}`}
            className="absolute inset-0 z-0 rounded-2xl"
          />
        )}

        <div className="pointer-events-none relative z-10 flex min-w-0 flex-1 flex-col">
          <div className="flex items-center justify-between gap-3">
            {tagUtama ? (
              <button
                type="button"
                onClick={() => updateQueryParams({ tag: tagUtama, page: 1 })}
                className="pointer-events-auto max-w-[55%] truncate rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
              >
                {tagUtama}
              </button>
            ) : (
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
                Tanpa tag
              </span>
            )}
            <div className="flex shrink-0 items-center gap-1">
              <span className="whitespace-nowrap text-xs text-slate-500">Diubah {formatDate(note.updatedAt)}</span>
              {isSelectionMode && (
                <label className="pointer-events-auto inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-lg hover:bg-indigo-50 sm:h-9 sm:w-9">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    disabled={reachedLimit}
                    onChange={() => toggleSelectNote(note.id)}
                    aria-label={`${isSelected ? "Batalkan pilihan" : "Pilih"} catatan ${note.title}`}
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 disabled:opacity-40"
                  />
                </label>
              )}
              <button
                type="button"
                aria-label={`Menu tindakan untuk ${note.title}`}
                aria-haspopup="menu"
                aria-expanded={openMenuId === note.id}
                aria-controls={openMenuId === note.id ? `note-menu-${note.id}` : undefined}
                onClick={(event) => toggleNoteMenu(note.id, event.currentTarget)}
                className="pointer-events-auto inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 sm:h-9 sm:w-9"
              >
                <Icon name="more" className="h-5 w-5" />
              </button>
            </div>
          </div>

          <h2 className="mt-3 line-clamp-2 break-words text-lg font-bold leading-snug text-slate-900">
            {note.title}
          </h2>
          <p className="mt-2 line-clamp-3 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-500">
            {note.summary || note.contentPreview || "Tidak ada isi teks."}
          </p>

          {note.tags && note.tags.length > 1 && (
            <div className="mt-auto flex flex-wrap gap-1.5 pt-4">
              {note.tags.slice(1).map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => updateQueryParams({ tag, page: 1 })}
                  className="pointer-events-auto max-w-full truncate rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-indigo-50 hover:text-indigo-700"
                >
                  #{tag}
                </button>
              ))}
            </div>
          )}
          {isSelectionMode && reachedLimit && (
            <p className="mt-2 text-xs text-slate-500">Maksimal 5 pilihan</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <AppShell user={user}>
      <div>
        <PageHeader
          title="Catatan Saya"
          subtitle="Semua yang sudah kamu simpan, di satu tempat."
          action={
            <Link href="/notes/new" className={`${btnPrimary} hidden sm:inline-flex`}>
              <Icon name="plus" className="h-5 w-5" />
              Catatan Baru
            </Link>
          }
        />

        {/* Pencarian, urutan, dan tampilan */}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Icon
              name="search"
              className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
            />
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Cari di catatanmu"
              aria-label="Cari judul atau isi catatan"
              className={`${inputClass} pl-11`}
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div
              role="group"
              aria-label="Urutkan catatan"
              className="flex w-full rounded-xl border border-slate-200 bg-white p-1 sm:inline-flex sm:w-auto"
            >
              {(
                [
                  ["terbaru", "Terbaru"],
                  ["terlama", "Terlama"],
                  ["judul", "Judul A–Z"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={paramSort === value}
                  onClick={() => updateQueryParams({ sort: value, page: 1 })}
                  className={`min-h-[44px] flex-1 rounded-lg px-3.5 text-sm font-semibold transition-colors sm:min-h-[36px] sm:flex-none ${
                    paramSort === value
                      ? "bg-indigo-50 text-indigo-700"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div
              role="group"
              aria-label="Tampilan daftar"
              className="hidden rounded-xl border border-slate-200 bg-white p-1 sm:inline-flex"
            >
              {(
                [
                  ["cards", "Kartu", "grid"],
                  ["list", "Daftar", "list"],
                ] as const
              ).map(([value, label, icon]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={viewMode === value}
                  onClick={() => setViewMode(value)}
                  className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-lg px-3.5 text-sm font-semibold transition-colors ${
                    viewMode === value
                      ? "bg-indigo-50 text-indigo-700"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <Icon name={icon} className="h-4 w-4" />
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Chip tag */}
        {availableTags.length > 0 && (
          <div
            className="-mx-4 mt-4 flex items-center gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0"
            aria-label="Filter tag"
          >
            <button
              type="button"
              aria-pressed={!paramTag}
              onClick={() => updateQueryParams({ tag: "", page: 1 })}
              className={`${chipBase} ${!paramTag ? chipOn : chipOff}`}
            >
              Semua
            </button>
            {availableTags.map((t) => {
              const isActive = paramTag === t.tag;
              return (
                <button
                  key={t.tag}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => updateQueryParams({ tag: isActive ? "" : t.tag, page: 1 })}
                  className={`${chipBase} ${isActive ? chipOn : chipOff}`}
                >
                  {t.tag}
                  <span className={`text-xs ${isActive ? "text-indigo-100" : "text-slate-400"}`}>
                    {t.count}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {!isInitialLoading && !errorMessage && pagination.total > 0 && (
          <p className="mt-5 text-sm text-slate-500" aria-live="polite">
            Menampilkan {awalTampil}–{akhirTampil} dari {pagination.total} catatan
          </p>
        )}

        {errorMessage && (
          <div
            role="alert"
            className="mt-6 flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="text-sm font-semibold text-red-700">Catatanmu belum bisa dimuat</p>
              <p className="mt-0.5 text-sm text-red-700/90">{errorMessage} Tidak ada yang hilang.</p>
            </div>
            <button
              type="button"
              onClick={fetchNotes}
              className="inline-flex min-h-[40px] items-center justify-center self-start rounded-xl border border-red-200 bg-white px-4 text-sm font-semibold text-red-700 hover:bg-red-50"
            >
              Coba lagi
            </button>
          </div>
        )}

        {/* Bilah gabung catatan */}
        {isSelectionMode && (
          <div className="sticky top-[4.5rem] z-20 mt-5 flex flex-wrap lg:top-4 items-center justify-between gap-3 rounded-2xl border border-indigo-200 bg-indigo-50 p-4 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-semibold text-indigo-900">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-xs text-white">
                {selectedNoteIds.length}
              </span>
              <span>dipilih</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={leaveSelectionMode}
                className="inline-flex min-h-[40px] items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={selectedNoteIds.length < 2}
                onClick={() => {
                  const mergeUrl = `/notes/merge?ids=${selectedNoteIds.join(",")}`;
                  leaveSelectionMode();
                  router.push(mergeUrl);
                }}
                className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                title={
                  selectedNoteIds.length < 2
                    ? "Pilih minimal 2 catatan untuk digabung"
                    : "Gabungkan catatan yang dipilih"
                }
              >
                <Icon name="merge" className="h-4 w-4" />
                Gabungkan dengan AI
              </button>
            </div>
          </div>
        )}

        {/* Isi daftar */}
        {isInitialLoading ? (
          <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <div key={n} className={`${cardClass} min-h-[200px] animate-pulse space-y-3 p-5`}>
                <div className="h-5 w-20 rounded-full bg-slate-100" />
                <div className="h-5 w-3/4 rounded bg-slate-200" />
                <div className="h-3.5 w-full rounded bg-slate-100" />
                <div className="h-3.5 w-5/6 rounded bg-slate-100" />
              </div>
            ))}
          </div>
        ) : notes.length === 0 && !errorMessage ? (
          hasFilterActive ? (
            <div className={`${cardClass} mt-8 p-10 text-center`}>
              <h3 className="text-base font-semibold text-slate-900">Tidak ada catatan yang cocok</h3>
              <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">
                Coba kata kunci lain atau hapus filter yang aktif.
              </p>
              <button type="button" onClick={resetFilter} className={`${btnSecondary} mt-5`}>
                Hapus filter
              </button>
            </div>
          ) : (
            <div className={`${cardClass} mt-8 p-10 text-center`}>
              <svg viewBox="0 0 80 48" className="mx-auto h-12 w-20" fill="none" aria-hidden="true">
                <path d="M8 38 28 14l18 14 26-20" stroke="#4F46E5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="8" cy="38" r="4.5" fill="#fff" stroke="#4F46E5" strokeWidth="2" />
                <circle cx="28" cy="14" r="4.5" fill="#fff" stroke="#4F46E5" strokeWidth="2" />
                <circle cx="46" cy="28" r="4.5" fill="#fff" stroke="#4F46E5" strokeWidth="2" />
                <circle cx="72" cy="8" r="5" fill="#4F46E5" />
              </svg>
              <h3 className="mt-4 text-lg font-bold text-slate-900">Belum ada catatan</h3>
              <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">
                Tulis catatan pertamamu. Nalar akan membantu merangkumnya dan menghubungkannya
                dengan ide-idemu yang lain.
              </p>
              <Link href="/notes/new" className={`${btnPrimary} mt-6`}>
                Tulis catatan pertama
              </Link>
            </div>
          )
        ) : (
          <div
            className={`mt-5 grid gap-5 transition-opacity duration-200 ${
              viewMode === "cards" ? "grid-cols-1 sm:grid-cols-2 xl:grid-cols-3" : "grid-cols-1"
            } ${isFetching ? "opacity-60" : "opacity-100"}`}
          >
            {notes.map((note) => renderCard(note))}
          </div>
        )}

        <Pagination
          page={pagination.page}
          totalPages={pagination.totalPages}
          total={pagination.total}
          limit={pagination.limit}
          disabled={isFetching}
          onPageChange={(newPage) => updateQueryParams({ page: newPage })}
        />

        {!isInitialLoading && notes.length > 0 && !isSelectionMode && (
          <div className="mt-8 flex items-center gap-4 rounded-2xl bg-indigo-50 p-4 text-sm text-indigo-800">
            <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-indigo-600">
              <Icon name="sparkle" className="h-5 w-5" />
            </span>
            <p>
              <strong className="font-semibold">Tips:</strong> buka catatan lalu tekan Ringkasan AI untuk
              versi singkatnya. Teks aslimu tidak pernah diubah.
            </p>
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={Boolean(noteToDelete)}
        title="Hapus catatan ini?"
        message={
          noteToDelete
            ? `“${noteToDelete.title}” beserta ringkasan AI-nya akan dihapus permanen. Tindakan ini tidak bisa dibatalkan.`
            : ""
        }
        confirmLabel="Hapus catatan"
        cancelLabel="Batal"
        isLoading={isDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setNoteToDelete(null)}
      />
      {openMenuNote &&
        menuPosition &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={menuRef}
            id={`note-menu-${openMenuNote.id}`}
            role="menu"
            aria-label={`Menu tindakan untuk ${openMenuNote.title}`}
            onKeyDown={handleMenuKeyDown}
            onBlur={(event) => {
              if (
                event.relatedTarget instanceof Node &&
                !event.currentTarget.contains(event.relatedTarget)
              ) {
                setOpenMenuId(null);
              }
            }}
            style={{ left: menuPosition.left, top: menuPosition.top }}
            className="fixed z-[70] w-52 rounded-xl bg-white p-1.5 shadow-xl ring-1 ring-slate-200"
          >
            <button
              ref={(element) => {
                menuItemRefs.current[0] = element;
              }}
              type="button"
              role="menuitem"
              onClick={() => {
                leaveSelectionMode();
                setOpenMenuId(null);
                router.push(`/notes/${openMenuNote.id}?edit=true`);
              }}
              className="flex min-h-10 w-full items-center gap-2.5 rounded-lg px-3 text-left text-sm font-medium text-slate-700 hover:bg-slate-100 focus:bg-slate-100 focus:outline-none"
            >
              <Icon name="edit" className="h-4 w-4 text-slate-500" />
              Ubah
            </button>
            <button
              ref={(element) => {
                menuItemRefs.current[1] = element;
              }}
              type="button"
              role="menuitem"
              onClick={() => {
                startSelectionWith(openMenuNote.id);
                menuTriggerRef.current?.focus();
              }}
              className="flex min-h-10 w-full items-center gap-2.5 rounded-lg px-3 text-left text-sm font-medium text-slate-700 hover:bg-slate-100 focus:bg-slate-100 focus:outline-none"
            >
              <Icon name="merge" className="h-4 w-4 text-slate-500" />
              Gabungkan dengan…
            </button>
            <button
              ref={(element) => {
                menuItemRefs.current[2] = element;
              }}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpenMenuId(null);
                setNoteToDelete(openMenuNote);
              }}
              className="flex min-h-10 w-full items-center gap-2.5 rounded-lg px-3 text-left text-sm font-medium text-red-600 hover:bg-red-50 focus:bg-red-50 focus:outline-none"
            >
              <Icon name="trash" className="h-4 w-4" />
              Hapus
            </button>
          </div>,
          document.body,
        )}
    </AppShell>
  );
}
