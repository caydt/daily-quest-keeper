# 트리/농장 SVG 스테이지 아이콘 — Design Spec

**작성일**: 2026-05-07
**작업자**: Claude (with @ayoungjo)
**상태**: 사용자 검토 대기

## 배경

현재 메인 화면(ProjectList의 나무/농장 카드)과 `/map` 페이지에서 트리/농장 단계를 emoji(`🌱🌿🌲🌳🏆` / `🪨🪴🌱🌾🏡`)로 표시한다. 시각적 임팩트가 약하고 단계 차이가 직관적이지 않다. 정원 게이미피케이션의 시각적 핵심 요소를 강화한다.

## 목표

`treeStage`/`farmStage` 결과를 사용하는 4개 사이트에서 emoji를 **SVG 스테이지 아이콘 컴포넌트**로 교체. lucide-react 아이콘 + 단계별 컬러 배지 + 완성 단계 halo 글로우. 단계 변경 시 부드러운 pop 트랜지션.

## 비목표 (YAGNI)

- 직접 SVG 일러스트 그리기 (lucide-react 활용)
- Avatar HUD의 `stageFromLevel` 아이콘 변경 (별개 도메인)
- 본격 애니메이션 (idle 흔들림, 햇빛, 폭죽) — Brainstorm 시 옵션 C로 명시적 제외
- 데이터 모델 변경 (tier 필드 추가만, icon emoji 필드는 호환을 위해 유지)
- 새 이미지 자산/Lottie/Framer Motion 의존성 추가

## 사용자 경험

- 메인 화면 진입 시 농장/나무 카드의 단계가 컬러풀한 둥근 배지로 표시됨. 단계가 높을수록 색이 진해지고 채도가 올라감.
- `/map` 페이지에서도 동일한 배지가 더 큰 사이즈로 보임. 시각적 톤이 메인과 통일됨.
- 사용자가 임무 완료로 나무가 한 단계 성장 (`tier 2 → tier 3`)하면 새 배지가 0.4s에 걸쳐 부드럽게 등장 (scale + opacity).
- 완성(tier 5) 나무·농장에는 골드 halo가 은은하게 pulse.
- 호버 시 살짝 scale up (1.05).

## 데이터 레이어

### `garden-store.ts`

`treeStage`는 이미 `tier: number` 반환. 변경 없음.

`farmStage` 반환 타입에 `tier` 추가. 기존 `icon` 필드는 호환을 위해 유지(다른 미사용 경로 보호용, 사용처 0 되면 별도 정리).

```ts
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

## UI 레이어

### 새 컴포넌트 `src/components/garden/StageIcon.tsx`

```ts
type Tier = 1 | 2 | 3 | 4 | 5;
type Props = {
  tier: Tier;
  size?: number;       // 배지 외경 픽셀, default 28
  className?: string;
};

export function TreeStageIcon({ tier, size, className }: Props) { ... }
export function FarmStageIcon({ tier, size, className }: Props) { ... }
```

내부 구조 (각 컴포넌트):
1. 외곽 div: `relative inline-flex items-center justify-center rounded-full border-2`, 사이즈 적용 (`width:size, height:size`), tier별 배경/테두리 색
2. 내부 lucide 아이콘: 배지 사이즈의 약 60% (`size * 0.6`)
3. tier 5인 경우만: halo div (`absolute inset-0 -z-10 rounded-full animate-pulse`, 골드 그라디언트 blur)
4. root에 `key={tier}`로 tier 변경 시 unmount/mount → `animate-stage-pop` 클래스로 pop-in

### Tree 5단계

| tier | 라벨 | lucide 아이콘 | 배경 | 테두리 |
|---|---|---|---|---|
| 1 | 씨앗 | `Sprout` (size×0.4) | `bg-stone-700/40` | `border-stone-600` |
| 2 | 새싹 | `Sprout` | `bg-emerald-900/40` | `border-emerald-700` |
| 3 | 성목 | `TreePine` | `bg-emerald-700/30` | `border-emerald-500` |
| 4 | 거목 | `TreePine` | `bg-emerald-600/40 shadow-[0_0_12px_rgba(52,211,153,0.4)]` | `border-emerald-400` |
| 5 | 완성 | `Trophy` | `bg-gradient-to-br from-amber-300 to-amber-500` | `border-amber-200` |

tier 5 halo: `bg-amber-400/30 blur-md` halo div + `animate-pulse`.

### Farm 5단계

| tier | 라벨 | lucide 아이콘 | 배경 | 테두리 |
|---|---|---|---|---|
| 1 | 빈 땅 | `Mountain` | `bg-stone-800/40` | `border-stone-700` |
| 2 | 묘목장 | `Sprout` | `bg-stone-700/40` | `border-emerald-800` |
| 3 | 정원 | `TreePine` | `bg-emerald-900/40` | `border-emerald-600` |
| 4 | 농장 | `Wheat` | `bg-amber-900/30` | `border-amber-700` |
| 5 | 마을 | `Castle` | `bg-gradient-to-br from-amber-300 to-amber-500` | `border-amber-200` |

tier 5 halo: 동일 패턴.

### 호출 사이트 4곳 변경

| 위치 | 변경 |
|---|---|
| `src/routes/map.tsx:204` (TreeNode 원형) | 기존 24×16 emoji span → `<TreeStageIcon tier={stage.tier} size={40} />` (외곽 원은 기존 유지하되 내부 emoji만 교체. 또는 외곽 원 자체를 `<TreeStageIcon>`로 흡수 — Plan에서 결정.) |
| `src/routes/map.tsx:127` (FarmTerritory 헤더) | `<span className="text-3xl">{stage.icon}</span>` → `<FarmStageIcon tier={stage.tier} size={40} />` |
| `src/components/garden/ProjectList.tsx:64` (TreeCard) | `{stage.icon}` → `<TreeStageIcon tier={stage.tier} size={24} />` |
| `src/components/garden/ProjectList.tsx:539` (FarmCard) | `<span className="text-2xl leading-none">{stage.icon}</span>` → `<FarmStageIcon tier={stage.tier} size={28} />` |

map.tsx의 TreeNode는 현재 16px 원 안에 emoji 들어가는 구조. 새 `<TreeStageIcon>` 자체가 이미 둥근 배지라 기존 외곽 원과 겹친다. → **`map.tsx`의 TreeNode 외곽 원 div 제거 + StageIcon으로 대체**. 결과적으로 시각이 훨씬 정돈됨.

### CSS 키프레임

`src/index.css`(또는 Tailwind v4의 `@theme`)에 `stage-pop` 키프레임 + utility 추가:

```css
@keyframes stage-pop {
  from { transform: scale(0.6); opacity: 0; }
  to   { transform: scale(1);   opacity: 1; }
}
.animate-stage-pop { animation: stage-pop 0.4s ease-out; }
```

호버는 Tailwind 기본 `transition-transform hover:scale-105` 사용.

## 테스트

### `src/components/garden/StageIcon.test.tsx` (신규)

vitest + @testing-library/react. 5×2=10 케이스:

1. `<TreeStageIcon tier={N} />` 렌더링 시 해당 lucide 아이콘 식별 가능 (각 아이콘에 `data-testid` 또는 `aria-label` 부여, 또는 lucide의 기본 `data-lucide` 속성)
2. `<TreeStageIcon tier={5} />` 렌더 시 halo div 존재 (다른 tier에는 없음)
3. `<FarmStageIcon tier={N} />` 동일 검증
4. `<FarmStageIcon tier={5} />` halo 검증

### `src/lib/garden-store.test.ts` 추가

`farmStage` tier 반환 5개 케이스:
- (0, 0) → tier 1
- (1, 50) → tier 2
- (2, 30) → tier 3
- (3, 60) → tier 4
- (5, 90) → tier 5

### 수동 검증

1. 메인 화면 — 프로젝트 카드, 농장 카드 헤더 모두 새 배지로 보임
2. `/map` 페이지 — 농장 헤더 + 나무 노드 모두 새 배지
3. 임무 토글로 nature 진행률 변경 시 단계 전환 감지 → pop 애니메이션
4. tier 5 농장/나무 — halo pulse
5. 모바일 (390×844) — 작은 사이즈에서도 인식 가능, 레이아웃 깨짐 없음
6. 호버 시 scale-up 동작

## 변경 파일

**Created:**
- `src/components/garden/StageIcon.tsx`
- `src/components/garden/StageIcon.test.tsx`

**Modified:**
- `src/lib/garden-store.ts` — `farmStage` 반환에 tier 추가
- `src/lib/garden-store.test.ts` — farmStage tier 5 케이스 추가
- `src/routes/map.tsx` — TreeNode 원형 div 제거 + StageIcon 도입, FarmTerritory 헤더 emoji 교체
- `src/components/garden/ProjectList.tsx` — TreeCard, FarmCard 헤더 emoji 교체
- `src/index.css` — `stage-pop` 키프레임 + utility

## 리스크

- **lucide 버전 호환**: `^0.575.0` 사용 중. 검증된 export: Sprout, TreePine, Trophy, Mountain, Wheat, Castle 모두 OK (사전 확인). lucide minor 업그레이드로 export 사라질 가능성은 낮음.
- **map.tsx TreeNode 외곽 원 제거**: 현재 외곽 원의 호버 효과(border 변화)가 사라짐. StageIcon의 hover scale로 대체. 시각적 회귀 가능 → 수동 검증에서 어색하면 외곽 원 유지하되 내부 emoji만 교체로 fallback.
- **`stage.icon` emoji 필드 잔류**: 사용처 0이 되지만 호환을 위해 유지. 추후 정리 시 grep으로 확인 가능.
- **단계 전환 키 mounting 비용**: tier 변경 시 unmount/mount는 React 입장에서 가벼움 (배지 div 1개). 무해.
- **테스트가 lucide 내부 마크업에 의존**: lucide가 마크업 형식을 바꾸면 테스트 깨짐. → `data-testid` 자체 부여로 격리.
