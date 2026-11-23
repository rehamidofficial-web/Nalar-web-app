import { z } from "zod";

export const BATAS_HALAMAN = 10_000;
export const BATAS_PANJANG_TAG = 30;

export const tagsSchema = z
  .array(
    z
      .string()
      .trim()
      .toLowerCase()
      .min(1, "Tag minimal 1 karakter")
      .max(BATAS_PANJANG_TAG, `Tag maksimal ${BATAS_PANJANG_TAG} karakter`)
  )
  .max(10, "Maksimal 10 tag")
  .transform((tags) => [...new Set(tags)]);
