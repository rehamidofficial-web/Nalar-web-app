import { Suspense } from "react";
import { AssistantContent } from "@/components/assistant/AssistantContent";

export default function AssistantPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-50">
          <p className="text-slate-500 text-sm">Memuat Asisten AI...</p>
        </div>
      }
    >
      <AssistantContent />
    </Suspense>
  );
}
