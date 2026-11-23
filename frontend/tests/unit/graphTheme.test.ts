import { describe, it, expect } from "vitest";
import { GRAPH_THEMES, GRAPH_THEME } from "@/lib/graphTheme";

describe("graphTheme lib", () => {
  it("menyediakan konfigurasi tema modern yang valid", () => {
    expect(GRAPH_THEMES.modern).toBeDefined();
    expect(GRAPH_THEME).toBe(GRAPH_THEMES.modern);
    expect(GRAPH_THEME.board.background).toBe("#0b1020");
    expect(GRAPH_THEME.node.tagColors.length).toBeGreaterThan(0);
    expect(GRAPH_THEME.thread.similarColor).toBe("#818cf8");
  });
});
