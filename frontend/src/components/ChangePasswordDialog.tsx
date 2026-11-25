"use client";

import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from "react";
import { apiFetch, pesanError } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { Icon, Spinner, btnPrimary, btnSecondary, inputClass } from "@/components/ui";

/**
 * Dialog "Ubah password".
 *
 * Kontrak API yang dipakai (backend dikerjakan terpisah, lihat docs/PROMPT-BACKEND-UBAH-PASSWORD.md):
 *   PATCH /auth/password   body: { currentPassword, newPassword }
 *   200  -> berhasil
 *   400/422 + errors[{field, message}] -> galat per kolom (field: currentPassword | newPassword)
 *   Catatan: password lama yang salah HARUS dibalas 400, bukan 401, karena 401 membuat apiFetch
 *   menganggap sesi habis dan mengeluarkan pengguna dari akun.
 */

const MIN_PANJANG = 8;
const MAKS_BYTE = 72; // batas bcrypt, sama dengan aturan di backend

function jumlahByte(teks: string) {
  return new TextEncoder().encode(teks).length;
}

type Kekuatan = { skor: 0 | 1 | 2 | 3 | 4; label: string };

/** Penilaian kekuatan sederhana di browser (tidak dikirim ke mana pun). */
function nilaiKekuatan(pw: string): Kekuatan {
  if (!pw) return { skor: 0, label: "" };
  let skor = 0;
  if (pw.length >= MIN_PANJANG) skor++;
  if (pw.length >= 12) skor++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) skor++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) skor++;
  if (pw.length < MIN_PANJANG) skor = Math.min(skor, 1);
  const label = ["", "Lemah", "Cukup", "Bagus", "Kuat"][skor] || "Lemah";
  return { skor: skor as Kekuatan["skor"], label: skor === 0 ? "Lemah" : label };
}

const WARNA_BATANG = ["bg-slate-200", "bg-red-500", "bg-amber-500", "bg-lime-500", "bg-emerald-500"];

function IkonMata({ tampil }: { tampil: boolean }) {
  return (
    <svg
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {tampil ? (
        <>
          <path d="M3 3l18 18" />
          <path d="M10.6 5.1A9.8 9.8 0 0112 5c5 0 8.5 4.2 9.5 7a11.7 11.7 0 01-2.6 3.9M6.6 6.7A11.6 11.6 0 002.5 12c1 2.8 4.5 7 9.5 7a9.6 9.6 0 004.2-1" />
          <path d="M9.9 9.9a3 3 0 004.2 4.2" />
        </>
      ) : (
        <>
          <path d="M2.5 12C3.5 9.2 7 5 12 5s8.5 4.2 9.5 7c-1 2.8-4.5 7-9.5 7s-8.5-4.2-9.5-7z" />
          <circle cx="12" cy="12" r="3" />
        </>
      )}
    </svg>
  );
}

function KolomPassword({
  id,
  label,
  value,
  onChange,
  autoComplete,
  error,
  bantuan,
  inputRef,
  disabled,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: "current-password" | "new-password";
  error?: string;
  bantuan?: string;
  inputRef?: React.Ref<HTMLInputElement>;
  disabled?: boolean;
}) {
  const [tampil, setTampil] = useState(false);
  const idGalat = `${id}-galat`;
  const idBantuan = `${id}-bantuan`;
  const deskripsi = [error ? idGalat : null, bantuan ? idBantuan : null].filter(Boolean).join(" ") || undefined;

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-slate-900">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          ref={inputRef}
          type={tampil ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={deskripsi}
          className={`${inputClass} pr-12 ${error ? "!border-red-400 focus:!ring-red-200" : ""}`}
        />
        <button
          type="button"
          onClick={() => setTampil((v) => !v)}
          aria-label={tampil ? `Sembunyikan ${label.toLowerCase()}` : `Tampilkan ${label.toLowerCase()}`}
          aria-pressed={tampil}
          disabled={disabled}
          className="absolute right-1 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          <IkonMata tampil={tampil} />
        </button>
      </div>
      {bantuan && !error && (
        <p id={idBantuan} className="mt-1.5 text-xs text-slate-500">
          {bantuan}
        </p>
      )}
      {error && (
        <p id={idGalat} role="alert" className="mt-1.5 flex items-start gap-1.5 text-xs font-medium text-red-600">
          <Icon name="alert" className="mt-px h-4 w-4 shrink-0" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}

export function ChangePasswordDialog({
  isOpen,
  onClose,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const uid = useId();
  const idJudul = `${uid}-judul`;
  const kolomPertama = useRef<HTMLInputElement>(null);
  const pemicu = useRef<Element | null>(null);

  const [lama, setLama] = useState("");
  const [baru, setBaru] = useState("");
  const [ulang, setUlang] = useState("");
  const [sedangKirim, setSedangKirim] = useState(false);
  const [galatUmum, setGalatUmum] = useState("");
  const [galatServer, setGalatServer] = useState<{ lama?: string; baru?: string }>({});
  const [sudahCoba, setSudahCoba] = useState(false);

  // Atur ulang isian setiap dialog dibuka; kembalikan fokus ke tombol pemicu saat ditutup.
  useEffect(() => {
    if (!isOpen) return;
    pemicu.current = document.activeElement;
    const timer = window.setTimeout(() => {
      setLama("");
      setBaru("");
      setUlang("");
      setGalatUmum("");
      setGalatServer({});
      setSudahCoba(false);
      setSedangKirim(false);
      kolomPertama.current?.focus();
    }, 0);
    const pemicuSaatIni = pemicu.current;
    return () => {
      window.clearTimeout(timer);
      if (pemicuSaatIni instanceof HTMLElement) pemicuSaatIni.focus();
    };
  }, [isOpen]);

  // Esc untuk menutup, dan jangan biarkan layar di belakang ikut bergulir.
  useEffect(() => {
    if (!isOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !sedangKirim) onClose();
    }
    window.addEventListener("keydown", onKey);
    const awal = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = awal;
    };
  }, [isOpen, sedangKirim, onClose]);

  const kekuatan = useMemo(() => nilaiKekuatan(baru), [baru]);

  const syarat = useMemo(
    () => [
      { ok: baru.length >= MIN_PANJANG, teks: `Minimal ${MIN_PANJANG} karakter` },
      { ok: baru.length > 0 && jumlahByte(baru) <= MAKS_BYTE, teks: `Tidak lebih dari ${MAKS_BYTE} byte (sekitar ${MAKS_BYTE} huruf)` },
      { ok: baru.length > 0 && baru !== lama, teks: "Berbeda dari password saat ini" },
    ],
    [baru, lama],
  );

  // Galat yang dihitung di browser (ditampilkan setelah pengguna mencoba kirim)
  const galatLokal = useMemo(() => {
    const g: { lama?: string; baru?: string; ulang?: string } = {};
    if (!lama) g.lama = "Isi password saat ini.";
    if (!baru) g.baru = "Isi password baru.";
    else if (baru.length < MIN_PANJANG) g.baru = `Password baru minimal ${MIN_PANJANG} karakter.`;
    else if (jumlahByte(baru) > MAKS_BYTE) g.baru = `Password baru terlalu panjang (maksimal ${MAKS_BYTE} byte).`;
    else if (lama && baru === lama) g.baru = "Password baru harus berbeda dari password saat ini.";
    if (!ulang) g.ulang = "Ketik ulang password baru.";
    else if (ulang !== baru) g.ulang = "Password tidak sama.";
    return g;
  }, [lama, baru, ulang]);

  if (!isOpen) return null;

  const galatLama = (sudahCoba ? galatLokal.lama : undefined) ?? galatServer.lama;
  const galatBaru = (sudahCoba ? galatLokal.baru : undefined) ?? galatServer.baru;
  const galatUlang = sudahCoba ? galatLokal.ulang : undefined;

  async function kirim(e: FormEvent) {
    e.preventDefault();
    if (sedangKirim) return;
    setSudahCoba(true);
    setGalatUmum("");
    setGalatServer({});
    if (galatLokal.lama || galatLokal.baru || galatLokal.ulang) return;

    setSedangKirim(true);
    const res = await apiFetch<unknown>("/auth/password", {
      method: "PATCH",
      token: getToken(),
      body: { currentPassword: lama, newPassword: baru },
    });
    setSedangKirim(false);

    if (res.ok) {
      onSuccess?.();
      onClose();
      return;
    }

    // Fitur belum ada di server (backend belum dipasang)
    if (res.status === 404 || res.status === 405) {
      setGalatUmum("Fitur ubah password belum aktif di server. Hubungi pengembang aplikasi.");
      return;
    }

    const perKolom: { lama?: string; baru?: string } = {};
    for (const err of res.errors ?? []) {
      if (err.field === "currentPassword") perKolom.lama = err.message;
      else if (err.field === "newPassword") perKolom.baru = err.message;
    }
    if (perKolom.lama || perKolom.baru) {
      setGalatServer(perKolom);
      return;
    }
    setGalatUmum(pesanError(res));
  }

  const tombolLabel = sedangKirim ? "Menyimpan…" : "Simpan password";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !sedangKirim) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={idJudul}
        className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-6 shadow-xl ring-1 ring-slate-200 sm:rounded-2xl sm:p-7"
        style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id={idJudul} className="text-xl font-bold text-slate-900">
              Ubah password
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Pakai password panjang yang tidak kamu pakai di tempat lain.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={sedangKirim}
            aria-label="Tutup"
            className="-mr-2 -mt-1 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-50"
          >
            <Icon name="x" className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={kirim} noValidate className="mt-5 space-y-4">
          {galatUmum && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
            >
              <Icon name="alert" className="mt-0.5 h-5 w-5 shrink-0" />
              <span>{galatUmum}</span>
            </div>
          )}

          <KolomPassword
            id={`${uid}-lama`}
            label="Password saat ini"
            value={lama}
            onChange={(v) => {
              setLama(v);
              if (galatServer.lama) setGalatServer((s) => ({ ...s, lama: undefined }));
            }}
            autoComplete="current-password"
            error={galatLama}
            inputRef={kolomPertama}
            disabled={sedangKirim}
          />

          <div>
            <KolomPassword
              id={`${uid}-baru`}
              label="Password baru"
              value={baru}
              onChange={(v) => {
                setBaru(v);
                if (galatServer.baru) setGalatServer((s) => ({ ...s, baru: undefined }));
              }}
              autoComplete="new-password"
              error={galatBaru}
              disabled={sedangKirim}
            />

            {/* Indikator kekuatan */}
            <div className="mt-3" aria-live="polite">
              <div className="flex gap-1.5" aria-hidden="true">
                {[1, 2, 3, 4].map((n) => (
                  <span
                    key={n}
                    className={`h-1.5 flex-1 rounded-full transition-colors ${
                      kekuatan.skor >= n ? WARNA_BATANG[kekuatan.skor] : "bg-slate-200"
                    }`}
                  />
                ))}
              </div>
              <p className="mt-1.5 text-xs text-slate-500">
                {baru ? (
                  <>
                    Kekuatan: <span className="font-semibold text-slate-700">{kekuatan.label}</span>
                  </>
                ) : (
                  "Kekuatan password akan tampil di sini."
                )}
              </p>
            </div>

            <ul className="mt-2 space-y-1" aria-label="Syarat password baru">
              {syarat.map((s) => (
                <li
                  key={s.teks}
                  className={`flex items-center gap-2 text-xs ${s.ok ? "text-emerald-700" : "text-slate-500"}`}
                >
                  <span
                    className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${
                      s.ok ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-400"
                    }`}
                    aria-hidden="true"
                  >
                    {s.ok ? <Icon name="check" className="h-3 w-3" /> : <span className="h-1 w-1 rounded-full bg-current" />}
                  </span>
                  <span>
                    {s.teks}
                    <span className="sr-only">{s.ok ? " (terpenuhi)" : " (belum terpenuhi)"}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <KolomPassword
            id={`${uid}-ulang`}
            label="Ulangi password baru"
            value={ulang}
            onChange={setUlang}
            autoComplete="new-password"
            error={galatUlang}
            disabled={sedangKirim}
          />

          <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={onClose} disabled={sedangKirim} className={btnSecondary}>
              Batal
            </button>
            <button type="submit" disabled={sedangKirim} className={btnPrimary}>
              {sedangKirim && <Spinner />}
              {tombolLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
