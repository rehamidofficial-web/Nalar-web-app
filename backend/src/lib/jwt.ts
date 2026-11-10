import jwt from "jsonwebtoken";

function getSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET belum diisi di file .env");
  return secret;
}

export function signToken(userId: string) {
  return jwt.sign({ userId }, getSecret(), { expiresIn: "1d" });
}

export function verifyToken(token: string) {
  return jwt.verify(token, getSecret()) as { userId: string };
}
