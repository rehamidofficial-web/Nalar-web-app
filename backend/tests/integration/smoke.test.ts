import { describe, expect, it } from "vitest";
import { createTestClient } from "../helpers/client.js";

describe("API smoke tests", () => {
  it("melayani health check tanpa membuka port", async () => {
    const response = await createTestClient().get("/api/v1/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok", app: "Nalar" });
  });

  it("mengembalikan 404 dengan format standar untuk rute yang tidak dikenal", async () => {
    const response = await createTestClient().get("/api/v1/rute-tidak-ada");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      success: false,
      message: "Alamat tidak ditemukan.",
    });
  });
});
