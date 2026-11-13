"use client";

import { useState } from "react";
import { apiFetch, pesanError } from "@/lib/api";
import { getToken } from "@/lib/auth";

export interface ConceptItem {
  id: string;
  name: string;
  description: string | null;
}

interface ConceptPanelProps {
  noteId: string;
  concepts: ConceptItem[];
  onConceptsUpdated: (newConcepts: ConceptItem[]) => void;
  isDirty?: boolean;
}

export function ConceptPanel({
  noteId,
  concepts,
  onConceptsUpdated,
  isDirty = false,
}: ConceptPanelProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isTruncated, setIsTruncated] = useState(false);

  async function handleExtractConcepts() {
    if (isDirty || isLoading) return;

    setErrorMessage("");
    setIsLoading(true);
    setIsTruncated(false);

    try {
      const token = getToken();
      const res = await apiFetch<{
        noteId: string;
        concepts: ConceptItem[];
        model: string;
        terpotong: boolean;
      }>("/ai/extract-concepts", {
        method: "POST",
        token,
        body: { noteId },
      });

      if (res.ok && res.data) {
        onConceptsUpdated(res.data.concepts);
        setIsTruncated(res.data.terpotong);
      } else {
        setErrorMessage(pesanError(res));
      }
    } catch {
      setErrorMessage("Tidak bisa terhubung ke server. Pastikan backend aktif.");
    } finally {
      setIsLoading(false);
    }
  }

  const hasConcepts = concepts.length > 0;

  return (
    <div className="mt-8 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
            {/* Tag / Lightbulb Icon */}
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="1.8"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 18v-5.25m0 0a6.01 6.01 0 0 0 1.5-.189m-1.5.189a6.01 6.01 0 0 1-1.5-.189m3.75 7.478a12.06 12.06 0 0 1-4.5 0m3.75 2.383a14.406 14.406 0 0 1-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 1 0-7.516 0c.85.493 1.508 1.333 1.508 2.316V18"
              />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Konsep Utama</h2>
            <p className="text-xs text-slate-500">
              Ide dan topik kunci yang diekstrak oleh AI dari catatan ini.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleExtractConcepts}
          disabled={isLoading || isDirty}
          aria-busy={isLoading}
          className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <svg
                className="h-4 w-4 animate-spin text-white"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v8H4z"
                />
              </svg>
              <span>AI sedang mengekstrak konsep...</span>
            </span>
          ) : hasConcepts ? (
            "Ekstrak ulang konsep"
          ) : (
            "Ekstrak Konsep dengan AI"
          )}
        </button>
      </div>

      {isDirty && (
        <p className="mt-3 text-xs text-amber-600">
          * Simpan perubahan dulu agar konsep memakai isi terbaru.
        </p>
      )}

      {errorMessage && (
        <div className="mt-4 flex flex-col gap-2 rounded-lg bg-red-50 p-4 text-sm text-red-700 sm:flex-row sm:items-center sm:justify-between">
          <span>{errorMessage}</span>
          <button
            type="button"
            onClick={handleExtractConcepts}
            className="self-start font-semibold text-red-800 underline hover:text-red-900"
          >
            Coba lagi
          </button>
        </div>
      )}

      {/* Area Daftar Chip Konsep */}
      <div className="mt-5 rounded-xl border border-slate-100 bg-slate-50 p-4" aria-live="polite">
        {hasConcepts ? (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {concepts.map((concept) => (
                <span
                  key={concept.id}
                  className="inline-flex items-center rounded-full bg-indigo-50 px-3 py-1 text-sm font-medium text-indigo-700 ring-1 ring-inset ring-indigo-200/60"
                >
                  {concept.name}
                </span>
              ))}
            </div>

            {/* Accordion detail penjelasan konsep */}
            <details className="group border-t border-slate-200/80 pt-3">
              <summary className="cursor-pointer text-xs font-semibold text-indigo-600 hover:text-indigo-700 focus:outline-none">
                Lihat penjelasan
              </summary>
              <ul className="mt-2.5 space-y-2 text-xs text-slate-700">
                {concepts.map((concept) => (
                  <li key={concept.id} className="leading-relaxed">
                    <span className="font-semibold text-slate-900">{concept.name}:</span>{" "}
                    {concept.description || "Tidak ada deskripsi."}
                  </li>
                ))}
              </ul>
            </details>

            {isTruncated && (
              <p className="text-xs text-slate-500 italic">
                * Catatan terlalu panjang, hanya bagian awalnya yang diproses.
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm italic text-slate-400">Belum ada konsep.</p>
        )}
      </div>
    </div>
  );
}
