import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 text-slate-900">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
        <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50 text-indigo-600 font-bold text-xl">
          404
        </div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
          Halaman Tidak Ditemukan
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Halaman yang kamu tuju tidak ada atau tautannya sudah kedaluwarsa.
        </p>
        <div className="mt-6">
          <Link
            href="/dashboard"
            className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 transition-colors"
          >
            Kembali ke Dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
