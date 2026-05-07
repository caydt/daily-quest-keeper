import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TaskList } from "./TaskList";

describe("TaskList 멀티라인 paste", () => {
  it("개행 포함 텍스트 paste → onAdd가 줄 수만큼 호출", () => {
    const onAdd = vi.fn();
    render(
      <TaskList
        tasks={[]}
        onToggle={vi.fn()}
        onDelete={vi.fn()}
        onPostpone={vi.fn()}
        onAdd={onAdd}
        onReorder={vi.fn()}
      />,
    );

    const input = screen.getByPlaceholderText("새로운 씨앗 심기...") as HTMLInputElement;

    const clipboardData = {
      getData: (type: string) => (type === "text" ? "할일1\n할일2\n할일3" : ""),
    } as DataTransfer;
    const event = new Event("paste", { bubbles: true, cancelable: true }) as ClipboardEvent;
    Object.defineProperty(event, "clipboardData", { value: clipboardData });
    input.dispatchEvent(event);

    expect(onAdd).toHaveBeenCalledTimes(3);
    expect(onAdd.mock.calls[0][0]).toBe("할일1");
    expect(onAdd.mock.calls[1][0]).toBe("할일2");
    expect(onAdd.mock.calls[2][0]).toBe("할일3");
  });

  it("개행 없는 paste → onAdd 호출 안 됨 (기본 paste 동작)", () => {
    const onAdd = vi.fn();
    render(
      <TaskList
        tasks={[]}
        onToggle={vi.fn()}
        onDelete={vi.fn()}
        onPostpone={vi.fn()}
        onAdd={onAdd}
        onReorder={vi.fn()}
      />,
    );

    const input = screen.getByPlaceholderText("새로운 씨앗 심기...") as HTMLInputElement;
    const clipboardData = {
      getData: (type: string) => (type === "text" ? "단일항목" : ""),
    } as DataTransfer;
    const event = new Event("paste", { bubbles: true, cancelable: true }) as ClipboardEvent;
    Object.defineProperty(event, "clipboardData", { value: clipboardData });
    input.dispatchEvent(event);

    expect(onAdd).not.toHaveBeenCalled();
  });
});
