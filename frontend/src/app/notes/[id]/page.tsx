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

  return (
    <AppShell user={user}>
      <div className="mx-auto max-w-3xl">
        {isLoading ? (
          <div className="py-16 text-center">
            <p className="text-slate-500">Memuat catatan...</p>
          </div>
        ) : notFound ? (
          <div className="rounded-2xl bg-white p-8 text-center ring-1 ring-slate-200 sm:p-12">
            <h2 className="text-xl font-bold text-slate-900">Catatan tidak ditemukan</h2>
            <p className="mt-2 text-sm text-slate-500">
              Catatan yang kamu cari mungkin sudah dihapus atau bukan milikmu.
            </p>
            <div className="mt-6">
              <Link
                href="/notes"
                className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700"
              >
                Kembali ke Catatan Saya
              </Link>
            </div>
          </div>
        ) : errorMessage ? (
          <div className="flex flex-col gap-3 rounded-xl bg-red-50 p-4 text-sm text-red-700 sm:flex-row sm:items-center sm:justify-between">
            <span>{errorMessage}</span>
            <button
              type="button"
              onClick={fetchNote}
              className="self-start font-semibold text-red-800 underline hover:text-red-900"
            >
              Coba lagi
            </button>
          </div>
        ) : note ? (
          <div>
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <h1 className="break-words text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                  {isEditing ? "Ubah Catatan" : note.title}
                </h1>
                <p className="mt-1 text-sm text-slate-500">
                  {isEditing ? "Perbarui isi dan tag catatanmu." : "Catatan pengetahuanmu."}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                {isEditing ? (
                  <Link
                    href={`/notes/${note.id}`}
                    className="inline-flex min-h-[40px] items-center justify-center rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
                  >
                    Lihat Catatan
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={() => router.push(`/notes/${note.id}?edit=true`)}
                    className="inline-flex min-h-[40px] items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700"
                  >
                    Ubah
                  </button>
                )}
                <Link
                  href="/notes"
                  className="inline-flex min-h-[40px] items-center justify-center rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
                >
                  Kembali
                </Link>
                <Link
                  href={`/graph?catatan=${note.id}`}
                  className="inline-flex min-h-[40px] items-center justify-center rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
                >
                  Lihat di Graph
                </Link>
              </div>
            </div>

            {isEditing ? (
              <>
                <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">
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
              </>
            ) : (
              <div className="space-y-5">
                <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">
                  <h2 className="text-sm font-semibold text-slate-500">Isi Catatan</h2>
                  <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-slate-800">
                    {note.content}
                  </p>
                  {note.tags && note.tags.length > 0 && (
                    <div className="mt-6 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                      {note.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </section>

                <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">
                  <h2 className="text-lg font-bold text-slate-900">Ringkasan</h2>
                  <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-slate-700">
                    {note.summary || "Belum ada ringkasan."}
                  </p>
                </section>

                <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">
                  <h2 className="text-lg font-bold text-slate-900">Konsep Utama</h2>
                  {note.concepts && note.concepts.length > 0 ? (
                    <ul className="mt-3 space-y-3">
                      {note.concepts.map((concept) => (
                        <li key={concept.id} className="text-sm leading-6 text-slate-700">
                          <span className="font-semibold text-slate-900">{concept.name}</span>
                          {concept.description && (
                            <span>: {concept.description}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-3 text-sm text-slate-500">Belum ada konsep.</p>
                  )}
                </section>
              </div>
            )}
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
