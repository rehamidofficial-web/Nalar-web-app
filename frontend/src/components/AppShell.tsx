"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { clearToken } from "@/lib/auth";
import type { User } from "@/lib/useRequireAuth";
import { Avatar, Icon, NalarMark } from "@/components/ui";

interface AppShellProps {
  user: User;
  children: React.ReactNode;
}

type NavIcon = Parameters<typeof Icon>[0]["name"];

interface MenuItem {
  name: string;
  short: string;
  href: string;
  icon: NavIcon;
  match: (pathname: string) => boolean;
  inBottomBar: boolean;
}

const MENU: MenuItem[] = [
  {
    name: "Dashboard",
    short: "Beranda",
    href: "/dashboard",
    icon: "dashboard",
    match: (p) => p === "/dashboard",
    inBottomBar: true,
  },
  {
    name: "Catatan Saya",
    short: "Catatan",
    href: "/notes",
    icon: "notes",
    match: (p) => p.startsWith("/notes"),
    inBottomBar: true,
  },
  {
    name: "Knowledge Graph",
    short: "Graph",
    href: "/graph",
    icon: "graph",
    match: (p) => p.startsWith("/graph"),
    inBottomBar: true,
  },
  {
    name: "Asisten AI",
    short: "Asisten",
    href: "/assistant",
    icon: "sparkle",
    match: (p) => p.startsWith("/assistant"),
    inBottomBar: true,
  },
  {
    name: "Pencarian",
    short: "Cari",
    href: "/search",
    icon: "search",
    match: (p) => p.startsWith("/search"),
    inBottomBar: true,
  },
  {
    name: "Pengaturan",
    short: "Atur",
    href: "/settings",
    icon: "settings",
    match: (p) => p.startsWith("/settings"),
    inBottomBar: false,
  },
];

export function AppShell({ user, children }: AppShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const hideFab =
    pathname === "/notes/new" ||
    pathname === "/assistant" ||
    pathname === "/graph" ||
    pathname.startsWith("/notes/merge");

  // Tutup menu akun saat pindah halaman
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (prevPathname !== pathname) {
    setPrevPathname(pathname);
    setMenuOpen(false);
  }

  useEffect(() => {
    if (!menuOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  function keluar() {
    clearToken();
    router.replace("/login");
  }

  function renderSidebar() {
    return (
      <div className="flex h-full flex-col justify-between px-4 py-5">
        <div>
          <Link href="/dashboard" className="flex items-center gap-3 px-2 py-1" aria-label="Nalar, ke Dashboard">
            <NalarMark size={36} />
            <span className="text-[22px] font-bold tracking-tight text-slate-900">Nalar</span>
          </Link>

          <Link
            href="/notes/new"
            className="mt-6 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700"
          >
            <Icon name="plus" className="h-5 w-5" />
            Catatan Baru
          </Link>

          <nav className="mt-6 space-y-1" aria-label="Navigasi utama">
            {MENU.map((item) => {
              const active = item.match(pathname);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-[48px] items-center gap-3 rounded-xl px-3.5 text-[15px] font-medium transition-colors ${
                    active
                      ? "bg-indigo-50 text-indigo-700"
                      : "text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  <Icon
                    name={item.icon}
                    className={`h-[22px] w-[22px] ${active ? "text-indigo-600" : "text-slate-500"}`}
                  />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="rounded-2xl bg-white p-3 ring-1 ring-slate-200">
          <div className="flex items-center gap-3">
            <Avatar name={user.name} size={40} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-900">{user.name}</p>
              <p className="truncate text-xs text-slate-500">{user.email}</p>
            </div>
            <button
              type="button"
              onClick={keluar}
              aria-label="Keluar dari akun"
              title="Keluar"
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
            >
              <Icon name="logout" className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Bilah atas khusus layar kecil */}
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 lg:hidden">
        <Link href="/dashboard" className="flex items-center gap-2.5" aria-label="Nalar, ke Dashboard">
          <NalarMark size={32} />
          <span className="text-xl font-bold tracking-tight text-slate-900">Nalar</span>
        </Link>
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          aria-label="Buka menu akun"
          aria-expanded={menuOpen}
          className="rounded-full focus-visible:outline-2"
        >
          <Avatar name={user.name} size={40} />
        </button>
      </header>

      {/* Lembar menu akun (layar kecil) */}
      {menuOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Menu akun"
          className="fixed inset-0 z-50 flex items-end bg-slate-900/50 backdrop-blur-sm lg:hidden"
          onClick={() => setMenuOpen(false)}
        >
          <div
            className="w-full rounded-t-3xl bg-white p-5 pb-8 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <Avatar name={user.name} size={44} />
              <div className="min-w-0">
                <p className="truncate font-semibold text-slate-900">{user.name}</p>
                <p className="truncate text-sm text-slate-500">{user.email}</p>
              </div>
            </div>
            <div className="mt-5 space-y-2">
              <Link
                href="/settings"
                className="flex min-h-[48px] items-center gap-3 rounded-xl px-3 text-[15px] font-medium text-slate-700 hover:bg-slate-100"
              >
                <Icon name="settings" className="h-5 w-5 text-slate-500" />
                Pengaturan
              </Link>
              <button
                type="button"
                onClick={keluar}
                className="flex min-h-[48px] w-full items-center gap-3 rounded-xl px-3 text-left text-[15px] font-medium text-red-600 hover:bg-red-50"
              >
                <Icon name="logout" className="h-5 w-5" />
                Keluar
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex">
        {/* Sidebar desktop */}
        <aside className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-[272px] lg:flex-col lg:border-r lg:border-slate-200 lg:bg-white">
          {renderSidebar()}
        </aside>

        <main className="min-w-0 flex-1 pb-24 lg:pb-0 lg:pl-[272px]">
          <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-9">{children}</div>
        </main>
      </div>

      {/* Tombol tambah mengambang (layar kecil) */}
      {!hideFab && (
        <Link
          href="/notes/new"
          aria-label="Catatan baru"
          className="fixed bottom-24 right-5 z-30 inline-flex h-14 w-14 items-center justify-center rounded-full bg-indigo-600 text-white shadow-[0_8px_24px_rgba(79,70,229,0.4)] transition-colors hover:bg-indigo-700 lg:hidden"
        >
          <Icon name="plus" className="h-7 w-7" />
        </Link>
      )}

      {/* Navigasi bawah (layar kecil) */}
      <nav
        aria-label="Navigasi utama"
        className="fixed inset-x-0 bottom-0 z-40 flex h-[4.25rem] items-stretch border-t border-slate-200 bg-white lg:hidden"
      >
        {MENU.filter((m) => m.inBottomBar).map((item) => {
          const active = item.match(pathname);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors ${
                active ? "text-indigo-600" : "text-slate-600"
              }`}
            >
              <Icon name={item.icon} className="h-6 w-6" />
              {item.short}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
