import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ToolChipBar } from "./ToolChipBar";
import type { Tool } from "@/lib/tools-sheet";

const t = (id: string, name: string, url: string): Tool => ({
  id,
  name,
  url,
  tags: [],
});

const tools: Tool[] = [
  t("https://figma.com", "Figma", "https://figma.com"),
  t("https://github.com", "GitHub", "https://github.com"),
];

describe("ToolChipBar", () => {
  it("매치되는 도구는 이름 칩으로 렌더", () => {
    render(<ToolChipBar availableTools={tools} toolIds={["https://figma.com"]} />);
    expect(screen.getByText("Figma")).toBeInTheDocument();
  });

  it("[P2-A] 매치되지 않는 toolId는 '(연결 끊김)' placeholder로 렌더", () => {
    render(
      <ToolChipBar
        availableTools={tools}
        toolIds={["https://no-longer-exists.com"]}
      />,
    );
    expect(screen.getByText(/연결 끊김/)).toBeInTheDocument();
  });

  it("[P2-A] placeholder 칩의 X 버튼 → onRemove 호출 (사용자가 dangling ID 정리 가능)", () => {
    const onRemove = vi.fn();
    render(
      <ToolChipBar
        availableTools={tools}
        toolIds={["https://no-longer-exists.com"]}
        onRemove={onRemove}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /연결 해제/ }));
    expect(onRemove).toHaveBeenCalledWith("https://no-longer-exists.com");
  });

  it("매치/미매치 혼합 → 둘 다 렌더", () => {
    render(
      <ToolChipBar
        availableTools={tools}
        toolIds={["https://figma.com", "https://broken.com"]}
      />,
    );
    expect(screen.getByText("Figma")).toBeInTheDocument();
    expect(screen.getByText(/연결 끊김/)).toBeInTheDocument();
  });
});
