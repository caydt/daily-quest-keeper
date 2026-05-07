# 멀티라인 붙여넣기 → 항목별 일괄 생성 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 5개 add-input(`<input>`)에 paste 핸들러를 추가해서 멀티라인 텍스트 붙여넣을 때 줄별 항목으로 일괄 생성한다.

**Architecture:** `splitMultilinePaste` 순수 함수를 `garden-store.ts`에 추가. 각 인풋에 동일 패턴의 onPaste 핸들러 인라인으로 삽입 (`\n` 포함 시 preventDefault → split → add 핸들러 N회 호출).

**Tech Stack:** React 19, vitest + @testing-library/react.

**Spec:** `docs/superpowers/specs/2026-05-08-multiline-paste-bulk-create-design.md`

---

## File Structure

**Modified:**
- `src/lib/garden-store.ts` — `splitMultilinePaste` export
- `src/lib/garden-store.test.ts` — 5 케이스
- `src/components/garden/TaskList.tsx` — "새로운 씨앗 심기" 인풋 onPaste
- `src/components/garden/ProjectList.tsx` — 4개 인풋 onPaste (할일 입력, 나무 이름 입력, 농장 이름, 나무 이름 (프로젝트))

**Created:**
- `src/components/garden/TaskList.test.tsx` — 멀티라인 paste 회귀 1 케이스

---

## Task 1: `splitMultilinePaste` 유틸 (RED→GREEN)

**Files:**
- Modify: `src/lib/garden-store.test.ts`
- Modify: `src/lib/garden-store.ts`

- [ ] **Step 1: 테스트 추가 (RED)**

`src/lib/garden-store.test.ts` 파일 끝에 추가:

```ts
describe("splitMultilinePaste", () => {
  it("LF 줄바꿈 → 줄별 배열", () => {
    expect(splitMultilinePaste("a\nb\nc")).toEqual(["a", "b", "c"]);
  });

  it("앞뒤 공백 트림 + 빈 줄 제거", () => {
    expect(splitMultilinePaste("  a  \n\n  b  ")).toEqual(["a", "b"]);
  });

  it("단일 라인도 한 항목 배열로", () => {
    expect(splitMultilinePaste("single")).toEqual(["single"]);
  });

  it("CRLF (Windows) 줄바꿈도 처리", () => {
    expect(splitMultilinePaste("a\r\nb")).toEqual(["a", "b"]);
  });

  it("빈 문자열/공백만 → 빈 배열", () => {
    expect(splitMultilinePaste("")).toEqual([]);
    expect(splitMultilinePaste("   ")).toEqual([]);
    expect(splitMultilinePaste("\n\n")).toEqual([]);
  });
});
```

기존 import 라인에 `splitMultilinePaste` 추가:
```ts
import { useGarden, type Farm, farmStage, lastMorningCrossing, migrateLegacyCondition, conditionStampFor, splitMultilinePaste } from "./garden-store";
```

- [ ] **Step 2: 테스트 실행 — RED 확인**

```bash
cd /Users/ayoungjo/daily-quest-keeper
npm run test:run -- src/lib/garden-store.test.ts
```

기대: 5개 새 케이스 모두 FAIL — `Cannot find name 'splitMultilinePaste'` 또는 `is not exported`.

- [ ] **Step 3: `splitMultilinePaste` 구현 (GREEN)**

`src/lib/garden-store.ts`의 적당한 위치 — 다른 export 헬퍼들 (예: `todayStr`, `lastMorningCrossing`) 근처 (대략 line 180~ 부근)에 추가:

```ts
// 멀티라인 paste 텍스트를 트리밍된 줄 배열로 변환. 빈 줄은 제거. CRLF/LF 둘 다 지원.
// 사용처: TaskList/ProjectList의 add input에서 onPaste 핸들러로 줄별 일괄 생성.
export const splitMultilinePaste = (text: string): string[] =>
  text.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
```

- [ ] **Step 4: 테스트 실행 — GREEN 확인**

```bash
npm run test:run -- src/lib/garden-store.test.ts
```

기대: 모두 PASS.

- [ ] **Step 5: 빌드 확인**

```bash
npm run build
```

기대: 성공.

- [ ] **Step 6: 커밋**

```bash
git add src/lib/garden-store.ts src/lib/garden-store.test.ts
git commit -m "feat(store): splitMultilinePaste 유틸 추가

멀티라인 paste 텍스트를 줄별로 split + 트림 + 빈 줄 제거하는 순수 함수.
TaskList/ProjectList 인풋의 onPaste 핸들러에서 일괄 생성에 사용."
```

---

## Task 2: TaskList "새로운 씨앗 심기" 인풋 onPaste + 컴포넌트 테스트

**Files:**
- Create: `src/components/garden/TaskList.test.tsx`
- Modify: `src/components/garden/TaskList.tsx`

- [ ] **Step 1: 컴포넌트 테스트 작성 (RED)**

`src/components/garden/TaskList.test.tsx` 신규:

```tsx
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

    // clipboardData 준비된 paste 이벤트 디스패치
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
```

- [ ] **Step 2: 테스트 실행 — RED 확인**

```bash
npm run test:run -- src/components/garden/TaskList.test.tsx
```

기대: 첫 테스트 FAIL (`onAdd` 0회 호출).

- [ ] **Step 3: `TaskList.tsx`에 onPaste 추가**

`src/components/garden/TaskList.tsx` 상단 import에 추가:

```ts
import { splitMultilinePaste } from "@/lib/garden-store";
```

(기존 garden-store import에 합치기. `import { ..., splitMultilinePaste } from "@/lib/garden-store";` 형태로.)

라인 219~224의 `<input value={title} ...>` 에 `onPaste` 추가:

**Before:**
```tsx
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="새로운 씨앗 심기..."
          className="w-full bg-transparent border-b border-white/10 focus:border-primary outline-none px-2 py-2 text-sm"
        />
```

**After:**
```tsx
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onPaste={(e) => {
            const text = e.clipboardData.getData("text");
            if (!text.includes("\n")) return; // 단일 라인 → 기본 paste
            e.preventDefault();
            const titles = splitMultilinePaste(text);
            if (titles.length === 0) return;
            for (const t of titles) onAdd(t, time, difficulty, kind);
            setTitle("");
          }}
          placeholder="새로운 씨앗 심기..."
          className="w-full bg-transparent border-b border-white/10 focus:border-primary outline-none px-2 py-2 text-sm"
        />
```

- [ ] **Step 4: 테스트 실행 — GREEN 확인**

```bash
npm run test:run -- src/components/garden/TaskList.test.tsx
```

기대: 2개 모두 PASS.

- [ ] **Step 5: 빌드 + 전체 테스트**

```bash
npm run build
npm run test:run
```

기대: 빌드 성공, 모든 테스트 PASS.

- [ ] **Step 6: 커밋**

```bash
git add src/components/garden/TaskList.tsx src/components/garden/TaskList.test.tsx
git commit -m "feat(tasks): TaskList 인풋에 멀티라인 paste 일괄 생성

개행 포함 텍스트 paste 시 줄별로 task 일괄 생성. 단일 라인은 기본
paste 동작 유지."
```

---

## Task 3: `ProjectList.tsx` 4개 인풋에 onPaste 추가

**Files:**
- Modify: `src/components/garden/ProjectList.tsx`

4개 인풋 모두 같은 패턴. import 한 번만 추가, 각 인풋마다 onPaste 인라인 핸들러.

- [ ] **Step 1: import 추가**

`src/components/garden/ProjectList.tsx` 상단 import에 `splitMultilinePaste` 추가 (`garden-store` 기존 import에 합치기):

```ts
import { ..., splitMultilinePaste } from "@/lib/garden-store";
```

기존 import에 어떤 심볼이 있는지에 따라 적절히 결합.

- [ ] **Step 2: "할일 입력" (subTaskTitle) 인풋 onPaste**

`ProjectList.tsx` line 415~422의 `<input>` (placeholder="할일 입력...")에 onPaste 추가.

**Before:**
```tsx
            <input
              autoFocus
              value={subTaskTitle}
              onChange={(e) => setSubTaskTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Escape") { setShowSubTaskAdd(false); setSubTaskTitle(""); } }}
              placeholder="할일 입력..."
              className="flex-1 px-3 py-1.5 rounded-lg bg-input/40 border border-accent/20 text-xs focus:border-accent/50 focus:outline-none"
            />
```

**After:**
```tsx
            <input
              autoFocus
              value={subTaskTitle}
              onChange={(e) => setSubTaskTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Escape") { setShowSubTaskAdd(false); setSubTaskTitle(""); } }}
              onPaste={(e) => {
                const text = e.clipboardData.getData("text");
                if (!text.includes("\n")) return;
                e.preventDefault();
                const titles = splitMultilinePaste(text);
                if (titles.length === 0) return;
                for (const t of titles) onAddSubTask(p.id, t);
                setSubTaskTitle("");
                setShowSubTaskAdd(false);
              }}
              placeholder="할일 입력..."
              className="flex-1 px-3 py-1.5 rounded-lg bg-input/40 border border-accent/20 text-xs focus:border-accent/50 focus:outline-none"
            />
```

- [ ] **Step 3: "나무 이름 입력" (inlineTitle, FarmCard 내부) 인풋 onPaste**

`ProjectList.tsx` line 681~688의 `<input>` (placeholder="나무 이름 입력...")에 추가.

**Before:**
```tsx
          <input
            autoFocus
            value={inlineTitle}
            onChange={(e) => setInlineTitle(e.target.value)}
            placeholder="나무 이름 입력..."
            className="flex-1 bg-input/40 border border-emerald-500/20 rounded-lg px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
            onKeyDown={(e) => { if (e.key === "Escape") { setShowInlineAdd(false); setInlineTitle(""); } }}
          />
```

**After:**
```tsx
          <input
            autoFocus
            value={inlineTitle}
            onChange={(e) => setInlineTitle(e.target.value)}
            onPaste={(e) => {
              const text = e.clipboardData.getData("text");
              if (!text.includes("\n")) return;
              e.preventDefault();
              const titles = splitMultilinePaste(text);
              if (titles.length === 0) return;
              for (const t of titles) onAddTree(farm.id, t);
              setInlineTitle("");
              setShowInlineAdd(false);
            }}
            placeholder="나무 이름 입력..."
            className="flex-1 bg-input/40 border border-emerald-500/20 rounded-lg px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
            onKeyDown={(e) => { if (e.key === "Escape") { setShowInlineAdd(false); setInlineTitle(""); } }}
          />
```

- [ ] **Step 4: "농장 이름" (farmTitle) 인풋 onPaste**

`ProjectList.tsx` line 874~880 부근의 `<input>` (placeholder="농장 이름..."에 추가.

**Before:**
```tsx
            <input
              value={farmTitle}
              onChange={e => setFarmTitle(e.target.value)}
              placeholder="농장 이름 (예: 내 앱 개발)"
              className="flex-1 bg-transparent border-b border-white/10 focus:border-emerald-400 outline-none px-2 py-2 text-sm font-medium"
              autoFocus
            />
```

**After:**
```tsx
            <input
              value={farmTitle}
              onChange={e => setFarmTitle(e.target.value)}
              onPaste={(e) => {
                const text = e.clipboardData.getData("text");
                if (!text.includes("\n")) return;
                e.preventDefault();
                const titles = splitMultilinePaste(text);
                if (titles.length === 0) return;
                for (const t of titles) onAddFarm(t, farmIcon);
                setFarmTitle(""); setFarmIcon("🌾"); setShowAddFarm(false);
              }}
              placeholder="농장 이름 (예: 내 앱 개발)"
              className="flex-1 bg-transparent border-b border-white/10 focus:border-emerald-400 outline-none px-2 py-2 text-sm font-medium"
              autoFocus
            />
```

- [ ] **Step 5: "나무 이름 (프로젝트)" (title) 인풋 onPaste**

`ProjectList.tsx` line 895~901 부근의 `<input>` (placeholder="나무 이름 (프로젝트)")에 추가. 이 폼은 standalone 프로젝트 추가 (description, dueDate 등 추가 필드 있음). 멀티라인 paste 시엔 description 비우고 dueDate 안 두고 N개 생성.

호출 핸들러를 확인. 아래 검색으로 정확한 함수명 파악:

```bash
grep -n "submitProject\|onAdd(\|onAddProject\|addProject" src/components/garden/ProjectList.tsx | head -5
```

표준적으로 `submitProject`가 form onSubmit이고 그 안에서 `onAdd(title, description, dueDate, farmId)` 같은 형태로 호출됨. 정확한 시그니처에 맞춰 paste 핸들러 작성.

기존 onAdd 시그니처가 `onAdd(title: string, description?: string, dueDate?: string, farmId?: string | null)` 같은 형태라면:

**After:**
```tsx
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          onPaste={(e) => {
            const text = e.clipboardData.getData("text");
            if (!text.includes("\n")) return;
            e.preventDefault();
            const titles = splitMultilinePaste(text);
            if (titles.length === 0) return;
            for (const t of titles) onAdd(t);  // 정확한 시그니처에 맞춰 추가 인자 전달
            setTitle("");
            setDescription("");
            setDueDate("");
            setShowAddProject(false);
          }}
          placeholder="나무 이름 (프로젝트)"
          className="w-full bg-transparent border-b border-white/10 focus:border-primary outline-none px-2 py-2 text-sm font-medium"
          autoFocus
        />
```

⚠️ **시그니처 확인 필수**: 호출 전에 ProjectList 내 `onAdd` prop 시그니처를 grep으로 확인. 멀티라인 paste 시 description/dueDate 등 보조 인자는 비워서 호출. 추가 인자 필수면 빈 문자열/undefined/null 적절히 사용.

- [ ] **Step 6: 빌드 + lint + 전체 테스트**

```bash
cd /Users/ayoungjo/daily-quest-keeper
npm run build
npm run lint 2>&1 | tail -10
npm run test:run
```

기대: 빌드 성공, lint에 새 에러 없음, 모든 테스트 PASS.

- [ ] **Step 7: 커밋**

```bash
git add src/components/garden/ProjectList.tsx
git commit -m "feat(projects): ProjectList 4개 인풋에 멀티라인 paste 일괄 생성

농장/나무/할일/서브태스크 인풋 모두 동일 패턴. 개행 포함 paste 시 줄별
일괄 생성. 단일 라인 paste는 기본 동작 유지."
```

---

## Task 4: 수동 검증 + 머지

**Files:** 코드 변경 없음.

- [ ] **Step 1: 전체 테스트**

```bash
cd /Users/ayoungjo/daily-quest-keeper
npm run test:run
```

기대: 전체 PASS.

- [ ] **Step 2: dev 서버**

```bash
npm run dev
```

브라우저 열기.

- [ ] **Step 3: 5개 인풋 paste 검증**

각 인풋에서 클립보드에 `한줄1\n한줄2\n한줄3` 복사 후 paste:

1. 메인 화면 "새로운 씨앗 심기..." → 오늘의 임무 3개 생성
2. 농장 카드의 "할일 입력..." (서브태스크 추가 폼) → 해당 프로젝트에 서브태스크 3개
3. 농장 카드의 "나무 이름 입력..." (인라인 트리 추가) → 해당 농장에 나무 3그루
4. ProjectList의 "농장 이름" → 농장 3개
5. ProjectList의 "나무 이름 (프로젝트)" → 독립 프로젝트 3개

각 인풋에서:
- paste 후 인풋이 비워지는지
- 폼이 닫히는지 (각 인풋 동작에 맞게)
- 새 항목들이 화면에 나타나는지
- 시트에 동기화되는지 (디바운스 600ms 후)

- [ ] **Step 4: 단일 라인 paste 회귀 확인**

각 인풋에서 단일 줄("그냥문구") paste → 인풋에 그대로 들어감, 항목 자동 생성 안 됨, 일반 paste처럼 동작.

- [ ] **Step 5: 빈 줄/공백 처리 확인**

`\n\n  공백  \n실제할일\n` 같은 paste → 결과 1개 ("실제할일")만 생성.

- [ ] **Step 6: push**

검증 통과 → push:

```bash
git push origin main
```

(워크트리 사용 시 finishing-a-development-branch 스킬에서 머지.)

---

## 완료 후

다음 후보:
- 도구 ID 안정화 + Picker UX (이미 spec 작성됨, plan 작성 시작 가능)
- 컨디션 잔여 P2 정리
- /map 추가 강화
