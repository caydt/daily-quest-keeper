# 농장 순서 변경 기능 — Design Spec

**작성일**: 2026-05-06
**작업자**: Claude (with @ayoungjo)
**상태**: 사용자 검토 대기

## 배경

`Farm` 타입은 이미 `order: number` 필드를 가지고 있고 `sortedFarms = [...farms].sort((a,b) => (a.order ?? 0) - (b.order ?? 0))` 패턴이 메인 화면(`ProjectList.tsx:776`)과 맵 화면(`map.tsx:25`) 양쪽에 적용돼 있다. 즉 **데이터 모델·정렬 로직은 이미 준비된 상태**이고, 사용자가 순서를 조작할 UI만 비어 있다.

`reorderProjects`, `reorderTasks` 등 동일 컨셉의 store 액션이 이미 존재한다. 이번 작업은 그 패턴을 따른다.

## 목표

농장 카드의 순서를 사용자가 직접 변경할 수 있게 한다. 변경 결과는 메인 화면·맵 화면 양쪽에 즉시 반영된다.

## 비목표 (YAGNI)

- 농장 안의 나무(프로젝트) 순서 변경 — 이미 별도 `reorderProjects` 존재, 본 spec 범위 밖
- 드래그 앤 드롭 — 위/아래 버튼 방식 채택 (모바일 안정성)
- /map 페이지 시각 강화 — 별도 spec
- "오늘의 임무" 위치 이동 — 별도 spec

## 사용자 경험

- 각 농장 카드 헤더 우측에 ▲ ▼ 버튼이 항상 표시된다
- ▲ 클릭: 바로 위 농장과 위치 교환
- ▼ 클릭: 바로 아래 농장과 위치 교환
- 첫 번째 농장의 ▲, 마지막 농장의 ▼ 는 **흐리게 표시되고 비활성**(클릭해도 동작 없음). 위치는 유지해서 카드 레이아웃이 흔들리지 않게 한다
- 변경은 즉시 화면에 반영되고, 기존 디바운스 자동저장 로직을 통해 로컬 + Apps Script(Google Sheets)에 자동 동기화된다

## 데이터 레이어

### `src/lib/garden-store.ts`

새 액션 추가:

```ts
const moveFarm = useCallback((id: string, direction: "up" | "down") => {
  setState((s) => {
    const sorted = [...s.farms].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const idx = sorted.findIndex((f) => f.id === id);
    if (idx === -1) return s;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return s; // 경계 no-op

    const a = sorted[idx];
    const b = sorted[swapIdx];
    return {
      ...s,
      farms: s.farms.map((f) => {
        if (f.id === a.id) return { ...f, order: b.order ?? swapIdx };
        if (f.id === b.id) return { ...f, order: a.order ?? idx };
        return f;
      }),
    };
  });
}, []);
```

`useGarden()` 반환 객체에 `moveFarm`을 추가한다.

### 왜 swap 방식인가

기존 `reorderProjects(orderedIds)` 패턴 대신 `moveFarm(id, direction)`을 채택한 이유:

- 위/아래 버튼이라는 UI에 1:1 매핑 — 인덱스 계산을 호출자가 다룰 필요 없음
- 한 번에 두 농장의 `order`만 변경하므로 변경 범위가 작고, Apps Script 동기화 페이로드도 가벼움
- 테스트 케이스가 단순 (인접 swap, 경계, 미존재 id)

## UI 레이어

### `src/components/garden/ProjectList.tsx`

**`FarmCard` 컴포넌트 props 추가**:

```ts
isFirst: boolean;
isLast: boolean;
onMoveUp: (farmId: string) => void;
onMoveDown: (farmId: string) => void;
```

**버튼 렌더링** — 농장 헤더 우측, 기존 액션 버튼 영역에 배치:

```tsx
<button
  type="button"
  aria-label="농장 위로 이동"
  disabled={isFirst}
  onClick={() => onMoveUp(farm.id)}
  className="size-7 rounded-lg ... disabled:opacity-30 disabled:cursor-not-allowed"
>
  <ChevronUp className="size-4" />
</button>
<button
  type="button"
  aria-label="농장 아래로 이동"
  disabled={isLast}
  onClick={() => onMoveDown(farm.id)}
  className="size-7 rounded-lg ... disabled:opacity-30 disabled:cursor-not-allowed"
>
  <ChevronDown className="size-4" />
</button>
```

`disabled` 상태에서는 `opacity-30`으로 흐리게, `cursor-not-allowed`로 인터랙션 불가 시그널.

**메인 루프 변경** (line 904 근처, `sortedFarms.map(...)`):

```tsx
{sortedFarms.map((farm, idx) => (
  <FarmCard
    key={farm.id}
    farm={farm}
    isFirst={idx === 0}
    isLast={idx === sortedFarms.length - 1}
    onMoveUp={moveFarm}
    onMoveDown={moveFarm}
    {/* ...기존 props */}
  />
))}
```

호출 측에서 `(id) => moveFarm(id, "up")` / `(id) => moveFarm(id, "down")` 어댑터를 만들어 전달한다.

### `src/routes/index.tsx`

`useGarden()` 반환에서 `moveFarm`을 분해해 `ProjectList`로 전달.

## 테스트

이 프로젝트는 현재 테스트 프레임워크가 없으므로 인프라 도입을 함께 진행한다.

### 인프라

설치:
- `vitest` — 테스트 러너
- `@testing-library/react` + `@testing-library/jest-dom` — 컴포넌트 테스트
- `jsdom` — DOM 환경
- `@vitest/ui` (옵션, 생략 가능)

`package.json` scripts에 `"test": "vitest"`, `"test:run": "vitest run"` 추가.

`vite.config.ts`에 `test: { environment: "jsdom", setupFiles: ["./src/test-setup.ts"] }` 추가.

### 테스트 케이스

**`src/lib/garden-store.test.ts`** — `moveFarm` 단위 테스트 (renderHook 사용):

1. 중간 농장 ▲ → 위 농장과 order swap
2. 중간 농장 ▼ → 아래 농장과 order swap
3. 첫 농장 ▲ → 변화 없음 (no-op)
4. 마지막 농장 ▼ → 변화 없음 (no-op)
5. 존재하지 않는 id → 변화 없음

**`src/components/garden/FarmCard.test.tsx`** — 컴포넌트 동작:

1. ▲ 클릭 → `onMoveUp(farm.id)` 1회 호출
2. ▼ 클릭 → `onMoveDown(farm.id)` 1회 호출
3. `isFirst=true` → ▲ 버튼 `disabled` 속성
4. `isLast=true` → ▼ 버튼 `disabled` 속성
5. `isFirst=true` 상태에서 ▲ 클릭 → 핸들러 호출되지 않음

> 주: `FarmCard`는 현재 `ProjectList.tsx` 내부 로컬 함수다. 테스트를 위해 동일 파일에서 `export function FarmCard` 로 노출하거나, `FarmCard.tsx` 별도 파일로 분리한다. 분리 쪽이 깔끔하지만 spec 범위를 키우므로 **export만 추가하는 최소 변경**으로 간다. (필요 시 추후 별도 작업으로 분리)

### 검증 절차 (TDD 흐름)

각 케이스마다:
1. RED: 실패 테스트 작성, `npm run test:run` 으로 실패 확인
2. GREEN: 최소 구현, 테스트 통과 확인
3. 다음 케이스로

## 변경 파일 요약

- 신규: `src/test-setup.ts`, `src/lib/garden-store.test.ts`, `src/components/garden/FarmCard.test.tsx`
- 수정: `package.json`, `vite.config.ts`, `src/lib/garden-store.ts`, `src/components/garden/ProjectList.tsx`, `src/routes/index.tsx`

## 리스크

- **store 테스트의 비동기 setState**: `useGarden`은 디바운스 자동저장을 가지지만 `setState` 자체는 동기. `act()`로 감싸면 충분.
- **`FarmCard` export 노출**: 다른 곳에서 import할 가능성은 낮지만, 테스트 외 사용은 금지(주석으로 명시)하거나 `export function FarmCardForTest`처럼 별칭 고려. → 단순히 `export`만 붙이고 코멘트로 의도 표시.
- **Apps Script 동기화**: order 두 개만 바뀌므로 페이로드 영향 무시할 수준.
