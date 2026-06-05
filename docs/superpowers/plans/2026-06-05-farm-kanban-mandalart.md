# 농장 칸반 + 만다라트 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 농장 목록을 가로 스크롤 칸반 열로 재배치하고, 각 농장에서 3×3 만다라트 오버레이를 열 수 있도록 한다.

**Architecture:** `MandalartOverlay` 신규 컴포넌트를 만들고, `FarmCard`에 만다라트 버튼을 추가한다. `ProjectList`의 렌더링 컨테이너를 가로 스크롤 flex로 교체하되, 기존 `FarmCard` export는 유지한다.

**Tech Stack:** React 19, TypeScript, TailwindCSS v4, vitest + @testing-library/react

---

### Task 1: MandalartOverlay — 기본 그리드 렌더링 (TDD)

**Files:**
- Create: `src/components/garden/MandalartOverlay.test.tsx`
- Create: `src/components/garden/MandalartOverlay.tsx`

- [ ] **Step 1: 테스트 파일 작성**

`src/components/garden/MandalartOverlay.test.tsx` 전체 내용:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MandalartOverlay } from "./MandalartOverlay";
import type { Farm, Project, Task, Settings } from "@/lib/garden-store";

const baseFarm: Farm = { id: "f1", title: "테스트 농장", icon: "🌾", createdAt: 0, order: 0 };
const baseSettings: Settings = { morningTime: "07:00", eveningTime: "21:00" };

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
  settings: baseSettings,
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
});
```

- [ ] **Step 2: 테스트 실행 → FAIL 확인**

```bash
cd ~/daily-quest-keeper && npx vitest run src/components/garden/MandalartOverlay.test.tsx --reporter=verbose 2>&1 | tail -15
```

예상 결과: `Cannot find module './MandalartOverlay'`

- [ ] **Step 3: MandalartOverlay.tsx 구현**

`src/components/garden/MandalartOverlay.tsx` 전체 내용:

```tsx
import { useEffect } from "react";
import type { Farm, Project, Task, Settings } from "@/lib/garden-store";
import { treeStage, farmStage } from "@/lib/garden-store";
import { X, Plus } from "lucide-react";
import { TreeStageIcon, FarmStageIcon } from "./StageIcon";

type Props = {
  farm: Farm;
  trees: Project[];
  tasks: Task[];
  onClose: () => void;
  onToggleProject: (id: string) => void;
  onAddTree: (farmId: string, title: string) => void;
  settings: Settings;
};

// 3×3 그리드 슬롯 매핑: null = 중앙(농장), 0~7 = 나무 인덱스
const SLOT_MAP = [0, 1, 2, 3, null, 4, 5, 6, 7] as const;

export function MandalartOverlay({
  farm, trees, tasks, onClose, onToggleProject, onAddTree,
}: Props) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const slottedTrees = trees.slice(0, 8);
  const overflowTrees = trees.slice(8);

  const treeStats = trees.map(p => {
    const childTasks = tasks.filter(t => t.projectId === p.id);
    const total = childTasks.length;
    const done = childTasks.filter(t => t.completed).length;
    return total === 0 ? (p.completed ? 100 : 0) : (done / total) * 100;
  });
  const avgPct = treeStats.length === 0 ? 0 : treeStats.reduce((a, b) => a + b, 0) / treeStats.length;
  const stage = farmStage(trees.length, avgPct);

  const handleAddTree = (slotIdx: number) => {
    const title = window.prompt(`슬롯 ${slotIdx + 1}: 나무 이름을 입력하세요`);
    if (title?.trim()) onAddTree(farm.id, title.trim());
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-xl rounded-3xl bg-card border border-emerald-500/20 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-emerald-500/10">
          <div className="flex items-center gap-3">
            <FarmStageIcon tier={stage.tier as 1 | 2 | 3 | 4 | 5} size={28} />
            <div>
              <h2 className="font-bold text-emerald-300">{farm.title}</h2>
              <p className="text-[11px] text-muted-foreground">
                만다라트 · 나무 {trees.length}그루 · 평균 {Math.round(avgPct)}%
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="만다라트 닫기"
            className="p-2 rounded-xl hover:bg-white/5 text-muted-foreground hover:text-foreground transition"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* 3×3 그리드 */}
        <div className="p-5">
          <div className="grid grid-cols-3 gap-2" data-testid="mandalart-grid">
            {SLOT_MAP.map((slotIdx, cellPos) => {
              // 중앙 셀 (농장)
              if (slotIdx === null) {
                return (
                  <div
                    key="center"
                    data-testid="mandalart-center"
                    className="aspect-square flex flex-col items-center justify-center rounded-2xl bg-emerald-950/40 border-2 border-emerald-500/40 p-2 text-center"
                  >
                    <span className="text-xl mb-1">{farm.icon ?? "🌾"}</span>
                    <p className="text-[11px] font-bold text-emerald-300 leading-tight line-clamp-2">
                      {farm.title}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{Math.round(avgPct)}%</p>
                  </div>
                );
              }

              const tree = slottedTrees[slotIdx];

              // 빈 슬롯
              if (!tree) {
                return (
                  <button
                    key={`empty-${slotIdx}`}
                    data-testid={`mandalart-empty-${slotIdx}`}
                    onClick={() => handleAddTree(slotIdx)}
                    className="aspect-square flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 hover:border-emerald-500/30 hover:bg-emerald-950/20 text-muted-foreground hover:text-emerald-400 transition"
                  >
                    <Plus className="size-4" />
                  </button>
                );
              }

              // 나무 셀
              const childTasks = tasks.filter(t => t.projectId === tree.id);
              const total = childTasks.length;
              const done = childTasks.filter(t => t.completed).length;
              const pct = total === 0 ? (tree.completed ? 100 : 0) : (done / total) * 100;
              const tStage = treeStage(pct, tree.completed);

              return (
                <button
                  key={tree.id}
                  data-testid={`mandalart-tree-${tree.id}`}
                  onClick={() => onToggleProject(tree.id)}
                  className={`aspect-square flex flex-col items-center justify-center rounded-2xl border-2 p-2 text-center transition ${
                    tree.completed
                      ? "border-primary/30 bg-primary/5 opacity-60"
                      : "border-accent/20 bg-card hover:border-accent/50 hover:shadow-bloom"
                  }`}
                >
                  <TreeStageIcon tier={tStage.tier as 1 | 2 | 3 | 4 | 5} size={22} />
                  <p className="text-[10px] font-medium mt-1 leading-tight line-clamp-2 w-full">
                    {tree.title}
                  </p>
                  {total > 0 && (
                    <p className="text-[9px] text-primary/60 mt-0.5">{done}/{total}</p>
                  )}
                </button>
              );
            })}
          </div>

          {/* 8개 초과 나무 */}
          {overflowTrees.length > 0 && (
            <div className="mt-4 space-y-1" data-testid="mandalart-overflow">
              <p className="text-[10px] text-muted-foreground mb-2">
                나머지 나무 ({overflowTrees.length})
              </p>
              {overflowTrees.map(tree => (
                <button
                  key={tree.id}
                  data-testid={`mandalart-overflow-tree-${tree.id}`}
                  onClick={() => onToggleProject(tree.id)}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-card/60 border border-white/5 hover:border-accent/20 text-sm text-left transition"
                >
                  <span className={tree.completed ? "line-through text-muted-foreground" : ""}>
                    {tree.title}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: 테스트 실행 → PASS 확인**

```bash
cd ~/daily-quest-keeper && npx vitest run src/components/garden/MandalartOverlay.test.tsx --reporter=verbose 2>&1 | tail -15
```

예상 결과: `Tests 7 passed (7)`

- [ ] **Step 5: 커밋**

```bash
cd ~/daily-quest-keeper && git add src/components/garden/MandalartOverlay.tsx src/components/garden/MandalartOverlay.test.tsx && git commit -m "feat: MandalartOverlay 컴포넌트 — 3×3 그리드, 빈 슬롯, 초과 처리, 닫기"
```

---

### Task 2: FarmCard — 만다라트 버튼 추가 + 좌/우 이동 aria-label 업데이트 (TDD)

**Files:**
- Modify: `src/components/garden/FarmCard.test.tsx`
- Modify: `src/components/garden/ProjectList.tsx` (FarmCard 컴포넌트 부분)

- [ ] **Step 1: FarmCard.test.tsx 업데이트**

`src/components/garden/FarmCard.test.tsx` 전체 내용으로 교체:

```tsx
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
  it("◀ 버튼 클릭 시 onMoveUp(farm.id) 호출", async () => {
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
    await userEvent.click(screen.getByRole("button", { name: "농장 왼쪽으로 이동" }));
    expect(onMoveUp).toHaveBeenCalledTimes(1);
    expect(onMoveUp).toHaveBeenCalledWith("f1");
  });

  it("▶ 버튼 클릭 시 onMoveDown(farm.id) 호출", async () => {
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
    await userEvent.click(screen.getByRole("button", { name: "농장 오른쪽으로 이동" }));
    expect(onMoveDown).toHaveBeenCalledTimes(1);
    expect(onMoveDown).toHaveBeenCalledWith("f1");
  });

  it("isFirst=true 일 때 ◀ 버튼은 disabled", () => {
    render(
      <FarmCard
        {...baseProps}
        isFirst={true}
        isLast={false}
        onMoveUp={vi.fn()}
        onMoveDown={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "농장 왼쪽으로 이동" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "농장 오른쪽으로 이동" })).not.toBeDisabled();
  });

  it("isLast=true 일 때 ▶ 버튼은 disabled", () => {
    render(
      <FarmCard
        {...baseProps}
        isFirst={false}
        isLast={true}
        onMoveUp={vi.fn()}
        onMoveDown={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "농장 왼쪽으로 이동" })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: "농장 오른쪽으로 이동" })).toBeDisabled();
  });

  it("isFirst=true 상태에서 ◀ 클릭 — 핸들러 호출되지 않음", async () => {
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
    await userEvent.click(screen.getByRole("button", { name: "농장 왼쪽으로 이동" }));
    expect(onMoveUp).not.toHaveBeenCalled();
  });

  it("isLast=true 상태에서 ▶ 클릭 — 핸들러 호출되지 않음", async () => {
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
    await userEvent.click(screen.getByRole("button", { name: "농장 오른쪽으로 이동" }));
    expect(onMoveDown).not.toHaveBeenCalled();
  });

  it("만다라트 버튼 클릭 → 만다라트 오버레이 표시", async () => {
    render(
      <FarmCard
        {...baseProps}
        isFirst={false}
        isLast={false}
        onMoveUp={vi.fn()}
        onMoveDown={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "만다라트 보기" }));
    expect(screen.getByTestId("mandalart-center")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 테스트 실행 → FAIL 확인**

```bash
cd ~/daily-quest-keeper && npx vitest run src/components/garden/FarmCard.test.tsx --reporter=verbose 2>&1 | tail -20
```

예상 결과: aria-label "농장 왼쪽으로 이동" not found, "만다라트 보기" not found

- [ ] **Step 3: ProjectList.tsx — FarmCard 컴포넌트 수정**

`src/components/garden/ProjectList.tsx` 상단 import 블록에 추가:
- `ChevronLeft, ChevronRight` 추가 (ChevronUp, ChevronDown 교체)
- `LayoutGrid` 추가
- `MandalartOverlay` import 추가

```tsx
// 기존 import에서 ChevronUp, ChevronDown 제거하고 아래로 교체:
import {
  Check,
  Trash2,
  Plus,
  Trophy,
  Sparkles,
  CalendarDays,
  GripVertical,
  X,
  ChevronDown,
  ChevronRight,
  ChevronLeft,    // 추가
  Pencil,
  MoveRight,
  ExternalLink,
  Link2,
  LayoutGrid,    // 추가
} from "lucide-react";
import { MandalartOverlay } from "./MandalartOverlay";  // 추가
```

FarmCard 컴포넌트 상단에 `showMandalart` state 추가 및 헤더 버튼 수정:

`FarmCard` 함수 안의 state 선언 블록에 추가:
```tsx
const [showMandalart, setShowMandalart] = useState(false);
```

헤더 버튼 블록에서 ChevronUp→ChevronLeft, ChevronDown→ChevronRight, aria-label 변경:
```tsx
<button
  type="button"
  aria-label="농장 왼쪽으로 이동"          // "농장 위로 이동" → "농장 왼쪽으로 이동"
  disabled={isFirst}
  onClick={(e) => { e.stopPropagation(); onMoveUp(farm.id); }}
  className="p-1.5 rounded-lg hover:bg-white/5 text-muted-foreground hover:text-primary transition disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
  title="농장 왼쪽으로 이동"
>
  <ChevronLeft className="size-3.5" />    {/* ChevronUp → ChevronLeft */}
</button>
<button
  type="button"
  aria-label="농장 오른쪽으로 이동"        // "농장 아래로 이동" → "농장 오른쪽으로 이동"
  disabled={isLast}
  onClick={(e) => { e.stopPropagation(); onMoveDown(farm.id); }}
  className="p-1.5 rounded-lg hover:bg-white/5 text-muted-foreground hover:text-primary transition disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
  title="농장 오른쪽으로 이동"
>
  <ChevronRight className="size-3.5" />   {/* ChevronDown → ChevronRight */}
</button>
```

만다라트 버튼을 삭제 버튼 앞에 추가:
```tsx
<button
  onClick={(e) => { e.stopPropagation(); setShowMandalart(true); }}
  aria-label="만다라트 보기"
  className="p-1.5 rounded-lg hover:bg-emerald-500/10 text-muted-foreground hover:text-emerald-400 transition"
  title="만다라트 보기"
>
  <LayoutGrid className="size-3.5" />
</button>
```

FarmCard의 return 문을 Fragment로 감싸고 MandalartOverlay를 메인 div 밖에 추가 (fixed overlay이므로 DOM 위치 무관하지만 Fragment로 래핑):

```tsx
// 기존: return ( <div id={`farm-${farm.id}`} ...> ... </div> );
// 변경: Fragment로 감싸고 오버레이 추가
return (
  <>
    <div id={`farm-${farm.id}`} className="rounded-3xl border border-emerald-500/20 bg-emerald-950/20 overflow-hidden">
      {/* 기존 내용 그대로 */}
      ...
    </div>
    {showMandalart && (
      <MandalartOverlay
        farm={farm}
        trees={trees}
        tasks={tasks}
        onClose={() => setShowMandalart(false)}
        onToggleProject={onToggleProject}
        onAddTree={onAddTree}
        settings={settings}
      />
    )}
  </>
);
```

- [ ] **Step 4: 테스트 실행 → PASS 확인**

```bash
cd ~/daily-quest-keeper && npx vitest run src/components/garden/FarmCard.test.tsx --reporter=verbose 2>&1 | tail -15
```

예상 결과: `Tests 7 passed (7)`

- [ ] **Step 5: 전체 테스트 실행 → 기존 테스트 회귀 없음 확인**

```bash
cd ~/daily-quest-keeper && npx vitest run --reporter=verbose 2>&1 | tail -10
```

예상 결과: `Tests 116 passed` (기존 109 + 신규 7)

- [ ] **Step 6: 커밋**

```bash
cd ~/daily-quest-keeper && git add src/components/garden/FarmCard.test.tsx src/components/garden/ProjectList.tsx && git commit -m "feat: FarmCard — 만다라트 버튼 추가, 이동 버튼 좌우 방향으로 변경"
```

---

### Task 3: ProjectList — 가로 스크롤 칸반 레이아웃

**Files:**
- Modify: `src/components/garden/ProjectList.tsx` (ProjectList 컴포넌트 렌더링 부분)

이 task는 순수 레이아웃 변경이므로 `npm run dev`로 브라우저 확인으로 검증한다.

- [ ] **Step 1: ProjectList 컴포넌트의 렌더링 구조 변경**

`ProjectList` 함수 return 문에서 아래 두 부분을 수정한다.

**수정 전** (`return` 문 내 section 최하단의 "농장들" 및 "독립 나무들" 렌더링):

```tsx
{/* 농장들 */}
{sortedFarms.map((farm, idx) => (
  <FarmCard
    key={farm.id}
    ...
  />
))}

{/* 독립 나무들 */}
{standaloneTrees.length > 0 && (
  <div className="rounded-3xl border border-accent/20 bg-card/40 p-5 space-y-3">
    ...
  </div>
)}

{/* 빈 상태 */}
{projects.length === 0 && farms.length === 0 && (
  ...
)}
```

**수정 후**: section의 `space-y-4` 구조를 유지하되, 농장+독립나무 영역을 가로 스크롤 컨테이너로 감싼다.

```tsx
{/* 가로 스크롤 칸반 보드 */}
{(sortedFarms.length > 0 || standaloneTrees.length > 0) && (
  <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory -mx-1 px-1">
    {/* 농장 열들 */}
    {sortedFarms.map((farm, idx) => (
      <div
        key={farm.id}
        className="flex-none w-[260px] sm:w-[280px] snap-start"
      >
        <FarmCard
          farm={farm}
          trees={projects.filter(p => p.farmId === farm.id).sort((a, b) => (a.order ?? 0) - (b.order ?? 0))}
          tasks={tasks}
          rewardXp={rewardXp}
          allFarms={farms}
          availableTools={availableTools}
          onToggleProject={onToggle}
          onDeleteProject={onDelete}
          onDeleteFarm={onDeleteFarm}
          onUpdateFarm={onUpdateFarm}
          onToggleFarmTool={(toolId) => onToggleFarmTool(farm.id, toolId)}
          onUnassign={(taskId) => onAssignTask(taskId, null)}
          onMoveProjectToFarm={onMoveProjectToFarm}
          onAddTree={(farmId, title) => onAdd(title, undefined, undefined, farmId)}
          onAddSubTask={onAddSubTask}
          onToggleProjectTool={onToggleProjectTool}
          onUpdateProject={onUpdateProject}
          settings={settings}
          onAddTasksToProject={onAddTasksToProject}
          isFirst={idx === 0}
          isLast={idx === sortedFarms.length - 1}
          onMoveUp={(id) => onMoveFarm(id, "up")}
          onMoveDown={(id) => onMoveFarm(id, "down")}
        />
      </div>
    ))}

    {/* 독립 나무 열 */}
    {standaloneTrees.length > 0 && (
      <div className="flex-none w-[260px] sm:w-[280px] snap-start">
        <div className="rounded-3xl border border-accent/20 bg-card/40 overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-accent/10">
            <span>🌱</span>
            <span className="font-bold text-sm">독립 나무</span>
            <span className="text-xs text-muted-foreground">({standaloneTrees.length}그루)</span>
          </div>
          <div className="p-4 space-y-2.5">
            <SortableContext items={standaloneTrees.map(p => p.id)} strategy={verticalListSortingStrategy}>
              {standaloneTrees.map(p => (
                <ProjectCard
                  key={p.id}
                  p={p}
                  childTasks={tasks.filter(t => t.projectId === p.id)}
                  rewardXp={rewardXp}
                  farms={farms}
                  availableTools={availableTools}
                  onToggle={onToggle}
                  onDelete={onDelete}
                  onUnassign={(taskId) => onAssignTask(taskId, null)}
                  onMoveToFarm={(farmId) => onMoveProjectToFarm(p.id, farmId)}
                  onToggleProjectTool={(toolId) => onToggleProjectTool(p.id, toolId)}
                  onUpdateProject={(patch) => onUpdateProject(p.id, patch)}
                  onAddSubTask={onAddSubTask}
                  settings={settings}
                  onAddTasksToProject={onAddTasksToProject}
                />
              ))}
            </SortableContext>
          </div>
        </div>
      </div>
    )}

    {/* 농장 추가 버튼 열 */}
    <div className="flex-none w-[200px] snap-start flex items-start pt-1">
      <button
        type="button"
        onClick={() => setShowAddFarm(v => !v)}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl border border-dashed border-emerald-500/20 hover:border-emerald-500/40 hover:bg-emerald-950/20 text-emerald-400/60 hover:text-emerald-400 text-sm transition"
      >
        <Plus className="size-4" /> 농장 만들기
      </button>
    </div>
  </div>
)}

{/* 빈 상태 */}
{projects.length === 0 && farms.length === 0 && (
  <div className="rounded-3xl border border-dashed border-white/10 p-10 text-center space-y-3">
    <p className="text-4xl">🌱</p>
    <p className="text-muted-foreground text-sm">아직 아무것도 없어요.</p>
    <p className="text-muted-foreground/60 text-xs">나무를 심거나 농장을 만들어보세요.</p>
  </div>
)}
```

또한 헤더의 "농장 만들기" 버튼은 유지하되, 섹션 상단 버튼 영역에서 제거할 필요는 없음 (두 곳 모두 존재해도 무방).

- [ ] **Step 2: 개발 서버 실행 → 브라우저로 확인**

```bash
cd ~/daily-quest-keeper && npm run dev
```

확인 항목:
- 농장들이 가로로 나열되는가
- 모바일 뷰에서 스와이프로 열 전환되는가
- 농장 헤더의 만다라트 버튼(LayoutGrid 아이콘) 클릭 시 오버레이 표시되는가
- 오버레이에서 ESC / X 버튼으로 닫히는가
- 나무 셀 클릭 시 완료 토글되는가

- [ ] **Step 3: 전체 테스트 실행 → 회귀 없음 확인**

```bash
cd ~/daily-quest-keeper && npx vitest run --reporter=verbose 2>&1 | tail -10
```

예상 결과: `Tests 116 passed`

- [ ] **Step 4: 커밋**

```bash
cd ~/daily-quest-keeper && git add src/components/garden/ProjectList.tsx && git commit -m "feat: ProjectList — 농장 가로 스크롤 칸반 열 레이아웃"
```

---

## 완료 체크리스트

- [ ] MandalartOverlay 테스트 7개 통과
- [ ] FarmCard 테스트 7개 통과 (기존 6 → 업데이트 + 신규 1)
- [ ] 전체 테스트 116개 통과 (회귀 없음)
- [ ] 브라우저에서 칸반 가로 스크롤 동작 확인
- [ ] 브라우저에서 만다라트 오버레이 열기/닫기 확인
- [ ] 모바일 스냅 스크롤 동작 확인
