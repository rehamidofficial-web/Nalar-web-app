import { Suspense } from "react";
import { GraphContent } from "@/components/graph/GraphContent";

export default function GraphPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-50">
          <p className="text-slate-500 text-sm">Memuat Knowledge Graph...</p>
        </div>
      }
    >
      <GraphContent />
    </Suspense>
  );
}