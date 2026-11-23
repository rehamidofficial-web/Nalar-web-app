import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    testTimeout: 15_000,
    hookTimeout: 15_000,
    fileParallelism: false,
    coverage: {
      provider: "v8",
      include: ["src/routes/**/*.ts", "src/services/**/*.ts", "src/lib/**/*.ts"],
      thresholds: {
        "src/routes/**/*.ts": { lines: 60 },
        "src/services/**/*.ts": { lines: 60 },
        "src/lib/**/*.ts": { lines: 60 },
      },
    },
  },
});
