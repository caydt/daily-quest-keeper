# 오늘의 임무 위치 변경 — Design Spec

**작성일**: 2026-05-07
**작업자**: Claude (with @ayoungjo)
**상태**: 사용자 검토 대기

## 배경

메인 화면(`src/routes/index.tsx`)에서 "오늘의 임무"(`<TaskList>`)가 메인 그리드의 좌측 컬럼 안, `<ProjectList>` 다음에 위치한다. 사용자가 페이지를 열었을 때 가장 먼저 보고 싶은 정보는 오늘 할 일이지만, 지금은 농장/나무(프로젝트) 카드와 PledgeBoard·Avatar 다음에 위치해 시선이 분산된다.

## 목표

`<TaskList>`를 헤더 바로 아래, `<PledgeBoard>`(나의 각오) 위로 옮긴다. PC/모바일 모두 동일한 순서. 다른 동작·스타일·데이터 흐름은 그대로 유지한다.

## 비목표 (YAGNI)

- TaskList 컴포넌트 내부 구조 변경
- "오늘의 임무" 헤더/스타일 리디자인
- QuestPanel·SidePanels·AchievementCodex(우측 aside) 위치 변경
- 모바일 전용 스타일 추가

## 변경 후 마크업 순서

```
header (헤더 + 액션 버튼 + 컨디션 픽커)
<section max-w-3xl mx-auto> TaskList </section>   ← 신규 위치
PledgeBoard (각오 보드)
Avatar (HUD)
<main grid>
  좌측: ProjectList         ← TaskList 빠짐
  우측 aside: QuestPanel, SidePanels, AchievementCodex   ← 변동 없음
</main>
```

## 데이터 흐름

`<TaskList>`의 props는 변경 없음:
- `tasks={visibleStandalone}` — `todayCondition` 기반 필터링 그대로
- `onToggle`, `onDelete`, `onPostpone`, `onAdd`, `onReorder` — 동일

`visibleStandalone`은 `index.tsx` 함수 본체 상단(line 84 부근)에서 계산되므로 위치 이동에 영향 없음.

## DnD 영역

`handleDragEnd`(`index.tsx:135~175`)에 **task → project drop** 크로스 컴포넌트 동작이 있다(line 144~147). TaskList의 sortable item을 ProjectList의 droppable에 드롭해 task를 project에 할당한다. 따라서 `<DndContext>`는 `<TaskList>`와 `<main grid>` 양쪽을 모두 감싸야 한다.

**현재**: `<DndContext>`가 `<main grid>`만 감쌈 (line 285~331 사이).
**변경 후**: `<DndContext>`를 `<TaskList>` 바로 위로 끌어올려 다음 4개를 감싼다 — `<TaskList>` section, `<PledgeBoard>`, `<Avatar>`, `<main grid>`.

PledgeBoard와 Avatar는 DnD와 무관하지만 DndContext 안에 있어도 부작용 없음 (이벤트 리스너만 활성화).

## 폭/정렬

- TaskList section: `max-w-3xl mx-auto` — 헤더(`max-w-7xl`)보다 좁은 중앙 정렬. 시선 집중 + 가독성.
- PledgeBoard, Avatar, main grid: 기존 `max-w-7xl` 컨테이너 폭 그대로.

## 모바일

`lg:grid-cols-1` 영향으로 기본이 stack. 새 순서:
1. 헤더
2. **TaskList**
3. PledgeBoard
4. Avatar
5. ProjectList
6. QuestPanel, SidePanels, AchievementCodex

사용자 시선 첫 자리에 오늘의 임무 — 의도와 일치.

## 회귀 우려 + 검증

자동 단위 테스트 추가하지 않음. 이유:
- `index.tsx`는 라우터/훅/DnD 의존성이 무거워 단위 테스트가 비싸고 진정성 검증이 어렵다.
- 변경은 마크업 순서 이동 한 건 — 컴포넌트 로직 회귀 가능성 낮음.
- 기존 16개 단위 테스트(garden-store, FarmCard)가 데이터 레이어 회귀를 막아준다.
- 시각/구조 회귀는 수동 검증으로 확인.

**수동 검증 체크리스트**:
1. PC `lg:` 뷰포트 — 헤더 바로 아래 TaskList 중앙 좁은 폭, 그 아래 PledgeBoard/Avatar 풀 폭
2. 모바일 (390×844 viewport) — TaskList → PledgeBoard → Avatar → ProjectList 순서로 stack
3. TaskList 안 임무 reorder 드래그 — 정상 동작
4. TaskList의 task를 ProjectList의 project 카드로 드래그 — task가 해당 project에 할당됨
5. ProjectList 안 project reorder, 농장 reorder, 나무 추가/이동 — 정상 동작
6. `todayCondition` 미설정/설정 양쪽 — TaskList 표시/숨김 또는 필터링 정상
7. 헤더 액션 버튼(AI, 도구, 주간 회고, 맵, 설정) 정상 동작 — 회귀 없음

## 변경 파일

- 수정: `src/routes/index.tsx` (마크업 순서 + DndContext 영역 확장)

## 리스크

- **DndContext 영역 확장**: PledgeBoard/Avatar 안에 향후 클릭/드래그 충돌 가능한 요소가 추가되면 영향. 현재 두 컴포넌트는 단순 디스플레이 + 단순 클릭 핸들러라 무해.
- **폭 비대칭**: TaskList(`max-w-3xl`)와 다른 섹션(`max-w-7xl`)의 폭 차이가 어색해 보일 수 있음. 사용자 합의된 결정. 수동 검증에서 어색하면 추가 조정 가능.
