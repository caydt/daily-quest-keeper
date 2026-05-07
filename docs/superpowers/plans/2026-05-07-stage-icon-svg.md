# 트리/농장 SVG 스테이지 아이콘 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 메인 화면과 `/map` 페이지의 단계 emoji 4곳을 lucide-react 기반 컬러 배지 SVG 컴포넌트로 교체하고, tier 변경 시 pop 트랜지션과 tier 5 골드 halo를 적용한다.

**Architecture:** 새 `<TreeStageIcon>` / `<FarmStageIcon>` 컴포넌트는 lucide-react 아이콘을 둥근 컬러 배지로 감싼다. tier 5는 pulsing halo 추가. `farmStage` 헬퍼에 `tier` 필드 추가. 호출 사이트 4곳에서 emoji 직접 사용 → StageIcon 컴포넌트 사용으로 교체.

**Tech Stack:** React 19, lucide-react ^0.575, Tailwind v4, vitest + @testing-library/react.

**Spec:** `docs/superpowers/specs/2026-05-07-stage-icon-svg-design.md`

---

## File Structure

**Created:**
- `src/components/garden/StageIcon.tsx` — `TreeStageIcon`/`FarmStageIcon` 두 컴포넌트 export. tier(1~5) → lucide 아이콘 + 컬러 배지 + tier 5 halo
- `src/components/garden/StageIcon.test.tsx` — vitest 단위 테스트

**Modified:**
- `src/lib/garden-store.ts` — `farmStage` 반환 타입에 `tier: number` 추가
- `src/lib/garden-store.test.ts` — `farmStage` tier 반환 5개 테스트 케이스
- `src/styles.css` — `stage-pop` keyframe + `.animate-stage-pop` utility
- `src/routes/map.tsx` — TreeNode 외곽 원 div 제거 + StageIcon 도입, FarmTerritory 헤더 emoji 교체
- `src/components/garden/ProjectList.tsx` — 기존 `TreeIcon` 함수(line 57~67)를 `TreeStageIcon` 호출로 교체, FarmCard 헤더 emoji(line 539) 교체

---

## Task 1: `farmStage`에 tier 필드 추가 (RED→GREEN)

**Files:**
- Modify: `src/lib/garden-store.test.ts`
- Modify: `src/lib/garden-store.ts`

- [ ] **Step 1: 테스트 추가 (RED)**

`src/lib/garden-store.test.ts` 파일 끝(또는 기존 `describe` 블록들 다음)에 추가:

```ts
import { farmStage } from "./garden-store";

describe("farmStage tier", () => {
  it("treeCount 0 → tier 1 (빈 땅)", () => {
    expect(farmStage(0, 0).tier).toBe(1);
  });
  it("treeCount 1 → tier 2 (묘목장)", () => {
    expect(farmStage(1, 50).tier).toBe(2);
  });
  it("treeCount 2 → tier 3 (정원)", () => {
    expect(farmStage(2, 30).tier).toBe(3);
  });
  it("treeCount 3 + avgPct 60 → tier 4 (농장)", () => {
    expect(farmStage(3, 60).tier).toBe(4);
  });
  it("treeCount 5 + avgPct 90 → tier 5 (마을)", () => {
    expect(farmStage(5, 90).tier).toBe(5);
  });
});
```

(기존 import 줄에 `farmStage`가 이미 있으면 중복 import 라인 제거. `useGarden`, `Farm` import 라인 옆에 `farmStage` 추가하는 식으로.)

- [ ] **Step 2: 테스트 실행 — RED 확인**

```bash
cd /Users/ayoungjo/daily-quest-keeper
npm run test:run -- src/lib/garden-store.test.ts
```

기대: 5개 케이스 모두 FAIL (`Property 'tier' does not exist` 타입 에러 또는 `tier`가 `undefined`).

- [ ] **Step 3: `farmStage` 반환 타입에 tier 추가 (GREEN)**

`src/lib/garden-store.ts:99~108`의 `farmStage` 함수를 다음으로 교체:

```ts
// 농장 성장 단계 (포함된 나무 수 + 평균 완료율 기반)
export const farmStage = (
  treeCount: number,
  avgPct: number,
): { icon: string; label: string; tier: number } => {
  if (treeCount === 0)                return { icon: "🪨", label: "빈 땅",   tier: 1 };
  if (treeCount >= 5 && avgPct >= 80) return { icon: "🏡", label: "마을",   tier: 5 };
  if (treeCount >= 3 && avgPct >= 50) return { icon: "🌾", label: "농장",   tier: 4 };
  if (treeCount >= 2)                 return { icon: "🌱", label: "정원",   tier: 3 };
  return                                     { icon: "🪴", label: "묘목장", tier: 2 };
};
```

변경점: 반환 타입에 `tier: number` 추가, 각 분기 객체에 tier 값 추가. 라벨/아이콘은 그대로.

- [ ] **Step 4: 테스트 실행 — GREEN 확인**

```bash
npm run test:run -- src/lib/garden-store.test.ts
```

기대: 21 passed (기존 16 + 새 5).

- [ ] **Step 5: 빌드 확인**

```bash
npm run build
```

기대: 빌드 성공. `farmStage` 사용처(map.tsx, ProjectList.tsx)에서 타입 에러 없음 (tier 필드만 추가했고 기존 icon/label 그대로).

- [ ] **Step 6: 커밋**

```bash
git add src/lib/garden-store.ts src/lib/garden-store.test.ts
git commit -m "feat(store): farmStage 반환에 tier 필드 추가"
```

---

## Task 2: `StageIcon.tsx` 기본 구조 + Tree 5단계 (RED→GREEN)

**Files:**
- Create: `src/components/garden/StageIcon.tsx`
- Create: `src/components/garden/StageIcon.test.tsx`

- [ ] **Step 1: 테스트 작성 (RED)**

`src/components/garden/StageIcon.test.tsx` 신규 생성:

```tsx
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { TreeStageIcon } from "./StageIcon";

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
```

- [ ] **Step 2: 테스트 실행 — RED 확인**

```bash
npm run test:run -- src/components/garden/StageIcon.test.tsx
```

기대: 6개 케이스 모두 FAIL (`Cannot find module './StageIcon'`).

- [ ] **Step 3: `StageIcon.tsx` 구현 (GREEN)**

`src/components/garden/StageIcon.tsx` 신규 생성:

```tsx
import { Sprout, TreePine, Trophy, Mountain, Wheat, Castle } from "lucide-react";

type Tier = 1 | 2 | 3 | 4 | 5;
type Props = {
  tier: Tier;
  size?: number;
  className?: string;
};

const treeMap: Record<Tier, {
  Icon: typeof Sprout;
  iconName: string;
  iconScale: number;
  bg: string;
  border: string;
  iconColor: string;
}> = {
  1: { Icon: Sprout,    iconName: "sprout",    iconScale: 0.45, bg: "bg-stone-700/40",   border: "border-stone-600",   iconColor: "text-stone-400" },
  2: { Icon: Sprout,    iconName: "sprout",    iconScale: 0.6,  bg: "bg-emerald-900/40", border: "border-emerald-700", iconColor: "text-emerald-300" },
  3: { Icon: TreePine,  iconName: "tree-pine", iconScale: 0.6,  bg: "bg-emerald-700/30", border: "border-emerald-500", iconColor: "text-emerald-200" },
  4: { Icon: TreePine,  iconName: "tree-pine", iconScale: 0.7,  bg: "bg-emerald-600/40 shadow-[0_0_12px_rgba(52,211,153,0.4)]", border: "border-emerald-400", iconColor: "text-emerald-100" },
  5: { Icon: Trophy,    iconName: "trophy",    iconScale: 0.6,  bg: "bg-gradient-to-br from-amber-300 to-amber-500", border: "border-amber-200", iconColor: "text-amber-900" },
};

const farmMap: Record<Tier, {
  Icon: typeof Sprout;
  iconName: string;
  iconScale: number;
  bg: string;
  border: string;
  iconColor: string;
}> = {
  1: { Icon: Mountain, iconName: "mountain",  iconScale: 0.55, bg: "bg-stone-800/40",   border: "border-stone-700",   iconColor: "text-stone-400" },
  2: { Icon: Sprout,   iconName: "sprout",    iconScale: 0.6,  bg: "bg-stone-700/40",   border: "border-emerald-800", iconColor: "text-emerald-300" },
  3: { Icon: TreePine, iconName: "tree-pine", iconScale: 0.6,  bg: "bg-emerald-900/40", border: "border-emerald-600", iconColor: "text-emerald-200" },
  4: { Icon: Wheat,    iconName: "wheat",     iconScale: 0.6,  bg: "bg-amber-900/30",   border: "border-amber-700",   iconColor: "text-amber-300" },
  5: { Icon: Castle,   iconName: "castle",    iconScale: 0.6,  bg: "bg-gradient-to-br from-amber-300 to-amber-500", border: "border-amber-200", iconColor: "text-amber-900" },
};

function StageBadge({
  tier,
  size,
  className,
  config,
}: {
  tier: Tier;
  size: number;
  className?: string;
  config: typeof treeMap[Tier];
}) {
  const { Icon, iconName, iconScale, bg, border, iconColor } = config;
  const iconSize = Math.round(size * iconScale);
  return (
    <span
      key={tier}
      data-stage-tier={tier}
      className={`relative inline-flex items-center justify-center rounded-full border-2 transition-transform hover:scale-105 animate-stage-pop ${bg} ${border} ${className ?? ""}`}
      style={{ width: size, height: size }}
    >
      {tier === 5 && (
        <span
          data-stage-halo
          aria-hidden
          className="absolute inset-0 -z-10 rounded-full bg-amber-400/30 blur-md animate-pulse"
        />
      )}
      <Icon
        data-lucide-icon={iconName}
        size={iconSize}
        className={iconColor}
        strokeWidth={2}
      />
    </span>
  );
}

export function TreeStageIcon({ tier, size = 28, className }: Props) {
  return <StageBadge tier={tier} size={size} className={className} config={treeMap[tier]} />;
}

export function FarmStageIcon({ tier, size = 28, className }: Props) {
  return <StageBadge tier={tier} size={size} className={className} config={farmMap[tier]} />;
}
```

- [ ] **Step 4: 테스트 실행 — GREEN 확인**

```bash
npm run test:run -- src/components/garden/StageIcon.test.tsx
```

기대: 6 passed.

만약 `data-lucide-icon` 속성이 lucide 컴포넌트에 안 붙어 있으면 (라이브러리가 spread하지 않을 가능성): lucide-react 0.575는 `forwardRef + spread`이므로 일반적으로 spread됨. 만약 실패 시 `data-testid={iconName}` 으로 대체.

- [ ] **Step 5: 커밋**

```bash
git add src/components/garden/StageIcon.tsx src/components/garden/StageIcon.test.tsx
git commit -m "feat(garden): StageIcon — Tree/Farm 5단계 컬러 배지 컴포넌트"
```

---

## Task 3: FarmStageIcon 테스트 추가 (RED→GREEN, 사실 GREEN)

**Files:**
- Modify: `src/components/garden/StageIcon.test.tsx`

Task 2에서 이미 `FarmStageIcon`을 구현했으므로 테스트만 추가하면 GREEN. 명시적으로 케이스를 작성해 회귀 보호.

- [ ] **Step 1: FarmStageIcon describe 블록 추가**

`StageIcon.test.tsx`에 추가 (기존 `describe("TreeStageIcon", ...)` 다음):

```tsx
import { FarmStageIcon } from "./StageIcon";

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
```

(기존 import 줄에 `FarmStageIcon` 추가 — 별도 import 줄 만들지 말고 첫 import 라인에 합치기.)

- [ ] **Step 2: 테스트 실행**

```bash
npm run test:run -- src/components/garden/StageIcon.test.tsx
```

기대: 11 passed (TreeStageIcon 6 + FarmStageIcon 5).

- [ ] **Step 3: 커밋**

```bash
git add src/components/garden/StageIcon.test.tsx
git commit -m "test(garden): FarmStageIcon 5단계 케이스 보강"
```

---

## Task 4: `stage-pop` keyframe 추가

**Files:**
- Modify: `src/styles.css`

- [ ] **Step 1: keyframe 위치 확인**

```bash
cd /Users/ayoungjo/daily-quest-keeper
grep -n "@keyframes\|\.animate-" src/styles.css | tail -20
```

기존 keyframe 패턴 파악 (`bloom-pulse`, `float-up`, `bloom-burst`, `petal`, `shimmer` 등이 라인 156부터 정의됨).

- [ ] **Step 2: `stage-pop` keyframe + utility 추가**

`src/styles.css`의 마지막 keyframe 정의 다음(파일 끝부분)에 추가:

```css
@keyframes stage-pop {
  from { transform: scale(0.6); opacity: 0; }
  to   { transform: scale(1);   opacity: 1; }
}
.animate-stage-pop { animation: stage-pop 0.4s ease-out; }
```

- [ ] **Step 3: 빌드 + 테스트**

```bash
npm run build
npm run test:run
```

기대: 빌드 성공, 모든 테스트 통과 (이전 Task의 21 + 11 = 27 passed, 또는 전체).

- [ ] **Step 4: 커밋**

```bash
git add src/styles.css
git commit -m "feat(style): stage-pop keyframe — StageIcon tier 변경 시 pop 트랜지션"
```

---

## Task 5: ProjectList.tsx에서 StageIcon 사용

**Files:**
- Modify: `src/components/garden/ProjectList.tsx`

- [ ] **Step 1: import 추가**

`src/components/garden/ProjectList.tsx`의 import 섹션(파일 상단)에 추가:

```ts
import { TreeStageIcon, FarmStageIcon } from "./StageIcon";
```

(기존 import 라인들 사이에 자연스러운 위치에 끼워넣기.)

- [ ] **Step 2: 기존 `TreeIcon` 함수 교체**

`src/components/garden/ProjectList.tsx:57~67`의 `TreeIcon` 함수 본문을 다음으로 교체:

```tsx
// ── 나무 성장 단계 컴포넌트
function TreeIcon({ pct, completed }: { pct: number; completed: boolean }) {
  const stage = treeStage(pct, completed);
  return (
    <span title={`${stage.label} (${Math.round(pct)}%)`}>
      <TreeStageIcon tier={stage.tier as 1 | 2 | 3 | 4 | 5} size={28} />
    </span>
  );
}
```

변경점: emoji `<span>` → `<TreeStageIcon>` 호출. `title` 속성은 외부 `<span>`으로 옮겨서 유지(접근성 유지).

`stage.tier`는 number이므로 `as 1|2|3|4|5` 단언이 필요. (tier 타입을 좁히려면 garden-store.ts의 treeStage 반환 타입을 `tier: 1|2|3|4|5`로 좁히는 별도 작업 가능 — 본 plan 범위 밖.)

- [ ] **Step 3: FarmCard 헤더 emoji 교체**

`src/components/garden/ProjectList.tsx:539`의 다음 라인을 교체:

**Before**:
```tsx
        <span className="text-2xl leading-none">{stage.icon}</span>
```

**After**:
```tsx
        <FarmStageIcon tier={stage.tier as 1 | 2 | 3 | 4 | 5} size={28} />
```

- [ ] **Step 4: 빌드 + 타입 체크**

```bash
npm run build
```

기대: 빌드 성공. 타입 에러 없음. tier 단언이 거슬리면 `as const` 패턴 또는 그냥 `Number(stage.tier) as 1|2|3|4|5` — 어느 쪽이든 통과.

- [ ] **Step 5: 전체 테스트**

```bash
npm run test:run
```

기대: 27 passed (또는 전체).

- [ ] **Step 6: 커밋**

```bash
git add src/components/garden/ProjectList.tsx
git commit -m "feat(garden): ProjectList — emoji → StageIcon 컴포넌트 교체"
```

---

## Task 6: map.tsx에서 StageIcon 사용

**Files:**
- Modify: `src/routes/map.tsx`

- [ ] **Step 1: import 추가**

`src/routes/map.tsx`의 import 섹션에 추가:

```ts
import { TreeStageIcon, FarmStageIcon } from "@/components/garden/StageIcon";
```

- [ ] **Step 2: FarmTerritory 헤더 emoji 교체**

`src/routes/map.tsx:127`을 교체:

**Before**:
```tsx
        <span className="text-3xl">{stage.icon}</span>
```

**After**:
```tsx
        <FarmStageIcon tier={stage.tier as 1 | 2 | 3 | 4 | 5} size={40} />
```

- [ ] **Step 3: TreeNode 외곽 원 + emoji 교체**

`src/routes/map.tsx:196~205` (TreeNode 안 외곽 원 div)를 교체:

**Before**:
```tsx
      {/* 원형 아이콘 */}
      <div
        className={`size-16 rounded-full flex items-center justify-center text-2xl border-2 transition-all ${
          tree.completed
            ? "border-primary/30 bg-primary/10"
            : "border-accent/30 bg-card/60 group-hover/tree:border-accent/70 group-hover/tree:bg-accent/10"
        }`}
      >
        {stage.icon}
      </div>
```

**After**:
```tsx
      {/* 원형 스테이지 배지 */}
      <TreeStageIcon tier={stage.tier as 1 | 2 | 3 | 4 | 5} size={64} />
```

(StageIcon 자체가 이미 둥근 컬러 배지이므로 외곽 원 div는 제거. 호버 효과는 StageIcon 내장 `hover:scale-105`로 대체.)

- [ ] **Step 4: 빌드 + 타입 체크 + 테스트**

```bash
npm run build
npm run test:run
```

기대: 빌드 성공, 27 passed.

- [ ] **Step 5: 커밋**

```bash
git add src/routes/map.tsx
git commit -m "feat(map): emoji → StageIcon 컴포넌트 교체 + TreeNode 외곽 원 흡수"
```

---

## Task 7: 수동 검증

**Files:** 코드 변경 없음.

- [ ] **Step 1: dev 서버 실행**

```bash
cd /Users/ayoungjo/daily-quest-keeper
npm run dev
```

브라우저에서 출력된 URL 열기.

- [ ] **Step 2: 메인 화면 검증**

1. 농장 카드 헤더 — emoji 대신 컬러 배지(28px)가 보임. 농장 단계에 따라 색이 다름 (1: 회색 흙 / 5: 골드 마을)
2. 나무(프로젝트) 카드 — 동일하게 컬러 배지 (28px)
3. 호버 시 살짝 scale-up
4. tier 5 농장이 있으면 골드 halo가 pulse 애니메이션

- [ ] **Step 3: /map 페이지 검증**

`/map`으로 이동:

1. 농장 헤더 — 40px 컬러 배지
2. 나무 노드 — 64px 컬러 배지 (외곽 원 사라짐, StageIcon 자체가 둥근 배지)
3. 단계별 색 차이 명확
4. tier 5 항목들 halo

- [ ] **Step 4: 단계 전환 (pop 애니메이션)**

1. 메인 화면에서 임무 추가 → 토글로 진행률 변경
2. 진행률이 단계 임계점(20%, 50%, 80%)을 넘어 단계가 바뀌면 새 배지가 0.4s 동안 scale + opacity로 등장 — pop 애니메이션 확인
3. tier 5 도달 시 halo가 즉시 보임

- [ ] **Step 5: 모바일 뷰포트 (390×844)**

1. 작은 사이즈 배지 (28px)도 인식 가능
2. /map의 64px 배지 — 너무 크지 않은지 확인
3. 레이아웃 깨짐 없음

- [ ] **Step 6: 회귀 확인**

1. DnD — task→project 드래그, 프로젝트 reorder, 농장 reorder 정상
2. /map 클릭 → 메인 화면 해당 농장으로 스크롤 정상
3. 헤더 액션 버튼 정상

- [ ] **Step 7: 결과 보고**

검증 통과 → push 진행:

```bash
git push origin main
```

(워크트리/feature 브랜치 사용 시 finishing-a-development-branch 스킬에서 머지 처리.)

이슈 발견 → 해당 Task로 돌아가 수정 + 재검증.

---

## 완료 후

다음 후보:
- 로드 중 사용자 입력이 원격 응답으로 덮이는 별도 레이스 픽스 (AI API 키/도구연결 저장 안 되는 증상의 원인 가능성)
- /map 추가 강화 (E. 위치 자체 — 농장이 진짜 "지도상의 점"처럼 흩어진 배치)
