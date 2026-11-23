"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch, pesanError } from "@/lib/api";
import { NalarMark, Spinner } from "@/components/ui";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [konfirmasi, setKonfirmasi] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== konfirmasi) {
      setError("Konfirmasi password tidak sama");
      return;
    }
    setLoading(true);
    const res = await apiFetch("/auth/register", {
      method: "POST",
      body: { name, email, password },
    });
    setLoading(false);
    if (!res.ok) {
      setError(pesanError(res));
      return;
    }
    router.push("/login");
  }

  const inputClass =
    "w-full min-h-[48px] rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-slate-900 placeholder-slate-400 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200";

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 text-slate-900">
      <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-[0_8px_30px_rgba(15,23,42,0.06)] ring-1 ring-slate-200 sm:p-10">
        <div className="mb-6 flex flex-col items-center">
          <NalarMark size={56} />
          <h1 className="mt-4 text-[26px] font-bold tracking-tight text-slate-900">Buat akun Nalar</h1>
          <p className="mt-1 text-sm text-slate-500">
            Mulai kumpulkan pengetahuanmu.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="name" className="mb-1.5 block text-sm font-semibold text-slate-900">
              Nama
            </label>
            <input
              id="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="email" className="mb-1.5 block text-sm font-semibold text-slate-900">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label
              htmlFor="password"
              className="mb-1.5 block text-sm font-semibold text-slate-900"
            >
              Password (minimal 8 karakter)
            </label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label
              htmlFor="konfirmasi"
              className="mb-1.5 block text-sm font-semibold text-slate-900"
            >
              Ulangi password
            </label>
            <input
              id="konfirmasi"
              type="password"
              autoComplete="new-password"
              required
              value={konfirmasi}
              onChange={(e) => setKonfirmasi(e.target.value)}
              className={inputClass}
            />
          </div>

          {error && (
            <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-60"
          >
            {loading ? (<><Spinner /> Memproses…</>) : "Daftar"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          Sudah punya akun?{" "}
          <Link
            href="/login"
            className="font-semibold text-indigo-700 hover:underline"
          >
            Masuk
          </Link>
        </p>
      </div>
    </main>
  );
}
