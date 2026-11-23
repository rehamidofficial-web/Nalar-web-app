"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch, pesanError } from "@/lib/api";
import { NalarMark, Spinner } from "@/components/ui";
import { saveToken } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await apiFetch<{ accessToken: string }>("/auth/login", {
      method: "POST",
      body: { email, password },
    });
    setLoading(false);
    if (!res.ok || !res.data) {
      setError(pesanError(res));
      return;
    }
    saveToken(res.data.accessToken);
    router.push("/dashboard");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 text-slate-900">
      <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-[0_8px_30px_rgba(15,23,42,0.06)] ring-1 ring-slate-200 sm:p-10">
        <div className="mb-6 flex flex-col items-center">
          <NalarMark size={56} />
          <h1 className="mt-4 text-[26px] font-bold tracking-tight text-slate-900">Masuk ke Nalar</h1>
          <p className="mt-1 text-sm text-slate-500">
            Hubungkan Idemu. Temukan Pengetahuanmu.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="mb-1.5 block text-sm font-semibold text-slate-900">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full min-h-[48px] rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-slate-900 placeholder-slate-400 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
            />
          </div>
          <div>
            <label
              htmlFor="password"
              className="mb-1.5 block text-sm font-semibold text-slate-900"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full min-h-[48px] rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-slate-900 placeholder-slate-400 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
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
            {loading ? (<><Spinner /> Memproses…</>) : "Masuk"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          Belum punya akun?{" "}
          <Link
            href="/register"
            className="font-semibold text-indigo-700 hover:underline"
          >
            Daftar
          </Link>
        </p>
      </div>
    </main>
  );
}
