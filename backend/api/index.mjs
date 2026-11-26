// Fungsi Vercel: meneruskan semua permintaan ke aplikasi Express hasil rakitan (dist/vercel.mjs).
// File dist/vercel.mjs dibuat otomatis oleh installCommand di vercel.json.
import app from "../dist/vercel.mjs";

export default app;
