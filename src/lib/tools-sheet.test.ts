import { describe, it, expect } from "vitest";
import { findToolById, type Tool } from "./tools-sheet";

const tool = (id: string, name: string, url: string, category?: string, tags: string[] = []): Tool => ({
  id, name, url, category, tags,
});

const tools: Tool[] = [
  tool("https://figma.com", "Figma", "https://figma.com", "디자인"),
  tool("https://github.com", "GitHub", "https://github.com", "개발"),
  tool("https://notion.so", "Notion", "https://notion.so"),
];

describe("findToolById", () => {
  it("새 형식 ID(URL) 직접 매치", () => {
    const t = findToolById(tools, "https://figma.com");
    expect(t?.name).toBe("Figma");
  });

  it("옛 형식 ID(row-N-slug)는 name slug 매치로 fallback", () => {
    const t = findToolById(tools, "row-3-figma");
    expect(t?.name).toBe("Figma");
  });

  it("옛 형식인데 매치되는 도구 없으면 undefined", () => {
    expect(findToolById(tools, "row-99-nonexistent")).toBeUndefined();
  });

  it("잘못된 형식 (row 패턴 아님)도 그냥 undefined", () => {
    expect(findToolById(tools, "garbage-id")).toBeUndefined();
  });
});
