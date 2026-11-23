import { describe, expect, it, vi } from "vitest";
import { AiError, kirimErrorAi } from "../../src/services/ai.service.js";

function buatResponse() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
}

describe("kirimErrorAi", () => {
  it.each([
    [429, "Kuota AI habis."],
    [504, "AI terlalu lama menjawab."],
    [502, "Format JSON dari AI rusak."],
  ])("mengirim status %i dan pesan yang sesuai", (status, message) => {
    const response = buatResponse();

    kirimErrorAi(response, new AiError(status, message));

    expect(response.status).toHaveBeenCalledWith(status);
    expect(response.json).toHaveBeenCalledWith({
      success: false,
      message,
      errors: [],
    });
  });

  it("mengirim error umum dengan status 502", () => {
    const response = buatResponse();

    kirimErrorAi(response, new Error("detail internal"));

    expect(response.status).toHaveBeenCalledWith(502);
    expect(response.json).toHaveBeenCalledWith({
      success: false,
      message: "Terjadi kesalahan pada layanan AI.",
      errors: [],
    });
  });
});
