import { describe, it, expect } from "vitest";
import { findToolById, matchToolsForTitle, type Tool } from "./tools-sheet";

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

describe("matchToolsForTitle", () => {
  const figma = tool("https://figma.com", "Figma", "https://figma.com", "디자인", ["UI", "프로토타이핑"]);
  const github = tool("https://github.com", "GitHub", "https://github.com", "개발", ["코드", "git"]);
  const notion = tool("https://notion.so", "Notion", "https://notion.so", undefined, ["문서", "노트"]);
  const t: Tool[] = [figma, github, notion];

  it("제목과 카테고리 정확 일치 → 매치", () => {
    const r = matchToolsForTitle("디자인", t);
    expect(r).toContain(figma);
    expect(r).not.toContain(github);
  });

  it("제목 단어 중 하나가 태그 정확 일치 → 매치", () => {
    const r = matchToolsForTitle("개발 도구", t);
    expect(r).toContain(github);
  });

  it("부분 문자열 (디자 vs 디자인) → 매치 안 됨", () => {
    const r = matchToolsForTitle("디자", t);
    expect(r).not.toContain(figma);
  });

  it("빈 제목 → 빈 배열", () => {
    expect(matchToolsForTitle("", t)).toEqual([]);
    expect(matchToolsForTitle("   ", t)).toEqual([]);
  });

  it("케이스 무시 (영문 'Design' vs 'design')", () => {
    const designed = tool("https://x.com", "X", "https://x.com", "design");
    const r = matchToolsForTitle("Design", [designed]);
    expect(r).toContain(designed);
  });

  it("태그 단어 정확 일치 (다중 단어 태그는 split 안 함)", () => {
    const ds = tool("https://y.com", "DS", "https://y.com", undefined, ["디자인 시스템"]);
    expect(matchToolsForTitle("디자인", [ds])).not.toContain(ds);
    expect(matchToolsForTitle("디자인 시스템", [ds])).toEqual([]);
  });
});
