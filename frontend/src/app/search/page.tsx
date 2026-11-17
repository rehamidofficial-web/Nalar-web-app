import { Suspense } from "react";
import { SearchContent } from "@/components/SearchContent";

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-50">
          <p className="text-slate-500">Memuat halaman pencarian...</p>
        </div>
      }
    >
      <SearchContent />
    </Suspense>
  );
}
