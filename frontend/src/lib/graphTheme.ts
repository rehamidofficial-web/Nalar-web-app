/**
 * Tema visual untuk Knowledge Graph
 * Memusatkan semua warna, ketebalan, dan ukuran agar mudah disesuaikan
 * saat perubahan palet warna (misal tema gelap atau palet hitam-putih-merah).
 */

export const GRAPH_THEME = {
  // Latar belakang kanvas
  background: "#f8fafc", // slate-50

  // Node (Simpul Catatan)
  node: {
    defaultColor: "#4f46e5", // indigo-600
    isolatedColor: "#94a3b8", // slate-400 (node tanpa hubungan)
    highlightColor: "#e11d48", // rose-600 (saat dipilih/fokus)
    dimmedColor: "#cbd5e1", // slate-300 (saat node lain di-hover)
    centerHighlight: "#ea580c", // orange-600 (catatan pusat saat fokus single note)
    textColor: "#1e293b", // slate-800
    textDimmedColor: "#94a3b8", // slate-400

    // Ukuran radius lingkaran node
    minRadius: 4,
    maxRadius: 14,
    baseRadius: 5,
  },

  // Edge (Garis Hubungan)
  edge: {
    similarColor: "#6366f1", // indigo-500
    conceptColor: "#0ea5e9", // sky-500
    highlightColor: "#e11d48", // rose-600 (saat node terhubung di-hover)
    dimmedColor: "#e2e8f0", // slate-200 (saat tidak tersorot)

    // Ketebalan garis
    similarMinWidth: 1,
    similarMaxWidth: 3.5,
    conceptWidth: 1.2,
    dashPattern: [3, 3], // pola putus-putus untuk relasi concept
  },
};
