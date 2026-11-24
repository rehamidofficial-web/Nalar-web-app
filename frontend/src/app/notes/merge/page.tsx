"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useRequireAuth } from "@/lib/useRequireAuth";
import { AppShell } from "@/components/AppShell";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { apiFetch, pesanError } from "@/lib/api";
import { getToken } from "@/lib/auth";

interface SumberCatatan {
  noteId: string;
  title: string;
}

interface MergePreviewResponse {
  title: string;
  content: string;
  tags: string[];
  sumber: SumberCatatan[];
}

function MergePageContent() {
  const user = useRequireAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const idsParam = searchParams.get("ids") || "";
  const noteIds = idsParam
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [sumber, setSumber] = useState<SumberCatatan[]>([]);
  const [hapusAsli, setHapusAsli] = useState(false);

  // Accordion isi catatan sumber
  const [detailCatatan, setDetailCatatan] = useState<Map<string, string>>(new Map());
  const [terbukaCatatanId, setTerbukaCatatanId] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [hasEdited, setHasEdited] = useState(false);

  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [isConfirmRegenOpen, setIsConfirmRegenOpen] = useState(false);

  // Penjaga pemanggilan ganda (Strict Mode / re-render)
  const hasFetchedRef = useRef(false);

  // Muat detail isi catatan untuk preview sumber jika dibuka
  function handleToggleSumber(id: string) {
    if (terbukaCatatanId === id) {
      setTerbukaCatatanId(null);
      return;
    }
    setTerbukaCatatanId(id);

    if (!detailCatatan.has(id)) {
      const token = getToken();
      if (!token) return;
      apiFetch<{ content: string }>(`/notes/${id}`, { token }).then((res) => {
        if (res.ok && res.data && typeof res.data.content === "string") {
          const contentVal = res.data.content;
          setDetailCatatan((prev) => new Map(prev).set(id, contentVal));
        }
      });
    }
  }

  // Panggil AI merge-preview
  async function muatRancangan(isUlang = false) {
    if (noteIds.length < 2 || noteIds.length > 5) {
      setErrorMessage("Pilih antara 2 sampai 5 catatan untuk digabungkan.");
      setIsLoading(false);
      return;
    }

    const token = getToken();
    if (!token) {
      setIsLoading(false);
      return;
    }

    if (isUlang) {
      setIsRegenerating(true);
    } else {
      setIsLoading(true);
    }
    setErrorMessage("");

    try {
      const res = await apiFetch<MergePreviewResponse>("/ai/merge-preview", {
        method: "POST",
        token,
        body: { noteIds },
      });

      if (!res.ok) {
        setErrorMessage(pesanError(res));
        return;
      }

      if (res.data) {
        setTitle(res.data.title);
        setContent(res.data.content);
        setTags(res.data.tags || []);
        setSumber(res.data.sumber || []);
        setHasEdited(false);
      }
    } catch {
      setErrorMessage("Tidak dapat terhubung ke server. Pastikan backend aktif.");
    } finally {
      setIsLoading(false);
      setIsRegenerating(false);
    }
  }

  useEffect(() => {
    if (!user) return;
    if (hasFetchedRef.current) return;
    hasFetchedRef.current = true;
    muatRancangan(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  function handleAddTag() {
    const rawTag = tagInput.trim().toLowerCase().replace(/^,+|,+$/g, "");
    if (!rawTag) return;
    if (rawTag.length > 30) {
      setErrorMessage("Tag maksimal 30 karakter");
      return;
    }
    if (tags.includes(rawTag)) {
      setTagInput("");
      return;
    }
    if (tags.length >= 10) {
      setErrorMessage("Maksimal 10 tag per catatan");
      return;
    }
    setTags([...tags, rawTag]);
    setTagInput("");
    setHasEdited(true);
  }

  function removeTag(t: string) {
    setTags(tags.filter((item) => item !== t));
    setHasEdited(true);
  }

  function handleMintaRegen() {
    if (hasEdited) {
      setIsConfirmRegenOpen(true);
    } else {
      muatRancangan(true);
    }
  }

  async function handleSimpanCatatan() {
    const trimmedTitle = title.trim();
    const trimmedContent = content.trim();

    if (!trimmedTitle) {
      setErrorMessage("Judul catatan wajib diisi.");
      return;
    }
    if (!trimmedContent) {
      setErrorMessage("Isi catatan wajib diisi.");
      return;
    }

    const token = getToken();
    if (!token) return;

    setIsSaving(true);
    setErrorMessage("");

    try {
      const res = await apiFetch<{ id: string }>("/notes/merge", {
        method: "POST",
        token,
        body: {
          title: trimmedTitle,
          content: trimmedContent,
          tags,
          sourceNoteIds: noteIds,
          hapusAsli,
        },
      });

      if (!res.ok) {
        setErrorMessage(pesanError(res));
        setIsSaving(false);
        return;
      }

      if (res.data?.id) {
        router.push(`/notes/${res.data.id}`);
      } else {
        router.push("/notes");
      }
    } catch {
      setErrorMessage("Gagal menyimpan catatan gabungan.");
      setIsSaving(false);
    }
  }

  function handleKlikSimpan() {
    if (hapusAsli) {
      setIsConfirmDialogOpen(true);
    } else {
      handleSimpanCatatan();
    }
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-sm text-slate-500">Memuat...</p>
      </div>
    );
  }

  return (
    <AppShell user={user}>
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Header */}
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
            <Link href="/notes" className="hover:text-slate-800 transition">
              Catatan
            </Link>
            <span>/</span>
            <span className="text-slate-700">Gabungkan dengan AI</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Gabungkan Catatan
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Tinjau rancangan catatan gabungan yang disusun AI dari {noteIds.length} catatan pilihanmu.
          </p>
        </div>

        {/* Keadaan Memuat Pertama Kali */}
        {isLoading && (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center ring-1 ring-slate-200/60 shadow-sm">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50 text-indigo-600 mb-4 animate-pulse">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
              </svg>
            </div>
            <h2 className="text-base font-semibold text-slate-900">
              AI sedang menyusun catatan gabungan...
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Membaca poin-poin dari {noteIds.length} catatan sumber dan merangkainya menjadi satu catatan yang runtut.
            </p>
          </div>
        )}

        {/* Pesan Error */}
        {errorMessage && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 flex items-center justify-between">
            <span>{errorMessage}</span>
            <Link
              href="/notes"
              className="text-xs font-semibold text-red-800 underline hover:text-red-900 ml-4 shrink-0"
            >
              Kembali ke Daftar
            </Link>
          </div>
        )}

        {/* Formulir Rancangan & Daftar Catatan Asli */}
        {!isLoading && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Kolom Kiri: Formulir Editor Catatan Gabungan */}
            <div className="lg:col-span-2 space-y-5">
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm ring-1 ring-slate-200/60 space-y-4">
                <div>
                  <label htmlFor="merge-title" className="block text-xs font-medium text-slate-700 mb-1">
                    Judul Catatan Gabungan
                  </label>
                  <input
                    id="merge-title"
                    type="text"
                    value={title}
                    maxLength={100}
                    disabled={isRegenerating || isSaving}
                    onChange={(e) => {
                      setTitle(e.target.value);
                      setHasEdited(true);
                    }}
                    placeholder="Judul catatan baru"
                    className="block w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-base text-slate-900 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600 sm:text-sm"
                  />
                </div>

                {/* Input Tag */}
                <div>
                  <label htmlFor="merge-tags" className="block text-xs font-medium text-slate-700 mb-1">
                    Tag (maksimal 10)
                  </label>
                  <div className="flex flex-wrap items-center gap-1.5 p-2 rounded-xl border border-slate-300 bg-white focus-within:border-indigo-600 focus-within:ring-2 focus-within:ring-indigo-600">
                    {tags.map((t) => (
                      <span
                        key={t}
                        className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700 border border-indigo-100"
                      >
                        #{t}
                        <button
                          type="button"
                          onClick={() => removeTag(t)}
                          disabled={isRegenerating || isSaving}
                          className="hover:text-indigo-900"
                          aria-label={`Hapus tag ${t}`}
                        >
                          &times;
                        </button>
                      </span>
                    ))}
                    {tags.length < 10 && (
                      <input
                        id="merge-tags"
                        type="text"
                        value={tagInput}
                        disabled={isRegenerating || isSaving}
                        onChange={(e) => setTagInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === ",") {
                            e.preventDefault();
                            handleAddTag();
                          }
                        }}
                        placeholder={tags.length === 0 ? "Ketik tag lalu tekan Enter" : "+ tag"}
                        className="flex-1 min-w-[80px] border-none p-1 text-base text-slate-800 placeholder:text-slate-400 focus:outline-none sm:text-xs"
                      />
                    )}
                  </div>
                </div>

                {/* Isi Catatan */}
                <div>
                  <label htmlFor="merge-content" className="block text-xs font-medium text-slate-700 mb-1">
                    Isi Catatan Gabungan
                  </label>
                  <textarea
                    id="merge-content"
                    rows={12}
                    maxLength={50000}
                    value={content}
                    disabled={isRegenerating || isSaving}
                    onChange={(e) => {
                      setContent(e.target.value);
                      setHasEdited(true);
                    }}
                    placeholder="Isi catatan gabungan..."
                    className="block w-full rounded-xl border border-slate-300 p-3.5 text-base text-slate-900 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600 sm:text-sm"
                  />
                  <div className="mt-1 flex justify-between text-[11px] text-slate-400">
                    <span>Mendukung format Markdown</span>
                    <span>{content.length}/50.000 karakter</span>
                  </div>
                </div>

                {/* Opsi Hapus Asli */}
                <div className="pt-2 border-t border-slate-100">
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hapusAsli}
                      onChange={(e) => setHapusAsli(e.target.checked)}
                      disabled={isRegenerating || isSaving}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600"
                    />
                    <div className="text-xs">
                      <span className="font-medium text-slate-800">
                        Hapus catatan asli setelah berhasil digabungkan
                      </span>
                      <p className="text-slate-500 mt-0.5">
                        Bawaan tidak tercentang. Jika dicentang, {sumber.length} catatan sumber akan dihapus permanen.
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Tombol Aksi Bawah */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleMintaRegen}
                    disabled={isRegenerating || isSaving}
                    className="inline-flex min-h-[40px] items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 transition disabled:opacity-50"
                  >
                    {isRegenerating ? "Menyusun ulang..." : "Buat Ulang Rancangan"}
                  </button>
                  <Link
                    href="/notes"
                    className="inline-flex min-h-[40px] items-center justify-center rounded-xl border border-transparent px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 transition"
                  >
                    Batal
                  </Link>
                </div>

                <button
                  type="button"
                  onClick={handleKlikSimpan}
                  disabled={isRegenerating || isSaving || !title.trim() || !content.trim()}
                  className="inline-flex min-h-[40px] items-center justify-center rounded-xl bg-indigo-600 px-6 py-2 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 transition disabled:opacity-50"
                >
                  {isSaving ? "Menyimpan..." : "Simpan Catatan Gabungan"}
                </button>
              </div>
            </div>

            {/* Kolom Kanan: Rujukan Catatan Asli */}
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ring-1 ring-slate-200/60">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
                  Catatan Asli ({sumber.length})
                </h3>
                <p className="text-xs text-slate-500 mb-3">
                  Klik catatan untuk melihat cuplikan isi aslinya:
                </p>

                <div className="space-y-2">
                  {sumber.map((s, idx) => {
                    const isBuka = terbukaCatatanId === s.noteId;
                    const isiTeks = detailCatatan.get(s.noteId);

                    return (
                      <div
                        key={s.noteId}
                        className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-xs"
                      >
                        <button
                          type="button"
                          onClick={() => handleToggleSumber(s.noteId)}
                          className="w-full flex items-center justify-between text-left font-medium text-slate-800 hover:text-indigo-600 transition"
                        >
                          <span className="truncate pr-2">
                            {idx + 1}. {s.title}
                          </span>
                          <span className="text-slate-400 text-xs">
                            {isBuka ? "▲" : "▼"}
                          </span>
                        </button>

                        {isBuka && (
                          <div className="mt-2 pt-2 border-t border-slate-200 text-slate-600 max-h-48 overflow-y-auto whitespace-pre-wrap">
                            {isiTeks ? (
                              isiTeks
                            ) : (
                              <span className="text-slate-400 italic">Memuat isi...</span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Dialog Konfirmasi Buat Ulang (Jika Ada Perubahan Manual) */}
        <ConfirmDialog
          isOpen={isConfirmRegenOpen}
          title="Buat ulang rancangan?"
          message="Perubahan judul atau teks yang sudah kamu tulis manual di formulir ini akan diganti dengan hasil baru dari AI."
          confirmLabel="Buat Ulang"
          cancelLabel="Batal"
          onConfirm={() => {
            setIsConfirmRegenOpen(false);
            muatRancangan(true);
          }}
          onCancel={() => setIsConfirmRegenOpen(false)}
        />

        {/* Dialog Konfirmasi Hapus Catatan Asli */}
        <ConfirmDialog
          isOpen={isConfirmDialogOpen}
          title="Hapus catatan asli?"
          message={`Kamu mencentang pilihan untuk menghapus ${sumber.length} catatan asli (${sumber.map((s) => `"${s.title}"`).join(", ")}). Catatan asli akan dihapus permanen dan tidak dapat dikembalikan setelah disimpan.`}
          confirmLabel="Lanjutkan dan Simpan"
          cancelLabel="Batal"
          isLoading={isSaving}
          onConfirm={() => {
            setIsConfirmDialogOpen(false);
            handleSimpanCatatan();
          }}
          onCancel={() => setIsConfirmDialogOpen(false)}
        />
      </div>
    </AppShell>
  );
}

export default function MergeNotesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-50">
          <p className="text-sm text-slate-500">Memuat halaman penggabungan...</p>
        </div>
      }
    >
      <MergePageContent />
    </Suspense>
  );
}
