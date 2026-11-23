import { vi } from "vitest";

const mock = vi.hoisted(() => vi.fn(async () => {}));

vi.mock("../../src/services/embedding.service.js", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("../../src/services/embedding.service.js")
    >();
  return {
    ...actual,
    jalankanEmbeddingDiLatarBelakang: mock,
  };
});

export const resetMockBackgroundEmbedding = () => {
  mock.mockReset().mockResolvedValue(undefined);
};
