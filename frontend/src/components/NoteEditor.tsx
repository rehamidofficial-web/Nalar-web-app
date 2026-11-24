"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, pesanError } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { Spinner, btnPrimary, btnSecondary } from "@/components/ui";

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
            setTitle("");
            setContent("");
            setTags([]);
            setTagInput("");
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
            setTitle("");
            setContent("");
            setTags([]);
            setTagInput("");
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
  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
  const labelClass =
    "block text-xs font-semibold uppercase tracking-wide text-slate-500";

  return (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
      {errorMessage && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {errorMessage}
        </div>
      )}

      <div>
        <label htmlFor="title" className={labelClass}>
          Judul
        </label>
        <input
          id="title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Tanpa judul"
          maxLength={255}
          disabled={isSubmitting}
          aria-invalid={errorMessage === "Judul wajib diisi"}
          className={`mt-2 w-full border-0 bg-transparent p-0 text-[28px] font-bold leading-tight tracking-tight text-slate-900 placeholder-slate-300 outline-none disabled:opacity-50 ${
            errorMessage === "Judul wajib diisi"
              ? "rounded-md ring-2 ring-red-500 ring-offset-4 ring-offset-white"
              : ""
          }`}
        />
      </div>

      <div>
        <label htmlFor="tags" className={labelClass}>
          Tag{" "}
          <span className="font-normal normal-case tracking-normal text-slate-400">
            · maksimal 10, tekan Enter atau koma untuk menambah
          </span>
        </label>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1 text-sm font-medium text-indigo-700"
            >
              {tag}
              <button
                type="button"
                onClick={() => removeTag(tag)}
                disabled={isSubmitting}
                aria-label={`Hapus tag ${tag}`}
                className="text-indigo-400 hover:text-indigo-700"
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
              placeholder={tags.length === 0 ? "+ Tambah tag" : "+ Tambah tag"}
              disabled={isSubmitting}
              className="min-h-[34px] w-32 rounded-full border border-dashed border-slate-300 bg-transparent px-3 text-base text-slate-900 placeholder-slate-500 sm:text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
            />
          )}
        </div>
      </div>

      <div className="border-t border-slate-100 pt-5">
        <div className="flex items-center justify-between">
          <label htmlFor="content" className={labelClass}>
            Isi catatan
          </label>
          <span
            className={`text-xs ${isOverLimit ? "font-bold text-red-600" : "text-slate-500"}`}
          >
            {wordCount.toLocaleString("id-ID")} kata · {charCount.toLocaleString("id-ID")} / 50.000
          </span>
        </div>
        <textarea
          id="content"
          value={content}
          onChange={(e) => {
            setContent(e.target.value);
            onContentChange?.(e.target.value);
          }}
          placeholder="Tuliskan isi catatanmu di sini…"
          rows={14}
          disabled={isSubmitting}
          className={`mt-3 w-full min-h-[340px] resize-y rounded-xl border bg-white p-4 text-base leading-7 text-slate-900 placeholder-slate-400 outline-none focus:ring-2 disabled:opacity-50 sm:text-[15px] ${
            isOverLimit
              ? "border-red-400 focus:border-red-500 focus:ring-red-200"
              : "border-slate-200 focus:border-indigo-500 focus:ring-indigo-200"
          }`}
        />
      </div>

      <div className="flex flex-col-reverse gap-3 pt-1 sm:flex-row sm:justify-end">
        <button
          type="button"
          disabled={isSubmitting}
          onClick={() => router.push("/notes")}
          className={btnSecondary}
        >
          Batal
        </button>
        <button type="submit" disabled={isSubmitting || isOverLimit} className={btnPrimary}>
          {isSubmitting ? (
            <>
              <Spinner /> Menyimpan…
            </>
          ) : (
            "Simpan"
          )}
        </button>
      </div>
    </form>
  );
}
