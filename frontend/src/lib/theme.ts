export type ThemeName = "light" | "dark";

const THEME_KEY = "nalar_theme";

export function getTheme(): ThemeName {
  if (typeof document === "undefined") return "light";
  return document.documentElement.getAttribute("data-theme") === "dark"
    ? "dark"
    : "light";
}

export function applyTheme(theme: ThemeName) {
  document.documentElement.setAttribute("data-theme", theme);
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Penyimpanan browser tidak tersedia: tema tetap berlaku untuk sesi ini.
  }
}
