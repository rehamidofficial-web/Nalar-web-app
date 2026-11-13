"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, pesanError } from "@/lib/api";
import { getToken } from "@/lib/auth";

interface NoteEditorProps {
  initialData?: {
    id?: string;
    title: string;
    content: string;
    tags?: string[];
  };
  isEdit?: boolean;
  onContentChange?: (currentContent: string) => void;
  onSaveSuccess?: () => void;
}

export function NoteEditor({
  initialData,
  isEdit = false,
  onContentChange,
  onSaveSuccess,
}: NoteEditorProps) {
  const router = useRouter();

  const [title, setTitle] = useState(initialData?.title ?? "");
  const [content, setContent] = useState(initialData?.content ?? "");
  const [tags, setTags] = useState<string[]>(initialData?.tags ?? []);
  const [tagInput, setTagInput] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  function handleAddTag() {
    const rawTag = tagInput.trim().toLowerCase();
    if (!rawTag) return;

    // Bersihkan karakter koma jika ada
    const cleanTag = rawTag.replace(/^,+|,+$/g, "");
    if (!cleanTag) return;

    if (cleanTag.length > 30) {
      setErrorMessage("Tag maksimal 30 karakter");
      return;
    }

    if (tags.includes(cleanTag)) {
      setTagInput("");
      return;
    }

    if (tags.length >= 10) {
      setErrorMessage("Maksimal 10 tag per catatan");
      return;
    }

    setTags([...tags, cleanTag]);
    setTagInput("");
    setErrorMessage("");
  }

  function handleTagKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      handleAddTag();
    }
  }

  function removeTag(tagToRemove: string) {
    setTags(tags.filter((t) => t !== tagToRemove));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage("");

    const trimmedTitle = title.trim();
    const trimmedContent = content.trim();

    if (!trimmedTitle) {
      setErrorMessage("Judul wajib diisi");
      return;
    }
    if (!trimmedContent) {
      setErrorMessage("Isi catatan wajib diisi");
      return;
    }

    if (trimmedContent.length > 50000) {
      setErrorMessage("Isi catatan melebihi batas 50.000 karakter");
      return;
    }

    const token = getToken();
    setIsSubmitting(true);

    try {
      if (isEdit && initialData?.id) {
        const res = await apiFetch(`/notes/${initialData.id}`, {
          method: "PATCH",
          token,
          body: {
            title: trimmedTitle,
            content: trimmedContent,
            tags,
          },
        });

        if (res.ok) {
          if (onSaveSuccess) {
            onSaveSuccess();
          } else {
            router.push("/notes");
          }
        } else {
          setErrorMessage(pesanError(res));
        }
      } else {
        const res = await apiFetch("/notes", {
          method: "POST",
          token,
          body: {
            title: trimmedTitle,
            content: trimmedContent,
            tags,
          },
        });

        if (res.ok) {
          if (onSaveSuccess) {
            onSaveSuccess();
          } else {
            router.push("/notes");
          }
        } else {
          setErrorMessage(pesanError(res));
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  const charCount = content.length;
  const isOverLimit = charCount > 50000;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {errorMessage && (
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      <div>
        <label
          htmlFor="title"
          className="block text-sm font-semibold text-slate-900"
        >
          Judul <span className="text-red-500">*</span>
        </label>
        <input
          id="title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Tuliskan judul catatan..."
          maxLength={255}
          disabled={isSubmitting}
          className="mt-1.5 w-full min-h-[44px] rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-slate-900 placeholder-slate-400 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 disabled:opacity-50"
        />
      </div>

      <div>
        <label
          htmlFor="tags"
          className="block text-sm font-semibold text-slate-900"
        >
          Tag{" "}
          <span className="text-xs font-normal text-slate-500">
            (Maksimal 10 tag. Tekan Enter atau koma untuk menambahkan)
          </span>
        </label>
        <div className="mt-1.5 flex flex-wrap items-center gap-2 rounded-lg border border-slate-300 bg-white p-2 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-200">
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700"
            >
              #{tag}
              <button
                type="button"
                onClick={() => removeTag(tag)}
                disabled={isSubmitting}
                className="text-slate-400 hover:text-slate-600 focus:outline-none"
              >
                &times;
              </button>
            </span>
          ))}
          {tags.length < 10 && (
            <input
              id="tags"
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleTagKeyDown}
              onBlur={handleAddTag}
              placeholder={tags.length === 0 ? "Contoh: javascript, dasar" : "Tambah tag..."}
              disabled={isSubmitting}
              className="min-h-[32px] flex-1 bg-transparent px-2 text-sm text-slate-900 placeholder-slate-400 outline-none"
            />
          )}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between">
          <label
            htmlFor="content"
            className="block text-sm font-semibold text-slate-900"
          >
            Isi Catatan <span className="text-red-500">*</span>
          </label>
          <span
            className={`text-xs ${
              isOverLimit ? "font-bold text-red-600" : "text-slate-400"
            }`}
          >
            {charCount.toLocaleString("id-ID")} / 50.000
          </span>
        </div>
        <textarea
          id="content"
          value={content}
          onChange={(e) => {
            setContent(e.target.value);
            onContentChange?.(e.target.value);
          }}
          placeholder="Tuliskan isi catatanmu di sini..."
          rows={14}
          disabled={isSubmitting}
          className={`mt-1.5 w-full min-h-[320px] rounded-lg border bg-white p-3.5 text-slate-900 placeholder-slate-400 outline-none focus:ring-2 disabled:opacity-50 ${
            isOverLimit
              ? "border-red-400 focus:border-red-500 focus:ring-red-200"
              : "border-slate-300 focus:border-indigo-500 focus:ring-indigo-200"
          }`}
        />
      </div>

      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-2">
        <button
          type="button"
          disabled={isSubmitting}
          onClick={() => router.push("/notes")}
          className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors disabled:opacity-50"
        >
          Batal
        </button>
        <button
          type="submit"
          disabled={isSubmitting || isOverLimit}
          className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 transition-colors disabled:opacity-50"
        >
          {isSubmitting ? "Memproses..." : "Simpan"}
        </button>
      </div>
    </form>
  );
}
