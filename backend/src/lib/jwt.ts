import jwt from "jsonwebtoken";

const JWT_SECRET_MIN_LENGTH = 32;

export function validateJwtSecretConfiguration() {
  const secret = process.env.JWT_SECRET;
  const isStrongEnough = Boolean(secret && secret.length >= JWT_SECRET_MIN_LENGTH);

  if (isStrongEnough) return;

  if (process.env.NODE_ENV === "production") {
    console.error("FATAL: JWT_SECRET wajib diisi dan minimal 32 karakter di mode produksi.");
    process.exit(1);
  }

  console.warn(
    "Peringatan: JWT_SECRET belum diisi atau kurang dari 32 karakter. Gunakan minimal 32 karakter.",
  );
}

function getSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET belum diisi di file .env");
  if (
    process.env.NODE_ENV === "production" &&
    secret.length < JWT_SECRET_MIN_LENGTH
  ) {
    throw new Error("JWT_SECRET minimal harus 32 karakter di mode produksi.");
  }
  return secret;
}

export function signToken(userId: string) {
  return jwt.sign({ userId }, getSecret(), { expiresIn: "1d" });
}

export function verifyToken(token: string) {
  return jwt.verify(token, getSecret()) as { userId: string };
}
