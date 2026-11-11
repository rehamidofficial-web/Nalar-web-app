"use client";

import { useRequireAuth } from "@/lib/useRequireAuth";
import { AppShell } from "@/components/AppShell";
import { NoteEditor } from "@/components/NoteEditor";

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
      <div className="mx-auto max-w-3xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Catatan Baru
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Tulis ide baru untuk disimpan ke dalam basis pengetahuanmu.
          </p>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">
          <NoteEditor isEdit={false} />
        </div>
      </div>
    </AppShell>
  );
}
