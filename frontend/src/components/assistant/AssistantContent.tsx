"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useRequireAuth } from "@/lib/useRequireAuth";
import { AppShell } from "@/components/AppShell";
import { apiFetch, pesanError } from "@/lib/api";
import { getToken } from "@/lib/auth";
import type {
  AssistantMessage,
  ConversationSummary,
  AskResponseData,
  ConversationDetailData,
} from "@/types/assistant";

const CONTOH_PERTANYAAN = [
  "Apa kesimpulan dari catatan yang baru saja saya tulis?",
  "Jelaskan hubungan antara konsep yang ada di catatan saya.",
  "Rangkum hal terpenting yang perlu saya ingat minggu ini.",
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
  const [inputQuestion, setInputQuestion] = useState("");

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
        body: JSON.stringify({
          conversationId: targetConvIdAtSend,
          question: q,
        }),
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
        const { conversationId, answer, sources, mode } = res.data;
        setLastMode(mode);

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
        <p className="text-slate-500 text-sm">Memuat...</p>
      </div>
    );
  }

  return (
    <AppShell user={user}>
      <div className="flex h-[calc(100vh-4rem)] md:h-screen bg-slate-50 overflow-hidden">
        {/* ============================================================== */}
        {/* PANEL KIRI: DAFTAR PERCAKAPAN (Desktop + Drawer Mobile) */}
        {/* ============================================================== */}
        <aside
          className={`fixed inset-y-0 left-0 z-30 w-72 bg-white border-r border-slate-200 transform transition-transform duration-200 ease-in-out md:static md:translate-x-0 flex flex-col ${
            mobileDrawerOpen ? "translate-x-0 shadow-xl" : "-translate-x-full"
          }`}
          aria-label="Riwayat Percakapan"
        >
          {/* Header Panel Kiri */}
          <div className="p-3 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Riwayat Percakapan
            </h2>
            <button
              type="button"
              onClick={() => setMobileDrawerOpen(false)}
              className="md:hidden text-slate-400 hover:text-slate-600 p-1"
              aria-label="Tutup panel riwayat"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Tombol Percakapan Baru */}
          <div className="p-3">
            <button
              type="button"
              onClick={handleNewConversation}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-xs"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>Percakapan Baru</span>
            </button>
          </div>

          {/* Daftar Percakapan */}
          <div className="flex-1 overflow-y-auto px-2 space-y-1">
            {isLoadingList ? (
              <div className="p-4 text-center text-xs text-slate-400">Memuat riwayat...</div>
            ) : conversations.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-400 italic">
                Belum ada percakapan tersimpan.
              </div>
            ) : (
              conversations.map((c) => {
                const isActive = c.id === currentConvId;
                return (
                  <div
                    key={c.id}
                    onClick={() => handleSelectConversation(c.id)}
                    className={`group flex items-center justify-between p-2.5 rounded-lg text-xs cursor-pointer transition-colors ${
                      isActive
                        ? "bg-indigo-50 text-indigo-700 font-semibold"
                        : "text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    <div className="flex-1 min-w-0 pr-2">
                      <p className="truncate">{c.title || "Percakapan baru"}</p>
                      <span className="text-[10px] text-slate-400 font-normal">
                        {c.jumlahPesan} pesan
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => handleDeleteConversation(e, c.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-600 transition-opacity"
                      title="Hapus percakapan"
                      aria-label="Hapus percakapan"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </aside>

        {/* Overlay backdrop untuk mobile */}
        {mobileDrawerOpen && (
          <div
            className="fixed inset-0 bg-slate-900/30 z-20 md:hidden"
            onClick={() => setMobileDrawerOpen(false)}
          />
        )}

        {/* ============================================================== */}
        {/* AREA UTAMA: OBROLAN CHAT */}
        {/* ============================================================== */}
        <main className="flex-1 flex flex-col h-full bg-white relative overflow-hidden">
          {/* Topbar Chat */}
          <div className="p-3 border-b border-slate-200 flex items-center justify-between bg-white shrink-0">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setMobileDrawerOpen(true)}
                className="md:hidden p-1.5 text-slate-500 hover:bg-slate-100 rounded-md"
                aria-label="Buka riwayat percakapan"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <div>
                <h1 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                  <span>Nalar AI Assistant</span>
                  <span className="text-[10px] font-normal text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
                    Berdasarkan Catatanmu
                  </span>
                </h1>
              </div>
            </div>

            {currentConvId && (
              <button
                type="button"
                onClick={handleNewConversation}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
              >
                + Mulai Baru
              </button>
            )}
          </div>

          {/* Mode Pencarian Fallback Alert */}
          {lastMode === "kata" && (
            <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-xs text-amber-800">
              Pencarian makna sedang tidak tersedia, jawaban dibuat dari pencarian kata biasa.
            </div>
          )}

          {/* Daftar Pesan */}
          <div
            className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4"
            role="log"
            aria-live="polite"
          >
            {isLoadingMessages ? (
              <div className="flex items-center justify-center h-48">
                <div className="text-center">
                  <div className="inline-block w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mb-2" />
                  <p className="text-xs text-slate-400">Memuat percakapan...</p>
                </div>
              </div>
            ) : messages.length === 0 ? (
              /* State Kosong */
              <div className="max-w-lg mx-auto my-12 text-center space-y-4">
                <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto shadow-xs border border-indigo-100">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z"
                    />
                  </svg>
                </div>
                <div>
                  <h2 className="text-base font-semibold text-slate-800">Halo! Ada yang ingin ditanyakan?</h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Aku akan mencari catatanmu yang relevan dan menjawab pertanyaanmu secara akurat.
                  </p>
                </div>

                <div className="space-y-2 pt-2 text-left">
                  <p className="text-xs font-medium text-slate-400 px-1">Contoh pertanyaan:</p>
                  {CONTOH_PERTANYAAN.map((contoh, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSend(contoh)}
                      className="w-full text-left p-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 hover:border-indigo-200 text-xs text-slate-700 transition-all shadow-xs"
                    >
                      &ldquo;{contoh}&rdquo;
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((msg) => {
                const isUser = msg.role === "user";
                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}
                  >
                    <div
                      className={`max-w-[85%] sm:max-w-xl rounded-2xl p-4 text-xs sm:text-sm leading-relaxed break-words shadow-xs ${
                        isUser
                          ? "bg-indigo-600 text-white rounded-br-none"
                          : "bg-slate-50 text-slate-800 border border-slate-200 rounded-bl-none"
                      }`}
                    >
                      {/* Teks Pesan Asli (pertahankan baris baru) */}
                      <div className="whitespace-pre-wrap">{msg.content}</div>

                      {/* Sumber Catatan untuk Pesan Asisten */}
                      {!isUser && msg.sources && msg.sources.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-slate-200 text-xs">
                          <p className="font-semibold text-slate-600 mb-1.5 flex items-center gap-1">
                            <svg className="w-3.5 h-3.5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                            </svg>
                            Sumber Rujukan:
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {msg.sources.map((src, i) => (
                              <Link
                                key={`${src.noteId}-${i}`}
                                href={`/notes/${src.noteId}`}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white border border-slate-200 text-indigo-600 hover:text-indigo-800 hover:border-indigo-300 font-medium transition-colors"
                              >
                                <span>[{i + 1}]</span>
                                <span className="max-w-[140px] truncate">{src.title}</span>
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

            {/* Gelembung Mengetik / Memuat AI */}
            {isSending && (
              <div className="flex items-start">
                <div className="bg-slate-50 border border-slate-200 rounded-2xl rounded-bl-none p-3.5 shadow-xs flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse" />
                  <span className="text-xs text-slate-500">Sedang berpikir dan membaca catatanmu...</span>
                </div>
              </div>
            )}

            {/* Notifikasi Error */}
            {errorMessage && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center justify-between">
                <span>{errorMessage}</span>
                <button
                  type="button"
                  onClick={() => handleSend()}
                  className="font-semibold underline ml-2 hover:text-rose-900"
                >
                  Coba lagi
                </button>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* ============================================================== */}
          {/* AREA INPUT CHAT */}
          {/* ============================================================== */}
          <div className="p-3 sm:p-4 border-t border-slate-200 bg-white shrink-0">
            <div className="relative rounded-xl border border-slate-300 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-100 transition-all bg-white">
              <label htmlFor="question-input" className="sr-only">
                Ketik pertanyaan untuk AI Assistant
              </label>
              <textarea
                id="question-input"
                rows={2}
                maxLength={1000}
                placeholder="Tanyakan sesuatu tentang catatanmu... (Enter untuk kirim, Shift+Enter untuk baris baru)"
                value={inputQuestion}
                onChange={(e) => setInputQuestion(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isSending}
                className="w-full resize-none p-3 text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 focus:outline-hidden disabled:bg-slate-50"
              />

              <div className="flex items-center justify-between px-3 pb-2 text-[11px] text-slate-400">
                <span>
                  {inputQuestion.length > 800 && (
                    <span className="text-amber-600 font-medium">
                      {inputQuestion.length}/1000 karakter
                    </span>
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => handleSend()}
                  disabled={!inputQuestion.trim() || isSending}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-xs"
                >
                  <span>Kirim</span>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Catatan Privasi & Legal */}
            <p className="mt-2 text-[11px] text-center text-slate-400">
              Nalar menjawab dari catatanmu. Periksa kembali jawaban penting. Isi catatan yang relevan dikirim ke layanan AI untuk membuat jawaban.
            </p>
          </div>
        </main>
      </div>
    </AppShell>
  );
}
