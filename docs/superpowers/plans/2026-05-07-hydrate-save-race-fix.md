# Hydrate/Save 레이스 컨디션 픽스 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `useGarden` 훅의 hydrate가 끝나기 전에 빈 state가 Apps Script로 POST되어 시트가 덮이는 데이터 손실 버그를 막는다.

**Architecture:** `syncReady` 상태(useState)를 도입해 "원격 동기화가 한 번 완료(성공/실패/skip)되었는가"를 추적한다. save effect와 `saveNow`는 `syncReady`가 true가 되기 전엔 실행을 보류한다. Apps Script URL이 없으면 즉시 true.

**Tech Stack:** React 19 hooks, vitest + @testing-library/react, fetch mocking via `vi.spyOn`.

**Spec:** `docs/superpowers/specs/2026-05-07-hydrate-save-race-fix-design.md`

---

## File Structure

**Modified:**
- `src/lib/garden-store.ts` — `syncReady` state 추가, hydrate `finally`로 set, save effect 가드, `saveNow` 가드, return 객체에 노출
- `src/lib/garden-store.test.ts` — fetch mock 인프라 + 회귀 테스트 (`describe("hydrate/save race", ...)`)

**Not modified:** `src/lib/sheets-adapter.ts`, `src/lib/storage.ts` 변경 없음.

**스펙 대비 변경:** 스펙의 회귀 테스트 4개 중 "Apps Script URL 없음" 케이스는 본 plan에서 생략. 이유: `getScriptUrl()`이 `localStorage` 없을 때 하드코딩 기본 URL을 반환하므로 "URL 없음" 상태를 vi.mock 없이 만들 수 없음. 핵심 버그(빈 state로 시트 덮음)는 나머지 테스트(slow fetch, remote 도착, remote 실패)로 충분히 커버됨.

---

## Task 1: Fetch mock 인프라 + 첫 RED 테스트 + `syncReady` 구현

**Files:**
- Modify: `src/lib/garden-store.test.ts`
- Modify: `src/lib/garden-store.ts`

- [ ] **Step 1: 테스트 파일 상단에 fetch mock 헬퍼 추가**

`src/lib/garden-store.test.ts` 상단 import 다음에 추가:

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useGarden, type Farm } from "./garden-store";

const STORAGE_KEY = "lumi-garden-v3";
const SCRIPT_URL_KEY = "lumi-script-url";
const TEST_SCRIPT_URL = "https://test.example/exec";

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

// fetch mock 컨트롤러
type FetchControl = {
  postCalls: Array<{ url: string; body: string }>;
  resolveGet: (data: unknown) => void;
  rejectGet: (err: Error) => void;
};

const installFetchMock = (): FetchControl => {
  const ctrl: FetchControl = {
    postCalls: [],
    resolveGet: () => {},
    rejectGet: () => {},
  };
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = typeof input === "string" ? input : (input as Request).url;
    const method = init?.method ?? "GET";
    if (method === "POST") {
      ctrl.postCalls.push({ url, body: String(init?.body ?? "") });
      return new Response(JSON.stringify({ ok: true }), {
        headers: { "Content-Type": "application/json" },
      });
    }
    // GET: 외부에서 resolve/reject 제어
    return new Promise<Response>((resolve, reject) => {
      ctrl.resolveGet = (data) => {
        resolve(
          new Response(JSON.stringify({ ok: true, data }), {
            headers: { "Content-Type": "application/json" },
          }),
        );
      };
      ctrl.rejectGet = reject;
    });
  });
  return ctrl;
};
```

(기존 `farm`, `seedAndHydrate` 정의는 그대로 두되 import 줄은 `afterEach, vi` 추가.)

- [ ] **Step 2: 새 `describe` 블록 + 첫 RED 테스트 작성**

기존 `describe("moveFarm", ...)` 블록 **다음에** 추가:

```ts
describe("hydrate/save race", () => {
  let fetchCtrl: FetchControl;

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem(SCRIPT_URL_KEY, TEST_SCRIPT_URL);
    fetchCtrl = installFetchMock();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("느린 sheets fetch 동안 빈 state가 POST되지 않는다", async () => {
    // local 비어있고, sheets GET은 계속 pending
    const { result } = renderHook(() => useGarden());
    await waitFor(() => expect(result.current.hydrated).toBe(true));

    // 디바운스(600ms) 충분히 지나도록 대기
    await new Promise((r) => setTimeout(r, 700));

    // POST 발생하지 않아야 함
    expect(fetchCtrl.postCalls).toHaveLength(0);
  });
});
```

- [ ] **Step 3: 테스트 실행 — RED 확인**

```bash
cd /Users/ayoungjo/daily-quest-keeper
npm run test:run -- src/lib/garden-store.test.ts
```

기대: 새 테스트 1개 FAIL (빈 state가 POST됨 — `expect(fetchCtrl.postCalls).toHaveLength(0)` → 실제 1 이상). 기존 `moveFarm` 테스트 5개는 PASS.

만약 GREEN으로 바로 통과하면: fetch mock이 제대로 안 걸린 것. `globalThis.fetch`가 다른 경로로 호출되는지 확인 (jsdom 환경 점검). 또는 Apps Script URL이 mock 안 걸린 다른 URL일 수 있음 → `localStorage.setItem(SCRIPT_URL_KEY, TEST_SCRIPT_URL)` 동작 확인.

- [ ] **Step 4: `garden-store.ts`에 `syncReady` state 추가**

`src/lib/garden-store.ts:264` (`const [hydrated, setHydrated] = useState(false);`) **다음 줄**에 추가:

```ts
const [syncReady, setSyncReady] = useState(false);
```

- [ ] **Step 5: hydrate `useEffect` 변경 — `setSyncReady(true)` 호출 추가**

`src/lib/garden-store.ts:271~322` 의 `useEffect` 안 `run` 함수를 다음과 같이 수정:

```ts
const run = async () => {
  // ① 로컬 데이터 즉시 로드 → 빈 화면 없이 바로 렌더
  const local = await createLocalAdapter().load();
  if (cancelled) return;
  applyState(local ? mergeState(local) : initial);
  setHydrated(true);

  // ② Apps Script URL 있으면 백그라운드에서 원격 데이터 가져와 갱신
  const scriptUrl = getScriptUrl();
  if (!scriptUrl) {
    if (!cancelled) setSyncReady(true);
    return;
  }

  try {
    const remote = await createSheetsAdapter(scriptUrl).load();
    if (cancelled) return;

    if (!remote || Object.keys(remote).length === 0) {
      // 시트가 비어있으면 로컬 데이터를 업로드해 초기화
      if (local) await createSheetsAdapter(scriptUrl).save(local).catch(() => {});
      return;
    }

    // 원격 데이터가 있으면 갱신 (로컬보다 우선)
    applyState(mergeState(remote));
  } catch {
    // Apps Script 실패 → 이미 로컬 데이터가 표시된 상태이므로 그대로 유지
  } finally {
    if (!cancelled) setSyncReady(true);
  }
};
```

(주: 기존 `mergeState`, `applyState` 정의는 변경 없음. `if (cancelled) return;` 가드 위치 그대로.)

- [ ] **Step 6: save effect에 `syncReady` 가드 추가**

`src/lib/garden-store.ts:325~351` 의 save useEffect를 다음과 같이 수정:

```ts
// 저장: StorageAdapter 기반 debounce 저장
useEffect(() => {
  if (!hydrated) return;
  if (!syncReady) return;
  if (isApplyingRemote.current) return;

  const scriptUrl = getScriptUrl();
  const adapter = scriptUrl ? createSheetsAdapter(scriptUrl) : createLocalAdapter();

  if (saveTimer.current) clearTimeout(saveTimer.current);
  saveTimer.current = setTimeout(async () => {
    setSaveStatus("saving");
    try {
      await adapter.save(state);
      setSaveStatus("saved");
      if (savedResetTimer.current) clearTimeout(savedResetTimer.current);
      savedResetTimer.current = setTimeout(() => setSaveStatus("idle"), 2000);
    } catch {
      await createLocalAdapter().save(state);
      setSaveStatus("error");
      if (savedResetTimer.current) clearTimeout(savedResetTimer.current);
      savedResetTimer.current = setTimeout(() => setSaveStatus("idle"), 3000);
    }
  }, 600);

  return () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
  };
}, [state, hydrated, syncReady]);
```

변경점: `if (!syncReady) return;` 한 줄 추가, deps 배열 끝에 `syncReady` 추가.

- [ ] **Step 7: return 객체에 `syncReady` 노출**

`src/lib/garden-store.ts:955~960` 의 `return {` 객체에서 `hydrated,` 다음 줄에 추가:

```ts
return {
  state,
  hydrated,
  syncReady,
  saveStatus,
  // ...기존 그대로
```

- [ ] **Step 8: 테스트 실행 — GREEN 확인**

```bash
npm run test:run -- src/lib/garden-store.test.ts
```

기대: 6 passed (`moveFarm` 5개 + `hydrate/save race` 1개).

- [ ] **Step 9: 커밋**

```bash
git add src/lib/garden-store.ts src/lib/garden-store.test.ts
git commit -m "fix(store): hydrate 중 빈 state가 시트 덮는 레이스 차단

원격 fetch가 끝나기 전 디바운스 save가 발화해 빈 state를 Apps Script로
POST하는 데이터 손실 버그를 막는다. syncReady state로 첫 save를
fetch 완료(성공/실패/URL없음)까지 보류한다."
```

---

## Task 2: 회귀 테스트 추가 (원격 도착, 원격 실패)

**Files:**
- Modify: `src/lib/garden-store.test.ts`

- [ ] **Step 1: "원격 도착" 테스트 추가**

`describe("hydrate/save race", ...)` 안에 첫 테스트 다음에 추가:

```ts
it("원격 데이터 도착 시 state가 원격으로 갱신되고 syncReady=true", async () => {
  const { result } = renderHook(() => useGarden());
  await waitFor(() => expect(result.current.hydrated).toBe(true));

  // 원격 데이터 응답
  await act(async () => {
    fetchCtrl.resolveGet({
      farms: [farm("remote-a", 0, "원격 농장")],
      projects: [],
      tasks: [],
    });
    await new Promise((r) => setTimeout(r, 0)); // 마이크로태스크 한 번
  });

  await waitFor(() => expect(result.current.syncReady).toBe(true));
  expect(result.current.state.farms).toHaveLength(1);
  expect(result.current.state.farms[0].id).toBe("remote-a");
});
```

- [ ] **Step 2: "원격 실패" 테스트 추가**

```ts
it("원격 fetch 실패 시에도 syncReady=true가 된다", async () => {
  const { result } = renderHook(() => useGarden());
  await waitFor(() => expect(result.current.hydrated).toBe(true));

  await act(async () => {
    fetchCtrl.rejectGet(new Error("network down"));
    await new Promise((r) => setTimeout(r, 0));
  });

  await waitFor(() => expect(result.current.syncReady).toBe(true));
});
```

- [ ] **Step 3: 테스트 실행**

```bash
npm run test:run -- src/lib/garden-store.test.ts
```

기대: 8 passed (`moveFarm` 5 + `hydrate/save race` 3). Task 1 구현이 finally 블록에서 `setSyncReady(true)`를 항상 호출하므로 두 케이스 모두 GREEN으로 바로 통과.

만약 "원격 도착" 테스트가 FAIL하면: `fetchCtrl.resolveGet`이 호출됐는지, `mergeState(remote)`가 정상 동작하는지 확인. `applyState`가 `isApplyingRemote=true` 후 RAF에서 false로 돌아가는 시점을 `act`/`waitFor`가 정확히 잡는지 점검.

만약 "원격 실패" 테스트가 FAIL하면: `try/catch/finally` 블록의 finally가 실제로 실행되는지(`if (!cancelled) setSyncReady(true);`), reject가 catch에 잡히는지 확인.

- [ ] **Step 4: 커밋**

```bash
git add src/lib/garden-store.test.ts
git commit -m "test(store): hydrate/save 레이스 회귀 테스트 — 원격 도착/실패 경로"
```

---

## Task 3: `saveNow` 가드 (RED → GREEN)

**Files:**
- Modify: `src/lib/garden-store.test.ts`
- Modify: `src/lib/garden-store.ts`

- [ ] **Step 1: RED 테스트 추가**

`describe("hydrate/save race", ...)` 안에 추가:

```ts
it("syncReady=false 동안 saveNow() 호출해도 POST 발생 안 함", async () => {
  const { result } = renderHook(() => useGarden());
  await waitFor(() => expect(result.current.hydrated).toBe(true));
  // GET resolve 안 함 → syncReady=false 유지

  await act(async () => {
    await result.current.saveNow();
  });

  expect(fetchCtrl.postCalls).toHaveLength(0);
});
```

- [ ] **Step 2: 테스트 실행 — RED 확인**

```bash
npm run test:run -- src/lib/garden-store.test.ts
```

기대: 새 테스트 1개 FAIL (`saveNow`는 아직 `syncReady` 가드 없음 → POST 1회 발생).

- [ ] **Step 3: `saveNow`에 가드 추가**

`src/lib/garden-store.ts:930~949` 의 `saveNow` callback을 다음과 같이 수정:

```ts
const saveNow = useCallback(async () => {
  if (!hydrated) return;
  if (!syncReady) return;
  if (saveTimer.current) clearTimeout(saveTimer.current);

  const scriptUrl = getScriptUrl();
  const adapter = scriptUrl ? createSheetsAdapter(scriptUrl) : createLocalAdapter();

  setSaveStatus("saving");
  try {
    await adapter.save(state);
    setSaveStatus("saved");
    if (savedResetTimer.current) clearTimeout(savedResetTimer.current);
    savedResetTimer.current = setTimeout(() => setSaveStatus("idle"), 2000);
  } catch {
    await createLocalAdapter().save(state);
    setSaveStatus("error");
    if (savedResetTimer.current) clearTimeout(savedResetTimer.current);
    savedResetTimer.current = setTimeout(() => setSaveStatus("idle"), 3000);
  }
}, [state, hydrated, syncReady]);
```

변경점: `if (!syncReady) return;` 한 줄 추가, deps에 `syncReady` 추가.

- [ ] **Step 4: 테스트 실행 — GREEN 확인**

```bash
npm run test:run -- src/lib/garden-store.test.ts
```

기대: 9 passed.

- [ ] **Step 5: 커밋**

```bash
git add src/lib/garden-store.ts src/lib/garden-store.test.ts
git commit -m "fix(store): saveNow도 syncReady 가드 적용 — defense-in-depth"
```

---

## Task 4: 빌드 + 전체 테스트 + 수동 검증

**Files:** 코드 변경 없음.

- [ ] **Step 1: 전체 테스트 실행**

```bash
cd /Users/ayoungjo/daily-quest-keeper
npm run test:run
```

기대: 전체 PASS (FarmCard 6 + moveFarm 5 + hydrate/save race 4 = 15 passed).

- [ ] **Step 2: 빌드 확인**

```bash
npm run build
```

기대: 성공. 타입 에러 없음.

- [ ] **Step 3: 수동 검증 — 안전한 경로**

⚠️ **원본 시트 데이터 위험 경로(localStorage 비우고 새로고침)는 단위 테스트가 보장하므로 생략. 대신 정상 경로만 가볍게 확인.**

```bash
npm run dev
```

브라우저에서 출력된 URL 열기 (예: `http://localhost:5173`). DevTools Network 탭 켠 상태로:

1. **localStorage 비우지 마.** 기존 데이터로 페이지 로드.
2. Network 탭에서 다음 순서 확인:
   - GET `script.google.com/.../exec` 1회 발생
   - GET 응답 도착 **이전에는 POST가 없어야 함** (이게 이번 픽스의 본질)
   - 사용자가 농장/나무 추가하거나 임무 토글하면 그때부터 POST 정상 발생
3. 시트 A1 셀이 그대로인지 확인

**만약 GET 도착 전에 POST가 보이면**: Task 1/3 구현 누락. `syncReady` 게이트가 제대로 안 걸린 것. 이 경우 시트가 다시 덮였을 수 있으니 즉시 시트 버전 기록으로 복원.

**더 강한 검증을 원하면 (선택):** 별도 테스트 시트 + 별도 Apps Script 배포본 만들어 `lumi-script-url`을 그쪽으로 바꾼 뒤 localStorage 비우고 새로고침. 하지만 단위 테스트 4개가 게이트 동작을 명세 수준으로 검증하므로 이 단계는 불필요.

- [ ] **Step 4: 정상 동작 후 push**

```bash
git push origin main
```

수동 검증까지 통과 후에만 push.

---

## 완료 후

이 plan 완료 후:
- 사용자는 안전하게 dev 서버/배포 사이트를 열 수 있음
- 다음 작업: "오늘의 임무 위로 이동" — 별도 brainstorming → spec → plan
