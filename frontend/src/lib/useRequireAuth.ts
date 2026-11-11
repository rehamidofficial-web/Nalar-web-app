"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "./api";
import { getToken, clearToken } from "./auth";

export type User = { id: string; name: string; email: string };

export function useRequireAuth() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    apiFetch<{ user: User }>("/auth/me", { token }).then((res) => {
      if (res.ok && res.data) {
        setUser(res.data.user);
      } else {
        clearToken();
        router.replace("/login");
      }
    });
  }, [router]);

  return user;
}
