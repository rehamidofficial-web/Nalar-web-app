import { clearToken } from "./auth";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

export type ApiResult<T> = {
  ok: boolean;
  status: number;
  message: string;
  data?: T;
  errors?: { field?: string; message: string }[];
  retryAfter?: number; // Detik dari header Retry-After bila terkena 429
};

/**
 * Memetakan hasil API atau error ke pesan ramah bahasa Indonesia.
 */
export function pesanError(res: ApiResult<unknown>): string {
  // 1. Jika ada pesan spesifik dari server (message) dan bukan kosong
  if (res.message && res.message.trim().length > 0) {
    return res.message;
  }

  // 2. Jika ada rincian errors dari validasi
  if (res.errors && res.errors.length > 0) {
    return res.errors.map((e) => e.message).join(". ");
  }

  // 3. Pemetaan berdasarkan kode status HTTP
  switch (res.status) {
    case 0:
      return "Tidak bisa terhubung. Periksa koneksi internetmu lalu coba lagi.";
    case 400:
      return "Format data yang dikirim tidak valid.";
    case 401:
      return "Sesi tidak valid atau sudah berakhir. Silakan masuk lagi.";
    case 403:
      return "Kamu tidak memiliki akses untuk tindakan ini.";
    case 404:
      return "Data atau halaman tidak ditemukan.";
    case 409:
      return "Data sudah ada atau terjadi konflik.";
    case 413:
      return "Data yang dikirim terlalu besar.";
    case 422:
      return "Validasi data gagal. Periksa kembali isian formulir.";
    case 429:
      if (res.retryAfter && res.retryAfter > 0) {
        return `Terlalu banyak permintaan. Coba lagi sekitar ${res.retryAfter} detik lagi.`;
      }
      return "Terlalu banyak permintaan. Coba lagi sebentar lagi.";
    case 503:
    case 504:
      return "Layanan sedang sibuk, coba lagi sebentar.";
    default:
      if (res.status >= 500) {
        return "Terjadi kesalahan di server. Coba lagi nanti.";
      }
      return "Terjadi kesalahan tak terduga.";
  }
}

export async function apiFetch<T>(
  path: string,
  options: { method?: string; body?: unknown; token?: string | null } = {},
): Promise<ApiResult<T>> {
  let response: Response;

  try {
    response = await fetch(`${API_URL}${path}`, {
      method: options.method ?? "GET",
      headers: {
        "Content-Type": "application/json",
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    // Tangani kegagalan jaringan sungguhan (fetch melempar error)
    return {
      ok: false,
      status: 0,
      message: "Tidak bisa terhubung. Periksa koneksi internetmu lalu coba lagi.",
    };
  }

  // Tangani 401: sesi habis (kecuali untuk rute auth)
  if (
    response.status === 401 &&
    typeof window !== "undefined" &&
    !path.startsWith("/auth/login") &&
    !path.startsWith("/auth/register")
  ) {
    clearToken();
    if (window.location.pathname !== "/login") {
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = "/login";
    }
  }

  // Baca header Retry-After bila ada (misal pada 429)
  const retryAfterHeader = response.headers.get("Retry-After");
  const retryAfter = retryAfterHeader ? parseInt(retryAfterHeader, 10) : undefined;

  // Baca respons JSON dengan aman (antisipasi jika server mengirim non-JSON / HTML)
  let json: { message?: string; data?: T; errors?: { field?: string; message: string }[] } | null = null;
  try {
    json = (await response.json()) as {
      message?: string;
      data?: T;
      errors?: { field?: string; message: string }[];
    };
  } catch {
    // Non-JSON response
    const statusMsg = response.status >= 500
      ? "Terjadi kesalahan di server. Coba lagi nanti."
      : response.status === 429
      ? "Terlalu banyak permintaan. Coba lagi sebentar lagi."
      : "Terjadi kesalahan pada respons server.";

    return {
      ok: response.ok,
      status: response.status,
      message: statusMsg,
      retryAfter: !isNaN(Number(retryAfter)) ? retryAfter : undefined,
    };
  }

  return {
    ok: response.ok,
    status: response.status,
    message: json?.message ?? "",
    data: json?.data,
    errors: json?.errors,
    retryAfter: !isNaN(Number(retryAfter)) ? retryAfter : undefined,
  };
}
