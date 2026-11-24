import type { ReactNode } from "react";

/* ---------- Logo ---------- */
export function NalarMark({ size = 36 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      role="img"
      aria-label="Nalar"
      className="shrink-0"
    >
      <rect width="48" height="48" rx="12" fill="#4F46E5" />
      <path
        d="M13 33 L20 15 L31 25 L36 12"
        fill="none"
        stroke="#fff"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="13" cy="33" r="3.4" fill="#fff" />
      <circle cx="20" cy="15" r="3.4" fill="#fff" />
      <circle cx="31" cy="25" r="3.4" fill="#fff" />
      <circle cx="36" cy="12" r="3.4" fill="#C7D2FE" />
    </svg>
  );
}

/* ---------- Ikon (gaya garis 1.8px) ---------- */
type IconName =
  | "dashboard"
  | "notes"
  | "graph"
  | "sparkle"
  | "search"
  | "settings"
  | "plus"
  | "minus"
  | "arrow-right"
  | "arrow-left"
  | "grid"
  | "list"
  | "more"
  | "check"
  | "alert"
  | "info"
  | "logout"
  | "link"
  | "x"
  | "merge"
  | "edit"
  | "trash"
  | "send";

const PATHS: Record<IconName, ReactNode> = {
  dashboard: (
    <>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.6" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.6" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.6" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.6" />
    </>
  ),
  notes: (
    <>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5" />
      <path d="M9 13h6M9 17h4" />
    </>
  ),
  graph: (
    <>
      <circle cx="6" cy="12" r="2.6" />
      <circle cx="18" cy="5.5" r="2.6" />
      <circle cx="18" cy="18.5" r="2.6" />
      <path d="m8.3 10.8 7.4-4M8.3 13.2l7.4 4" />
    </>
  ),
  sparkle: (
    <>
      <path d="M9.5 4.5 11 9l4.5 1.5L11 12l-1.5 4.5L8 12 3.5 10.5 8 9z" />
      <path d="M18 3.5v4M16 5.5h4M17.5 14.5v5M15 17h5" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20 20-4.2-4.2" />
    </>
  ),
  settings: (
    <>
      <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
      <circle cx="15" cy="7" r="2.2" />
      <circle cx="9" cy="17" r="2.2" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  "arrow-right": <path d="M5 12h14M13 6l6 6-6 6" />,
  "arrow-left": <path d="M19 12H5M11 6l-6 6 6 6" />,
  grid: (
    <>
      <rect x="4" y="4" width="6.5" height="6.5" rx="1.4" />
      <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.4" />
      <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.4" />
      <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.4" />
    </>
  ),
  list: <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />,
  more: (
    <>
      <circle cx="5.5" cy="12" r="1.4" fill="currentColor" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" />
      <circle cx="18.5" cy="12" r="1.4" fill="currentColor" />
    </>
  ),
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  alert: (
    <>
      <path d="M12 8v5M12 16.5h.01" />
      <circle cx="12" cy="12" r="9" />
    </>
  ),
  info: (
    <>
      <path d="M12 11v5M12 7.5h.01" />
      <circle cx="12" cy="12" r="9" />
    </>
  ),
  logout: (
    <>
      <path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4" />
      <path d="M15 8l4 4-4 4M19 12H9" />
    </>
  ),
  link: (
    <>
      <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
      <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
    </>
  ),
  x: <path d="M6 6l12 12M18 6 6 18" />,
  merge: (
    <>
      <circle cx="6" cy="6" r="2.4" />
      <circle cx="6" cy="18" r="2.4" />
      <circle cx="18" cy="12" r="2.4" />
      <path d="M8.2 7.2c4 1 5 2.6 7.4 3.6M8.2 16.8c4-1 5-2.6 7.4-3.6" />
    </>
  ),
  edit: (
    <>
      <path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17z" />
      <path d="m14.5 7.5 3 3" />
    </>
  ),
  trash: (
    <>
      <path d="M4 7h16M10 11v6M14 11v6" />
      <path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
    </>
  ),
  send: <path d="M5 12h14M13 6l6 6-6 6" />,
};

export function Icon({
  name,
  className = "h-5 w-5",
}: {
  name: IconName;
  className?: string;
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  );
}

/* ---------- Pembantu tampilan ---------- */
export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  const huruf = (name.trim().charAt(0) || "?").toUpperCase();
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-indigo-600 font-bold text-white"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
      aria-hidden="true"
    >
      {huruf}
    </span>
  );
}

export function Spinner({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} fill="none" viewBox="0 0 24 24" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  );
}

/** Judul halaman: judul besar + subjudul, tombol aksi di kanan. */
export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-[28px] font-bold leading-tight tracking-tight text-slate-900">
          {title}
        </h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/** Kartu putih standar desain: sudut 16px, garis tipis. */
export const cardClass =
  "rounded-2xl bg-white ring-1 ring-slate-200 shadow-[0_1px_2px_rgba(15,23,42,0.04)]";

export const btnPrimary =
  "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50";

export const btnSecondary =
  "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50";

export const btnDanger =
  "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50";

export const inputClass =
  // text-base di HP (16px) supaya iPhone tidak memperbesar halaman saat kolom diketuk
  "w-full min-h-[44px] rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-base text-slate-900 placeholder-slate-400 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 disabled:opacity-50 sm:text-sm";

export const chipClass =
  "inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700";
