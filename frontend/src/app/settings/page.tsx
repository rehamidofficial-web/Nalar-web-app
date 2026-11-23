"use client";

import { useEffect, useState } from "react";
import { useRequireAuth } from "@/lib/useRequireAuth";
import { AppShell } from "@/components/AppShell";
import { Avatar, PageHeader, cardClass, inputClass } from "@/components/ui";
import { applyTheme, getTheme, type ThemeName } from "@/lib/theme";

type PanjangRingkasan = "pendek" | "sedang" | "rinci";
type BahasaJawaban = "sama" | "id" | "en";

interface PrefAI {
  panjang: PanjangRingkasan;
  cariKonsep: boolean;
  sarankanTerkait: boolean;
  bahasa: BahasaJawaban;
}

const PREF_KEY = "nalar_ai_prefs";
const PREF_AWAL: PrefAI = {
  panjang: "sedang",
  cariKonsep: true,
  sarankanTerkait: true,
  bahasa: "sama",
};

function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${
        checked ? "bg-indigo-600" : "bg-slate-300"
      }`}
    >
      <span
        className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-6" : "translate-x-1"
        }`}
        style={{ backgroundColor: "#fff" }}
      />
    </button>
  );
}

function Baris({
  judul,
  isi,
  children,
}: {
  judul: string;
  isi: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 border-t border-slate-100 py-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-900">{judul}</p>
        <p className="mt-0.5 text-sm text-slate-500">{isi}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export default function SettingsPage() {
  const user = useRequireAuth();
  const [theme, setTheme] = useState<ThemeName>("light");
  const [pref, setPref] = useState<PrefAI>(PREF_AWAL);
  const [tersimpan, setTersimpan] = useState(false);

  // Baca tema aktif dan preferensi tersimpan setelah halaman tampil di browser
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setTheme(getTheme());
      try {
        const raw = window.localStorage.getItem(PREF_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as Partial<PrefAI>;
          setPref({ ...PREF_AWAL, ...parsed });
        }
      } catch {
        // Gunakan nilai awal bila data tersimpan rusak.
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function pilihTema(next: ThemeName) {
    setTheme(next);
    applyTheme(next);
  }

  function ubahPref(patch: Partial<PrefAI>) {
    setPref((prev) => {
      const next = { ...prev, ...patch };
      try {
        window.localStorage.setItem(PREF_KEY, JSON.stringify(next));
      } catch {
        // Abaikan bila penyimpanan browser diblokir.
      }
      return next;
    });
    setTersimpan(true);
    window.setTimeout(() => setTersimpan(false), 1800);
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-slate-500">Memuat...</p>
      </div>
    );
  }

  const bagian = [
    ["profil", "Profil"],
    ["akun", "Akun"],
    ["tampilan", "Tampilan"],
    ["ai", "Preferensi AI"],
  ];

  return (
    <AppShell user={user}>
      <PageHeader
        title="Pengaturan"
        subtitle="Atur profilmu, tampilan Nalar, dan cara AI membantumu."
      />

      <div className="grid gap-6 lg:grid-cols-[200px_minmax(0,1fr)]">
        <nav aria-label="Bagian pengaturan" className="hidden lg:block">
          <ul className="sticky top-8 space-y-1">
            {bagian.map(([id, label]) => (
              <li key={id}>
                <a
                  href={`#${id}`}
                  className="block rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                >
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="space-y-6">
          {/* Profil */}
          <section id="profil" className={`${cardClass} scroll-mt-8 p-6 sm:p-8`} aria-labelledby="h-profil">
            <h2 id="h-profil" className="text-xl font-bold text-slate-900">
              Profil
            </h2>
            <p className="mt-1 text-sm text-slate-500">Begini kamu tampil di dalam Nalar.</p>
            <div className="mt-6 flex items-center gap-4">
              <Avatar name={user.name} size={72} />
              <div className="min-w-0">
                <p className="truncate text-lg font-bold text-slate-900">{user.name}</p>
                <p className="truncate text-sm text-slate-500">{user.email}</p>
              </div>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="nama" className="mb-1.5 block text-sm font-semibold text-slate-900">
                  Nama
                </label>
                <input id="nama" value={user.name} readOnly className={`${inputClass} bg-slate-50`} />
              </div>
              <div>
                <label htmlFor="surel" className="mb-1.5 block text-sm font-semibold text-slate-900">
                  Email
                </label>
                <input id="surel" value={user.email} readOnly className={`${inputClass} bg-slate-50`} />
              </div>
            </div>
            <p className="mt-3 text-xs text-slate-500">
              Mengubah nama dan email belum tersedia. Fitur ini menyusul.
            </p>
          </section>

          {/* Akun */}
          <section id="akun" className={`${cardClass} scroll-mt-8 p-6 sm:p-8`} aria-labelledby="h-akun">
            <h2 id="h-akun" className="text-xl font-bold text-slate-900">
              Akun
            </h2>
            <p className="mt-1 text-sm text-slate-500">Jaga akunmu tetap aman.</p>
            <div className="mt-4">
              <Baris judul="Password" isi="Pakai password panjang yang tidak kamu pakai di tempat lain.">
                <button
                  type="button"
                  disabled
                  className="min-h-[44px] cursor-not-allowed rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-500 opacity-60"
                >
                  Ubah password · segera
                </button>
              </Baris>
              <Baris
                judul="Hapus akun"
                isi="Semua catatanmu ikut terhapus dan tidak bisa dikembalikan. Kami akan minta konfirmasi dulu."
              >
                <button
                  type="button"
                  disabled
                  className="min-h-[44px] cursor-not-allowed rounded-xl border border-red-200 bg-white px-4 text-sm font-semibold text-red-600 opacity-60"
                >
                  Hapus akun · segera
                </button>
              </Baris>
            </div>
          </section>

          {/* Tampilan */}
          <section id="tampilan" className={`${cardClass} scroll-mt-8 p-6 sm:p-8`} aria-labelledby="h-tampilan">
            <h2 id="h-tampilan" className="text-xl font-bold text-slate-900">
              Tampilan
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Pilih tampilan yang nyaman untuk matamu. Perubahan langsung berlaku.
            </p>

            <div className="mt-5 grid max-w-xl grid-cols-2 gap-4" role="radiogroup" aria-label="Tema tampilan">
              {(
                [
                  ["light", "Terang"],
                  ["dark", "Gelap"],
                ] as const
              ).map(([value, label]) => {
                const aktif = theme === value;
                return (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={aktif}
                    onClick={() => pilihTema(value)}
                    className={`rounded-2xl border-2 p-3 text-left transition-colors ${
                      aktif ? "border-indigo-600 bg-indigo-50" : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <span
                      className="block rounded-xl p-3"
                      style={{ background: value === "dark" ? "#0b1020" : "#f8fafc", border: "1px solid rgba(100,116,139,.25)" }}
                    >
                      <span className="block h-2 w-3/5 rounded-full" style={{ background: value === "dark" ? "#818cf8" : "#4f46e5" }} />
                      <span className="mt-2 block h-1.5 w-full rounded-full" style={{ background: value === "dark" ? "#26304a" : "#cbd5e1" }} />
                      <span className="mt-1.5 block h-1.5 w-4/5 rounded-full" style={{ background: value === "dark" ? "#26304a" : "#cbd5e1" }} />
                    </span>
                    <span className="mt-3 block text-sm font-semibold text-slate-900">{label}</span>
                  </button>
                );
              })}
            </div>

            <div className="mt-5">
              <Baris judul="Mode gelap" isi="Warna lebih lembut saat cahaya redup.">
                <Switch
                  checked={theme === "dark"}
                  onChange={(v) => pilihTema(v ? "dark" : "light")}
                  label="Mode gelap"
                />
              </Baris>
            </div>
          </section>

          {/* Preferensi AI */}
          <section id="ai" className={`${cardClass} scroll-mt-8 p-6 sm:p-8`} aria-labelledby="h-ai">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="h-ai" className="text-xl font-bold text-slate-900">
                  Preferensi AI
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Atur cara AI bekerja dengan catatanmu. Catatanmu tidak pernah dibagikan ke pengguna lain.
                </p>
              </div>
              <span
                aria-live="polite"
                className={`shrink-0 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 transition-opacity ${
                  tersimpan ? "opacity-100" : "opacity-0"
                }`}
              >
                Tersimpan
              </span>
            </div>

            <div className="mt-4">
              <Baris judul="Panjang ringkasan" isi="Seberapa panjang ringkasan AI.">
                <div
                  role="radiogroup"
                  aria-label="Panjang ringkasan"
                  className="inline-flex rounded-xl border border-slate-200 bg-white p-1"
                >
                  {(
                    [
                      ["pendek", "Pendek"],
                      ["sedang", "Sedang"],
                      ["rinci", "Rinci"],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={pref.panjang === value}
                      onClick={() => ubahPref({ panjang: value })}
                      className={`min-h-[40px] rounded-lg px-4 text-sm font-semibold transition-colors ${
                        pref.panjang === value
                          ? "bg-indigo-50 text-indigo-700"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </Baris>
              <Baris judul="Cari konsep utama saat menyimpan" isi="Nalar mencari ide penting di tiap catatan baru.">
                <Switch
                  checked={pref.cariKonsep}
                  onChange={(v) => ubahPref({ cariKonsep: v })}
                  label="Cari konsep utama saat menyimpan"
                />
              </Baris>
              <Baris judul="Sarankan catatan terkait" isi="Tampilkan catatan serupa di samping yang sedang kamu baca.">
                <Switch
                  checked={pref.sarankanTerkait}
                  onChange={(v) => ubahPref({ sarankanTerkait: v })}
                  label="Sarankan catatan terkait"
                />
              </Baris>
              <Baris judul="Bahasa jawaban" isi="Bahasa yang dipakai asisten saat menjawab.">
                <select
                  value={pref.bahasa}
                  onChange={(e) => ubahPref({ bahasa: e.target.value as BahasaJawaban })}
                  aria-label="Bahasa jawaban"
                  className={`${inputClass} sm:w-60`}
                >
                  <option value="sama">Sama dengan pertanyaanku</option>
                  <option value="id">Bahasa Indonesia</option>
                  <option value="en">English</option>
                </select>
              </Baris>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Pilihan ini disimpan di browser ini. Penerapannya ke AI menyusul.
            </p>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
