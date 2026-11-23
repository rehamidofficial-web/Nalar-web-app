import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useRequireAuth } from "@/lib/useRequireAuth";
import * as api from "@/lib/api";

const mockReplace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: mockReplace,
    push: vi.fn(),
  }),
}));

describe("lib/useRequireAuth", () => {
  beforeEach(() => {
    localStorage.clear();
    mockReplace.mockReset();
  });

  it("mengalihkan ke /login jika tidak ada token", () => {
    localStorage.removeItem("nalar_token");
    const { result } = renderHook(() => useRequireAuth());
    expect(mockReplace).toHaveBeenCalledWith("/login");
    expect(result.current).toBeNull();
  });

  it("mengembalikan data pengguna jika token ada dan valid", async () => {
    localStorage.setItem("nalar_token", "valid-token");
    mockReplace.mockClear();

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
    localStorage.setItem("nalar_token", "expired-token");

    vi.spyOn(api, "apiFetch").mockResolvedValueOnce({
      ok: false,
      status: 401,
      message: "Token kedaluwarsa",
    });

    const { result } = renderHook(() => useRequireAuth());

    await waitFor(() => {
      expect(localStorage.getItem("nalar_token")).toBeNull();
      expect(mockReplace).toHaveBeenCalledWith("/login");
      expect(result.current).toBeNull();
    });
  });
});
