import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useRequireAuth } from "@/lib/useRequireAuth";
import * as api from "@/lib/api";

const mockReplace = vi.fn();
const mockRouter = {
  replace: mockReplace,
  push: vi.fn(),
};

vi.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
}));

vi.mock("@/lib/auth", () => ({
  getToken: vi.fn(),
  clearToken: vi.fn(),
  saveToken: vi.fn(),
}));

import { getToken, clearToken } from "@/lib/auth";

describe("lib/useRequireAuth", () => {
  beforeEach(() => {
    mockReplace.mockReset();
    vi.mocked(getToken).mockReset();
    vi.mocked(clearToken).mockReset();
  });

  it("mengalihkan ke /login jika tidak ada token", () => {
    vi.mocked(getToken).mockReturnValue(null);
    const { result } = renderHook(() => useRequireAuth());
    expect(mockReplace).toHaveBeenCalledWith("/login");
    expect(result.current).toBeNull();
  });

  it("mengembalikan data pengguna jika token ada dan valid", async () => {
    vi.mocked(getToken).mockReturnValue("valid-token");

    vi.spyOn(api, "apiFetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      message: "OK",
      data: {
        user: { id: "u1", name: "Pengguna Uji", email: "uji@nalar.app" },
      },
    });

    const { result } = renderHook(() => useRequireAuth());

    await waitFor(() => {
      expect(result.current).toEqual({
        id: "u1",
        name: "Pengguna Uji",
        email: "uji@nalar.app",
      });
    });

    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("menghapus token dan mengalihkan ke /login jika /auth/me gagal", async () => {
    vi.mocked(getToken).mockReturnValue("expired-token");

    vi.spyOn(api, "apiFetch").mockResolvedValueOnce({
      ok: false,
      status: 401,
      message: "Token kedaluwarsa",
    });

    const { result } = renderHook(() => useRequireAuth());

    await waitFor(() => {
      expect(clearToken).toHaveBeenCalled();
      expect(mockReplace).toHaveBeenCalledWith("/login");
      expect(result.current).toBeNull();
    });
  });
});
