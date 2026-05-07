# 도구 ID 안정화 + Picker UX 개선 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 도구 ID를 행 번호 기반에서 URL 기반으로 변경 (시트 정렬에도 안정), 옛 형식 ID는 fallback 매치로 호환성 유지, ToolPicker에 카테고리 칩 + 추천 섹션 + 푸터(선택 카운트 + 닫기) + 폭 확대.

**Architecture:** `tools-sheet.ts`에 `findToolById` (옛/새 ID 양방 lookup), `matchToolsForTitle` (단어 단위 정확 일치 매칭) 두 헬퍼 추가. `ToolChipBar`는 `findToolById`로 fallback 적용. `ToolPicker`는 props에 `recommendForTitle` 추가하고 카테고리 필터 + 추천 섹션 + 푸터 신규.

**Tech Stack:** React 19, lucide-react, vitest + @testing-library/react.

**Spec:** `docs/superpowers/specs/2026-05-07-tool-id-stable-and-picker-ux-design.md`

---

## File Structure

**Created:**
- `src/lib/tools-sheet.test.ts` — `findToolById`, `matchToolsForTitle` 단위 테스트
- `src/components/garden/ToolPicker.test.tsx` — 카테고리/추천 동작 테스트

**Modified:**
- `src/lib/tools-sheet.ts` — 도구 ID 생성을 URL로, `findToolById`/`matchToolsForTitle` export
- `src/components/garden/ToolChipBar.tsx` — `availableTools.find` → `findToolById`
- `src/components/garden/ToolPicker.tsx` — props 추가 (`recommendForTitle?`), 카테고리 칩, 추천 섹션, 푸터, 폭 w-64 → w-80
- `src/components/garden/ProjectList.tsx` — `<ToolPicker>` 두 호출에 `recommendForTitle={p.title}` / `={farm.title}` 전달

---

## Task 1: 도구 ID = URL + `findToolById` 헬퍼 (RED→GREEN)

**Files:**
- Create: `src/lib/tools-sheet.test.ts`
- Modify: `src/lib/tools-sheet.ts`

- [ ] **Step 1: 테스트 작성 (RED)**

`src/lib/tools-sheet.test.ts` 신규 생성:

```ts
import { describe, it, expect } from "vitest";
import { findToolById, type Tool } from "./tools-sheet";

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
    // 옛 코드: id = `row-3-figma` (slug = lowercase + 공백→하이픈)
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
```

- [ ] **Step 2: 테스트 실행 — RED 확인**

```bash
cd /Users/ayoungjo/daily-quest-keeper
npm run test:run -- src/lib/tools-sheet.test.ts
```

기대: 4 케이스 모두 FAIL (`findToolById` 미정의 또는 export 안 됨).

- [ ] **Step 3: 도구 ID를 URL로 변경**

`src/lib/tools-sheet.ts:118` 부근의 ID 생성 라인:

**Before:**
```ts
    tools.push({
      id: `row-${r}-${name.toLowerCase().replace(/\s+/g, "-")}`,
      name,
      url,
```

**After:**
```ts
    tools.push({
      id: url,  // URL을 ID로 사용 — 시트 정렬·이름 변경에 안정적
      name,
      url,
```

- [ ] **Step 4: `findToolById` 추가**

`src/lib/tools-sheet.ts`의 `rowsToTools` 함수 다음, `useToolsSheet` 함수 전에 (대략 line 135 이전 어딘가) 추가:

```ts
// 저장된 toolId가 새 형식(URL)이면 그대로 lookup,
// 옛 형식("row-3-figma")이면 slug 추출 후 같은 name(slug 비교)으로 fallback.
// 옛 데이터(2026-05 이전 row 기반 ID로 저장된 farm/project/task.toolIds) 호환용.
export const findToolById = (tools: Tool[], savedId: string): Tool | undefined => {
  const direct = tools.find((t) => t.id === savedId);
  if (direct) return direct;
  const m = savedId.match(/^row-\d+-(.+)$/);
  if (!m) return undefined;
  const slug = m[1];
  return tools.find((t) => t.name.toLowerCase().replace(/\s+/g, "-") === slug);
};
```

- [ ] **Step 5: 테스트 실행 — GREEN 확인**

```bash
npm run test:run -- src/lib/tools-sheet.test.ts
```

기대: 4 케이스 모두 PASS.

- [ ] **Step 6: 빌드 확인**

```bash
npm run build
```

기대: 성공. 도구 ID가 URL로 바뀌어도 다른 곳에서는 string으로만 다뤄지므로 타입 영향 없음.

- [ ] **Step 7: 커밋**

```bash
git add src/lib/tools-sheet.ts src/lib/tools-sheet.test.ts
git commit -m "fix(tools): 도구 ID를 URL 기반으로 변경 + 옛 ID fallback

기존: row-N-slug 형식. 시트 정렬 시 행 번호 바뀌어 ID 깨짐 → 저장된
toolIds가 매치 안 되어 도구 연결 사라진 것처럼 보임.

변경: id = url. 시트 정렬·이름 변경에 안정적.
findToolById로 옛 형식 ID도 name slug 매치로 fallback (호환성)."
```

---

## Task 2: `ToolChipBar`에 `findToolById` 적용

**Files:**
- Modify: `src/components/garden/ToolChipBar.tsx`

- [ ] **Step 1: import 변경 + lookup 교체**

`src/components/garden/ToolChipBar.tsx`:

**Before (line 1, 16~18):**
```tsx
import type { Tool } from "@/lib/tools-sheet";
import { X, Plus } from "lucide-react";

// ...

  const connected = toolIds
    .map((id) => availableTools.find((t) => t.id === id))
    .filter((t): t is Tool => t !== undefined);
```

**After:**
```tsx
import { type Tool, findToolById } from "@/lib/tools-sheet";
import { X, Plus } from "lucide-react";

// ...

  const connected = toolIds
    .map((id) => findToolById(availableTools, id))
    .filter((t): t is Tool => t !== undefined);
```

- [ ] **Step 2: 빌드 + 전체 테스트**

```bash
npm run build
npm run test:run
```

기대: 빌드 성공, 모든 테스트 PASS.

- [ ] **Step 3: 커밋**

```bash
git add src/components/garden/ToolChipBar.tsx
git commit -m "fix(tools): ToolChipBar — findToolById로 옛 ID 호환

농장/프로젝트/태스크 카드에 표시되는 연결 도구 칩이 옛 형식 ID도
정상 lookup되도록. 사용자가 도구 다시 토글하지 않아도 표시 유지."
```

---

## Task 3: `matchToolsForTitle` 헬퍼 (RED→GREEN)

**Files:**
- Modify: `src/lib/tools-sheet.test.ts`
- Modify: `src/lib/tools-sheet.ts`

- [ ] **Step 1: 테스트 추가 (RED)**

`src/lib/tools-sheet.test.ts` 끝에 추가 (기존 import 라인에 `matchToolsForTitle` 추가):

```ts
// 기존 import 줄 변경:
// import { findToolById, type Tool } from "./tools-sheet";
// →
// import { findToolById, matchToolsForTitle, type Tool } from "./tools-sheet";

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
    expect(r).toContain(github); // "개발" 단어가 github의 category와 일치
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
    // 태그 "디자인 시스템"은 한 덩어리. 제목 "디자인"으로 매치 안 됨
    const ds = tool("https://y.com", "DS", "https://y.com", undefined, ["디자인 시스템"]);
    expect(matchToolsForTitle("디자인", [ds])).not.toContain(ds);
    // 태그 "디자인 시스템" 전체와 일치는?
    expect(matchToolsForTitle("디자인 시스템", [ds])).toEqual([]);
    // 단어 "디자인", "시스템" 각각 split되어 비교됨. 태그 "디자인 시스템"과 정확 일치 안 됨.
  });
});
```

- [ ] **Step 2: 테스트 실행 — RED 확인**

```bash
npm run test:run -- src/lib/tools-sheet.test.ts
```

기대: 새 6 케이스 FAIL (`matchToolsForTitle` 미정의).

- [ ] **Step 3: 구현 (GREEN)**

`src/lib/tools-sheet.ts`의 `findToolById` 다음에 추가:

```ts
// 농장/프로젝트 제목과 도구의 카테고리/태그가 단어 단위로 정확 일치하는지 검사.
// 단어 단위: 제목을 공백으로 split → 각 단어가 도구.category 정확 일치 또는
//   도구.tags의 어느 항목과 정확 일치하면 매치.
// 케이스 무시. 부분 문자열 매칭은 의도적으로 제외 (오버매칭 방지).
export const matchToolsForTitle = (title: string, tools: Tool[]): Tool[] => {
  const words = title.toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  return tools.filter((tool) => {
    const cat = tool.category?.toLowerCase().trim();
    const tagSet = new Set(tool.tags.map((t) => t.toLowerCase().trim()));
    return words.some((w) => w === cat || tagSet.has(w));
  });
};
```

- [ ] **Step 4: 테스트 실행 — GREEN 확인**

```bash
npm run test:run -- src/lib/tools-sheet.test.ts
```

기대: 모두 PASS.

- [ ] **Step 5: 커밋**

```bash
git add src/lib/tools-sheet.ts src/lib/tools-sheet.test.ts
git commit -m "feat(tools): matchToolsForTitle — 농장/프로젝트 제목 기반 도구 추천

제목을 단어로 split → 각 단어가 도구.category 정확 일치 또는 tags 안 단어
정확 일치하면 매치. 케이스 무시. 부분 문자열은 매치 안 함 (오버매칭 방지).
ToolPicker의 추천 섹션에서 사용 예정."
```

---

## Task 4: `ToolPicker` UI 오버홀 (카테고리 칩 + 추천 섹션 + 푸터 + 폭)

**Files:**
- Create: `src/components/garden/ToolPicker.test.tsx`
- Modify: `src/components/garden/ToolPicker.tsx`

- [ ] **Step 1: 테스트 작성 (RED)**

`src/components/garden/ToolPicker.test.tsx` 신규:

```tsx
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

    // figma + sketch 둘 다 디자인 카테고리
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
```

- [ ] **Step 2: 테스트 실행 — RED 확인**

```bash
npm run test:run -- src/components/garden/ToolPicker.test.tsx
```

기대: 모두 FAIL — 카테고리 칩, 추천 섹션, 푸터, recommendForTitle prop 전부 미구현.

- [ ] **Step 3: `ToolPicker.tsx` 전면 변경**

`src/components/garden/ToolPicker.tsx`를 다음으로 교체 (전체 파일):

```tsx
import { useMemo, useState } from "react";
import { type Tool, matchToolsForTitle } from "@/lib/tools-sheet";
import { Search, Check } from "lucide-react";

type Props = {
  /** 선택 가능한 전체 도구 목록 */
  availableTools: Tool[];
  /** 현재 선택된 도구 ID 목록 */
  selectedIds: string[];
  /** 선택/해제 토글 */
  onToggle: (id: string) => void;
  /** 드롭다운 닫기 */
  onClose: () => void;
  /** 매칭 기반 추천 — 농장/프로젝트 제목. 비어있거나 미제공이면 추천 섹션 안 보임. */
  recommendForTitle?: string;
};

export function ToolPicker({
  availableTools,
  selectedIds,
  onToggle,
  onClose,
  recommendForTitle,
}: Props) {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const t of availableTools) if (t.category) set.add(t.category);
    return Array.from(set).sort();
  }, [availableTools]);

  const recommended = useMemo(() => {
    if (!recommendForTitle) return [];
    return matchToolsForTitle(recommendForTitle, availableTools);
  }, [recommendForTitle, availableTools]);

  const recommendedNotSelected = recommended.filter((t) => !selectedIds.includes(t.id));

  const filtered = useMemo(() => {
    return availableTools.filter((t) => {
      if (activeCategory && t.category !== activeCategory) return false;
      const q = query.toLowerCase();
      if (!q) return true;
      return (
        t.name.toLowerCase().includes(q) ||
        (t.category ?? "").toLowerCase().includes(q) ||
        t.tags.some((tag) => tag.toLowerCase().includes(q))
      );
    });
  }, [availableTools, activeCategory, query]);

  const handleAddAllRecommended = () => {
    for (const t of recommendedNotSelected) onToggle(t.id);
  };

  const selectedCount = selectedIds.length;

  return (
    <>
      {/* 배경 클릭 시 닫기 */}
      <div className="fixed inset-0 z-40" onClick={onClose} />

      <div className="absolute left-0 top-full mt-1 z-50 w-80 rounded-xl border border-white/10 bg-card shadow-xl overflow-hidden">
        {/* 검색 */}
        <div className="p-2 border-b border-white/5">
          <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-black/20">
            <Search className="size-3.5 text-muted-foreground shrink-0" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="도구 검색..."
              className="bg-transparent text-xs outline-none flex-1 placeholder:text-muted-foreground/50"
            />
          </div>
        </div>

        {/* 카테고리 칩 */}
        {categories.length > 0 && (
          <div className="px-2 py-1.5 border-b border-white/5 flex gap-1 overflow-x-auto">
            <CategoryChip
              label="전체"
              active={activeCategory === null}
              onClick={() => setActiveCategory(null)}
            />
            {categories.map((c) => (
              <CategoryChip
                key={c}
                label={c}
                active={activeCategory === c}
                onClick={() => setActiveCategory(c)}
              />
            ))}
          </div>
        )}

        {/* 추천 섹션 */}
        {recommendedNotSelected.length > 0 && (
          <div className="p-2 border-b border-white/5 bg-primary/5 space-y-1">
            <div className="flex items-center justify-between gap-2 px-1">
              <span className="text-[10px] font-semibold text-primary/80">
                ✨ 추천 ({recommendedNotSelected.length}개)
              </span>
              <button
                type="button"
                onClick={handleAddAllRecommended}
                className="text-[10px] px-2 py-0.5 rounded-md bg-primary/15 border border-primary/30 text-primary hover:bg-primary/25 transition"
              >
                모두 추가
              </button>
            </div>
            {recommendedNotSelected.map((tool) => (
              <ToolRow key={tool.id} tool={tool} selected={false} onToggle={onToggle} />
            ))}
          </div>
        )}

        {/* 도구 목록 */}
        <div className="max-h-52 overflow-y-auto">
          {availableTools.length === 0 ? (
            <p className="text-center text-xs text-muted-foreground py-4 px-3">
              도구 라이브러리를 먼저 설정해주세요
              <br />
              <span className="text-[10px] opacity-60">(설정 → 도구 라이브러리)</span>
            </p>
          ) : filtered.length === 0 ? (
            <p className="text-center text-xs text-muted-foreground py-4">검색 결과 없음</p>
          ) : (
            filtered.map((tool) => (
              <ToolRow
                key={tool.id}
                tool={tool}
                selected={selectedIds.includes(tool.id)}
                onToggle={onToggle}
              />
            ))
          )}
        </div>

        {/* 푸터 */}
        <div className="p-2 border-t border-white/5 flex items-center justify-between text-xs">
          <span className="text-muted-foreground">선택됨 {selectedCount}개</span>
          <button
            type="button"
            onClick={onClose}
            className="px-2.5 py-1 rounded-md bg-primary/15 border border-primary/30 text-primary hover:bg-primary/25 transition"
          >
            닫기
          </button>
        </div>
      </div>
    </>
  );
}

function CategoryChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-[10px] px-2 py-0.5 rounded-full border whitespace-nowrap transition shrink-0 ${
        active
          ? "bg-primary/20 border-primary/40 text-primary"
          : "bg-transparent border-white/10 text-muted-foreground hover:border-white/20 hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
}

function ToolRow({
  tool,
  selected,
  onToggle,
}: {
  tool: Tool;
  selected: boolean;
  onToggle: (id: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onToggle(tool.id)}
      className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-white/5 transition"
    >
      {tool.icon ? (
        <span className="text-sm w-5 text-center shrink-0">{tool.icon}</span>
      ) : (
        <span className="w-5 shrink-0" />
      )}
      <span className="flex-1 text-left text-foreground truncate">{tool.name}</span>
      {tool.category && (
        <span className="text-[10px] text-muted-foreground shrink-0">{tool.category}</span>
      )}
      {selected && <Check className="size-3.5 text-primary shrink-0" />}
    </button>
  );
}
```

- [ ] **Step 4: 테스트 실행 — GREEN 확인**

```bash
npm run test:run -- src/components/garden/ToolPicker.test.tsx
```

기대: 5개 모두 PASS.

- [ ] **Step 5: 빌드 + 전체 테스트**

```bash
npm run build
npm run test:run
```

기대: 빌드 성공, 모든 테스트 PASS.

- [ ] **Step 6: 커밋**

```bash
git add src/components/garden/ToolPicker.tsx src/components/garden/ToolPicker.test.tsx
git commit -m "feat(tools): ToolPicker UX 오버홀 — 카테고리 칩, 추천 섹션, 푸터, 폭 확대

- 검색 박스 아래 카테고리 칩 (도구 목록에서 동적 생성, 전체/카테고리별 필터)
- recommendForTitle prop: 농장/프로젝트 제목과 매칭되는 도구를 상단 추천 섹션
  + '모두 추가' 버튼으로 N개 한 번에 연결
- 푸터: 선택됨 N개 카운트 + 명시적 닫기 버튼
- 폭 w-64 → w-80 (도구 많을 때 가독성)"
```

---

## Task 5: ProjectList에서 `recommendForTitle` 전달 + 수동 검증 + 머지

**Files:**
- Modify: `src/components/garden/ProjectList.tsx`

- [ ] **Step 1: 호출 사이트 두 곳에 prop 전달**

`src/components/garden/ProjectList.tsx`에서 `<ToolPicker>` 호출이 두 군데 있음. 각각:

**프로젝트 카드의 ToolPicker (line 394 부근):**

Before:
```tsx
              <ToolPicker
                availableTools={availableTools}
                selectedIds={p.toolIds ?? []}
                onToggle={onToggleProjectTool}
                onClose={() => setShowProjectPicker(false)}
              />
```

After:
```tsx
              <ToolPicker
                availableTools={availableTools}
                selectedIds={p.toolIds ?? []}
                onToggle={onToggleProjectTool}
                onClose={() => setShowProjectPicker(false)}
                recommendForTitle={p.title}
              />
```

**농장 헤더의 ToolPicker (line 671 부근):**

Before:
```tsx
            <ToolPicker
              availableTools={availableTools}
              selectedIds={farm.toolIds ?? []}
              onToggle={(toolId) => onToggleFarmTool(toolId)}
              onClose={() => setShowFarmPicker(false)}
            />
```

After:
```tsx
            <ToolPicker
              availableTools={availableTools}
              selectedIds={farm.toolIds ?? []}
              onToggle={(toolId) => onToggleFarmTool(toolId)}
              onClose={() => setShowFarmPicker(false)}
              recommendForTitle={farm.title}
            />
```

(정확한 prop 이름은 setShow* 변수명에 따라 달라질 수 있음 — `grep -n "setShowProjectPicker\|setShowFarmPicker\|<ToolPicker" src/components/garden/ProjectList.tsx`로 확인.)

- [ ] **Step 2: 빌드 + 전체 테스트**

```bash
npm run build
npm run test:run
```

기대: 빌드 성공, 모든 테스트 PASS.

- [ ] **Step 3: 커밋**

```bash
git add src/components/garden/ProjectList.tsx
git commit -m "feat(tools): ProjectList에서 ToolPicker로 recommendForTitle 전달

농장 picker는 farm.title 전달, 프로젝트 picker는 p.title 전달 →
제목과 매칭되는 도구가 추천 섹션에 노출됨."
```

- [ ] **Step 4: dev 서버 + 수동 검증**

```bash
npm run dev
```

체크리스트:

1. **버그 픽스 검증** — 옛 데이터 fallback
   - 시트에 도구 등록되어 있고 농장/나무에 도구 연결한 데이터 있음
   - 시트 정렬 (또는 도구 순서 변경) 후 페이지 새로고침
   - 농장/나무 카드에 연결된 도구 칩이 그대로 보이는지 (findToolById fallback 동작 확인)
2. **카테고리 칩 필터**
   - 도구 picker 열기 → 카테고리 칩들 표시됨
   - "디자인" 칩 클릭 → 디자인 카테고리만 표시
   - "전체" 클릭 → 모든 도구
3. **추천 섹션**
   - 농장 이름이 도구 카테고리/태그와 매칭되는 케이스 (예: 농장 "디자인", 도구 카테고리 "디자인")
   - picker 열면 상단에 ✨ 추천 N개 표시 + "모두 추가" 버튼
   - "모두 추가" 클릭 → 추천된 도구 모두 선택됨 + 추천 섹션 사라짐 (이미 선택됐으니)
4. **푸터**
   - "선택됨 N개" 정확히 표시
   - "닫기" 버튼 → picker 닫힘
5. **회귀 확인**
   - 검색 박스 동작
   - 도구 토글로 추가/제거
   - 새 도구 추가 시 새 ID(URL) 형식으로 저장됨

- [ ] **Step 5: push**

```bash
git push origin main
```

(워크트리 사용 시 finishing-a-development-branch 스킬에서 머지.)

---

## 완료 후

다음 후보:
- 컨디션 잔여 P2 정리 (앱 켠 채 morningTime 가로지를 때 staleness, morningTime 편집 시 컨디션 무효화)
- /map 추가 강화 (농장이 "지도상의 점"처럼 흩어진 배치)
