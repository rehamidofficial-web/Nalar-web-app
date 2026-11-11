"use client";

import Link from "next/link";
import { useRequireAuth } from "@/lib/useRequireAuth";
import { AppShell } from "@/components/AppShell";

export default function DashboardPage() {
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
      <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Halo, {user.name}
        </h1>
        <p className="mt-2 text-slate-600">
          Selamat datang di Nalar. Dashboard utama dengan statistik dan pengetahuan lengkap akan hadir di Task 3.4.
        </p>

        <div className="mt-6 flex flex-wrap gap-4">
          <Link
            href="/notes"
            className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 transition-colors"
          >
            Buka Catatan Saya &rarr;
          </Link>
          <Link
            href="/notes/new"
            className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            + Buat Catatan Baru
          </Link>
        </div>
      </div>
    </AppShell>
  );
}
