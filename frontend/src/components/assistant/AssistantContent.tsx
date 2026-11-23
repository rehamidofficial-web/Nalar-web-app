"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useRequireAuth } from "@/lib/useRequireAuth";
import { AppShell } from "@/components/AppShell";
import { apiFetch, pesanError } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { Icon, PageHeader, Spinner } from "@/components/ui";
import type {
  AssistantMessage,
  ConversationSummary,
  AskResponseData,
  ConversationDetailData,
} from "@/types/assistant";

const CONTOH_PERTANYAAN = [
  "Apa kesimpulan dari catatan yang baru saya tulis?",
  "Jelaskan hubungan antar konsep di catatanku",
  "Rangkum hal terpenting yang perlu kuingat minggu ini",
];

export function AssistantContent() {
  const user = useRequireAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Sinkronisasi percakapan aktif dari URL (?c=<id>)
  const urlConvId = searchParams.get("c") || "";
  const [prevUrlConvId, setPrevUrlConvId] = useState(urlConvId);
  const [currentConvId, setCurrentConvId] = useState<string | null>(urlConvId || null);

  if (prevUrlConvId !== urlConvId) {
    setPrevUrlConvId(urlConvId);
    setCurrentConvId(urlConvId || null);
  }

  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [inputQuestion, setInputQuestion] = useState(searchParams.get("tanya") ?? "");

  const [isLoadingList, setIsLoadingList] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");
  const [lastMode, setLastMode] = useState<"makna" | "kata">("makna");

  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const activeReqIdRef = useRef(0);
  const messageCounterRef = useRef(0);

  // Auto-scroll ke pesan terbawah
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isSending]);

  // 1. Muat daftar percakapan
  const loadConversations = useCallback(() => {
    const token = getToken();
    if (!token) {
      setIsLoadingList(false);
      return;
    }

    apiFetch<ConversationSummary[]>("/ai/conversations?limit=30", { token })
      .then((res) => {
        if (res.ok && res.data) {
          setConversations(res.data);
        }
      })
      .finally(() => {
        setIsLoadingList(false);
      });
  }, []);

  useEffect(() => {
    let isCancelled = false;
    const token = getToken();
    if (!token) return;

    apiFetch<ConversationSummary[]>("/ai/conversations?limit=30", { token })
      .then((res) => {
        if (isCancelled) return;
        if (res.ok && res.data) {
          setConversations(res.data);
        }
      })
      .finally(() => {
        if (!isCancelled) {
          setIsLoadingList(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, []);

  // 2. Muat percakapan detail saat currentConvId berubah
  useEffect(() => {
    if (!currentConvId) {
      return;
    }

    const token = getToken();
    if (!token) return;

    const reqId = ++activeReqIdRef.current;

    apiFetch<ConversationDetailData>(`/ai/conversations/${currentConvId}`, { token })
      .then((res) => {
        if (reqId !== activeReqIdRef.current) return;
        setIsLoadingMessages(false);
        if (res.ok && res.data) {
          setMessages(res.data.messages || []);
        } else {
          setErrorMessage(pesanError(res));
        }
      })
      .catch(() => {
        if (reqId === activeReqIdRef.current) {
          setIsLoadingMessages(false);
          setErrorMessage("Gagal memuat percakapan.");
        }
      });
  }, [currentConvId]);

  // 3. Mulai percakapan baru (reset ke state kosong)
  const handleNewConversation = () => {
    setCurrentConvId(null);
    setMessages([]);
    setInputQuestion("");
    setErrorMessage("");
    router.push("/assistant");
    setMobileDrawerOpen(false);
  };

  // 4. Pilih percakapan dari daftar
  const handleSelectConversation = (id: string) => {
    if (id === currentConvId) return;
    setCurrentConvId(id);
    setIsLoadingMessages(true);
    setMessages([]);
    setErrorMessage("");
    router.push(`/assistant?c=${id}`);
    setMobileDrawerOpen(false);
  };

  // 5. Hapus percakapan
  const handleDeleteConversation = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!window.confirm("Hapus percakapan ini? Semua pesan di dalamnya akan dihapus.")) {
      return;
    }

    const token = getToken();
    if (!token) return;

    try {
      const res = await apiFetch(`/ai/conversations/${id}`, {
        method: "DELETE",
        token,
      });

      if (res.ok) {
        setConversations((prev) => prev.filter((c) => c.id !== id));
        if (currentConvId === id) {
          handleNewConversation();
        }
      } else {
        alert(pesanError(res));
      }
    } catch {
      alert("Gagal menghapus percakapan.");
    }
  };

  // 6. Kirim pertanyaan ke AI
  const handleSend = async (questionToSend?: string) => {
    const q = (questionToSend || inputQuestion).trim();
    if (!q || isSending) return;

    const token = getToken();
    if (!token) return;

    messageCounterRef.current += 1;
    const tempId = `temp-${messageCounterRef.current}`;

    const tempUserMessage: AssistantMessage = {
      id: tempId,
      role: "user",
      content: q,
      createdAt: "",
    };

    setMessages((prev) => [...prev, tempUserMessage]);
    setInputQuestion("");
    setIsSending(true);
    setErrorMessage("");

    const targetConvIdAtSend = currentConvId;

    try {
      const res = await apiFetch<AskResponseData>("/ai/ask", {
        method: "POST",
        token,
        body: {
          conversationId: targetConvIdAtSend,
          question: q,
        },
      });

      if (!res.ok) {
        setErrorMessage(pesanError(res));
        // Kembalikan teks ke input agar tidak hilang saat error
        setInputQuestion(q);
        // Hapus pesan sementara yang belum terjawab
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        return;
      }

      if (res.data) {
        const { conversationId, answer, sources, mode, koreksi } = res.data;
        setLastMode(mode);

        // Jika ada koreksi kata, update pesan pengguna yang tadi dikirim
        if (koreksi) {
          setMessages((prev) =>
            prev.map((m) => (m.id === tempId ? { ...m, koreksi } : m))
          );
        }

        messageCounterRef.current += 1;
        const newAssistantMessage: AssistantMessage = {
          id: `asst-${messageCounterRef.current}`,
          role: "assistant",
          content: answer,
          sources: sources.length > 0 ? sources : null,
          createdAt: "",
        };

        // Jika ini percakapan baru, sinkronkan ID ke URL dan reload list
        if (!targetConvIdAtSend) {
          setCurrentConvId(conversationId);
          router.replace(`/assistant?c=${conversationId}`);
          loadConversations();
        }

        setMessages((prev) => [...prev, newAssistantMessage]);
      }
    } catch {
      setErrorMessage("Gagal menghubungkan ke server asisten.");
      setInputQuestion(q);
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-sm text-slate-500">Memuat...</p>
      </div>
    );
  }

  return (
    <AppShell user={user}>
      <PageHeader
        title="Asisten AI"
        subtitle="Ajukan pertanyaan dan dapatkan jawaban yang hanya berdasarkan catatanmu sendiri."
        action={
          <button
            type="button"
            onClick={() => setMobileDrawerOpen(true)}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 lg:hidden"
          >
            <Icon name="list" className="h-4 w-4" />
            Riwayat
          </button>
        }
      />

      <div className="grid h-[calc(100dvh-17rem)] min-h-[520px] gap-5 lg:h-[calc(100dvh-13rem)] lg:grid-cols-[300px_minmax(0,1fr)]">
        {/* Daftar percakapan (desktop) / laci (layar kecil) */}
        {mobileDrawerOpen && (
          <div
            className="fixed inset-0 z-40 bg-slate-900/40 lg:hidden"
            onClick={() => setMobileDrawerOpen(false)}
            aria-hidden="true"
          />
        )}
        <aside
          aria-label="Riwayat percakapan"
          className={`z-50 flex flex-col rounded-2xl bg-white p-4 ring-1 ring-slate-200 ${
            mobileDrawerOpen
              ? "fixed inset-x-4 bottom-24 top-24"
              : "hidden lg:flex"
          }`}
        >
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleNewConversation}
              className="flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-50"
            >
              <Icon name="plus" className="h-4 w-4" />
              Percakapan baru
            </button>
            {mobileDrawerOpen && (
              <button
                type="button"
                onClick={() => setMobileDrawerOpen(false)}
                aria-label="Tutup riwayat"
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 lg:hidden"
              >
                <Icon name="x" className="h-5 w-5" />
              </button>
            )}
          </div>

          <p className="mb-2 mt-5 px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Percakapan
          </p>

          <div className="-mx-1 flex-1 space-y-1 overflow-y-auto px-1">
            {isLoadingList ? (
              <p className="p-3 text-center text-xs text-slate-500">Memuat riwayat…</p>
            ) : conversations.length === 0 ? (
              <p className="p-3 text-center text-sm text-slate-500">
                Belum ada percakapan. Mulai dengan satu pertanyaan.
              </p>
            ) : (
              conversations.map((c) => {
                const isActive = c.id === currentConvId;
                return (
                  <div
                    key={c.id}
                    className={`group flex items-center gap-1 rounded-xl transition-colors ${
                      isActive ? "bg-indigo-50" : "hover:bg-slate-50"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => handleSelectConversation(c.id)}
                      aria-current={isActive ? "true" : undefined}
                      className="min-w-0 flex-1 px-3 py-2.5 text-left"
                    >
                      <span
                        className={`block truncate text-sm font-semibold ${
                          isActive ? "text-indigo-700" : "text-slate-900"
                        }`}
                      >
                        {c.title || "Percakapan baru"}
                      </span>
                      <span className="block text-xs text-slate-500">{c.jumlahPesan} pesan</span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleDeleteConversation(e, c.id)}
                      className="mr-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 opacity-100 transition hover:bg-red-50 hover:text-red-600 lg:opacity-0 lg:group-hover:opacity-100 lg:focus-visible:opacity-100"
                      title="Hapus percakapan"
                      aria-label={`Hapus percakapan ${c.title || "tanpa judul"}`}
                    >
                      <Icon name="trash" className="h-4 w-4" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </aside>

        {/* Area obrolan */}
        <section
          className="flex min-h-0 flex-col overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200"
          aria-label="Percakapan dengan Asisten AI"
        >
          {lastMode === "kata" && (
            <div className="border-b border-amber-200 bg-amber-50 px-5 py-2.5 text-xs text-amber-800">
              Pencarian makna sedang tidak tersedia, jawaban dibuat dari pencarian kata biasa.
            </div>
          )}

          <div className="flex-1 space-y-6 overflow-y-auto px-4 py-5 sm:px-8 sm:py-7" role="log" aria-live="polite">
            {isLoadingMessages ? (
              <div className="flex h-48 items-center justify-center gap-2 text-sm text-slate-500">
                <Spinner className="h-5 w-5 text-indigo-600" />
                Memuat percakapan…
              </div>
            ) : messages.length === 0 ? (
              <div className="mx-auto my-10 max-w-md text-center">
                <span className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
                  <Icon name="sparkle" className="h-7 w-7" />
                </span>
                <h2 className="mt-4 text-xl font-bold text-slate-900">Mau tahu apa dari catatanmu?</h2>
                <p className="mt-1.5 text-sm text-slate-500">
                  Aku mencari catatanmu yang paling nyambung, lalu menjawab hanya dari isinya.
                </p>
                <p className="mt-3 text-xs text-slate-500">
                  Isi catatan yang relevan diproses oleh layanan AI. Hindari menulis informasi yang sangat
                  sensitif.
                </p>
              </div>
            ) : (
              messages.map((msg) => {
                const isUser = msg.role === "user";
                if (isUser) {
                  return (
                    <div key={msg.id} className="flex flex-col items-end">
                      <div className="max-w-[88%] rounded-2xl rounded-br-md bg-indigo-600 px-5 py-3 text-[15px] leading-relaxed text-white sm:max-w-xl">
                        <div className="whitespace-pre-wrap break-words">{msg.content}</div>
                        {msg.koreksi && (
                          <div className="mt-2 border-t border-white/25 pt-2 text-xs text-indigo-100">
                            Menampilkan hasil untuk &lsquo;{msg.koreksi.dipakai}&rsquo; (kamu mengetik
                            &lsquo;{msg.koreksi.asli}&rsquo;)
                          </div>
                        )}
                      </div>
                    </div>
                  );
                }
                return (
                  <div key={msg.id} className="flex items-start gap-3 sm:gap-4">
                    <span className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
                      <Icon name="sparkle" className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="whitespace-pre-wrap break-words text-[15px] leading-7 text-slate-800">
                        {msg.content}
                      </div>
                      {msg.sources && msg.sources.length > 0 && (
                        <div className="mt-4">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Sumber dari catatanmu
                          </p>
                          <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                            {msg.sources.map((src, i) => (
                              <Link
                                key={`${src.noteId}-${i}`}
                                href={`/notes/${src.noteId}`}
                                className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 transition-colors hover:border-indigo-300 hover:bg-indigo-50/40"
                              >
                                <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-indigo-50 text-xs font-bold text-indigo-700">
                                  {i + 1}
                                </span>
                                <span className="line-clamp-2 text-sm font-semibold text-slate-900">
                                  {src.title}
                                </span>
                              </Link>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}

            {isSending && (
              <div className="flex items-center gap-3 sm:gap-4" role="status">
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
                  <Icon name="sparkle" className="h-5 w-5" />
                </span>
                <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-sm text-slate-600">
                  <span className="flex gap-1" aria-hidden="true">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-400" />
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-400 [animation-delay:150ms]" />
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-400 [animation-delay:300ms]" />
                  </span>
                  Membaca catatanmu…
                </span>
              </div>
            )}

            {errorMessage && (
              <div
                role="alert"
                className="flex items-center justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
              >
                <div>
                  <p className="font-semibold">Asisten AI belum bisa dihubungi</p>
                  <p className="mt-0.5">{errorMessage} Catatanmu aman.</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleSend()}
                  className="shrink-0 rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
                >
                  Coba lagi
                </button>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="shrink-0 border-t border-slate-200 px-4 pb-4 pt-4 sm:px-8">
            {!isSending && (
              <div className="mb-3 flex flex-wrap gap-2">
                {CONTOH_PERTANYAAN.map((contoh) => (
                  <button
                    key={contoh}
                    type="button"
                    onClick={() => handleSend(contoh)}
                    className="min-h-[40px] rounded-full border border-slate-200 bg-white px-4 text-left text-sm text-slate-700 transition-colors hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700"
                  >
                    {contoh}
                  </button>
                ))}
              </div>
            )}
            <div className="flex items-end gap-2 rounded-2xl border border-slate-200 bg-white p-2 pl-4 transition focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-200">
              <label htmlFor="question-input" className="sr-only">
                Ketik pertanyaan untuk Asisten AI
              </label>
              <textarea
                id="question-input"
                rows={1}
                maxLength={1000}
                placeholder="Tanyakan sesuatu tentang catatanmu…"
                value={inputQuestion}
                onChange={(e) => setInputQuestion(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isSending}
                className="max-h-32 min-h-[44px] flex-1 resize-none bg-transparent py-3 text-[15px] text-slate-900 placeholder-slate-400 outline-none disabled:opacity-60"
              />
              <button
                type="button"
                onClick={() => handleSend()}
                disabled={!inputQuestion.trim() || isSending}
                aria-label="Kirim pertanyaan"
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Icon name="arrow-right" className="h-5 w-5" />
              </button>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Asisten hanya memakai apa yang sudah kamu tulis. Kalau catatanmu belum menjawabnya, ia akan
              bilang begitu.
              {inputQuestion.length > 800 && (
                <span className="ml-2 font-semibold text-amber-600">{inputQuestion.length}/1000</span>
              )}
            </p>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
