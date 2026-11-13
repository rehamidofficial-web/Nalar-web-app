"use client";

import { useState } from "react";
import { apiFetch, pesanError } from "@/lib/api";
import { getToken } from "@/lib/auth";

interface SummaryPanelProps {
  noteId: string;
  summary: string | null;
  onSummaryUpdated: (newSummary: string) => void;
  isDirty?: boolean;
}

export function SummaryPanel({
  noteId,
  summary,
  onSummaryUpdated,
  isDirty = false,
}: SummaryPanelProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isTruncated, setIsTruncated] = useState(false);

  async function handleSummarize() {
    if (isDirty || isLoading) return;

    setErrorMessage("");
    setIsLoading(true);
    setIsTruncated(false);

    try {
      const token = getToken();
      const res = await apiFetch<{
        noteId: string;
        summary: string;
        model: string;
        terpotong: boolean;
      }>("/ai/summarize", {
        method: "POST",
        token,
        body: { noteId },
      });

      if (res.ok && res.data) {
        onSummaryUpdated(res.data.summary);
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

  const hasSummary = Boolean(summary && summary.trim().length > 0);

  return (
    <div className="mt-8 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
            {/* Sparkles Icon */}
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
                d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z"
              />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Ringkasan AI</h2>
            <p className="text-xs text-slate-500">
              Ringkas inti isi catatanmu dalam beberapa kalimat.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSummarize}
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
              <span>AI sedang meringkas...</span>
            </span>
          ) : hasSummary ? (
            "Buat ulang ringkasan"
          ) : (
            "Ringkas dengan AI"
          )}
        </button>
      </div>

      {isDirty && (
        <p className="mt-3 text-xs text-amber-600">
          * Simpan perubahan dulu agar ringkasan memakai isi catatan terbaru.
        </p>
      )}

      {errorMessage && (
        <div className="mt-4 flex flex-col gap-2 rounded-lg bg-red-50 p-4 text-sm text-red-700 sm:flex-row sm:items-center sm:justify-between">
          <span>{errorMessage}</span>
          <button
            type="button"
            onClick={handleSummarize}
            className="self-start font-semibold text-red-800 underline hover:text-red-900"
          >
            Coba lagi
          </button>
        </div>
      )}

      {/* Area Hasil Ringkasan */}
      <div className="mt-5 rounded-xl border border-slate-100 bg-slate-50 p-4" aria-live="polite">
        {hasSummary ? (
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="inline-flex items-center rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-medium text-indigo-800">
                Dibuat oleh AI
              </span>
            </div>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
              {summary}
            </p>
            {isTruncated && (
              <p className="mt-2 text-xs text-slate-500 italic">
                * Catatan terlalu panjang, hanya bagian awalnya yang diringkas.
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm italic text-slate-400">Belum ada ringkasan.</p>
        )}
      </div>
    </div>
  );
}
