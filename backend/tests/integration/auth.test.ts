import "../helpers/mockAi.js";
import "../helpers/mockBackgroundEmbedding.js";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import jwt from "jsonwebtoken";
import { ipKeyGenerator } from "express-rate-limit";
import { prisma } from "../../src/lib/prisma.js";
import { batasAuth } from "../../src/middleware/rateLimit.js";
import { createTestClient } from "../helpers/client.js";
import {
  cleanupStaleTestAccounts,
  cleanupTestAccounts,
  createTestAccount,
  createTestCredentials,
} from "../helpers/testData.js";

const api = createTestClient();
const emails = new Set<string>();

beforeAll(async () => {
  await cleanupStaleTestAccounts();
});

beforeEach(async () => {
  await batasAuth.resetKey?.(ipKeyGenerator("127.0.0.1"));
  await batasAuth.resetKey?.(ipKeyGenerator("::1"));
  await batasAuth.resetKey?.(ipKeyGenerator("::ffff:127.0.0.1"));
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

  describe("PATCH /api/v1/auth/password (ubah password)", () => {
    it("sukses mengubah password, login dengan password baru berhasil, login lama gagal", async () => {
      const credentials = createTestCredentials("Tes Ubah Password Sukses");
      emails.add(credentials.email);
      await api.post("/api/v1/auth/register").send(credentials);

      const loginRes = await api.post("/api/v1/auth/login").send(credentials);
      const token = loginRes.body.data.accessToken as string;

      const newPassword = "PasswordBaru123!";
      const response = await api
        .patch("/api/v1/auth/password")
        .set("Authorization", `Bearer ${token}`)
        .send({
          currentPassword: credentials.password,
          newPassword,
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        message: "Password berhasil diubah",
      });
      expect(response.body).not.toHaveProperty("passwordHash");
      expect(JSON.stringify(response.body)).not.toMatch(/passwordHash/i);

      // Login dengan password baru harus berhasil
      const loginNewRes = await api.post("/api/v1/auth/login").send({
        email: credentials.email,
        password: newPassword,
      });
      expect(loginNewRes.status).toBe(200);
      expect(loginNewRes.body.success).toBe(true);

      // Login dengan password lama harus gagal
      const loginOldRes = await api.post("/api/v1/auth/login").send({
        email: credentials.email,
        password: credentials.password,
      });
      expect(loginOldRes.status).toBe(401);
    });

    it("password lama salah -> 400 dan password tidak berubah", async () => {
      const credentials = createTestCredentials("Tes Ubah Password Salah");
      emails.add(credentials.email);
      await api.post("/api/v1/auth/register").send(credentials);

      const loginRes = await api.post("/api/v1/auth/login").send(credentials);
      const token = loginRes.body.data.accessToken as string;

      const response = await api
        .patch("/api/v1/auth/password")
        .set("Authorization", `Bearer ${token}`)
        .send({
          currentPassword: "PasswordSalah123!",
          newPassword: "PasswordBaruLain123!",
        });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        success: false,
        message: "Password saat ini salah",
        errors: [
          {
            field: "currentPassword",
            message: "Password saat ini salah",
          },
        ],
      });

      // Password asli tetap bisa digunakan untuk login
      const loginResCheck = await api.post("/api/v1/auth/login").send(credentials);
      expect(loginResCheck.status).toBe(200);
    });

    it("password baru sama dengan lama -> 422", async () => {
      const credentials = createTestCredentials("Tes Ubah Password Sama");
      emails.add(credentials.email);
      await api.post("/api/v1/auth/register").send(credentials);

      const loginRes = await api.post("/api/v1/auth/login").send(credentials);
      const token = loginRes.body.data.accessToken as string;

      const response = await api
        .patch("/api/v1/auth/password")
        .set("Authorization", `Bearer ${token}`)
        .send({
          currentPassword: credentials.password,
          newPassword: credentials.password,
        });

      expect(response.status).toBe(422);
      expect(response.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: "newPassword",
            message: "Password baru harus berbeda dari password saat ini",
          }),
        ])
      );
    });

    it("password baru kurang dari 8 karakter -> 422", async () => {
      const credentials = createTestCredentials("Tes Ubah Password Pendek");
      emails.add(credentials.email);
      await api.post("/api/v1/auth/register").send(credentials);

      const loginRes = await api.post("/api/v1/auth/login").send(credentials);
      const token = loginRes.body.data.accessToken as string;

      const response = await api
        .patch("/api/v1/auth/password")
        .set("Authorization", `Bearer ${token}`)
        .send({
          currentPassword: credentials.password,
          newPassword: "short",
        });

      expect(response.status).toBe(422);
      expect(response.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: "newPassword",
            message: "Password baru minimal 8 karakter",
          }),
        ])
      );
    });

    it("password baru lebih dari 72 byte -> 422", async () => {
      const account = await createTestAccount("Tes Ubah Password Panjang");
      emails.add(account.email);

      const response = await api
        .patch("/api/v1/auth/password")
        .set("Authorization", `Bearer ${account.token}`)
        .send({
          currentPassword: account.password,
          newPassword: "é".repeat(37),
        });

      expect(response.status).toBe(422);
      expect(response.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: "newPassword",
            message: "Password maksimal 72 byte",
          }),
        ])
      );
    });

    it("tanpa token -> 401", async () => {
      const response = await api.patch("/api/v1/auth/password").send({
        currentPassword: "CurrentPassword123!",
        newPassword: "NewPassword123!",
      });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it("pengguna A tidak bisa mengubah password pengguna B (userId selalu dari token)", async () => {
      const userA = await createTestAccount("User A");
      const userB = await createTestAccount("User B");
      emails.add(userA.email);
      emails.add(userB.email);

      // User A mencoba mengirim userId user B di body
      const response = await api
        .patch("/api/v1/auth/password")
        .set("Authorization", `Bearer ${userA.token}`)
        .send({
          userId: userB.id,
          currentPassword: userA.password,
          newPassword: "UserANewPass123!",
        });

      expect(response.status).toBe(200);

      // Verifikasi user B tidak terpengaruh, password di DB tetap cocok dengan password B
      const dbUserBAfter = await prisma.user.findUniqueOrThrow({
        where: { id: userB.id },
      });
      const bcrypt = (await import("bcryptjs")).default;
      expect(await bcrypt.compare(userB.password, dbUserBAfter.passwordHash)).toBe(true);
      expect(await bcrypt.compare("UserANewPass123!", dbUserBAfter.passwordHash)).toBe(false);
    });

    it("respons tidak pernah memuat passwordHash", async () => {
      const account = await createTestAccount("Tes Respons Hash");
      emails.add(account.email);

      const response = await api
        .patch("/api/v1/auth/password")
        .set("Authorization", `Bearer ${account.token}`)
        .send({
          currentPassword: account.password,
          newPassword: "NewSecurePass123!",
        });

      expect(response.status).toBe(200);
      expect(response.body).not.toHaveProperty("passwordHash");
      expect(response.body).not.toHaveProperty("password");
      expect(JSON.stringify(response.body)).not.toMatch(/passwordHash/i);
    });
  });
});
