/**
 * Tema visual untuk Knowledge Graph
 * Edisi Khusus: "Papan Detektif Benang Merah" (Detective Board with Red Strings & Paper Clips)
 * Terinspirasi oleh identitas logo Nalar: Kertas Ide, Pin Merah, dan Benang Pengetahuan.
 */

export const GRAPH_THEME = {
  // Latar belakang kanvas: Papan gabus hangat / papan investigasi
  board: {
    background: "#241e17", // Papan kayu / gabus gelap elegan (kontras tinggi untuk kartu kertas)
    patternColor: "#1d1812", // Nuansa tekstur papan
    gridColor: "rgba(255, 255, 255, 0.03)",
  },

  // Kartu Kertas (Node)
  card: {
    // Dimensi kartu dasar
    minWidth: 54,
    maxWidth: 96,
    baseWidth: 64,
    heightRatio: 0.62, // Aspek rasio kartu kertas catatan (lebar x tinggi)
    radius: 4, // Sudut melengkung halus kartu kertas

    // Warna kertas
    defaultBg: "#fbfaf5", // Kertas krem/off-white alami
    centerBg: "#fffdf0", // Kertas fokus catatan pusat
    selectedBg: "#ffffff", // Kertas saat dipilih
    dimmedBg: "#4a443b", // Kertas meredup saat node lain disorot
    isolatedBg: "#e7e5dc", // Kertas tanpa hubungan

    // Border & Bayangan kartu
    borderColor: "#e2ded4",
    borderHighlight: "#e11d48", // Border merah saat dipilih
    shadowColor: "rgba(0, 0, 0, 0.45)",
    shadowBlur: 6,

    // Teks di atas kartu kertas
    textColor: "#1c1917", // Tinta hitam arang tajam (stone-900)
    textDimmedColor: "#a8a29e",
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',

    // Penjepit kertas & Pin (Paperclip & Pushpin)
    pinColor: "#e11d48", // Merah khas Nalar (rose-600)
    pinCenterColor: "#ea580c", // Pin oranye untuk catatan pusat
    pinHighlight: "#f43f5e",
    pinRadius: 3.5,
    paperclipColor: "#94a3b8", // Logam silver/slate untuk klip kertas
    paperclipHighlight: "#e11d48",
  },

  // Benang Hubungan (Edge)
  thread: {
    // Benang Merah (Relasi Makna Mirip / Similar)
    similarColor: "#e11d48", // Benang merah khas detektif (rose-600)
    similarHighlight: "#ff2056", // Benang merah menyala terang saat disorot
    similarDimmed: "rgba(120, 50, 60, 0.2)", // Meredup gelap di latar papan
    similarMinWidth: 1.4,
    similarMaxWidth: 3.8,
    curvature: 0.12, // Lengkungan alami benang menggantung di papan

    // Benang Sekunder (Relasi Konsep Sama / Concept)
    conceptColor: "#38bdf8", // Benang biru muda/kapur putus-putus
    conceptHighlight: "#7dd3fc",
    conceptDimmed: "rgba(56, 189, 248, 0.15)",
    conceptWidth: 1.2,
    dashPattern: [4, 4],
    conceptCurvature: -0.08, // Melengkung ke arah berlawanan agar tidak tumpuk
  },

  // Fisika Tata Letak (D3 Force Simulation)
  physics: {
    chargeStrength: -320, // Gaya tolak antar kartu agar tidak bertumpuk
    linkDistance: 80, // Jarak antar kartu yang terhubung
    collideRadiusPadding: 16, // Bantalan ruang gerak kartu
    velocityDecay: 0.35, // Gesekan agar pergerakan kartu tenang dan mulus
  },

  // Optimasi Performa
  performance: {
    heavyThreshold: 120, // Jika node > 120, matikan bayangan dan penyederhanaan gambar
  },
  // Kompatibilitas alias untuk komponen lain (seperti NodeDetailPanel)
  node: {
    defaultColor: "#e11d48",
    centerHighlight: "#ea580c",
  },
};
