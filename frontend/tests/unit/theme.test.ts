import { describe, it, expect, beforeEach } from "vitest";
import { getTheme, applyTheme } from "@/lib/theme";

describe("lib/theme.ts", () => {
  beforeEach(() => {
    document.documentElement.removeAttribute("data-theme");
    localStorage.clear();
  });

  it("getTheme mengembalikan 'light' jika data-theme belum terpasang", () => {
    expect(getTheme()).toBe("light");
  });

  it("getTheme mengembalikan 'dark' jika data-theme=\"dark\"", () => {
    document.documentElement.setAttribute("data-theme", "dark");
    expect(getTheme()).toBe("dark");
  });

  it("applyTheme memasang atribut data-theme dan menyimpan ke localStorage", () => {
    applyTheme("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(localStorage.getItem("nalar_theme")).toBe("dark");

    applyTheme("light");
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    expect(localStorage.getItem("nalar_theme")).toBe("light");
  });

  it("applyTheme tetap aman dan tidak melempar error bila localStorage rusak/error", () => {
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new Error("QuotaExceeded or SecurityError");
    };

    expect(() => applyTheme("dark")).not.toThrow();
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");

    Storage.prototype.setItem = originalSetItem;
  });
});
