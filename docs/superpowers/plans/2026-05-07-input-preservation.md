# 로드 중 사용자 입력 보존 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** hydrate/focus-refetch에서 도착하는 원격 데이터가 사용자가 그 사이 입력한 값을 덮어쓰지 못하도록 차단하고, 도구 시트 URL 인풋을 명시적 저장 버튼 패턴으로 통일.

**Architecture:** `useGarden`에 `userTouched` ref + `useEffect[state]` watcher 추가. state ref가 변경될 때 `isApplyingRemote.current === false`이면 userTouched=true. hydrate ②와 focus-refetch 두 원격 적용 경로 모두 진입 직전 가드. 설정 페이지의 toolsSheetUrl 인풋은 local state + 저장 버튼으로 변경.

**Tech Stack:** React 19 hooks, vitest + @testing-library/react.

**Spec:** `docs/superpowers/specs/2026-05-07-input-preservation-design.md`

---

## File Structure

**Modified:**
- `src/lib/garden-store.ts` — `userTouched` ref, state watcher useEffect, hydrate ② 가드, focus-refetch 가드
- `src/lib/garden-store.test.ts` — userTouched gate 테스트 2 케이스
- `src/routes/settings.tsx` — toolsSheetUrl 인풋을 local state + 저장 버튼 패턴으로 변경

---

## Task 1: `userTouched` ref + state watcher (RED→GREEN)

**Files:**
- Modify: `src/lib/garden-store.test.ts`
- Modify: `src/lib/garden-store.ts`

- [ ] **Step 1: 테스트 추가 (RED)**

`src/lib/garden-store.test.ts`의 기존 `describe("hydrate/save race", ...)` 블록 안에 추가 (마지막 `it` 다음):

```ts
  it("[userTouched] hydrate 후 사용자 액션 → 도착하는 원격 응답을 적용하지 않음", async () => {
    // 로컬 시드: 농장 1개
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ farms: [farm("local-a", 0, "로컬 농장")] }),
    );
    const { result } = renderHook(() => useGarden());
    await waitFor(() => expect(result.current.hydrated).toBe(true));

    // 사용자 액션: 새 농장 추가 (state 변경 → userTouched=true)
    await act(async () => {
      result.current.addFarm("새 농장");
    });

    // 원격 응답 도착: 다른 농장 데이터
    await act(async () => {
      fetchCtrl.resolveGet({
        farms: [farm("remote-x", 0, "원격 농장")],
        projects: [],
        tasks: [],
      });
      await new Promise((r) => setTimeout(r, 0));
    });

    await waitFor(() => expect(result.current.syncReady).toBe(true));

    // 원격이 적용되지 않아야 함 → 로컬+사용자 액션의 결과 유지
    const ids = result.current.state.farms.map((f) => f.id);
    expect(ids).not.toContain("remote-x");
    expect(ids).toContain("local-a");
  });
```

- [ ] **Step 2: 테스트 실행 — RED 확인**

```bash
cd /Users/ayoungjo/daily-quest-keeper
npm run test:run -- src/lib/garden-store.test.ts
```

기대: 새 테스트 1개 FAIL (`expect(ids).not.toContain("remote-x")` 실패 — 현재 코드에서 원격이 그대로 적용됨).

- [ ] **Step 3: `userTouched` ref + state watcher 추가**

`src/lib/garden-store.ts`의 `useGarden` 함수 본체 상단(다른 useState/useRef들 옆, 대략 line 264~270 근처)에 추가:

```ts
  const userTouched = useRef(false);
```

그리고 hydrate `useEffect` 정의 바로 다음(원격 적용 가드 추가 전 단계 — Task 2에서 가드 도입)에 새 useEffect 추가. 위치: hydrate `useEffect`와 save `useEffect` 사이.

```ts
  // 사용자 액션으로 state가 변경되면 userTouched=true.
  // 원격 적용(applyState in hydrate/focus-refetch)은 isApplyingRemote.current=true 동안 실행되므로 false-positive 차단됨.
  useEffect(() => {
    if (!hydrated) return;
    if (isApplyingRemote.current) return;
    userTouched.current = true;
  }, [state, hydrated]);
```

- [ ] **Step 4: hydrate ②에 userTouched 가드 추가**

`src/lib/garden-store.ts`의 hydrate `run` 함수, 원격 응답 처리 직전(`if (!remote || ...)` 분기 다음)에 가드 삽입.

**Before** (대략 line 320~336):

```ts
        if (!remote || Object.keys(remote).length === 0) {
          if (local) await createSheetsAdapter(scriptUrl).save(local).catch(() => {});
          return;
        }

        // 원격 데이터가 있으면 갱신 (로컬보다 우선).
        const mergedSettings = { ...initial.settings, ...(remote.settings || {}) };
        migrateLegacyCondition(remote, mergedSettings.morningTime);
        applyState(mergeState(remote));
```

**After**:

```ts
        if (!remote || Object.keys(remote).length === 0) {
          if (local) await createSheetsAdapter(scriptUrl).save(local).catch(() => {});
          return;
        }

        // 사용자가 hydrate 후 입력/액션을 했으면 원격 적용 스킵.
        // 이후 save effect가 local→remote 동기화 처리. 다음 새로고침/focus 시 sync.
        if (userTouched.current) return;

        // 원격 데이터가 있으면 갱신 (로컬보다 우선).
        const mergedSettings = { ...initial.settings, ...(remote.settings || {}) };
        migrateLegacyCondition(remote, mergedSettings.morningTime);
        applyState(mergeState(remote));
```

- [ ] **Step 5: 테스트 실행 — GREEN 확인**

```bash
npm run test:run -- src/lib/garden-store.test.ts
```

기대: 모든 테스트 PASS (이전 케이스 + 새 1개).

- [ ] **Step 6: 빌드 확인**

```bash
npm run build
```

기대: 성공.

- [ ] **Step 7: 커밋**

```bash
git add src/lib/garden-store.ts src/lib/garden-store.test.ts
git commit -m "fix(store): hydrate 시 사용자 액션 후 원격 적용 차단

userTouched ref + state watcher useEffect 도입. hydrate 후 사용자가
어떤 액션을 했다면 도착하는 원격 응답을 적용하지 않음 — 사용자 입력
보존 우선. 다음 save effect가 local→remote 동기화 처리."
```

---

## Task 2: 사용자 액션 없을 때 원격 적용 정상 동작 검증

**Files:**
- Modify: `src/lib/garden-store.test.ts`

Task 1 구현이 사용자 액션 없을 때 원격을 정상 적용하는지 회귀 검증.

- [ ] **Step 1: 테스트 추가**

`describe("hydrate/save race", ...)` 안에 Task 1 테스트 다음에 추가:

```ts
  it("[userTouched] hydrate 후 사용자 액션 없음 → 도착하는 원격 응답이 정상 적용", async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ farms: [farm("local-a", 0, "로컬 농장")] }),
    );
    const { result } = renderHook(() => useGarden());
    await waitFor(() => expect(result.current.hydrated).toBe(true));

    // 사용자 액션 없이 원격 응답 도착
    await act(async () => {
      fetchCtrl.resolveGet({
        farms: [farm("remote-x", 0, "원격 농장")],
        projects: [],
        tasks: [],
      });
      await new Promise((r) => setTimeout(r, 0));
    });

    await waitFor(() => expect(result.current.syncReady).toBe(true));

    // 원격이 정상 적용 → 로컬 농장 사라지고 원격 농장만 남음
    const ids = result.current.state.farms.map((f) => f.id);
    expect(ids).toContain("remote-x");
    expect(ids).not.toContain("local-a");
  });
```

- [ ] **Step 2: 테스트 실행**

```bash
npm run test:run -- src/lib/garden-store.test.ts
```

기대: 모든 테스트 PASS (Task 1 구현이 isApplyingRemote 가드로 false-positive 차단하므로 자연스럽게 GREEN).

만약 FAIL하면: `useEffect[state, hydrated]`의 isApplyingRemote 체크 위치 확인. applyState 내부의 `isApplyingRemote.current = true; setState(next); requestAnimationFrame(...)` 순서 확인 — RAF 콜백 안에서 false로 돌아갈 때 useEffect는 이미 한 번 발화했어야 함.

- [ ] **Step 3: 커밋**

```bash
git add src/lib/garden-store.test.ts
git commit -m "test(store): userTouched gate 회귀 — 사용자 액션 없을 때 원격 정상 적용"
```

---

## Task 3: focus-refetch 경로에 userTouched 가드 추가

**Files:**
- Modify: `src/lib/garden-store.ts`

focus-refetch도 동일 race가 있음. 가드 추가.

- [ ] **Step 1: focus-refetch 진입 직전 가드 삽입**

`src/lib/garden-store.ts`의 focus-refetch useEffect 안 `onFocus` 함수, `await ... .load()` 직후, `setState((prev) => ...)` 직전에 가드 추가.

**Before** (대략 line 425~450 부근):

```ts
      try {
        const remote = await createSheetsAdapter(scriptUrl).load();
        if (!remote) return;
        isApplyingRemote.current = true;
        setState((prev) => {
          ...
        });
```

**After**:

```ts
      try {
        const remote = await createSheetsAdapter(scriptUrl).load();
        if (!remote) return;
        // 한 세션 안에서는 사용자 입력 보존 우선. focus-refetch도 스킵.
        // 다음 새로고침 시 hydrate 경로로 sync됨.
        if (userTouched.current) return;
        isApplyingRemote.current = true;
        setState((prev) => {
          ...
        });
```

- [ ] **Step 2: 빌드 + 전체 테스트**

```bash
npm run build
npm run test:run
```

기대: 빌드 성공, 모든 테스트 PASS.

- [ ] **Step 3: 커밋**

```bash
git add src/lib/garden-store.ts
git commit -m "fix(store): focus-refetch도 userTouched 가드 — 동일 race 차단"
```

---

## Task 4: 도구 시트 URL 인풋을 local state + 저장 버튼 패턴으로 변경

**Files:**
- Modify: `src/routes/settings.tsx`

- [ ] **Step 1: import 위치 확인**

```bash
cd /Users/ayoungjo/daily-quest-keeper
grep -n "useState\|useEffect" src/routes/settings.tsx | head
```

기대: `import { useState, useEffect } from "react";` 또는 `useState`만 import 중. `useEffect` 빠져있으면 추가 필요.

- [ ] **Step 2: 인풋용 local state 추가**

`src/routes/settings.tsx`의 컴포넌트 본체 상단 (다른 useState들 옆, 대략 line 26 근처 — `aiApiKey` 같은 패턴 따라가기) 추가:

```tsx
  const [toolsSheetUrlInput, setToolsSheetUrlInput] = useState(state.settings.toolsSheetUrl ?? "");

  // 외부에서 garden state가 변하면 local 인풋도 동기화 (다른 디바이스 sync 등)
  useEffect(() => {
    setToolsSheetUrlInput(state.settings.toolsSheetUrl ?? "");
  }, [state.settings.toolsSheetUrl]);
```

위치: `aiApiKey` useState 다음 줄 또는 가까운 곳. `useEffect`가 import 안 돼있으면 파일 상단 import 라인에 `useEffect` 추가.

- [ ] **Step 3: 인풋 + 저장 버튼 JSX 교체**

`src/routes/settings.tsx`의 도구 시트 섹션 인풋 (line 355~361 근처):

**Before**:

```tsx
          <input
            type="url"
            placeholder="https://docs.google.com/spreadsheets/d/.../edit#gid=0"
            value={state.settings.toolsSheetUrl ?? ""}
            onChange={(e) => updateSettings({ toolsSheetUrl: e.target.value })}
            className="w-full px-3 py-2.5 rounded-xl bg-input/40 border border-white/10 text-sm focus:border-primary/40 focus:outline-none"
          />
```

**After**:

```tsx
          <div className="flex gap-2">
            <input
              type="url"
              placeholder="https://docs.google.com/spreadsheets/d/.../edit#gid=0"
              value={toolsSheetUrlInput}
              onChange={(e) => setToolsSheetUrlInput(e.target.value)}
              className="flex-1 px-3 py-2.5 rounded-xl bg-input/40 border border-white/10 text-sm focus:border-primary/40 focus:outline-none"
            />
            <button
              type="button"
              onClick={() =>
                updateSettings({
                  toolsSheetUrl: toolsSheetUrlInput.trim() || undefined,
                })
              }
              className="px-4 py-2 rounded-xl bg-primary/15 border border-primary/40 text-primary text-sm font-semibold hover:bg-primary/25 transition shrink-0"
            >
              저장
            </button>
          </div>
```

- [ ] **Step 4: 빌드 + 타입 체크**

```bash
npm run build
```

기대: 빌드 성공.

- [ ] **Step 5: lint 확인**

```bash
npm run lint 2>&1 | tail -10
```

기대: 새로운 에러 없음 (기존 prettier/lint 이슈는 무관).

- [ ] **Step 6: 커밋**

```bash
git add src/routes/settings.tsx
git commit -m "feat(settings): 도구 시트 URL 인풋을 local state + 저장 버튼으로 변경

매 onChange마다 garden store 갱신하던 패턴이 hydrate 중 원격 도착 시
인풋 값 사라지는 UX 이슈를 일으킴. AI API 키 인풋과 동일한 명시적
저장 패턴으로 통일."
```

---

## Task 5: 수동 검증

**Files:** 코드 변경 없음.

- [ ] **Step 1: 전체 테스트**

```bash
cd /Users/ayoungjo/daily-quest-keeper
npm run test:run
```

기대: 전체 PASS (이전 56 + 새 2 = 58).

- [ ] **Step 2: dev 서버 실행**

```bash
npm run dev
```

브라우저에서 출력된 URL 열기.

- [ ] **Step 3: Part B 검증 — userTouched gate**

⚠️ **Network 탭 켠 상태에서 진행. 시트 데이터는 그대로 보존되도록 주의.**

1. 페이지 로드 → 헤더의 농장/나무가 정상 표시되는지 확인 (정상 hydrate).
2. 새로고침 → 즉시(원격 GET 도착 전, 1~2초 안에) 농장 추가 또는 임무 토글.
3. 1~2초 뒤 원격 GET 응답 도착 (Network 탭에서 확인) → **사용자가 방금 추가한 항목이 사라지지 않아야 함**.
4. 시트 A1 셀 확인 → 사용자 액션이 정상 POST됐는지(다음 디바운스 600ms 후 반영).

만약 사라진다면: Task 1/3 가드 위치 점검. `if (userTouched.current) return;`이 applyState 호출 직전에 있는지.

- [ ] **Step 4: Part C 검증 — 도구 시트 URL 인풋**

1. /settings 진입 → 도구 시트 URL 인풋이 보임.
2. 한 글자 입력 → 인풋에 그대로 표시됨.
3. 1~2초 안에 페이지 로드 다시 일어나도 (예: F5) → 입력 중이던 글자는 사라짐 (저장 안 했으므로 정상). 
4. 정식 URL 입력 → 저장 버튼 클릭 → 시트 A1에 반영됨 (디바운스 600ms 후).
5. 새로고침 → 저장된 URL이 유지됨.
6. 외부에서 시트 데이터 직접 수정해 toolsSheetUrl 변경 → focus 시 인풋 값 갱신되는지 확인 (선택, useEffect 의존성 동작 확인).

- [ ] **Step 5: 회귀 확인**

1. 농장 추가/삭제, 나무 추가/삭제, 임무 토글 — 정상 작동.
2. 컨디션 picker — 정상 표시 + 저장.
3. /map 페이지 정상 작동.
4. AI API 키 입력 + 저장 — 기존과 동일 동작.

- [ ] **Step 6: 결과 보고 + push**

검증 통과 → push:

```bash
git push origin main
```

이슈 발견 → 해당 Task 수정 + 재검증.

---

## 완료 후

- 사용자가 처음 보고했던 "AI 기능 설정에서 api 키도 저장이 잘 안되네", "도구연결은 저장이 안되나봐" 증상이 해결됨.
- 다음 후보:
  - /map 추가 강화 (위치 자체 — 농장이 진짜 "지도상의 점"처럼 흩어진 배치)
  - 컨디션 잔여 P2 정리 (앱 켠 채 morningTime 가로지를 때 staleness, morningTime 편집 시 컨디션 무효화)
