import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FarmCard } from "./ProjectList";
import type { Farm } from "@/lib/garden-store";

const baseFarm: Farm = {
  id: "f1",
  title: "테스트 농장",
  createdAt: 0,
  order: 0,
};

const baseProps = {
  farm: baseFarm,
  trees: [],
  tasks: [],
  rewardXp: 10,
  allFarms: [baseFarm],
  availableTools: [],
  onToggleProject: vi.fn(),
  onDeleteProject: vi.fn(),
  onDeleteFarm: vi.fn(),
  onUpdateFarm: vi.fn(),
  onToggleFarmTool: vi.fn(),
  onUnassign: vi.fn(),
  onMoveProjectToFarm: vi.fn(),
  onAddTree: vi.fn(),
  onAddSubTask: vi.fn(),
  onToggleProjectTool: vi.fn(),
  onUpdateProject: vi.fn(),
  settings: {
    morningTime: "07:00",
    eveningTime: "21:00",
  },
  onAddTasksToProject: vi.fn(),
};

describe("FarmCard 순서 변경 버튼", () => {
  it("▲ 버튼 클릭 시 onMoveUp(farm.id) 호출", async () => {
    const onMoveUp = vi.fn();
    render(
      <FarmCard
        {...baseProps}
        isFirst={false}
        isLast={false}
        onMoveUp={onMoveUp}
        onMoveDown={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "농장 위로 이동" }));
    expect(onMoveUp).toHaveBeenCalledTimes(1);
    expect(onMoveUp).toHaveBeenCalledWith("f1");
  });

  it("▼ 버튼 클릭 시 onMoveDown(farm.id) 호출", async () => {
    const onMoveDown = vi.fn();
    render(
      <FarmCard
        {...baseProps}
        isFirst={false}
        isLast={false}
        onMoveUp={vi.fn()}
        onMoveDown={onMoveDown}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "농장 아래로 이동" }));
    expect(onMoveDown).toHaveBeenCalledTimes(1);
    expect(onMoveDown).toHaveBeenCalledWith("f1");
  });

  it("isFirst=true 일 때 ▲ 버튼은 disabled", () => {
    render(
      <FarmCard
        {...baseProps}
        isFirst={true}
        isLast={false}
        onMoveUp={vi.fn()}
        onMoveDown={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "농장 위로 이동" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "농장 아래로 이동" })).not.toBeDisabled();
  });

  it("isLast=true 일 때 ▼ 버튼은 disabled", () => {
    render(
      <FarmCard
        {...baseProps}
        isFirst={false}
        isLast={true}
        onMoveUp={vi.fn()}
        onMoveDown={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "농장 위로 이동" })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: "농장 아래로 이동" })).toBeDisabled();
  });

  it("isFirst=true 상태에서 ▲ 클릭 — 핸들러 호출되지 않음", async () => {
    const onMoveUp = vi.fn();
    render(
      <FarmCard
        {...baseProps}
        isFirst={true}
        isLast={false}
        onMoveUp={onMoveUp}
        onMoveDown={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "농장 위로 이동" }));
    expect(onMoveUp).not.toHaveBeenCalled();
  });

  it("isLast=true 상태에서 ▼ 클릭 — 핸들러 호출되지 않음", async () => {
    const onMoveDown = vi.fn();
    render(
      <FarmCard
        {...baseProps}
        isFirst={false}
        isLast={true}
        onMoveUp={vi.fn()}
        onMoveDown={onMoveDown}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "농장 아래로 이동" }));
    expect(onMoveDown).not.toHaveBeenCalled();
  });
});
