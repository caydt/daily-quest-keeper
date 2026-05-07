import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ToolPicker } from "./ToolPicker";
import type { Tool } from "@/lib/tools-sheet";

const t = (id: string, name: string, url: string, category?: string, tags: string[] = []): Tool => ({
  id, name, url, category, tags,
});

const tools: Tool[] = [
  t("https://figma.com", "Figma", "https://figma.com", "디자인", ["UI"]),
  t("https://sketch.com", "Sketch", "https://sketch.com", "디자인"),
  t("https://github.com", "GitHub", "https://github.com", "개발", ["git"]),
  t("https://notion.so", "Notion", "https://notion.so"),
];

describe("ToolPicker", () => {
  it("카테고리 칩 클릭 → 해당 카테고리만 표시", () => {
    render(
      <ToolPicker
        availableTools={tools}
        selectedIds={[]}
        onToggle={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "디자인" }));

    expect(screen.getAllByText("Figma").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Sketch").length).toBeGreaterThan(0);
    expect(screen.queryByText("GitHub")).toBeNull();
  });

  it("recommendForTitle 전달 → 추천 섹션 노출", () => {
    render(
      <ToolPicker
        availableTools={tools}
        selectedIds={[]}
        onToggle={vi.fn()}
        onClose={vi.fn()}
        recommendForTitle="디자인"
      />,
    );

    expect(screen.getByText(/추천/)).toBeInTheDocument();
  });

  it("추천 모두 추가 버튼 → onToggle이 매치된 도구 수만큼 호출", () => {
    const onToggle = vi.fn();
    render(
      <ToolPicker
        availableTools={tools}
        selectedIds={[]}
        onToggle={onToggle}
        onClose={vi.fn()}
        recommendForTitle="디자인"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "모두 추가" }));

    expect(onToggle).toHaveBeenCalledTimes(2);
    const calledIds = onToggle.mock.calls.map((c) => c[0]);
    expect(calledIds).toContain("https://figma.com");
    expect(calledIds).toContain("https://sketch.com");
  });

  it("recommendForTitle 비어있음 → 추천 섹션 안 보임", () => {
    render(
      <ToolPicker
        availableTools={tools}
        selectedIds={[]}
        onToggle={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.queryByText(/추천/)).toBeNull();
  });

  it("푸터 — 선택됨 N개 + 닫기 버튼", () => {
    const onClose = vi.fn();
    render(
      <ToolPicker
        availableTools={tools}
        selectedIds={["https://figma.com", "https://github.com"]}
        onToggle={vi.fn()}
        onClose={onClose}
      />,
    );

    expect(screen.getByText("선택됨 2개")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "닫기" }));
    expect(onClose).toHaveBeenCalled();
  });
});
