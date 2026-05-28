import { describe, it, expect, vi, beforeEach } from "vitest";
import type { GardenState } from "@/lib/garden-store";

// supabase 클라이언트 전체를 mock
vi.mock("@/lib/supabase-client", () => {
  const from = vi.fn();
  return { supabase: { from } };
});

import { supabase } from "@/lib/supabase-client";
import { createSupabaseAdapter } from "@/lib/supabase-adapter";

const mockState: GardenState = {
  xp: 100,
  totalXp: 100,
  streak: 1,
  combo: 0,
  lastActiveDate: "2026-05-28",
  tasks: [],
  projects: [],
  farms: [],
  notificationsEnabled: false,
  settings: {
    morningTime: "08:00",
    eveningTime: "22:00",
  },
  history: [],
  achievements: {},
  condition: null,
  conditionSetAt: null,
  localTools: [],
  pledges: [],
};

const USER_ID = "test-user-id";

function makeChain(overrides: Record<string, unknown> = {}) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockResolvedValue({ error: null }),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    ...overrides,
  };
  (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue(chain);
  return chain;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createSupabaseAdapter.load", () => {
  it("데이터 있으면 GardenState 반환", async () => {
    const chain = makeChain();
    chain.maybeSingle.mockResolvedValue({ data: { state: mockState }, error: null });

    const adapter = createSupabaseAdapter(USER_ID);
    const result = await adapter.load();

    expect(result).toEqual(mockState);
    expect(supabase.from).toHaveBeenCalledWith("garden_state");
    expect(chain.eq).toHaveBeenCalledWith("user_id", USER_ID);
  });

  it("데이터 없으면 null 반환", async () => {
    makeChain();
    const adapter = createSupabaseAdapter(USER_ID);
    const result = await adapter.load();
    expect(result).toBeNull();
  });

  it("빈 객체 state이면 null 반환", async () => {
    const chain = makeChain();
    chain.maybeSingle.mockResolvedValue({ data: { state: {} }, error: null });
    const adapter = createSupabaseAdapter(USER_ID);
    const result = await adapter.load();
    expect(result).toBeNull();
  });

  it("DB 에러이면 null 반환", async () => {
    const chain = makeChain();
    chain.maybeSingle.mockResolvedValue({ data: null, error: { message: "DB error" } });
    const adapter = createSupabaseAdapter(USER_ID);
    const result = await adapter.load();
    expect(result).toBeNull();
  });
});

describe("createSupabaseAdapter.save", () => {
  it("upsert 호출 성공", async () => {
    const chain = makeChain();
    const adapter = createSupabaseAdapter(USER_ID);
    await expect(adapter.save(mockState)).resolves.toBeUndefined();
    expect(chain.upsert).toHaveBeenCalledWith(
      { user_id: USER_ID, state: mockState },
      { onConflict: "user_id" },
    );
  });

  it("DB 에러이면 throw", async () => {
    const chain = makeChain();
    chain.upsert.mockResolvedValue({ error: { message: "write failed" } });
    const adapter = createSupabaseAdapter(USER_ID);
    await expect(adapter.save(mockState)).rejects.toThrow("write failed");
  });
});
