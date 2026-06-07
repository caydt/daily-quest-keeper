import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MandalartOverlay } from "./MandalartOverlay";
import type { Farm, Project, Task } from "@/lib/garden-store";

const baseFarm: Farm = { id: "f1", title: "테스트 농장", icon: "🌾", createdAt: 0, order: 0 };

const makeTree = (id: string, title: string, completed = false): Project => ({
  id, title, completed, createdAt: 0, order: parseInt(id.replace(/\D/g, "")) || 0,
});

const baseProps = {
  farm: baseFarm,
  trees: [] as Project[],
  tasks: [] as Task[],
  onClose: vi.fn(),
  onToggleProject: vi.fn(),
  onAddTree: vi.fn(),
};

describe("MandalartOverlay — 기본 그리드", () => {
  it("중앙 셀에 농장 이름 표시", () => {
    render(<MandalartOverlay {...baseProps} />);
    expect(screen.getByTestId("mandalart-center")).toHaveTextContent("테스트 농장");
  });

  it("나무 2개 → 슬롯 0·1에 표시, 슬롯 2는 빈 슬롯", () => {
    const trees = [makeTree("p1", "프로젝트A"), makeTree("p2", "프로젝트B")];
    render(<MandalartOverlay {...baseProps} trees={trees} />);
    expect(screen.getByTestId("mandalart-tree-p1")).toBeInTheDocument();
    expect(screen.getByTestId("mandalart-tree-p2")).toBeInTheDocument();
    expect(screen.getByTestId("mandalart-empty-2")).toBeInTheDocument();
  });

  it("나무 8개 → 그리드 모두 채움, overflow 없음, 빈 슬롯 없음", () => {
    const trees = Array.from({ length: 8 }, (_, i) => makeTree(`p${i}`, `나무${i}`));
    render(<MandalartOverlay {...baseProps} trees={trees} />);
    expect(screen.queryByTestId("mandalart-overflow")).not.toBeInTheDocument();
    expect(screen.queryByTestId("mandalart-empty-0")).not.toBeInTheDocument();
  });

  it("나무 10개 → 그리드에 8개, overflow에 2개", () => {
    const trees = Array.from({ length: 10 }, (_, i) => makeTree(`p${i}`, `나무${i}`));
    render(<MandalartOverlay {...baseProps} trees={trees} />);
    expect(screen.getByTestId("mandalart-overflow")).toBeInTheDocument();
    expect(screen.getByTestId("mandalart-overflow-tree-p8")).toBeInTheDocument();
    expect(screen.getByTestId("mandalart-overflow-tree-p9")).toBeInTheDocument();
  });

  it("X 버튼 클릭 → onClose 호출", async () => {
    const onClose = vi.fn();
    render(<MandalartOverlay {...baseProps} onClose={onClose} />);
    await userEvent.click(screen.getByRole("button", { name: "만다라트 닫기" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("ESC 키 → onClose 호출", async () => {
    const onClose = vi.fn();
    render(<MandalartOverlay {...baseProps} onClose={onClose} />);
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("나무 셀 클릭 → onToggleProject(tree.id) 호출", async () => {
    const onToggleProject = vi.fn();
    const trees = [makeTree("p1", "프로젝트A")];
    render(<MandalartOverlay {...baseProps} trees={trees} onToggleProject={onToggleProject} />);
    await userEvent.click(screen.getByTestId("mandalart-tree-p1"));
    expect(onToggleProject).toHaveBeenCalledWith("p1");
  });

  it("빈 슬롯 클릭 + prompt 입력 → onAddTree(farm.id, title) 호출", async () => {
    vi.spyOn(window, "prompt").mockReturnValue("새 나무");
    const onAddTree = vi.fn();
    render(<MandalartOverlay {...baseProps} onAddTree={onAddTree} />);
    await userEvent.click(screen.getByTestId("mandalart-empty-0"));
    expect(onAddTree).toHaveBeenCalledWith("f1", "새 나무");
    vi.restoreAllMocks();
  });

  it("빈 슬롯 클릭 + prompt 취소(null) → onAddTree 호출되지 않음", async () => {
    vi.spyOn(window, "prompt").mockReturnValue(null);
    const onAddTree = vi.fn();
    render(<MandalartOverlay {...baseProps} onAddTree={onAddTree} />);
    await userEvent.click(screen.getByTestId("mandalart-empty-0"));
    expect(onAddTree).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });
});
