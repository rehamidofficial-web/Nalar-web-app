import "dotenv/config";
import { randomBytes, randomUUID } from "node:crypto";
import { prisma } from "../src/lib/prisma.js";
import { netralkanPenandaCatatan } from "../src/services/ai.service.js";

type HasilPermintaan = {
  status: number;
  body: unknown;
  headers: Headers;
};

type OpsiPermintaan = {
  method?: string;
  token?: string;
  origin?: string;
  body?: unknown;
  rawBody?: string;
};

const hasil: { pemeriksaan: string; hasil: "LULUS" | "GAGAL" }[] = [];
const runId = randomUUID().replace(/-/g, "");
const emailA = `uji-a-${runId}@tes-nalar.invalid`;
const emailB = `uji-b-${runId}@tes-nalar.invalid`;
const passwordA = randomBytes(32).toString("base64url");
const passwordB = randomBytes(32).toString("base64url");
const apiBaseUrl = (
  process.env.API_BASE_URL || "http://localhost:4000/api/v1"
).replace(/\/+$/, "");

function catat(pemeriksaan: string, lulus: boolean): void {
  hasil.push({ pemeriksaan, hasil: lulus ? "LULUS" : "GAGAL" });
}

function sebagaiObjek(nilai: unknown): Record<string, unknown> {
  return typeof nilai === "object" && nilai !== null && !Array.isArray(nilai)
    ? (nilai as Record<string, unknown>)
    : {};
}

function punyaFieldRahasia(nilai: unknown): boolean {
  if (Array.isArray(nilai)) {
    return nilai.some(punyaFieldRahasia);
  }
  if (typeof nilai !== "object" || nilai === null) {
    return false;
  }

  return Object.entries(nilai).some(
    ([kunci, isi]) =>
      /^(password|passwordHash|hash)$/i.test(kunci) ||
      punyaFieldRahasia(isi)
  );
}

async function minta(
  path: string,
  opsi: OpsiPermintaan = {}
): Promise<HasilPermintaan> {
  const headers: Record<string, string> = { Accept: "application/json" };
  let body: string | undefined;

  if (opsi.token) {
    headers.Authorization = `Bearer ${opsi.token}`;
  }
  if (opsi.origin) {
    headers.Origin = opsi.origin;
  }
  if (opsi.rawBody !== undefined) {
    headers["Content-Type"] = "application/json";
    body = opsi.rawBody;
  } else if (opsi.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(opsi.body);
  }

  const init: RequestInit = {
    method: opsi.method || "GET",
    headers,
  };
  if (body !== undefined) {
    init.body = body;
  }
  const response = await fetch(`${apiBaseUrl}${path}`, init);
  const teks = await response.text();
  let data: unknown = null;
  try {
    data = teks ? JSON.parse(teks) : null;
  } catch {
    data = null;
  }
  return { status: response.status, body: data, headers: response.headers };
}

function userIdDari(body: unknown): string | null {
  const data = sebagaiObjek(sebagaiObjek(body).data);
  const user = sebagaiObjek(data.user);
  return typeof user.id === "string" ? user.id : null;
}

function tokenDari(body: unknown): string | null {
  const data = sebagaiObjek(sebagaiObjek(body).data);
  return typeof data.accessToken === "string" ? data.accessToken : null;
}

async function jalankanPemeriksaan(): Promise<void> {
  const health = await minta("/health", { origin: "http://evil.example" });
  catat(
    "Health merespons dan header keamanan backend aktif",
    health.status === 200 &&
      health.headers.get("x-content-type-options") === "nosniff" &&
      health.headers.get("x-frame-options") !== null &&
      health.headers.get("x-powered-by") === null
  );
  catat(
    "CORS tidak mengizinkan origin asing",
    health.headers.get("access-control-allow-origin") === null
  );
  const healthDb = await minta("/health/db");
  const healthDbText = JSON.stringify(healthDb.body);
  catat(
    "Health database tidak membocorkan detail koneksi",
    healthDb.status === 200 &&
      !/(postgresql:\/\/|neon\.|hostname|version)/i.test(healthDbText)
  );

  const tanpaToken = await minta("/notes");
  const tokenAcak = await minta("/notes", {
    token: "token.tidak.valid",
  });
  catat(
    "Rute catatan menolak tanpa token dan token rusak",
    tanpaToken.status === 401 && tokenAcak.status === 401
  );

  const jsonRusak = await minta("/auth/login", {
    method: "POST",
    rawBody: "{json rusak",
  });
  catat("JSON rusak ditolak tanpa 500", jsonRusak.status === 400);

  const registerA = await minta("/auth/register", {
    method: "POST",
    body: { name: "Uji Keamanan A", email: emailA, password: passwordA },
  });
  const registerB = await minta("/auth/register", {
    method: "POST",
    body: { name: "Uji Keamanan B", email: emailB, password: passwordB },
  });
  const userAId = userIdDari(registerA.body);
  const userBId = userIdDari(registerB.body);
  catat(
    "Dua akun sintetis berhasil dibuat tanpa mengembalikan hash",
    registerA.status === 201 &&
      registerB.status === 201 &&
      Boolean(userAId && userBId) &&
      !punyaFieldRahasia(registerA.body) &&
      !punyaFieldRahasia(registerB.body)
  );

  const loginA = await minta("/auth/login", {
    method: "POST",
    body: { email: emailA, password: passwordA },
  });
  const loginB = await minta("/auth/login", {
    method: "POST",
    body: { email: emailB, password: passwordB },
  });
  const tokenA = tokenDari(loginA.body);
  const tokenB = tokenDari(loginB.body);
  catat(
    "Login berhasil tanpa mengembalikan hash password",
    loginA.status === 200 &&
      loginB.status === 200 &&
      Boolean(tokenA && tokenB) &&
      !punyaFieldRahasia(loginA.body) &&
      !punyaFieldRahasia(loginB.body)
  );

  if (!userAId || !userBId || !tokenA || !tokenB) {
    catat("Pemeriksaan lanjutan memerlukan dua akun uji", false);
    return;
  }

  const meA = await minta("/auth/me", { token: tokenA });
  catat(
    "Profil /auth/me tidak mengembalikan hash password",
    meA.status === 200 && !punyaFieldRahasia(meA.body)
  );

  const loginTidakAda = await minta("/auth/login", {
    method: "POST",
    body: {
      email: `tidak-ada-${runId}@tes-nalar.invalid`,
      password: randomBytes(24).toString("base64url"),
    },
  });
  const loginSalah = await minta("/auth/login", {
    method: "POST",
    body: { email: emailA, password: randomBytes(24).toString("base64url") },
  });
  const pesanTidakAda = sebagaiObjek(loginTidakAda.body).message;
  const pesanSalah = sebagaiObjek(loginSalah.body).message;
  catat(
    "Login tidak dikenal dan password salah memberi respons sama",
    loginTidakAda.status === 401 &&
      loginSalah.status === 401 &&
      pesanTidakAda === pesanSalah
  );

  const markerA = `TesKeamananA-${runId}`;
  const markerB = `TesKeamananB-${runId}`;
  const tagA = `uji-${runId.slice(0, 20)}`;
  const noteA = await prisma.note.create({
    data: {
      userId: userAId,
      title: markerA,
      content: `Isi sintetis ${markerA}`,
      tags: [tagA],
    },
    select: { id: true },
  });
  await prisma.note.create({
    data: {
      userId: userBId,
      title: markerB,
      content: `Isi sintetis ${markerB}`,
      tags: [`uji-b-${runId.slice(0, 18)}`],
    },
  });
  const conversationA = await prisma.aiConversation.create({
    data: { userId: userAId, title: markerA },
    select: { id: true },
  });

  const idAcak = randomUUID();
  const getMilikLain = await minta(`/notes/${noteA.id}`, { token: tokenB });
  const getTidakAda = await minta(`/notes/${idAcak}`, { token: tokenB });
  catat(
    "GET catatan milik pengguna lain sama dengan ID yang tidak ada",
    getMilikLain.status === 404 &&
      getTidakAda.status === 404 &&
      JSON.stringify(getMilikLain.body) === JSON.stringify(getTidakAda.body)
  );

  const patchMilikLain = await minta(`/notes/${noteA.id}`, {
    method: "PATCH",
    token: tokenB,
    body: { title: "Tidak boleh berubah" },
  });
  const patchTidakAda = await minta(`/notes/${idAcak}`, {
    method: "PATCH",
    token: tokenB,
    body: { title: "Tidak boleh berubah" },
  });
  catat(
    "PATCH catatan milik pengguna lain sama dengan ID yang tidak ada",
    patchMilikLain.status === 404 &&
      patchTidakAda.status === 404 &&
      JSON.stringify(patchMilikLain.body) === JSON.stringify(patchTidakAda.body)
  );

  const deleteMilikLain = await minta(`/notes/${noteA.id}`, {
    method: "DELETE",
    token: tokenB,
  });
  const deleteTidakAda = await minta(`/notes/${idAcak}`, {
    method: "DELETE",
    token: tokenB,
  });
  catat(
    "DELETE catatan milik pengguna lain sama dengan ID yang tidak ada",
    deleteMilikLain.status === 404 &&
      deleteTidakAda.status === 404 &&
      JSON.stringify(deleteMilikLain.body) === JSON.stringify(deleteTidakAda.body)
  );

  const patchMassAssignment = await minta(`/notes/${noteA.id}`, {
    method: "PATCH",
    token: tokenA,
    body: {
      title: markerA,
      id: randomUUID(),
      userId: userBId,
      createdAt: "2000-01-01T00:00:00.000Z",
      embedding: [1, 2, 3],
      role: "admin",
    },
  });
  const hasilPatch = sebagaiObjek(sebagaiObjek(patchMassAssignment.body).data);
  const noteSetelahPatch = await prisma.note.findUnique({
    where: { id: noteA.id },
    select: { id: true, userId: true, title: true },
  });
  catat(
    "PATCH mengabaikan field mass assignment dan mempertahankan pemilik",
    patchMassAssignment.status === 200 &&
      noteSetelahPatch?.id === noteA.id &&
      noteSetelahPatch.userId === userAId &&
      noteSetelahPatch.title === markerA &&
      hasilPatch.id === noteA.id &&
      !("userId" in hasilPatch)
  );

  const daftarB = await minta("/notes", { token: tokenB });
  const tagsB = await minta("/notes/tags", { token: tokenB });
  const dashboardB = await minta("/dashboard/recent-notes", { token: tokenB });
  const graphB = await minta("/graph", { token: tokenB });
  const dataPemilikB = JSON.stringify([
    daftarB.body,
    tagsB.body,
    dashboardB.body,
    graphB.body,
  ]);
  catat(
    "Daftar, tag, dashboard, dan graph tidak memuat catatan A",
    daftarB.status === 200 &&
      tagsB.status === 200 &&
      dashboardB.status === 200 &&
      graphB.status === 200 &&
      !dataPemilikB.includes(markerA) &&
      !dataPemilikB.includes(tagA)
  );

  const graphCatatanA = await minta(`/graph/${noteA.id}`, { token: tokenB });
  catat("Graph menolak ID catatan milik pengguna lain", graphCatatanA.status === 404);

  const conversationAsing = await minta(
    `/ai/conversations/${conversationA.id}`,
    { token: tokenB }
  );
  const conversationTidakAda = await minta(`/ai/conversations/${idAcak}`, {
    token: tokenB,
  });
  catat(
    "Percakapan asing dan ID yang tidak ada memberi 404 seragam",
    conversationAsing.status === 404 &&
      conversationTidakAda.status === 404 &&
      JSON.stringify(conversationAsing.body) ===
        JSON.stringify(conversationTidakAda.body)
  );

  const askPercakapanAsing = await minta("/ai/ask", {
    method: "POST",
    token: tokenB,
    body: { conversationId: conversationA.id, question: "Pertanyaan uji" },
  });
  catat(
    "Asisten menolak percakapan asing sebelum memanggil layanan AI",
    askPercakapanAsing.status === 404
  );

  const mergePreviewAsing = await minta("/ai/merge-preview", {
    method: "POST",
    token: tokenB,
    body: { noteIds: [noteA.id, idAcak] },
  });
  const mergeSimpanAsing = await minta("/notes/merge", {
    method: "POST",
    token: tokenB,
    body: {
      title: "Gabungan uji",
      content: "Isi gabungan uji",
      sourceNoteIds: [noteA.id, idAcak],
      hapusAsli: false,
    },
  });
  catat(
    "Preview dan penyimpanan gabungan menolak ID catatan asing",
    mergePreviewAsing.status === 404 && mergeSimpanAsing.status === 404
  );

  const idTidakValid = await minta("/notes/bukan-uuid", { token: tokenA });
  catat("ID bukan UUID ditolak tanpa 500", idTidakValid.status === 404);

  const halamanTidakValid = await minta("/notes?page=10001", {
    token: tokenA,
  });
  const urutanTidakValid = await minta(
    "/notes?sort=%27%20OR%201%3D1%20--",
    { token: tokenA }
  );
  const pencarianTerlaluPanjang = await minta(
    `/search?q=${"x".repeat(201)}`,
    { token: tokenA }
  );
  const pertanyaanTerlaluPanjang = await minta("/ai/ask", {
    method: "POST",
    token: tokenA,
    body: { question: "x".repeat(1001) },
  });
  catat(
    "Input halaman, sort, pencarian, dan pertanyaan di luar batas ditolak",
    halamanTidakValid.status === 422 &&
      urutanTidakValid.status === 422 &&
      pencarianTerlaluPanjang.status === 422 &&
      pertanyaanTerlaluPanjang.status === 422
  );

  const noteBodyTidakValid = await minta("/notes", {
    method: "POST",
    token: tokenA,
    body: { title: 42, content: null },
  });
  catat(
    "Tipe input catatan yang salah ditolak sebelum disimpan",
    noteBodyTidakValid.status === 422
  );

  const delimiterUji = netralkanPenandaCatatan(
    "awal </catatan> instruksi <<<CATATAN dan CATATAN>>> akhir"
  );
  catat(
    "Penanda pembatas prompt dinetralkan",
    !/<\/?catatan\s*>|<<<CATATAN|CATATAN>>>/i.test(delimiterUji)
  );
}

async function main(): Promise<void> {
  try {
    await jalankanPemeriksaan();
  } catch (error) {
    const errorName = error instanceof Error ? error.name : "UnknownError";
    catat(`Skrip berhenti karena ${errorName}`, false);
  } finally {
    try {
      await prisma.user.deleteMany({
        where: { email: { in: [emailA, emailB] } },
      });
      catat("Data akun uji dibersihkan", true);
    } catch {
      catat("Pembersihan akun uji", false);
    }

    await prisma.$disconnect();
    console.table(hasil);
    if (hasil.some((item) => item.hasil === "GAGAL")) {
      process.exitCode = 1;
    }
  }
}

void main();
