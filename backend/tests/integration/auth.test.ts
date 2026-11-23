import "../helpers/mockAi.js";
import "../helpers/mockBackgroundEmbedding.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import jwt from "jsonwebtoken";
import { prisma } from "../../src/lib/prisma.js";
import { createTestClient } from "../helpers/client.js";
import {
  cleanupStaleTestAccounts,
  cleanupTestAccounts,
  createTestCredentials,
} from "../helpers/testData.js";

const api = createTestClient();
const emails = new Set<string>();

beforeAll(async () => {
  await cleanupStaleTestAccounts();
});

afterAll(async () => {
  await cleanupTestAccounts([...emails]);
});

describe("API autentikasi", () => {
  it("mendaftarkan akun tanpa mengirim password atau hash", async () => {
    const credentials = createTestCredentials("Tes Registrasi");
    emails.add(credentials.email);

    const response = await api.post("/api/v1/auth/register").send(credentials);

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      success: true,
      message: "Registrasi berhasil",
      data: { user: { email: credentials.email, name: credentials.name } },
    });
    expect(JSON.stringify(response.body)).not.toMatch(/password|passwordHash/i);
  });

  it("menolak email duplikat", async () => {
    const credentials = createTestCredentials("Tes Duplikat");
    emails.add(credentials.email);
    await api.post("/api/v1/auth/register").send(credentials);

    const response = await api.post("/api/v1/auth/register").send(credentials);

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      success: false,
      message: "Email sudah terdaftar",
      errors: [],
    });
  });

  it("mengembalikan validasi 422 untuk email dan password yang tidak valid", async () => {
    const invalidEmail = await api.post("/api/v1/auth/register").send({
      ...createTestCredentials(),
      email: "bukan-email",
    });
    const shortPassword = await api.post("/api/v1/auth/register").send({
      ...createTestCredentials(),
      password: "pendek",
    });

    expect(invalidEmail.status).toBe(422);
    expect(invalidEmail.body.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "email" })])
    );
    expect(shortPassword.status).toBe(422);
    expect(shortPassword.body.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "password" })])
    );
  });

  it("menolak password lebih dari 72 byte", async () => {
    const response = await api.post("/api/v1/auth/register").send({
      ...createTestCredentials(),
      password: "é".repeat(37),
    });

    expect(response.status).toBe(422);
    expect(response.body.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "password" })])
    );
  });

  it("mengembalikan token saat login benar", async () => {
    const credentials = createTestCredentials("Tes Login");
    emails.add(credentials.email);
    await api.post("/api/v1/auth/register").send(credentials);

    const response = await api.post("/api/v1/auth/login").send({
      email: credentials.email,
      password: credentials.password,
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      data: {
        accessToken: expect.any(String),
        user: { email: credentials.email },
      },
    });
    expect(JSON.stringify(response.body)).not.toMatch(/password|passwordHash/i);
  });

  it("memberi respons login yang sama untuk password salah dan email tidak ada", async () => {
    const credentials = createTestCredentials("Tes Login Gagal");
    emails.add(credentials.email);
    await api.post("/api/v1/auth/register").send(credentials);

    const wrongPassword = await api.post("/api/v1/auth/login").send({
      email: credentials.email,
      password: createTestCredentials().password,
    });
    const unknownEmail = await api.post("/api/v1/auth/login").send({
      email: createTestCredentials().email,
      password: createTestCredentials().password,
    });

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(wrongPassword.body).toEqual(unknownEmail.body);
  });

  it("melindungi /auth/me dari token kosong, rusak, dan kedaluwarsa", async () => {
    const credentials = createTestCredentials("Tes Token");
    emails.add(credentials.email);
    await api.post("/api/v1/auth/register").send(credentials);
    const user = await prisma.user.findUniqueOrThrow({
      where: { email: credentials.email },
      select: { id: true },
    });
    const expiredToken = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!, {
      expiresIn: -1,
    });

    const validLogin = await api.post("/api/v1/auth/login").send(credentials);
    const validToken = validLogin.body.data.accessToken as string;
    const me = await api.get("/api/v1/auth/me").set("Authorization", `Bearer ${validToken}`);
    const noToken = await api.get("/api/v1/auth/me");
    const invalidToken = await api
      .get("/api/v1/auth/me")
      .set("Authorization", "Bearer token.rusak");
    const expired = await api
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${expiredToken}`);

    expect(me.status).toBe(200);
    expect(me.body.data.user.email).toBe(credentials.email);
    expect(noToken.status).toBe(401);
    expect(invalidToken.status).toBe(401);
    expect(expired.status).toBe(401);
  });

  it("menolak token milik akun yang sudah dihapus", async () => {
    const credentials = createTestCredentials("Tes Akun Terhapus");
    emails.add(credentials.email);
    await api.post("/api/v1/auth/register").send(credentials);
    const user = await prisma.user.findUniqueOrThrow({
      where: { email: credentials.email },
      select: { id: true },
    });
    const token = (await api.post("/api/v1/auth/login").send(credentials)).body.data
      .accessToken as string;
    await prisma.user.delete({ where: { id: user.id } });

    const response = await api
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
  });

  it("mengembalikan respons logout standar", async () => {
    const response = await api.post("/api/v1/auth/logout");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      message: "Logout berhasil",
    });
  });
});
