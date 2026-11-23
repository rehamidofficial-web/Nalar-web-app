import "../helpers/mockAi.js";
import "../helpers/mockBackgroundEmbedding.js";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";
import { randomUUID } from "node:crypto";
import authRoutes from "../../src/routes/auth.js";
import notesRoutes from "../../src/routes/notes.js";
import dashboardRoutes from "../../src/routes/dashboard.js";
import aiRoutes from "../../src/routes/ai.js";
import assistantRoutes from "../../src/routes/assistant.js";
import searchRoutes from "../../src/routes/search.js";
import graphRoutes from "../../src/routes/graph.js";
import { app } from "../../src/app.js";
import { requireAuth } from "../../src/middleware/auth.js";
import { signToken } from "../../src/lib/jwt.js";
import { prisma } from "../../src/lib/prisma.js";
import { createTestClient } from "../helpers/client.js";
import {
  cleanupStaleTestAccounts,
  cleanupTestAccounts,
  createTestAccount,
  type TestAccount,
} from "../helpers/testData.js";
import { resetMockAi } from "../helpers/mockAi.js";
import { resetMockBackgroundEmbedding } from "../helpers/mockBackgroundEmbedding.js";

type RouteHandler = { handle: unknown };
type RouteInfo = {
  path: string;
  methods: Record<string, boolean>;
  stack: RouteHandler[];
};
type RouterLayer = {
  name?: string;
  handle?: unknown;
  route?: RouteInfo;
};

const api = createTestClient();
const emails: string[] = [];
let account: TestAccount;
const routerPrefixes = new Map<unknown, string>([
  [authRoutes, "/api/v1/auth"],
  [notesRoutes, "/api/v1/notes"],
  [dashboardRoutes, "/api/v1/dashboard"],
  [aiRoutes, "/api/v1/ai"],
  [assistantRoutes, "/api/v1/ai"],
  [searchRoutes, "/api/v1/search"],
  [graphRoutes, "/api/v1/graph"],
]);

beforeAll(async () => {
  await cleanupStaleTestAccounts();
  account = await createTestAccount("Tes Keamanan");
  emails.push(account.email);
});

beforeEach(() => {
  resetMockAi();
  resetMockBackgroundEmbedding();
});

afterAll(async () => {
  await cleanupTestAccounts(emails);
});

function stackOf(router: unknown): RouterLayer[] {
  return (router as { stack: RouterLayer[] }).stack;
}

function protectedEndpoints(): { method: string; path: string }[] {
  const appStack = (app as unknown as { router: { stack: RouterLayer[] } })
    .router.stack;
  const mountedRouters = appStack.filter((layer) => layer.name === "router");
  expect(mountedRouters.map((layer) => layer.handle)).toEqual(
    expect.arrayContaining(Array.from(routerPrefixes.keys()))
  );
  expect(mountedRouters).toHaveLength(routerPrefixes.size);

  const directProtectedRoutes = appStack.filter((layer) =>
    layer.route?.stack.some((handler) => handler.handle === requireAuth)
  );
  expect(directProtectedRoutes).toHaveLength(0);

  const endpoints: { method: string; path: string }[] = [];
  for (const [router, prefix] of routerPrefixes) {
    const stack = stackOf(router);
    const routerRequiresAuth = stack.some(
      (layer) => !layer.route && layer.handle === requireAuth
    );
    for (const layer of stack) {
      if (!layer.route) continue;
      const protectedByRoute = layer.route.stack.some(
        (handler) => handler.handle === requireAuth
      );
      if (!routerRequiresAuth && !protectedByRoute) continue;

      expect(typeof layer.route.path).toBe("string");
      const suffix = layer.route.path === "/" ? "" : layer.route.path;
      for (const method of Object.keys(layer.route.methods)) {
        endpoints.push({
          method,
          path: `${prefix}${suffix}`.replace(/:([A-Za-z0-9_]+)/g, "00000000-0000-4000-8000-000000000000"),
        });
      }
    }
  }
  return endpoints;
}

async function kirimTanpaToken(
  method: string,
  path: string
): Promise<{ status: number; body: unknown }> {
  let request;
  if (method === "get") request = api.get(path);
  else if (method === "post") request = api.post(path).send({});
  else if (method === "patch") request = api.patch(path).send({});
  else if (method === "put") request = api.put(path).send({});
  else if (method === "delete") request = api.delete(path);
  else throw new Error(`Metode route tidak didukung dalam tes: ${method}`);

  const response = await request;
  return { status: response.status, body: response.body };
}

function denganToken() {
  return { Authorization: `Bearer ${account.token}` };
}

describe("keamanan API", () => {
  it("mengembalikan 401 untuk semua rute terlindungi tanpa token", async () => {
    const endpoints = protectedEndpoints();
    expect(endpoints.length).toBeGreaterThan(0);

    for (const endpoint of endpoints) {
      const response = await kirimTanpaToken(endpoint.method, endpoint.path);
      expect(response.status, `${endpoint.method.toUpperCase()} ${endpoint.path}`)
        .toBe(401);
      expect(response.body).toEqual({
        success: false,
        message: "Silakan login terlebih dahulu",
        errors: [],
      });
    }
  });

  it("menolak token alg none dan tanda tangan yang diubah", async () => {
    const encode = (value: object) =>
      Buffer.from(JSON.stringify(value)).toString("base64url");
    const tokenAlgNone = `${encode({ alg: "none", typ: "JWT" })}.${encode({
      userId: account.id,
    })}.`;
    const [header, payload, signature] = signToken(account.id).split(".");
    const signatureBytes = Buffer.from(signature ?? "", "base64url");
    signatureBytes[0] = (signatureBytes[0] ?? 0) ^ 1;
    const tokenTampered = `${header}.${payload}.${signatureBytes.toString("base64url")}`;

    const algNone = await api
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${tokenAlgNone}`);
    const tampered = await api
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${tokenTampered}`);

    expect(algNone.status).toBe(401);
    expect(algNone.body.success).toBe(false);
    expect(tampered.status).toBe(401);
    expect(tampered.body.success).toBe(false);
  });

  it("menangani payload SQL berbahaya tanpa 500 dan tetap menyimpan judul sebagai teks", async () => {
    const payload = "'; DROP TABLE users; --";
    const search = await api
      .get(`/api/v1/search?q=${encodeURIComponent(payload)}`)
      .set(denganToken());
    const sort = await api
      .get(`/api/v1/notes?sort=${encodeURIComponent("title; DROP TABLE users--")}`)
      .set(denganToken());
    const tag = await api
      .get(`/api/v1/notes?tag=${encodeURIComponent("x' OR 1=1 --")}`)
      .set(denganToken());
    const created = await api
      .post("/api/v1/notes")
      .set(denganToken())
      .send({
        title: payload,
        content: "Isi aman untuk pengujian injeksi SQL.",
      });

    expect(search.status).not.toBe(500);
    expect(sort.status).not.toBe(500);
    expect(tag.status).not.toBe(500);
    expect(created.status).toBe(201);
    expect(
      await prisma.note.findUnique({
        where: { id: created.body.data.id as string },
        select: { title: true },
      })
    ).toEqual({ title: payload });
  });

  it("menolak ID yang bukan UUID dengan 404 atau 422", async () => {
    const invalidNote = await api
      .get("/api/v1/notes/bukan-uuid")
      .set(denganToken());
    const invalidGraph = await api
      .get("/api/v1/graph/bukan-uuid")
      .set(denganToken());
    const invalidConversation = await api
      .get("/api/v1/ai/conversations/bukan-uuid")
      .set(denganToken());

    for (const response of [
      invalidNote,
      invalidGraph,
      invalidConversation,
    ]) {
      expect([404, 422]).toContain(response.status);
      expect(response.body.success).toBe(false);
    }
  });
});
