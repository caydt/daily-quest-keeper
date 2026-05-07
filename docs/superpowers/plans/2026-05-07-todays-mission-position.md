# 오늘의 임무 위치 변경 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `<TaskList>`(오늘의 임무)을 `<PledgeBoard>` 위로 옮겨 사용자가 페이지를 열 때 가장 먼저 보게 한다.

**Architecture:** `src/routes/index.tsx`의 마크업 순서만 이동. `<DndContext>`를 위로 끌어올려 `<TaskList>`와 `<main grid>`를 모두 감싼다 (task → project 크로스 드래그 보존). 새 위치는 `max-w-3xl mx-auto` 중앙 좁은 폭.

**Tech Stack:** React 19, TanStack Router, Tailwind v4, @dnd-kit/core.

**Spec:** `docs/superpowers/specs/2026-05-07-todays-mission-position-design.md`

---

## File Structure

**Modified:**
- `src/routes/index.tsx` — `<DndContext>` 영역을 PledgeBoard 위까지 확장 + `<TaskList>` 블록을 좌측 컬럼에서 빼서 `<DndContext>` 안 가장 위로 이동

테스트 파일 변경 없음. 기존 16개 단위 테스트가 데이터 레이어 회귀를 막아주고, 시각/구조 회귀는 수동 검증으로 확인.

---

## Task 1: TaskList 위치 이동 + DndContext 영역 확장

**Files:**
- Modify: `src/routes/index.tsx`

이 Task는 마크업 순서를 한 번에 재배치한다. 중간 상태에서 JSX가 깨지지 않도록 **단일 원자 편집**으로 진행하라.

- [ ] **Step 1: 변경 위치 식별**

```bash
cd /Users/ayoungjo/daily-quest-keeper
grep -n "</header>\|PledgeBoard\|<DndContext\|</DndContext>\|<TaskList\|{/\* Main grid\|<footer\|<Avatar" src/routes/index.tsx
```

확인할 라인 (정확한 번호는 환경에 따라 ±몇 줄):
- `</header>` (대략 line 271)
- `{/* 각오 보드 */}` + `<PledgeBoard ... />` (대략 line 273~274)
- `{/* Avatar HUD */}` + `<Avatar ... />` block (대략 line 276~282)
- `{/* Main grid */}` + `<DndContext ...>` 시작 (대략 line 284~290)
- `<main className="grid ...">` + `<ProjectList ... />` (대략 line 291~315)
- `<TaskList ... />` (대략 line 316~323)
- 좌측 컬럼 종료 `</div>` + `<aside ...>` (대략 line 324~329)
- `</main>` + `</DndContext>` + `<footer ...>` (대략 line 330~333)

- [ ] **Step 2: 단일 편집으로 마크업 재배치**

`src/routes/index.tsx`에서 `</header>` 다음 줄(빈 줄 포함)부터 `</DndContext>` 종료 태그까지의 블록 전체를 다음 코드로 치환한다. 즉 "각오 보드 ~ 메인 그리드 끝"까지 통째로 바꾼다.

**대상 범위 (Before — 현재 코드)**:

`</header>` 다음 줄부터 `</DndContext>` 줄까지. 정확히 이 패턴을 포함:

```tsx
        </header>

        {/* 각오 보드 */}
        <PledgeBoard pledges={state.pledges ?? []} onSet={setPledge} />

        {/* Avatar HUD */}
        <Avatar
          totalXp={state.totalXp}
          xp={state.xp}
          combo={state.combo}
          streak={state.streak}
        />

        {/* Main grid */}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <main className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">
            <div className="space-y-6 min-w-0">
              <ProjectList
                projects={state.projects}
                farms={state.farms}
                tasks={state.tasks}
                totalXp={state.totalXp}
                availableTools={availableTools}
                onAdd={addProject}
                onToggle={toggleProject}
                onDelete={deleteProject}
                onReorder={reorderProjects}
                onAssignTask={assignTaskToProject}
                onAddFarm={addFarm}
                onDeleteFarm={deleteFarm}
                onUpdateFarm={updateFarm}
                onMoveProjectToFarm={moveProjectToFarm}
                onToggleFarmTool={toggleFarmTool}
                onToggleProjectTool={toggleProjectTool}
                onUpdateProject={updateProject}
                onAddSubTask={addSubTask}
                settings={state.settings}
                onAddTasksToProject={handleAddTasksToProject}
                onMoveFarm={moveFarm}
              />
              <TaskList
                tasks={visibleStandalone}
                onToggle={toggleTask}
                onDelete={deleteTask}
                onPostpone={postponeTask}
                onAdd={addTask}
                onReorder={reorderTasks}
              />
            </div>
            <aside className="space-y-6">
              <QuestPanel tasks={todaysTasks} projects={state.projects} combo={state.combo} />
              <SidePanels tasks={todaysTasks} streak={state.streak} totalXp={state.totalXp} />
              <AchievementCodex unlocked={state.achievements} />
            </aside>
          </main>
        </DndContext>
```

**치환 대상 (After — 새 코드)**:

```tsx
        </header>

        {/* DnD 영역: TaskList의 task를 ProjectList의 project로 드래그하는 동작 때문에
            DndContext가 두 컴포넌트를 모두 감싸야 함. PledgeBoard/Avatar는 DnD와 무관하지만
            안에 있어도 무해. */}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          {/* 오늘의 임무 — 헤더 바로 아래, 좁은 중앙 정렬 */}
          <section className="max-w-3xl mx-auto">
            <TaskList
              tasks={visibleStandalone}
              onToggle={toggleTask}
              onDelete={deleteTask}
              onPostpone={postponeTask}
              onAdd={addTask}
              onReorder={reorderTasks}
            />
          </section>

          {/* 각오 보드 */}
          <PledgeBoard pledges={state.pledges ?? []} onSet={setPledge} />

          {/* Avatar HUD */}
          <Avatar
            totalXp={state.totalXp}
            xp={state.xp}
            combo={state.combo}
            streak={state.streak}
          />

          {/* Main grid */}
          <main className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">
            <div className="space-y-6 min-w-0">
              <ProjectList
                projects={state.projects}
                farms={state.farms}
                tasks={state.tasks}
                totalXp={state.totalXp}
                availableTools={availableTools}
                onAdd={addProject}
                onToggle={toggleProject}
                onDelete={deleteProject}
                onReorder={reorderProjects}
                onAssignTask={assignTaskToProject}
                onAddFarm={addFarm}
                onDeleteFarm={deleteFarm}
                onUpdateFarm={updateFarm}
                onMoveProjectToFarm={moveProjectToFarm}
                onToggleFarmTool={toggleFarmTool}
                onToggleProjectTool={toggleProjectTool}
                onUpdateProject={updateProject}
                onAddSubTask={addSubTask}
                settings={state.settings}
                onAddTasksToProject={handleAddTasksToProject}
                onMoveFarm={moveFarm}
              />
            </div>
            <aside className="space-y-6">
              <QuestPanel tasks={todaysTasks} projects={state.projects} combo={state.combo} />
              <SidePanels tasks={todaysTasks} streak={state.streak} totalXp={state.totalXp} />
              <AchievementCodex unlocked={state.achievements} />
            </aside>
          </main>
        </DndContext>
```

**핵심 차이점 (체크리스트)**:
1. `<DndContext>` 시작 태그가 `</header>` 바로 다음으로 이동 (PledgeBoard 위)
2. `<DndContext>` 안 첫 번째 자식으로 `<section className="max-w-3xl mx-auto">` 안에 `<TaskList>` 추가
3. PledgeBoard, Avatar는 그대로 — 단지 `<DndContext>` 안으로 들어옴 (들여쓰기 한 단계 더 깊어짐)
4. 좌측 컬럼(`<div className="space-y-6 min-w-0">`) 안의 `<TaskList>` 블록 8줄 삭제
5. 기존 `{/* Main grid */}` 위에 있던 `<DndContext>` 시작 6줄 삭제 (이제 위로 이동했으므로)
6. `</DndContext>` 종료 태그는 그대로 (위치 그대로, 새 시작 태그와 매칭)
7. PledgeBoard, Avatar의 들여쓰기 한 단계(2 spaces) 더 깊어짐 — DndContext 안으로 이동했으므로

- [ ] **Step 3: 빌드 + 타입 체크**

```bash
cd /Users/ayoungjo/daily-quest-keeper
npm run build
```

기대: 빌드 성공. 타입 에러 없음. JSX 구조 깨졌으면 여기서 잡힘.

**자주 나는 실수**:
- `<DndContext>` 시작/종료 짝 안 맞음 → "Unexpected closing tag" 또는 "Adjacent JSX must be wrapped"
- `<TaskList>` 두 곳에 남음 → 중복 렌더 (런타임에 임무 두 줄 보임)
- 들여쓰기 깨져 prettier 이슈 → 빌드는 통과하나 lint에서 잡힐 수 있음

빌드 실패 시: 에러 메시지의 라인 번호를 보고 짝/들여쓰기 점검. 필요 시 `git diff src/routes/index.tsx` 로 변경 전체를 한 번 훑어 구조가 의도대로인지 확인.

- [ ] **Step 4: lint 확인**

```bash
npm run lint 2>&1 | tail -20
```

기대: 0 errors, 0 warnings (또는 기존 수준 유지 — 새로운 lint 이슈 없음).

- [ ] **Step 5: 전체 테스트 실행**

```bash
npm run test:run
```

기대: 16 passed (FarmCard 6 + garden-store 10). 마크업 변경이라 단위 테스트 영향 없어야 함.

- [ ] **Step 6: 수동 시각 확인 (선택, 빠른 검증용)**

```bash
git diff src/routes/index.tsx | head -150
```

diff 출력에서 다음을 확인:
- `<DndContext>` 시작이 `</header>` 다음으로 이동했는지
- `<section className="max-w-3xl mx-auto">` 신규 추가 + 그 안 `<TaskList>` 있는지
- 좌측 컬럼 안 `<TaskList>` 8줄이 삭제됐는지

- [ ] **Step 7: 커밋**

```bash
git add src/routes/index.tsx
git commit -m "feat(layout): 오늘의 임무를 헤더 바로 아래(PledgeBoard 위)로 이동

DndContext를 PledgeBoard 위까지 확장해 task→project 크로스 드래그를 유지.
새 TaskList 위치는 max-w-3xl mx-auto 중앙 좁은 폭."
```

---

## Task 2: 수동 검증

**Files:** 코드 변경 없음.

- [ ] **Step 1: dev 서버 실행**

```bash
cd /Users/ayoungjo/daily-quest-keeper
npm run dev
```

브라우저에서 출력된 URL 열기 (예: `http://localhost:5173`).

⚠️ **이전에 hydrate/save 레이스 픽스(commit 592b1e4)가 머지된 상태**라 데이터 손실 위험은 없음. 안전하게 dev 서버 띄워도 됨.

- [ ] **Step 2: PC 뷰포트 검증**

브라우저 창을 `lg:` 뷰포트(>=1024px)로 두고 확인:

1. 헤더 바로 아래 **TaskList**가 중앙 좁은 폭(`max-w-3xl`)으로 표시
2. 그 아래 **PledgeBoard**(나의 각오) 풀 폭(`max-w-7xl`)
3. 그 아래 **Avatar HUD** 풀 폭
4. 그 아래 메인 그리드 — 좌측 ProjectList(농장/나무), 우측 aside(QuestPanel/SidePanels/AchievementCodex)
5. 좌측 컬럼 안에 **TaskList가 더 이상 없음** (중복 렌더 아님)

- [ ] **Step 3: 모바일 뷰포트 검증**

Chrome DevTools → toggle device toolbar → iPhone 14 (390×844). 위에서부터 다음 순서로 stack:

1. 헤더
2. **TaskList** (오늘의 임무)
3. PledgeBoard
4. Avatar
5. ProjectList
6. QuestPanel
7. SidePanels
8. AchievementCodex

- [ ] **Step 4: DnD 동작 검증**

다음 4가지 드래그 동작이 모두 정상인지 확인:

1. **TaskList 안 임무 reorder** — 임무를 위/아래로 드래그해 순서 바뀜
2. **TaskList의 task → ProjectList의 project** (크로스 컴포넌트) — task를 project 카드로 드래그하면 task가 해당 project에 할당됨 (TaskList에서 사라지고 project 카드 안에 나타남)
3. **ProjectList 안 project reorder** — 프로젝트를 위/아래 드래그
4. **농장 reorder** — 이전 작업으로 추가된 ▲▼ 버튼 정상 동작

- [ ] **Step 5: `todayCondition` 분기 동작 검증**

1. 헤더의 컨디션 픽커에서 컨디션 미설정 상태 (또는 다른 컨디션) 전환 시 TaskList의 `visibleStandalone`이 정상 필터링되는지 확인
2. 새 임무 추가 → TaskList에 표시됨

- [ ] **Step 6: 헤더 액션 회귀 확인**

다음 헤더 버튼들이 전부 정상 동작:
- 알림 토글
- 도구
- 주간 회고
- 맵
- AI (Sparkles)
- 설정

- [ ] **Step 7: 결과 보고**

검증 모두 통과 → push 진행.
이슈 발견 → Task 1으로 돌아가 수정 후 재검증.

```bash
git push origin main
```

(워크트리/브랜치 사용 시 finishing-a-development-branch 스킬에서 머지 후 push.)

---

## 완료 후

다음 후보:
- 로드 중 사용자 입력이 원격 응답으로 덮이는 별도 레이스 픽스 (AI API 키/도구연결 저장 안 되는 증상의 원인 가능성)
- /map 시각 강화
