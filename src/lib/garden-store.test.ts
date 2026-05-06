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
});
