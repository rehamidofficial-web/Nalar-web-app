const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

export type ApiResult<T> = {
  ok: boolean;
  status: number;
  message: string;
  data?: T;
  errors?: { field: string; message: string }[];
};

export function pesanError(res: ApiResult<unknown>) {
  if (res.errors && res.errors.length > 0) {
    return res.errors.map((e) => e.message).join(". ");
  }
  return res.message;
}

export async function apiFetch<T>(
  path: string,
  options: { method?: string; body?: unknown; token?: string | null } = {},
): Promise<ApiResult<T>> {
  try {
    const res = await fetch(`${API_URL}${path}`, {
      method: options.method ?? "GET",
      headers: {
        "Content-Type": "application/json",
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    const json = await res.json();
    return {
      ok: res.ok,
      status: res.status,
      message: json.message ?? "",
      data: json.data,
      errors: json.errors,
    };
  } catch {
    return {
      ok: false,
      status: 0,
      message:
        "Tidak bisa terhubung ke server. Pastikan backend sedang menyala.",
    };
  }
}
