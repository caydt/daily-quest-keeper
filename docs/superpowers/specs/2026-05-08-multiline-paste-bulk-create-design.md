# 멀티라인 붙여넣기 → 항목별 일괄 생성 — Design Spec

**작성일**: 2026-05-08
**작업자**: Claude (with @ayoungjo)
**상태**: 사용자 검토 대기

## 배경

오늘의 임무, 농장, 나무 등을 추가할 때 한 번에 여러 개를 등록하고 싶다. 다른 곳(메모장, 채팅, 노트)에서 줄바꿈된 리스트를 복사해서 붙여넣으면 자동으로 줄별 항목 생성되도록.

## 목표

기존 5개 add-input에 paste 인터셉터 추가:
1. `TaskList` — "새로운 씨앗 심기..." (오늘의 임무)
2. `FarmCard` 안 "할일 입력..." (프로젝트 서브태스크)
3. `FarmCard` 안 "나무 이름 입력..." (나무 추가)
4. `ProjectList` — "농장 이름..." (농장 추가)
5. `ProjectList` — "나무 이름..." (스탠드얼론 나무)

paste된 텍스트에 `\n`이 있으면:
- preventDefault
- 줄별 split → trim → 빈 줄 제거
- 결과 N개를 기존 add 핸들러에 1개씩 순차 호출
- 인풋 비움

`\n` 없으면 (단일 라인 paste): 기본 동작 유지 (인풋에 그대로 붙여넣어짐).

비목표:
- input → textarea 전환 (시각 변화 없음 원칙)
- 단일 라인 타이핑 동작 변경
- 최대 개수 제한 (paste 1번에 100개 넣어도 그대로 처리. 이후 회귀 시 추가 가능)
- AI 패널의 `onAddTasksToProject` 경로 변경 (이미 bulk 지원)

## 데이터 레이어

### `src/lib/garden-store.ts` (신규 export)

순수 함수 추가 — paste 텍스트를 split하는 공통 로직:

```ts
// 멀티라인 paste 텍스트를 트리밍된 줄 배열로. 빈 줄 제거.
export const splitMultilinePaste = (text: string): string[] =>
  text.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
```

`\r?\n`로 split → Windows CRLF + Unix LF 둘 다 처리.

## UI 레이어

### 공통 paste 핸들러 패턴

각 인풋에 동일 패턴 적용. 인라인 함수로 두는 게 hook으로 추상화하는 것보다 단순:

```tsx
onPaste={(e) => {
  const text = e.clipboardData.getData("text");
  if (!text.includes("\n")) return; // 단일 라인 → 기본 동작
  e.preventDefault();
  const titles = splitMultilinePaste(text);
  if (titles.length === 0) return;
  for (const t of titles) onAdd(t, ...);
  setInputValue("");
}}
```

### 인풋별 호출 매핑

| 인풋 | 추가 호출 | 기타 인자 |
|---|---|---|
| TaskList "새로운 씨앗 심기" | `onAdd(title, time, difficulty, kind)` | 현재 폼의 time/difficulty/kind 그대로 |
| FarmCard "할일 입력" (서브태스크) | `onAddSubTask(projectId, title)` | 현재 project id |
| FarmCard "나무 이름 입력" | `onAddTree(farmId, title)` | 현재 farm id |
| ProjectList "농장 이름" | `onAddFarm(title)` | icon 비움 (사용자가 후에 편집) |
| ProjectList "나무 이름" | `onAdd(title)` 또는 동등 | farmId 없음(독립) |

ProjectList "농장 이름"의 icon: 단건 추가에서는 사용자가 이모지 picker로 명시 입력. 멀티라인 paste 시엔 icon 없이 생성, 사용자가 후에 한 번에 또는 개별 편집.

### 변경 파일

**Modified:**
- `src/lib/garden-store.ts` — `splitMultilinePaste` export
- `src/lib/garden-store.test.ts` — 단위 테스트 4 케이스
- `src/components/garden/TaskList.tsx` — 인풋에 onPaste 추가
- `src/components/garden/ProjectList.tsx` — 4개 인풋에 onPaste 추가 (FarmCard 안 2개 + ProjectList 메인 2개)

## 테스트

### `splitMultilinePaste` 단위 테스트

1. `"a\nb\nc"` → `["a", "b", "c"]`
2. `"  a  \n\n  b  "` → `["a", "b"]` (빈 줄 + 공백 트림)
3. `"single"` → `["single"]` (단일 라인도 동일 처리)
4. CRLF: `"a\r\nb"` → `["a", "b"]`
5. 빈 문자열 / 공백만: `""` 또는 `"   "` → `[]`

### 컴포넌트 테스트 (선택)

paste 이벤트 dispatch 테스트는 `userEvent.paste`로 가능하지만 mock 필요. 단위 테스트 한 케이스만 (TaskList) 추가해 회귀 안전망 확보:

`src/components/garden/TaskList.test.tsx` (신규):
- "멀티라인 paste 시 onAdd가 줄 수만큼 호출됨" — `vi.fn()`로 onAdd 가로채고 horizontal lines 확인.

다른 4개 인풋은 동일 패턴이라 수동 검증으로 회귀 방지.

## 변경 파일 요약

**Created:**
- `src/components/garden/TaskList.test.tsx` — 멀티라인 paste 회귀 1 케이스

**Modified:**
- `src/lib/garden-store.ts` — `splitMultilinePaste` export
- `src/lib/garden-store.test.ts` — 5 케이스 추가
- `src/components/garden/TaskList.tsx` — onPaste 핸들러
- `src/components/garden/ProjectList.tsx` — 4개 인풋에 onPaste 핸들러 (FarmCard 헤더의 나무/할일 인풋 + 메인 농장/나무 인풋)

## 리스크

- **정상적인 멀티라인 paste를 잘못 split**: 사용자가 농장 이름을 진짜로 "Line1\nLine2"로 짓고 싶을 때(?) — 거의 없는 케이스. 그래도 `\n` 단일 paste라도 나누는 게 일관성 ✓
- **느린 add 핸들러로 인한 race**: 여러 setState 연속 호출은 React batching으로 처리됨. 다만 "save 디바운스가 첫 add에만 발화하고 마지막 상태 저장"이라 데이터 안전.
- **클립보드 권한 거부**: 일부 브라우저/모드에서 `clipboardData.getData` 실패 시 e.preventDefault 안 하므로 자연 fallback (단일 줄로 paste). 안전.
