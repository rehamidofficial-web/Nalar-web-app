import { Suspense } from "react";
import { NotesList } from "@/components/NotesList";

export default function NotesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-50">
          <p className="text-slate-500">Memuat halaman catatan...</p>
        </div>
      }
    >
      <NotesList />
    </Suspense>
  );
}
