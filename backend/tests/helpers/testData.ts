import { randomBytes, randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "../../src/lib/prisma.js";
import { signToken } from "../../src/lib/jwt.js";

export interface TestCredentials {
  name: string;
  email: string;
  password: string;
}

export interface TestAccount extends TestCredentials {
  id: string;
  token: string;
}

export function createTestCredentials(name = "Akun Tes"): TestCredentials {
  const suffix = randomUUID().replace(/-/g, "");
  return {
    name,
    email: `uji-${suffix}@tes-nalar.invalid`,
    password: randomBytes(32).toString("base64url"),
  };
}

export async function createTestAccount(
  name = "Akun Tes"
): Promise<TestAccount> {
  const credentials = createTestCredentials(name);
  const passwordHash = await bcrypt.hash(credentials.password, 10);
  const user = await prisma.user.create({
    data: {
      name: credentials.name,
      email: credentials.email,
      passwordHash,
    },
    select: { id: true },
  });

  return {
    ...credentials,
    id: user.id,
    token: signToken(user.id),
  };
}

export async function cleanupStaleTestAccounts(): Promise<void> {
  await prisma.user.deleteMany({
    where: { email: { endsWith: "@tes-nalar.invalid" } },
  });
}

export async function cleanupTestAccounts(emails: string[]): Promise<void> {
  await prisma.user.deleteMany({
    where: { email: { in: emails } },
  });
  await prisma.$disconnect();
}
