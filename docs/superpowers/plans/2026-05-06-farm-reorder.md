# 농장 순서 변경 기능 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 농장 카드 헤더에 ▲▼ 버튼을 추가해 사용자가 농장 표시 순서를 직접 바꿀 수 있게 한다. 변경은 즉시 메인/맵 화면에 반영되고 자동저장된다.

**Architecture:** `Farm` 타입에 이미 존재하는 `order` 필드를 활용한다. `useGarden`에 `moveFarm(id, direction)` 액션을 추가해 인접 농장과 `order` 값을 swap한다. UI는 `FarmCard`(현재 `ProjectList.tsx` 내부 함수)에 ▲▼ 버튼을 붙이고 첫/마지막 위치에서는 `disabled + opacity-30`으로 처리한다. 동시에 vitest 기반 테스트 인프라를 신설해 store와 컴포넌트를 단위 테스트한다.

**Tech Stack:** React 19, TanStack Router, Tailwind v4, Vite 7, lucide-react. 신규: vitest, @testing-library/react, @testing-library/jest-dom, jsdom.

**Spec:** `docs/superpowers/specs/2026-05-06-farm-reorder-design.md`

---

## File Structure

**Created:**
- `src/test-setup.ts` — `@testing-library/jest-dom` 매처 등록
- `src/lib/garden-store.test.ts` — `moveFarm` 단위 테스트
- `src/components/garden/FarmCard.test.tsx` — `FarmCard` 렌더 + 인터랙션 테스트

**Modified:**
- `package.json` — devDependencies + test scripts
- `vite.config.ts` — vitest 설정 추가
- `src/lib/garden-store.ts` — `moveFarm` 액션 추가, `useGarden` 반환에 노출
- `src/components/garden/ProjectList.tsx` — `FarmCard` export, props 확장(`isFirst`/`isLast`/`onMoveUp`/`onMoveDown`), ▲▼ 버튼 렌더, `Props` 타입에 `onMoveFarm` 추가, `sortedFarms.map` 호출부에 어댑터 전달
- `src/routes/index.tsx` — `useGarden`에서 `moveFarm` 분해, `ProjectList`에 `onMoveFarm` 전달

---

## Task 1: 테스트 인프라 도입

**Files:**
- Modify: `package.json`
- Modify: `vite.config.ts`
- Create: `src/test-setup.ts`
- Create: `src/lib/sanity.test.ts` (임시, Task 2에서 삭제)

- [ ] **Step 1: devDependencies 설치**

```bash
cd /Users/ayoungjo/daily-quest-keeper
bun add -d vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom @vitest/ui
```

(이 프로젝트는 `bun.lockb`가 있으므로 bun 사용. `npm install` 도 가능하지만 lockfile이 갈라질 수 있음.)

- [ ] **Step 2: `package.json` scripts에 test 추가**

`package.json`의 `"scripts"` 객체에서 기존 항목 다음에 추가:

```json
{
  "scripts": {
    "dev": "vite dev",
    "build": "vite build",
    "build:dev": "vite build --mode development",
    "preview": "vite preview",
    "lint": "eslint .",
    "format": "prettier --write .",
    "test": "vitest",
    "test:run": "vitest run"
  }
}
```

- [ ] **Step 3: `vite.config.ts`에 test 설정 추가**

기존 `vite.config.ts`의 `defineConfig({...})` 호출에 `test` 항목을 추가한다. 파일 상단에 `/// <reference types="vitest" />` 한 줄을 추가하고, `defineConfig`에 다음을 병합:

```ts
test: {
  environment: "jsdom",
  globals: true,
  setupFiles: ["./src/test-setup.ts"],
  css: false,
},
```

(이미 다른 옵션들이 있으면 그 옆에 `test`만 추가하면 됨. 기존 옵션을 지우지 말 것.)

- [ ] **Step 4: `src/test-setup.ts` 생성**

```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 5: `src/lib/sanity.test.ts` 생성 — 인프라 동작 확인**

```ts
import { describe, it, expect } from "vitest";

describe("test infra sanity", () => {
  it("runs", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 6: 테스트 러너 동작 확인**

```bash
bun run test:run
```

기대 결과: sanity 테스트 1개 PASS. jsdom 환경, jest-dom 매처가 로드된 상태로 종료 코드 0.

실패 시: `vite.config.ts`의 `test` 위치 / `setupFiles` 경로 / `vitest` 버전 호환성 점검.

- [ ] **Step 7: 커밋**

```bash
git add package.json bun.lockb vite.config.ts src/test-setup.ts src/lib/sanity.test.ts
git commit -m "chore(test): vitest + testing-library 인프라 도입"
```

---

## Task 2: `moveFarm` — 중간 위치 ▲ swap (RED→GREEN)

**Files:**
- Create: `src/lib/garden-store.test.ts`
- Modify: `src/lib/garden-store.ts`
- Delete: `src/lib/sanity.test.ts`

- [ ] **Step 1: localStorage 키 확인**

```bash
grep -n "localStorage\|getItem\|setItem" /Users/ayoungjo/daily-quest-keeper/src/lib/storage.ts | head
```

`createLocalAdapter()`가 사용하는 키 상수(예: `"garden-state"` 등)를 메모. Step 2에서 `STORAGE_KEY` 자리에 그대로 사용한다.

- [ ] **Step 2: 실패 테스트 작성 — `garden-store.test.ts`**

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useGarden, type Farm } from "./garden-store";

const STORAGE_KEY = "<Step 1에서 확인한 키>";

const farm = (id: string, order: number, title = id): Farm => ({
  id,
  title,
  createdAt: 0,
  order,
});

const seedAndHydrate = async (farms: Farm[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ farms }));
  const { result } = renderHook(() => useGarden());
  await waitFor(() => expect(result.current.hydrated).toBe(true));
  return result;
};

describe("moveFarm", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("중간 농장 ▲ 클릭: 위 농장과 order swap", async () => {
    const result = await seedAndHydrate([farm("a", 0), farm("b", 1), farm("c", 2)]);

    act(() => {
      result.current.moveFarm("b", "up");
    });

    const byId = Object.fromEntries(result.current.state.farms.map((f) => [f.id, f.order]));
    expect(byId).toEqual({ a: 1, b: 0, c: 2 });
  });
});
```

- [ ] **Step 3: 테스트 실행 — RED 확인**

```bash
bun run test:run src/lib/garden-store.test.ts
```

기대: `result.current.moveFarm is not a function` 으로 FAIL.

- [ ] **Step 4: `garden-store.ts`에 `moveFarm` 추가**

`src/lib/garden-store.ts`의 다른 액션들(`addFarm`, `deleteFarm` 등) 근처(대략 line 800 부근)에 추가:

```ts
const moveFarm = useCallback((id: string, direction: "up" | "down") => {
  setState((s) => {
    const sorted = [...s.farms].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const idx = sorted.findIndex((f) => f.id === id);
    if (idx === -1) return s;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return s;

    const a = sorted[idx];
    const b = sorted[swapIdx];
    const orderA = a.order ?? idx;
    const orderB = b.order ?? swapIdx;
    return {
      ...s,
      farms: s.farms.map((f) => {
        if (f.id === a.id) return { ...f, order: orderB };
        if (f.id === b.id) return { ...f, order: orderA };
        return f;
      }),
    };
  });
}, []);
```

`useGarden`의 return 객체(line 932 근처, `addFarm` 다음 줄들)에 `moveFarm` 추가:

```ts
return {
  state,
  hydrated,
  // ...
  addFarm,
  deleteFarm,
  updateFarm,
  toggleFarmTool,
  moveFarm,  // ← 추가
  moveProjectToFarm,
  // ...
};
```

- [ ] **Step 5: 테스트 실행 — GREEN 확인**

```bash
bun run test:run src/lib/garden-store.test.ts
```

기대: 1 passed.

- [ ] **Step 6: sanity 테스트 삭제**

```bash
rm /Users/ayoungjo/daily-quest-keeper/src/lib/sanity.test.ts
```

- [ ] **Step 7: 커밋**

```bash
git add src/lib/garden-store.ts src/lib/garden-store.test.ts
git rm src/lib/sanity.test.ts
git commit -m "feat(store): moveFarm 액션 — 인접 농장과 order swap (▲)"
```

---

## Task 3: `moveFarm` — ▼ + 경계 + 미존재 id (RED→GREEN)

**Files:**
- Modify: `src/lib/garden-store.test.ts`

- [ ] **Step 1: 4개 케이스 추가**

`describe("moveFarm", ...)` 블록 안에 추가. Task 2의 헬퍼/`beforeEach`/seed 패턴 그대로 재사용:

```ts
it("중간 농장 ▼ 클릭: 아래 농장과 order swap", async () => {
  const result = await seedAndHydrate([farm("a", 0), farm("b", 1), farm("c", 2)]);

  act(() => {
    result.current.moveFarm("b", "down");
  });

  const byId = Object.fromEntries(result.current.state.farms.map((f) => [f.id, f.order]));
  expect(byId).toEqual({ a: 0, b: 2, c: 1 });
});

it("첫 농장 ▲ 클릭: no-op", async () => {
  const result = await seedAndHydrate([farm("a", 0), farm("b", 1)]);

  act(() => {
    result.current.moveFarm("a", "up");
  });

  const byId = Object.fromEntries(result.current.state.farms.map((f) => [f.id, f.order]));
  expect(byId).toEqual({ a: 0, b: 1 });
});

it("마지막 농장 ▼ 클릭: no-op", async () => {
  const result = await seedAndHydrate([farm("a", 0), farm("b", 1)]);

  act(() => {
    result.current.moveFarm("b", "down");
  });

  const byId = Object.fromEntries(result.current.state.farms.map((f) => [f.id, f.order]));
  expect(byId).toEqual({ a: 0, b: 1 });
});

it("존재하지 않는 id: no-op", async () => {
  const result = await seedAndHydrate([farm("a", 0), farm("b", 1)]);

  act(() => {
    result.current.moveFarm("ghost", "up");
  });

  const byId = Object.fromEntries(result.current.state.farms.map((f) => [f.id, f.order]));
  expect(byId).toEqual({ a: 0, b: 1 });
});
```

- [ ] **Step 2: 테스트 실행**

```bash
bun run test:run src/lib/garden-store.test.ts
```

기대: 5 passed (Task 2의 1개 + 추가 4개). Task 2 구현이 이미 경계/미존재를 처리하므로 GREEN 바로 통과해야 함. 만약 실패하면 구현 로직(`if (idx === -1) return s; if (swapIdx < 0 || swapIdx >= sorted.length) return s;`) 점검.

- [ ] **Step 3: 커밋**

```bash
git add src/lib/garden-store.test.ts
git commit -m "test(store): moveFarm 경계/미존재 id 케이스 보강"
```

---

## Task 4: `FarmCard` export 노출

**Files:**
- Modify: `src/components/garden/ProjectList.tsx`

이번 작업의 목적은 단지 테스트에서 `FarmCard`를 import 가능하게 만드는 것. 다음 Task의 RED를 위해 **이 Task에서는 props/렌더는 변경하지 않는다.**

- [ ] **Step 1: `function FarmCard(...)` 앞에 `export` 추가**

`src/components/garden/ProjectList.tsx:456` 라인을 다음과 같이 변경:

```tsx
// 테스트 노출용 export — 외부 사용 금지, 다른 모듈에서 import하지 말 것
export function FarmCard({
  farm,
  trees,
  // ...
```

- [ ] **Step 2: lint + 빌드 점검**

```bash
bun run lint
bun run build
```

기대: 둘 다 성공. `FarmCard` export가 다른 곳에서 안 쓰이므로 unused 경고 없음. (`ProjectList.tsx` 내부에서 이미 사용.)

- [ ] **Step 3: 커밋**

```bash
git add src/components/garden/ProjectList.tsx
git commit -m "refactor(garden): FarmCard export 추가 — 단위 테스트 진입점"
```

---

## Task 5: `FarmCard` ▲▼ 버튼 — 클릭 핸들러 (RED→GREEN)

**Files:**
- Create: `src/components/garden/FarmCard.test.tsx`
- Modify: `src/components/garden/ProjectList.tsx` (FarmCard 본문)

- [ ] **Step 1: 실패 테스트 작성 — `FarmCard.test.tsx`**

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
});
```

- [ ] **Step 2: 테스트 실행 — RED 확인**

```bash
bun run test:run src/components/garden/FarmCard.test.tsx
```

기대: TS 에러 (`Property 'isFirst' does not exist...`) 또는 런타임 — `getByRole`이 버튼을 찾지 못해 FAIL.

- [ ] **Step 3: `FarmCard` props 타입에 4개 추가**

`src/components/garden/ProjectList.tsx`의 `FarmCard` 시그니처 파라미터 분해 객체 + 타입 객체 양쪽에 추가:

파라미터 분해 (line 456~):
```tsx
export function FarmCard({
  farm,
  trees,
  tasks,
  rewardXp,
  allFarms,
  availableTools,
  onToggleProject,
  onDeleteProject,
  onDeleteFarm,
  onUpdateFarm,
  onToggleFarmTool,
  onUnassign,
  onMoveProjectToFarm,
  onAddTree,
  onAddSubTask,
  onToggleProjectTool,
  onUpdateProject,
  settings,
  onAddTasksToProject,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
}: {
  farm: Farm;
  // ...기존...
  onAddTasksToProject: (projectId: string | null, titles: string[]) => void;
  isFirst: boolean;
  isLast: boolean;
  onMoveUp: (farmId: string) => void;
  onMoveDown: (farmId: string) => void;
}) {
```

- [ ] **Step 4: 헤더 우측 액션 영역에 ▲▼ 버튼 추가**

`src/components/garden/ProjectList.tsx`의 농장 헤더 액션 영역(line 575의 `<div className="flex items-center gap-1 shrink-0">`) — 가장 처음 위치(MessageCircle 버튼 앞)에 두 버튼 삽입:

```tsx
<div className="flex items-center gap-1 shrink-0">
  <button
    type="button"
    aria-label="농장 위로 이동"
    disabled={isFirst}
    onClick={(e) => { e.stopPropagation(); onMoveUp(farm.id); }}
    className="p-1.5 rounded-lg hover:bg-white/5 text-muted-foreground hover:text-primary transition disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
    title="농장 위로 이동"
  >
    <ChevronUp className="size-3.5" />
  </button>
  <button
    type="button"
    aria-label="농장 아래로 이동"
    disabled={isLast}
    onClick={(e) => { e.stopPropagation(); onMoveDown(farm.id); }}
    className="p-1.5 rounded-lg hover:bg-white/5 text-muted-foreground hover:text-primary transition disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
    title="농장 아래로 이동"
  >
    <ChevronDown className="size-3.5" />
  </button>
  {/* 기존 MessageCircle 버튼부터 그대로 ... */}
```

`ChevronUp`, `ChevronDown` 임포트가 빠져 있으면 `lucide-react` import에 추가:

```tsx
import { ChevronDown, ChevronRight, ChevronUp, /* 기존... */ } from "lucide-react";
```

(파일 상단에서 `ChevronDown`은 이미 사용 중. `ChevronUp`만 신규.)

- [ ] **Step 5: 테스트 실행 — GREEN 확인**

```bash
bun run test:run src/components/garden/FarmCard.test.tsx
```

기대: 2 passed.

- [ ] **Step 6: 커밋**

```bash
git add src/components/garden/ProjectList.tsx src/components/garden/FarmCard.test.tsx
git commit -m "feat(garden): FarmCard ▲▼ 순서 변경 버튼"
```

---

## Task 6: `FarmCard` 버튼 — disabled 상태 (RED→GREEN)

**Files:**
- Modify: `src/components/garden/FarmCard.test.tsx`

Task 5에서 이미 `disabled={isFirst}` / `disabled={isLast}` 를 구현했으므로 이번 Task는 회귀 테스트 성격이지만, TDD 흐름상 명시적으로 케이스를 작성한다.

- [ ] **Step 1: 4개 케이스 추가**

`describe("FarmCard 순서 변경 버튼", ...)` 안에 추가:

```tsx
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
```

- [ ] **Step 2: 테스트 실행**

```bash
bun run test:run src/components/garden/FarmCard.test.tsx
```

기대: 6 passed (Task 5의 2개 + 추가 4개).

- [ ] **Step 3: 커밋**

```bash
git add src/components/garden/FarmCard.test.tsx
git commit -m "test(garden): FarmCard 버튼 disabled 상태 보강"
```

---

## Task 7: `ProjectList` → `FarmCard` 연결

**Files:**
- Modify: `src/components/garden/ProjectList.tsx` (Props 타입 + 메인 컴포넌트 매핑)

- [ ] **Step 1: `Props` 타입에 `onMoveFarm` 추가**

`Props` 타입(파일 상단부, `ProjectList`에 전달되는 props 정의 부분) 끝에 추가:

```ts
type Props = {
  // ...기존...
  onAddSubTask: (projectId: string, title: string) => void;
  onMoveFarm: (id: string, direction: "up" | "down") => void;
};
```

(타입 위치는 `ProjectList` 함수 시그니처 직전. 정확한 라인은 파일을 열어 확인.)

- [ ] **Step 2: 분해 파라미터에 `onMoveFarm` 추가**

`ProjectList`의 파라미터 분해(line 731~):

```tsx
export function ProjectList({
  // ...기존...
  onAddSubTask,
  onMoveFarm,
}: Props) {
```

- [ ] **Step 3: `sortedFarms.map` 호출부에 4개 prop 전달**

`ProjectList.tsx:898` 근처의 `<FarmCard ...>` 호출부에 idx 추가 + props 전달. 변경 전:

```tsx
{sortedFarms.map((farm) => (
  <FarmCard
    key={farm.id}
    farm={farm}
    // ...기존 props
  />
))}
```

변경 후 (만약 이미 `idx` 분해돼 있으면 재사용, 없으면 추가):

```tsx
{sortedFarms.map((farm, idx) => (
  <FarmCard
    key={farm.id}
    farm={farm}
    isFirst={idx === 0}
    isLast={idx === sortedFarms.length - 1}
    onMoveUp={(id) => onMoveFarm(id, "up")}
    onMoveDown={(id) => onMoveFarm(id, "down")}
    // ...기존 props 그대로
  />
))}
```

- [ ] **Step 4: lint + typecheck**

```bash
bun run lint
bun run build
```

기대: 둘 다 성공. `Props` 타입에 `onMoveFarm`을 추가했으므로 호출 측(`index.tsx`)이 prop을 빠뜨리면 다음 Task에서 typecheck 에러로 잡힘 — 정상.

빌드가 `index.tsx`의 누락된 prop으로 실패하면 다음 Task로 진행해도 좋고, 다음 Task의 변경을 미리 적용해도 좋다.

- [ ] **Step 5: 커밋**

```bash
git add src/components/garden/ProjectList.tsx
git commit -m "feat(garden): ProjectList에서 FarmCard로 onMoveFarm 전달"
```

---

## Task 8: `index.tsx` 연결 + 빌드 통과

**Files:**
- Modify: `src/routes/index.tsx`

- [ ] **Step 1: `useGarden()` 분해에 `moveFarm` 추가**

`src/routes/index.tsx`에서 `useGarden()`의 결과를 분해하는 부분(파일 상단 컴포넌트 본체)에 `moveFarm` 추가:

```tsx
const {
  state,
  // ...기존...
  addFarm,
  deleteFarm,
  updateFarm,
  toggleFarmTool,
  moveFarm,  // ← 추가
  moveProjectToFarm,
  // ...기존...
} = useGarden();
```

- [ ] **Step 2: `<ProjectList ... />` 호출부에 `onMoveFarm` 전달**

`src/routes/index.tsx:292~313` 근처의 `<ProjectList ...>` 호출:

```tsx
<ProjectList
  projects={state.projects}
  farms={state.farms}
  // ...기존...
  onAddSubTask={addSubTask}
  settings={state.settings}
  onAddTasksToProject={handleAddTasksToProject}
  onMoveFarm={moveFarm}  // ← 추가
/>
```

- [ ] **Step 3: 빌드 + 전체 테스트**

```bash
bun run build
bun run test:run
```

기대: 빌드 성공, 전체 테스트(store 5 + FarmCard 6 = 11) 모두 PASS.

- [ ] **Step 4: 커밋**

```bash
git add src/routes/index.tsx
git commit -m "feat(garden): index.tsx에서 moveFarm을 ProjectList로 전달"
```

---

## Task 9: 수동 검증

**Files:** 코드 변경 없음. dev 서버에서 직접 동작 확인.

- [ ] **Step 1: dev 서버 실행**

```bash
cd /Users/ayoungjo/daily-quest-keeper
bun run dev
```

브라우저에서 출력된 URL 열기 (보통 `http://localhost:5173`).

- [ ] **Step 2: 시나리오 검증**

농장 2개 이상 만든 상태에서 다음을 확인:

1. 첫 농장의 ▲ 버튼 — 흐리게 + 클릭 시 무반응 ✓
2. 마지막 농장의 ▼ 버튼 — 흐리게 + 클릭 시 무반응 ✓
3. 중간 농장 ▲ — 위 농장과 위치 교환, 즉시 반영 ✓
4. 중간 농장 ▼ — 아래 농장과 위치 교환, 즉시 반영 ✓
5. 페이지 새로고침 → 변경된 순서 유지 (localStorage 저장 확인) ✓
6. `/map` 페이지로 이동 → 같은 순서로 표시 ✓
7. (Apps Script URL 설정돼 있다면) Google Sheets 측 데이터에도 새 order 반영되는지 확인 ✓

문제 발견 시: 콘솔 에러 확인 → 해당 Task로 돌아가 테스트 추가 + 수정 → 다시 검증.

- [ ] **Step 3: 모바일 뷰포트 확인**

Chrome DevTools → toggle device toolbar → iPhone 14 (390×844) — ▲▼ 버튼이 다른 헤더 액션과 겹치지 않고 충분한 터치 타겟(최소 28px) 갖는지 확인. 문제 시 `p-1.5 size-3.5` 대신 `p-2 size-4` 로 키운다.

검증 통과 후 추가 커밋 불필요. 변경 사항이 있다면 Task 5로 돌아가 테스트와 함께 보강.

---

## 완료 후 다음 단계

이 plan 완료 후, brainstorming의 다음 sub-project로 진행:

- **C. "오늘의 임무" 위로 이동** (PC + 모바일, 모바일 최적화 포함) — 별도 spec/plan
- **B. /map 시각 강화** — 별도 brainstorm (어디까지 "지도화"할지 정해야 함)
