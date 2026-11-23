"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useRequireAuth } from "@/lib/useRequireAuth";
import { AppShell } from "@/components/AppShell";
import { NoteEditor } from "@/components/NoteEditor";
import { SummaryPanel } from "@/components/SummaryPanel";
import { ConceptPanel, ConceptItem } from "@/components/ConceptPanel";
import { apiFetch, pesanError } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { Icon, cardClass, btnPrimary, btnSecondary } from "@/components/ui";

interface NoteDetail {
  id: string;
  title: string;
  content: string;
  summary: string | null;
  tags?: string[];
  concepts?: ConceptItem[];
  createdAt: string;
  updatedAt: string;
}

function EditNoteContent() {
  const user = useRequireAuth();
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = typeof params?.id === "string" ? params.id : Array.isArray(params?.id) ? params.id[0] : "";
  const isEditing = searchParams.get("edit") === "true";

  const [note, setNote] = useState<NoteDetail | null>(null);
  const [currentContent, setCurrentContent] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const fetchNote = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    setErrorMessage("");
    setNotFound(false);

    try {
      const token = getToken();
      const res = await apiFetch<NoteDetail>(`/notes/${id}`, { token });
      if (res.ok && res.data) {
        setNote(res.data);
        setCurrentContent(res.data.content);
      } else if (res.status === 404) {
        setNotFound(true);
      } else {
        setErrorMessage(pesanError(res));
      }
    } catch {
      setErrorMessage("Tidak bisa terhubung. Periksa koneksi internetmu lalu coba lagi.");
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (!user || !id) return;

    let isCancelled = false;
    const token = getToken();
    apiFetch<NoteDetail>(`/notes/${id}`, { token })
      .then((res) => {
        if (isCancelled) return;
        if (res.ok && res.data) {
          setNote(res.data);
          setCurrentContent(res.data.content);
        } else if (res.status === 404) {
          setNotFound(true);
        } else {
          setErrorMessage(pesanError(res));
        }
      })
      .catch(() => {
        if (!isCancelled) {
          setErrorMessage("Tidak bisa terhubung. Periksa koneksi internetmu lalu coba lagi.");
        }
      })
      .finally(() => {
        if (!isCancelled) setIsLoading(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [user, id]);

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-slate-500">Memuat...</p>
      </div>
    );
  }

  const isDirty = Boolean(note && currentContent !== note.content);
  const jumlahKata = note?.content.trim() ? note.content.trim().split(/\s+/).length : 0;
  const waktuUbah = note
    ? new Intl.DateTimeFormat("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(note.updatedAt))
    : "";

  return (
    <AppShell user={user}>
      <div>
        {isLoading ? (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]" aria-busy="true">
            <div className={`${cardClass} animate-pulse space-y-4 p-8`}>
              <div className="h-4 w-16 rounded bg-slate-100" />
              <div className="h-8 w-2/3 rounded bg-slate-200" />
              <div className="h-4 w-full rounded bg-slate-100" />
              <div className="h-4 w-5/6 rounded bg-slate-100" />
              <div className="h-4 w-4/6 rounded bg-slate-100" />
            </div>
            <div className={`${cardClass} h-48 animate-pulse`} />
          </div>
        ) : notFound ? (
          <div className={`${cardClass} mx-auto max-w-lg p-10 text-center`}>
            <h2 className="text-xl font-bold text-slate-900">Catatan tidak ditemukan</h2>
            <p className="mt-2 text-sm text-slate-500">
              Catatan yang kamu cari mungkin sudah dihapus atau bukan milikmu.
            </p>
            <Link href="/notes" className={`${btnPrimary} mt-6`}>
              Kembali ke Catatan Saya
            </Link>
          </div>
        ) : errorMessage ? (
          <div
            role="alert"
            className="flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="text-sm font-semibold text-red-700">Catatan belum bisa dimuat</p>
              <p className="mt-0.5 text-sm text-red-700/90">{errorMessage}</p>
            </div>
            <button
              type="button"
              onClick={fetchNote}
              className="inline-flex min-h-[40px] items-center justify-center self-start rounded-xl border border-red-200 bg-white px-4 text-sm font-semibold text-red-700 hover:bg-red-50"
            >
              Coba lagi
            </button>
          </div>
        ) : note ? (
          <div>
            {/* Jejak halaman + aksi */}
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <nav aria-label="Jejak halaman" className="flex min-w-0 items-center gap-2 text-sm">
                <Link href="/notes" className="shrink-0 font-medium text-indigo-700 hover:underline">
                  Catatan Saya
                </Link>
                <span className="text-slate-400">/</span>
                <span className="truncate text-slate-700">{note.title}</span>
              </nav>
              <div className="flex shrink-0 flex-wrap gap-2">
                <Link href={`/graph?catatan=${note.id}`} className={btnSecondary}>
                  <Icon name="graph" className="h-4 w-4" />
                  Lihat di Graph
                </Link>
                {isEditing ? (
                  <Link href={`/notes/${note.id}`} className={btnSecondary}>
                    Lihat catatan
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={() => router.push(`/notes/${note.id}?edit=true`)}
                    className={btnPrimary}
                  >
                    <Icon name="edit" className="h-4 w-4" />
                    Ubah
                  </button>
                )}
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
              {/* Kolom kiri: catatan */}
              <div>
                {isEditing ? (
                  <div className={`${cardClass} p-6 sm:p-8`}>
                    <NoteEditor
                      isEdit={true}
                      initialData={{
                        id: note.id,
                        title: note.title,
                        content: note.content,
                        tags: note.tags ?? [],
                      }}
                      onContentChange={(newContent) => setCurrentContent(newContent)}
                      onSaveSuccess={() => {
                        router.replace(`/notes/${note.id}`);
                        fetchNote();
                      }}
                    />
                  </div>
                ) : (
                  <article className={`${cardClass} p-6 sm:p-8`}>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Judul</p>
                    <h1 className="mt-2 break-words text-[28px] font-bold leading-tight tracking-tight text-slate-900">
                      {note.title}
                    </h1>
                    {note.tags && note.tags.length > 0 && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {note.tags.map((tag) => (
                          <Link
                            key={tag}
                            href={`/notes?tag=${encodeURIComponent(tag)}`}
                            className="rounded-full bg-indigo-50 px-3 py-1 text-sm font-medium text-indigo-700 hover:bg-indigo-100"
                          >
                            {tag}
                          </Link>
                        ))}
                      </div>
                    )}
                    <div className="mt-6 border-t border-slate-100 pt-5">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Isi catatan
                      </p>
                      <p className="mt-3 whitespace-pre-wrap break-words text-[15px] leading-7 text-slate-800">
                        {note.content}
                      </p>
                    </div>
                    <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4 text-xs text-slate-500">
                      <span>{jumlahKata.toLocaleString("id-ID")} kata</span>
                      <span>Terakhir diubah {waktuUbah}</span>
                    </div>
                  </article>
                )}
              </div>

              {/* Kolom kanan: bantuan AI */}
              <aside className="h-fit space-y-4">
                <p className="text-sm text-slate-500">
                  AI membaca catatanmu dan menyarankan ringkasan serta ide utama.{" "}
                  <strong className="font-semibold text-slate-900">Catatan aslimu tidak pernah diubah.</strong>
                </p>
                <SummaryPanel
                  noteId={note.id}
                  summary={note.summary}
                  isDirty={isDirty}
                  onSummaryUpdated={(newSummary) => {
                    setNote((prev) => (prev ? { ...prev, summary: newSummary } : prev));
                  }}
                />
                <ConceptPanel
                  noteId={note.id}
                  concepts={note.concepts ?? []}
                  isDirty={isDirty}
                  onConceptsUpdated={(newConcepts) => {
                    setNote((prev) => (prev ? { ...prev, concepts: newConcepts } : prev));
                  }}
                />
              </aside>
            </div>
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}

export default function EditNotePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-50">
          <p className="text-slate-500">Memuat catatan...</p>
        </div>
      }
    >
      <EditNoteContent />
    </Suspense>
  );
}
