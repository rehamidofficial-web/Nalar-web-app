"use client";

import Link from "next/link";
import { useRequireAuth } from "@/lib/useRequireAuth";
import { AppShell } from "@/components/AppShell";
import { NoteEditor } from "@/components/NoteEditor";
import { Icon, cardClass } from "@/components/ui";

export default function NewNotePage() {
  const user = useRequireAuth();

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-slate-500">Memuat...</p>
      </div>
    );
  }

  return (
    <AppShell user={user}>
      <div className="mx-auto max-w-4xl">
        <nav aria-label="Jejak halaman" className="mb-5 flex items-center gap-2 text-sm">
          <Link href="/notes" className="font-medium text-indigo-700 hover:underline">
            Catatan Saya
          </Link>
          <span className="text-slate-400">/</span>
          <span className="text-slate-700">Catatan baru</span>
        </nav>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className={`${cardClass} p-6 sm:p-8`}>
            <NoteEditor key="new-note" isEdit={false} />
          </div>

          <aside className="h-fit space-y-4">
            <div className="flex gap-3 rounded-2xl bg-indigo-50 p-4 text-sm text-indigo-800">
              <Icon name="sparkle" className="mt-0.5 h-5 w-5 shrink-0 text-indigo-600" />
              <p>
                Setelah disimpan, kamu bisa meminta <strong className="font-semibold">Ringkasan AI</strong>{" "}
                dan <strong className="font-semibold">Konsep Utama</strong>. Teks aslimu tidak pernah
                diubah.
              </p>
            </div>
            <div className={`${cardClass} p-4 text-sm text-slate-500`}>
              <p className="font-semibold text-slate-900">Tips menulis</p>
              <ul className="mt-2 list-disc space-y-1.5 pl-5">
                <li>Satu catatan, satu ide.</li>
                <li>Tulis dengan kata-katamu sendiri.</li>
                <li>Tag membantu mengelompokkan catatan.</li>
              </ul>
            </div>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
