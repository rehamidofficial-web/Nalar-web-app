"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
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
  const id = typeof params?.id === "string" ? params.id : Array.isArray(params?.id) ? params.id[0] : "";

  const [note, setNote] = useState<NoteDetail | null>(null);
  const [currentContent, setCurrentContent] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const fetchNote = useCallback(() => {
    if (!id) return;
    const token = getToken();
    apiFetch<NoteDetail>(`/notes/${id}`, { token })
      .then((res) => {
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
        setErrorMessage("Tidak bisa terhubung ke server. Pastikan backend sedang menyala.");
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [id]);

  useEffect(() => {
    if (!user || !id) return;
    fetchNote();
  }, [user, id, fetchNote]);

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
            <h2 className="text-xl font-bold text-slate-900">
              Catatan tidak ditemukan
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Catatan yang kamu cari mungkin sudah dihapus atau bukan milikmu.
            </p>
            <div className="mt-6">
              <Link
                href="/notes"
                className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 transition-colors"
              >
                Kembali ke Catatan Saya
              </Link>
            </div>
          </div>
        ) : errorMessage ? (
          <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
            {errorMessage}
          </div>
        ) : note ? (
          <div>
            <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                  Ubah Catatan
                </h1>
                <p className="mt-1 text-sm text-slate-500">
                  Perbarui isi dan tag catatanmu.
                </p>
              </div>
              <div>
                <Link
                  href={`/graph?catatan=${note.id}`}
                  className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition-colors"
                >
                  <svg
                    className="h-4 w-4 text-slate-500"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M7.5 14.25v2.25m3-4.5v4.5m3-6.75v6.75m3-9v9M6 20.25h12A2.25 2.25 0 0 0 20.25 18V6A2.25 2.25 0 0 0 18 3.75H6A2.25 2.25 0 0 0 3.75 6v12A2.25 2.25 0 0 0 6 20.25Z"
                    />
                  </svg>
                  Lihat di Graph
                </Link>
              </div>
            </div>

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
                  fetchNote();
                }}
              />
            </div>

            {/* Panel Ringkasan AI */}
            <SummaryPanel
              noteId={note.id}
              summary={note.summary}
              isDirty={isDirty}
              onSummaryUpdated={(newSummary) => {
                setNote((prev) => (prev ? { ...prev, summary: newSummary } : prev));
              }}
            />

            {/* Panel Konsep Utama AI */}
            <ConceptPanel
              noteId={note.id}
              concepts={note.concepts ?? []}
              isDirty={isDirty}
              onConceptsUpdated={(newConcepts) => {
                setNote((prev) => (prev ? { ...prev, concepts: newConcepts } : prev));
              }}
            />
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
