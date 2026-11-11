"use client";

import { useRouter } from "next/navigation";
import { useRequireAuth } from "@/lib/useRequireAuth";
import { clearToken } from "@/lib/auth";

export default function DashboardPage() {
  const router = useRouter();
  const user = useRequireAuth();

  function keluar() {
    clearToken();
    router.replace("/login");
  }

  if (!user) {
    return (
      <p className="min-h-screen bg-slate-50 p-8 text-slate-500">Memuat...</p>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 p-8 text-slate-900">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Halo, {user.name}</h1>
          <button
            onClick={keluar}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm hover:bg-slate-100"
          >
            Keluar
          </button>
        </div>
        <p className="mt-4 text-slate-600">
          Dashboard Nalar yang sebenarnya kita bangun di Sprint 3.
        </p>
      </div>
    </main>
  );
}
