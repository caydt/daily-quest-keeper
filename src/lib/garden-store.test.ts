import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useGarden, type Farm, farmStage, lastMorningCrossing, migrateLegacyCondition, conditionStampFor, splitMultilinePaste } from "./garden-store";

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

describe("moveFarm", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("중간 농장 ▲ 클릭: 위 농장과 order swap", async () => {
    const result = await seedAndHydrate([farm("a", 0), farm("b", 1), farm("c", 2)]);

    act(() => {
      result.current.moveFarm("b", "up");
    });

    const byId = Object.fromEntries(result.current.state.farms.map((f) => [f.id, f.order]));
    expect(byId).toEqual({ a: 1, b: 0, c: 2 });
  });

  it("중간 농장 ▼ 클릭: 아래 농장과 order swap", async () => {
    const result = await seedAndHydrate([farm("a", 0), farm("b", 1), farm("c", 2)]);

    act(() => {
      result.current.moveFarm("b", "down");
    });

    const byId = Object.fromEntries(result.current.state.farms.map((f) => [f.id, f.order]));
    expect(byId).toEqual({ a: 0, b: 2, c: 1 });
  });

  it("첫 농장 ▲ 클릭: no-op", async () => {
    const result = await seedAndHydrate([farm("a", 0), farm("b", 1)]);

    act(() => {
      result.current.moveFarm("a", "up");
    });

    const byId = Object.fromEntries(result.current.state.farms.map((f) => [f.id, f.order]));
    expect(byId).toEqual({ a: 0, b: 1 });
  });

  it("마지막 농장 ▼ 클릭: no-op", async () => {
    const result = await seedAndHydrate([farm("a", 0), farm("b", 1)]);

    act(() => {
      result.current.moveFarm("b", "down");
    });

    const byId = Object.fromEntries(result.current.state.farms.map((f) => [f.id, f.order]));
    expect(byId).toEqual({ a: 0, b: 1 });
  });

  it("존재하지 않는 id: no-op", async () => {
    const result = await seedAndHydrate([farm("a", 0), farm("b", 1)]);

    act(() => {
      result.current.moveFarm("ghost", "up");
    });

    const byId = Object.fromEntries(result.current.state.farms.map((f) => [f.id, f.order]));
    expect(byId).toEqual({ a: 0, b: 1 });
  });
});

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

  it("느린 sheets fetch 동안 사용자 액션이 시트를 덮지 않는다", async () => {
    // local 비어있고, sheets GET은 계속 pending
    const { result } = renderHook(() => useGarden());
    await waitFor(() => expect(result.current.hydrated).toBe(true));

    // 사용자 액션: 농장 추가 → state 변경 → 디바운스 save 트리거
    await act(async () => {
      result.current.addFarm("새 농장");
    });

    // 디바운스(600ms) 기간 충분히 대기
    await new Promise((r) => setTimeout(r, 700));

    // 원격 fetch 도착 전엔 POST 발생하지 않아야 함
    expect(fetchCtrl.postCalls).toHaveLength(0);
  });

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

  it("원격 fetch 실패 시에도 syncReady=true가 된다", async () => {
    const { result } = renderHook(() => useGarden());
    await waitFor(() => expect(result.current.hydrated).toBe(true));

    await act(async () => {
      fetchCtrl.rejectGet(new Error("network down"));
      await new Promise((r) => setTimeout(r, 0));
    });

    await waitFor(() => expect(result.current.syncReady).toBe(true));
  });

  it("원격 응답이 빈 객체일 때도 syncReady=true가 된다", async () => {
    // 로컬에 데이터를 넣어두지 않으면 빈 응답일 때 save(local)이 호출되지 않음
    const { result } = renderHook(() => useGarden());
    await waitFor(() => expect(result.current.hydrated).toBe(true));

    await act(async () => {
      fetchCtrl.resolveGet({});
      await new Promise((r) => setTimeout(r, 0));
    });

    await waitFor(() => expect(result.current.syncReady).toBe(true));
  });

  it("syncReady=false 동안 saveNow() 호출해도 POST 발생 안 함", async () => {
    const { result } = renderHook(() => useGarden());
    await waitFor(() => expect(result.current.hydrated).toBe(true));
    // GET resolve 안 함 → syncReady=false 유지

    await act(async () => {
      await result.current.saveNow();
    });

    expect(fetchCtrl.postCalls).toHaveLength(0);
  });

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

  it("[userTouched-race] mutator 호출과 같은 batch에서 GET이 도착해도 사용자 입력이 우선", async () => {
    // RED before fix: 사용자 mutator 호출 → setState 큐잉 → watcher useEffect는 다음 effect flush에서야 실행.
    // 그 사이 in-flight GET이 resolve되면 hydrate continuation이 userTouched=false를 보고 applyState 통과 → 입력 clobber.
    // GREEN after fix: setStateUser 헬퍼가 setState 직전에 동기적으로 userTouched=true 설정 → applyState 스킵.
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ farms: [farm("local-a", 0, "로컬")] }),
    );
    const { result } = renderHook(() => useGarden());
    await waitFor(() => expect(result.current.hydrated).toBe(true));

    // 같은 act 안에서: mutator 호출 → 그 직후 GET resolve → microtask drain
    await act(async () => {
      result.current.addFarm("user-farm");
      fetchCtrl.resolveGet({
        farms: [farm("remote-x", 0, "원격")],
        projects: [],
        tasks: [],
      });
      await new Promise((r) => setTimeout(r, 0));
    });

    await waitFor(() => expect(result.current.syncReady).toBe(true));

    const titles = result.current.state.farms.map((f) => f.title);
    expect(titles).toContain("user-farm");
    expect(titles).not.toContain("원격");
  });

  it("[save-order] 빠르게 두 번 saveNow 호출되어도 POST는 직렬화됨 (동시 in-flight 1개 이하)", async () => {
    // RED before fix: 첫 POST 진행 중 두 번째 POST가 동시에 발사됨 → 도착 순서 역전 시 silent data loss.
    // GREEN after fix: inFlight promise chain으로 직렬화 → 동시 in-flight POST는 항상 1개 이하.
    let inFlight = 0;
    let maxConcurrent = 0;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const method = init?.method ?? "GET";
      if (method === "POST") {
        inFlight++;
        maxConcurrent = Math.max(maxConcurrent, inFlight);
        await new Promise((r) => setTimeout(r, 30));
        inFlight--;
        return new Response(JSON.stringify({ ok: true }), {
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ ok: true, data: {} }), {
        headers: { "Content-Type": "application/json" },
      });
    });

    const { result } = renderHook(() => useGarden());
    await waitFor(() => expect(result.current.hydrated).toBe(true));
    await waitFor(() => expect(result.current.syncReady).toBe(true));

    await act(async () => {
      const p1 = result.current.saveNow();
      const p2 = result.current.saveNow();
      await Promise.all([p1, p2]);
    });

    expect(maxConcurrent).toBeLessThanOrEqual(1);
  });
});

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

describe("lastMorningCrossing (morningTime 기준 reset 기준점)", () => {
  it("morningTime 이전: 어제 morningTime의 timestamp 반환", () => {
    // 2026-05-07 06:59, morningTime "07:00" → 2026-05-06 07:00 timestamp
    const at = new Date(2026, 4, 7, 6, 59);
    const expected = new Date(2026, 4, 6, 7, 0).getTime();
    expect(lastMorningCrossing("07:00", at)).toBe(expected);
  });

  it("morningTime 정시: 오늘 morningTime의 timestamp 반환", () => {
    // 2026-05-07 07:00 → 2026-05-07 07:00
    const at = new Date(2026, 4, 7, 7, 0);
    const expected = new Date(2026, 4, 7, 7, 0).getTime();
    expect(lastMorningCrossing("07:00", at)).toBe(expected);
  });

  it("morningTime 이후: 오늘 morningTime의 timestamp 반환", () => {
    // 2026-05-07 23:59 → 2026-05-07 07:00
    const at = new Date(2026, 4, 7, 23, 59);
    const expected = new Date(2026, 4, 7, 7, 0).getTime();
    expect(lastMorningCrossing("07:00", at)).toBe(expected);
  });

  it("자정 직후 (morningTime 전): 어제 morningTime 유지", () => {
    // 2026-05-08 00:01 → 2026-05-07 07:00
    const at = new Date(2026, 4, 8, 0, 1);
    const expected = new Date(2026, 4, 7, 7, 0).getTime();
    expect(lastMorningCrossing("07:00", at)).toBe(expected);
  });

  it("월말 경계: 06:00 → 전월 마지막 날 morningTime", () => {
    // 2026-06-01 06:00 → 2026-05-31 07:00
    const at = new Date(2026, 5, 1, 6, 0);
    const expected = new Date(2026, 4, 31, 7, 0).getTime();
    expect(lastMorningCrossing("07:00", at)).toBe(expected);
  });

  it("morningTime 변경에도 안정: 09:00 시점에 picker로 picked", () => {
    // 사용자 시나리오: morningTime "08:00"으로 09:00에 picker로 컨디션 설정 → conditionSetAt = 09:00 timestamp
    // 이후 settings에서 morningTime "23:00"으로 변경 → 같은 09:00 시점
    // lastMorningCrossing("23:00", 09:00) = 어제 23:00 → conditionSetAt(09:00) >= 어제 23:00 → 컨디션 유지 ✓
    const setAt = new Date(2026, 4, 7, 9, 0).getTime();
    const evalAt = new Date(2026, 4, 7, 9, 0);
    expect(setAt >= lastMorningCrossing("23:00", evalAt)).toBe(true);
  });
});

describe("conditionStampFor (setCondition stamp 계산)", () => {
  it("morningTime 이전에 picked → 오늘 morningTime timestamp", () => {
    // morningTime "08:00", 사용자가 06:30 picker로 picked
    // → stamp = today 08:00 → 오늘 새 윈도우(08:00)까지 이 pick이 커버
    const at = new Date(2026, 4, 7, 6, 30);
    expect(conditionStampFor("08:00", at)).toBe(new Date(2026, 4, 7, 8, 0).getTime());
  });

  it("morningTime 이후에 picked → 그 시각 timestamp (now)", () => {
    // morningTime "08:00", 사용자가 09:00 picker로 picked
    // → stamp = 09:00 (현재 시각, 현재 윈도우 안)
    const at = new Date(2026, 4, 7, 9, 0);
    expect(conditionStampFor("08:00", at)).toBe(at.getTime());
  });

  it("morningTime 정시에 picked → 그 시각 timestamp", () => {
    // morningTime "08:00", 사용자가 08:00 picker로 picked
    const at = new Date(2026, 4, 7, 8, 0);
    expect(conditionStampFor("08:00", at)).toBe(at.getTime());
  });

  it("늦은 morningTime(23:00)에 22:00 picked → today 23:00", () => {
    // morningTime "23:00", 사용자가 22:00 picker로 picked → stamp = today 23:00
    const at = new Date(2026, 4, 7, 22, 0);
    expect(conditionStampFor("23:00", at)).toBe(new Date(2026, 4, 7, 23, 0).getTime());
  });

  it("[P1 회귀 방지] 같은 calendar day 안에서 picker가 두 번 뜨지 않음", () => {
    // 시나리오: morningTime "08:00", 06:30 picker → pick → 09:00 다시 보면 valid 유지.
    const morningTime = "08:00";
    const pickAt = new Date(2026, 4, 7, 6, 30);
    const stamp = conditionStampFor(morningTime, pickAt);

    // 같은 날 06:31 (still pre-morning): valid
    const eval1 = new Date(2026, 4, 7, 6, 31);
    expect(stamp >= lastMorningCrossing(morningTime, eval1)).toBe(true);

    // 같은 날 09:00 (post-morning): valid (picker 다시 안 뜸 ✓)
    const eval2 = new Date(2026, 4, 7, 9, 0);
    expect(stamp >= lastMorningCrossing(morningTime, eval2)).toBe(true);

    // 다음날 09:00: invalid (picker)
    const eval3 = new Date(2026, 4, 8, 9, 0);
    expect(stamp >= lastMorningCrossing(morningTime, eval3)).toBe(false);
  });
});

describe("migrateLegacyCondition (옛 conditionSetOn → conditionSetAt 변환)", () => {
  it("morningTime 인자로 그 시각 timestamp 부여", () => {
    const data = { conditionSetOn: "2026-05-07" } as Parameters<typeof migrateLegacyCondition>[0];
    migrateLegacyCondition(data, "08:00");
    expect(data.conditionSetAt).toBe(new Date(2026, 4, 7, 8, 0).getTime());
  });

  it("morningTime이 늦은 시간(23:00)일 때도 그 시각으로 stamp", () => {
    // 코덱스 케이스: 어제 picker로 picked, morningTime "23:00".
    // 옛 conditionSetOn = "어제". 마이그레이션 stamp = 어제 23:00.
    // 오늘 09:00에서: lastMorningCrossing("23:00", today 09:00) = 어제 23:00.
    // stamp(어제 23:00) >= 어제 23:00 → 컨디션 유지 ✓
    const data = { conditionSetOn: "2026-05-06" } as Parameters<typeof migrateLegacyCondition>[0];
    migrateLegacyCondition(data, "23:00");
    const stamp = data.conditionSetAt!;
    expect(stamp).toBe(new Date(2026, 4, 6, 23, 0).getTime());
    const evalAt = new Date(2026, 4, 7, 9, 0);
    expect(stamp >= lastMorningCrossing("23:00", evalAt)).toBe(true);
  });

  it("conditionSetAt 이미 있음 → 변경 안 함", () => {
    const existing = new Date(2026, 4, 7, 9, 30).getTime();
    const data = { conditionSetOn: "2026-05-07", conditionSetAt: existing } as Parameters<typeof migrateLegacyCondition>[0];
    migrateLegacyCondition(data, "08:00");
    expect(data.conditionSetAt).toBe(existing);
  });

  it("conditionSetOn 없음 → 변경 안 함", () => {
    const data = {} as Parameters<typeof migrateLegacyCondition>[0];
    migrateLegacyCondition(data, "08:00");
    expect(data.conditionSetAt).toBeUndefined();
  });

  it("conditionSetOn 잘못된 형식 → 변경 안 함", () => {
    const data = { conditionSetOn: "invalid" } as Parameters<typeof migrateLegacyCondition>[0];
    migrateLegacyCondition(data, "08:00");
    expect(data.conditionSetAt).toBeUndefined();
  });

  it("어제 데이터 + 오늘 morningTime 이후 → picker 표시", () => {
    const data = { conditionSetOn: "2026-05-06" } as Parameters<typeof migrateLegacyCondition>[0];
    migrateLegacyCondition(data, "07:00");
    const todayAfterMorning = new Date(2026, 4, 7, 9, 0);
    expect(data.conditionSetAt! >= lastMorningCrossing("07:00", todayAfterMorning)).toBe(false);
  });

  it("[P1 회귀 방지] morningTime이 빈 문자열 → fallback 08:00 사용 (NaN 방지)", () => {
    const data = { conditionSetOn: "2026-05-07" } as Parameters<typeof migrateLegacyCondition>[0];
    migrateLegacyCondition(data, "");
    expect(data.conditionSetAt).toBe(new Date(2026, 4, 7, 8, 0).getTime());
    expect(Number.isFinite(data.conditionSetAt)).toBe(true);
  });

  it("[P1 회귀 방지] morningTime이 잘못된 형식 → fallback 08:00 사용", () => {
    const data = { conditionSetOn: "2026-05-07" } as Parameters<typeof migrateLegacyCondition>[0];
    migrateLegacyCondition(data, "garbage");
    expect(data.conditionSetAt).toBe(new Date(2026, 4, 7, 8, 0).getTime());
  });

  it("[focus-refetch P2 회귀 방지] partial remote settings에서 migrate와 merged morningTime 일치", () => {
    // 시나리오: focus-refetch가 remote.settings = {} 반환 (partial, morningTime 누락).
    // merged morningTime은 initial("08:00")이 됨. migrate도 같은 boundary 써야.
    // 호출자 책임: 머지될 settings를 먼저 계산해서 morningTime 전달.
    const remote = {
      conditionSetOn: "2026-05-07",
      settings: {} as never,
    } as Parameters<typeof migrateLegacyCondition>[0];
    const mergedSettings = { morningTime: "08:00" }; // 머지 결과 시뮬레이션
    migrateLegacyCondition(remote, mergedSettings.morningTime);
    expect(remote.conditionSetAt).toBe(new Date(2026, 4, 7, 8, 0).getTime());
  });
});

describe("[P1 회귀 방지] morningTime 빈/잘못된 값에 대한 NaN 가드", () => {
  it("lastMorningCrossing — 빈 morningTime → fallback 08:00", () => {
    const at = new Date(2026, 4, 7, 9, 0);
    const expected = new Date(2026, 4, 7, 8, 0).getTime();
    expect(lastMorningCrossing("", at)).toBe(expected);
    expect(Number.isFinite(lastMorningCrossing("", at))).toBe(true);
  });

  it("lastMorningCrossing — 잘못된 형식 → fallback 08:00", () => {
    const at = new Date(2026, 4, 7, 9, 0);
    const expected = new Date(2026, 4, 7, 8, 0).getTime();
    expect(lastMorningCrossing("not-a-time", at)).toBe(expected);
  });

  it("conditionStampFor — 빈 morningTime → fallback 08:00", () => {
    const at = new Date(2026, 4, 7, 6, 30);
    // pre-fallback-morning(08:00) → stamp = today 08:00
    expect(conditionStampFor("", at)).toBe(new Date(2026, 4, 7, 8, 0).getTime());
  });

  it("conditionStampFor — 잘못된 형식 → fallback 08:00", () => {
    const at = new Date(2026, 4, 7, 6, 30);
    expect(conditionStampFor("invalid", at)).toBe(new Date(2026, 4, 7, 8, 0).getTime());
  });
});

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

describe("[P2-C 회귀 방지] deleteLocalTool은 farms.toolIds에서도 제거", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("로컬 도구 삭제 시 농장에 연결된 toolId도 제거됨", async () => {
    // 시드: 농장 A에 두 도구 연결, 농장 B에 첫 번째만 연결
    const result = await seedAndHydrate([
      { ...farm("farm-a", 0, "농장A"), toolIds: ["local-tool-1", "local-tool-2"] },
      { ...farm("farm-b", 1, "농장B"), toolIds: ["local-tool-1"] },
    ]);

    act(() => {
      result.current.deleteLocalTool("local-tool-1");
    });

    const farmsById = Object.fromEntries(result.current.state.farms.map((f) => [f.id, f]));
    expect(farmsById["farm-a"].toolIds ?? []).not.toContain("local-tool-1");
    expect(farmsById["farm-a"].toolIds ?? []).toContain("local-tool-2");
    expect(farmsById["farm-b"].toolIds ?? []).not.toContain("local-tool-1");
  });
});
