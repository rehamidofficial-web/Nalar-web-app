"use client";

interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  onPageChange: (newPage: number) => void;
  disabled?: boolean;
}

export function Pagination({
  page,
  totalPages,
  onPageChange,
  disabled = false,
}: PaginationProps) {
  if (totalPages <= 1) return null;

  const btn =
    "inline-flex min-h-[44px] items-center justify-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <nav
      aria-label="Halaman daftar catatan"
      className="mt-8 flex items-center justify-between gap-4"
    >
      <p className="text-sm text-slate-500">
        Halaman {page} dari {totalPages}
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1 || disabled}
          className={btn}
        >
          Sebelumnya
        </button>
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages || disabled}
          className={btn}
        >
          Berikutnya
        </button>
      </div>
    </nav>
  );
}
