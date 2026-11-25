import { Router } from "express";
import { Buffer } from "node:buffer";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { signToken } from "../lib/jwt.js";
import { requireAuth } from "../middleware/auth.js";
import { batasAuth } from "../middleware/rateLimit.js";

const router = Router();
const BCRYPT_ROUNDS = 10;
const DUMMY_PASSWORD_HASH = bcrypt.hashSync("nalar-dummy-password", BCRYPT_ROUNDS);
const MAX_PASSWORD_BYTES = 72;

const passwordWithinBcryptLimit = (password: string) =>
  Buffer.byteLength(password, "utf8") <= MAX_PASSWORD_BYTES;

const registerSchema = z.object({
  name: z.string().trim().min(2, "Nama minimal 2 huruf").max(100),
  email: z.string().trim().toLowerCase().email("Format email salah").max(255),
  password: z
    .string()
    .min(8, "Password minimal 8 karakter")
    .refine(passwordWithinBcryptLimit, "Password maksimal 72 byte"),
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Format email salah"),
  password: z
    .string()
    .min(1, "Password wajib diisi")
    .refine(passwordWithinBcryptLimit, "Password maksimal 72 byte"),
});

const changePasswordSchema = z
  .object({
    currentPassword: z
      .string()
      .min(1, "Password saat ini wajib diisi")
      .refine(passwordWithinBcryptLimit, "Password maksimal 72 byte"),
    newPassword: z
      .string()
      .min(8, "Password baru minimal 8 karakter")
      .refine(passwordWithinBcryptLimit, "Password maksimal 72 byte"),
  })
  .refine((data) => data.newPassword !== data.currentPassword, {
    message: "Password baru harus berbeda dari password saat ini",
    path: ["newPassword"],
  });

router.post("/register", batasAuth, async (req, res) => {
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

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const user = await prisma.user.create({
    data: { name, email, passwordHash },
    select: { id: true, name: true, email: true },
  });
  res
    .status(201)
    .json({ success: true, message: "Registrasi berhasil", data: { user } });
});

router.post("/login", batasAuth, async (req, res) => {
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
  const cocok = await bcrypt.compare(
    password,
    user?.passwordHash ?? DUMMY_PASSWORD_HASH,
  );
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
      .status(401)
      .json({
        success: false,
        message: "Token tidak valid atau sudah kedaluwarsa",
        errors: [],
      });
    return;
  }
  res.json({ success: true, message: "Berhasil", data: { user } });
});

router.patch("/password", requireAuth, batasAuth, async (req, res) => {
  if (!req.userId) {
    res.status(401).json({
      success: false,
      message: "Token autentikasi tidak valid atau sudah kedaluwarsa",
      errors: [],
    });
    return;
  }

  const parsed = changePasswordSchema.safeParse(req.body);
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

  const { currentPassword, newPassword } = parsed.data;

  const user = await prisma.user.findUnique({
    where: { id: req.userId as string },
    select: { id: true, passwordHash: true },
  });

  if (!user) {
    res.status(401).json({
      success: false,
      message: "Token tidak valid atau sudah kedaluwarsa",
      errors: [],
    });
    return;
  }

  const cocok = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!cocok) {
    res.status(400).json({
      success: false,
      message: "Password saat ini salah",
      errors: [
        {
          field: "currentPassword",
          message: "Password saat ini salah",
        },
      ],
    });
    return;
  }

  const newHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: newHash },
  });

  res.json({
    success: true,
    message: "Password berhasil diubah",
  });
});

export default router;
