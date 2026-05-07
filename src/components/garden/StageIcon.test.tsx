import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { TreeStageIcon, FarmStageIcon } from "./StageIcon";

describe("TreeStageIcon", () => {
  it("tier 1 → Sprout 아이콘 + tier 데이터 속성", () => {
    const { container } = render(<TreeStageIcon tier={1} />);
    const root = container.querySelector("[data-stage-tier='1']");
    expect(root).toBeInTheDocument();
    expect(root?.querySelector("[data-lucide-icon='sprout']")).toBeInTheDocument();
  });

  it("tier 2 → Sprout 아이콘", () => {
    const { container } = render(<TreeStageIcon tier={2} />);
    expect(
      container.querySelector("[data-stage-tier='2'] [data-lucide-icon='sprout']"),
    ).toBeInTheDocument();
  });

  it("tier 3 → TreePine 아이콘", () => {
    const { container } = render(<TreeStageIcon tier={3} />);
    expect(
      container.querySelector("[data-stage-tier='3'] [data-lucide-icon='tree-pine']"),
    ).toBeInTheDocument();
  });

  it("tier 4 → TreePine 아이콘", () => {
    const { container } = render(<TreeStageIcon tier={4} />);
    expect(
      container.querySelector("[data-stage-tier='4'] [data-lucide-icon='tree-pine']"),
    ).toBeInTheDocument();
  });

  it("tier 5 → Trophy 아이콘 + halo", () => {
    const { container } = render(<TreeStageIcon tier={5} />);
    const root = container.querySelector("[data-stage-tier='5']");
    expect(root).toBeInTheDocument();
    expect(root?.querySelector("[data-lucide-icon='trophy']")).toBeInTheDocument();
    expect(root?.querySelector("[data-stage-halo]")).toBeInTheDocument();
  });

  it("tier 1~4에는 halo 없음", () => {
    for (const t of [1, 2, 3, 4] as const) {
      const { container } = render(<TreeStageIcon tier={t} />);
      expect(container.querySelector("[data-stage-halo]")).not.toBeInTheDocument();
    }
  });
});

describe("FarmStageIcon", () => {
  it("tier 1 → Mountain 아이콘", () => {
    const { container } = render(<FarmStageIcon tier={1} />);
    expect(
      container.querySelector("[data-stage-tier='1'] [data-lucide-icon='mountain']"),
    ).toBeInTheDocument();
  });

  it("tier 2 → Sprout 아이콘", () => {
    const { container } = render(<FarmStageIcon tier={2} />);
    expect(
      container.querySelector("[data-stage-tier='2'] [data-lucide-icon='sprout']"),
    ).toBeInTheDocument();
  });

  it("tier 3 → TreePine 아이콘", () => {
    const { container } = render(<FarmStageIcon tier={3} />);
    expect(
      container.querySelector("[data-stage-tier='3'] [data-lucide-icon='tree-pine']"),
    ).toBeInTheDocument();
  });

  it("tier 4 → Wheat 아이콘", () => {
    const { container } = render(<FarmStageIcon tier={4} />);
    expect(
      container.querySelector("[data-stage-tier='4'] [data-lucide-icon='wheat']"),
    ).toBeInTheDocument();
  });

  it("tier 5 → Castle 아이콘 + halo", () => {
    const { container } = render(<FarmStageIcon tier={5} />);
    const root = container.querySelector("[data-stage-tier='5']");
    expect(root?.querySelector("[data-lucide-icon='castle']")).toBeInTheDocument();
    expect(root?.querySelector("[data-stage-halo]")).toBeInTheDocument();
  });
});
