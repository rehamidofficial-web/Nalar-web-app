import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { signToken } from "../lib/jwt.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

const registerSchema = z.object({
  name: z.string().trim().min(2, "Nama minimal 2 huruf").max(100),
  email: z.string().trim().toLowerCase().email("Format email salah").max(255),
  password: z.string().min(8, "Password minimal 8 karakter").max(100),
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Format email salah"),
  password: z.string().min(1, "Password wajib diisi"),
});

router.post("/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({
      success: false,
      message: "Data tidak valid",
      errors: parsed.error.issues.map((i) => ({
        field: i.path.join("."),
        message: i.message,
      })),
    });
    return;
  }
  const { name, email, password } = parsed.data;

  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) {
    res
      .status(409)
      .json({ success: false, message: "Email sudah terdaftar", errors: [] });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { name, email, passwordHash },
    select: { id: true, name: true, email: true },
  });
  res
    .status(201)
    .json({ success: true, message: "Registrasi berhasil", data: { user } });
});

router.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({
      success: false,
      message: "Data tidak valid",
      errors: parsed.error.issues.map((i) => ({
        field: i.path.join("."),
        message: i.message,
      })),
    });
    return;
  }
  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  const cocok = user
    ? await bcrypt.compare(password, user.passwordHash)
    : false;
  if (!user || !cocok) {
    res
      .status(401)
      .json({
        success: false,
        message: "Email atau password salah",
        errors: [],
      });
    return;
  }

  const accessToken = signToken(user.id);
  res.json({
    success: true,
    message: "Login berhasil",
    data: {
      accessToken,
      user: { id: user.id, name: user.name, email: user.email },
    },
  });
});

router.post("/logout", (_req, res) => {
  res.json({ success: true, message: "Logout berhasil" });
});

router.get("/me", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId as string },
    select: { id: true, name: true, email: true },
  });
  if (!user) {
    res
      .status(404)
      .json({
        success: false,
        message: "Pengguna tidak ditemukan",
        errors: [],
      });
    return;
  }
  res.json({ success: true, message: "Berhasil", data: { user } });
});

export default router;
