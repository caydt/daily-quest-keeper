# 루미가든 Supabase 인증 + 기기 간 동기화 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Google Apps Script를 완전히 제거하고 Supabase 이메일 인증 + `garden_state` 테이블 기반 기기 간 동기화를 구현한다.

**Architecture:** 기존 `StorageAdapter` 인터페이스를 그대로 유지하고 `createSupabaseAdapter(userId)` 추가. `useGarden()` 훅이 Supabase 세션을 조회해 로그인 여부에 따라 어댑터를 선택. 비로그인 시 localStorage 전용.

**Tech Stack:** `@supabase/supabase-js` (신규 설치), Vitest + Testing Library (기존), React 19, TanStack Router

---

## 파일 맵

| 파일 | 작업 |
|------|------|
| `src/lib/supabase-client.ts` | 신규 — Supabase 클라이언트 싱글턴 |
| `src/lib/supabase-adapter.ts` | 신규 — StorageAdapter 구현 |
| `src/lib/supabase-adapter.test.ts` | 신규 — 어댑터 단위 테스트 |
| `src/hooks/use-auth.ts` | 신규 — auth 상태 훅 |
| `src/hooks/use-auth.test.ts` | 신규 — auth 훅 테스트 |
| `src/routes/auth.tsx` | 신규 — 로그인/회원가입 페이지 |
| `src/lib/garden-store.ts` | 수정 — Sheets 제거, Supabase 어댑터 적용 |
| `src/routes/settings.tsx` | 수정 — Apps Script 섹션 제거, 계정 섹션 추가 |
| `src/main.tsx` | 수정 — Apps Script URL 파라미터 처리 제거 |
| `src/lib/sheets-adapter.ts` | 삭제 |
| `src/lib/setup-link.ts` | 삭제 |
| `src/lib/setup-link.test.ts` | 삭제 |

---

## Task 1: @supabase/supabase-js 설치

**Files:**
- Modify: `package.json`

- [ ] **Step 1: 패키지 설치**

```bash
cd /Users/ayoungjo/daily-quest-keeper && bun add @supabase/supabase-js
```

Expected: `@supabase/supabase-js` 버전이 `package.json` dependencies에 추가됨

- [ ] **Step 2: 설치 확인**

```bash
grep '"@supabase/supabase-js"' package.json
```

Expected: `"@supabase/supabase-js": "^X.X.X"` 출력

- [ ] **Step 3: 커밋**

```bash
git add package.json bun.lockb
git commit -m "chore: @supabase/supabase-js 설치"
```

---

## Task 2: Supabase 클라이언트 싱글턴 생성

**Files:**
- Create: `src/lib/supabase-client.ts`

- [ ] **Step 1: 파일 생성**

`src/lib/supabase-client.ts`:

```typescript
import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

export const supabase = createClient(url, key);
```

`.env`에 이미 `VITE_SUPABASE_URL`과 `VITE_SUPABASE_PUBLISHABLE_KEY`가 있으므로 추가 설정 불필요.

- [ ] **Step 2: TypeScript 컴파일 확인**

```bash
cd /Users/ayoungjo/daily-quest-keeper && bun run build 2>&1 | head -30
```

Expected: 타입 에러 없이 빌드 성공 (또는 기존 에러만)

- [ ] **Step 3: 커밋**

```bash
git add src/lib/supabase-client.ts
git commit -m "feat: Supabase 클라이언트 싱글턴 추가"
```

---

## Task 3: SupabaseAdapter 구현 + 테스트

**Files:**
- Create: `src/lib/supabase-adapter.ts`
- Create: `src/lib/supabase-adapter.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/lib/supabase-adapter.test.ts`:

```typescript
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
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
cd /Users/ayoungjo/daily-quest-keeper && bun run test src/lib/supabase-adapter.test.ts 2>&1 | head -20
```

Expected: `Cannot find module '@/lib/supabase-adapter'` 에러

- [ ] **Step 3: SupabaseAdapter 구현**

`src/lib/supabase-adapter.ts`:

```typescript
import { supabase } from "@/lib/supabase-client";
import type { StorageAdapter } from "@/lib/storage";
import type { GardenState } from "@/lib/garden-store";

export function createSupabaseAdapter(userId: string): StorageAdapter {
  return {
    async load() {
      const { data, error } = await supabase
        .from("garden_state")
        .select("state")
        .eq("user_id", userId)
        .maybeSingle();
      if (error || !data) return null;
      const state = data.state as GardenState;
      if (!state || Object.keys(state).length === 0) return null;
      return state;
    },
    async save(state: GardenState) {
      const { error } = await supabase
        .from("garden_state")
        .upsert({ user_id: userId, state }, { onConflict: "user_id" });
      if (error) throw new Error(`Supabase 저장 실패: ${error.message}`);
    },
  };
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
cd /Users/ayoungjo/daily-quest-keeper && bun run test src/lib/supabase-adapter.test.ts 2>&1
```

Expected: `7 tests passed`

- [ ] **Step 5: 커밋**

```bash
git add src/lib/supabase-adapter.ts src/lib/supabase-adapter.test.ts
git commit -m "feat(storage): SupabaseAdapter 구현 — garden_state upsert/select"
```

---

## Task 4: useAuth 훅 구현 + 테스트

**Files:**
- Create: `src/hooks/use-auth.ts`
- Create: `src/hooks/use-auth.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/hooks/use-auth.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

vi.mock("@/lib/supabase-client", () => {
  const mockUnsubscribe = vi.fn();
  const mockSubscription = { unsubscribe: mockUnsubscribe };
  const mockOnAuthStateChange = vi.fn(() => ({
    data: { subscription: mockSubscription },
  }));
  const mockGetSession = vi.fn().mockResolvedValue({
    data: { session: null },
  });
  const mockSignInWithPassword = vi.fn();
  const mockSignUp = vi.fn();
  const mockSignOut = vi.fn();

  return {
    supabase: {
      auth: {
        getSession: mockGetSession,
        onAuthStateChange: mockOnAuthStateChange,
        signInWithPassword: mockSignInWithPassword,
        signUp: mockSignUp,
        signOut: mockSignOut,
      },
    },
  };
});

import { supabase } from "@/lib/supabase-client";
import { useAuth } from "@/hooks/use-auth";

const mockUser = { id: "user-1", email: "test@example.com" };

beforeEach(() => {
  vi.clearAllMocks();
  (supabase.auth.getSession as ReturnType<typeof vi.fn>).mockResolvedValue({
    data: { session: null },
  });
  (supabase.auth.onAuthStateChange as ReturnType<typeof vi.fn>).mockReturnValue({
    data: { subscription: { unsubscribe: vi.fn() } },
  });
});

describe("useAuth", () => {
  it("초기 상태: user=null, loading=true → false", async () => {
    const { result } = renderHook(() => useAuth());
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.user).toBeNull();
  });

  it("세션 있으면 user 설정", async () => {
    (supabase.auth.getSession as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { session: { user: mockUser } },
    });
    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.user).toEqual(mockUser));
  });

  it("login 성공 시 signInWithPassword 호출", async () => {
    (supabase.auth.signInWithPassword as ReturnType<typeof vi.fn>).mockResolvedValue({ error: null });
    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.login("a@b.com", "pw123");
    });
    expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({ email: "a@b.com", password: "pw123" });
  });

  it("login 실패 시 throw", async () => {
    (supabase.auth.signInWithPassword as ReturnType<typeof vi.fn>).mockResolvedValue({
      error: { message: "Invalid credentials" },
    });
    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await expect(
      act(async () => { await result.current.login("a@b.com", "wrong"); })
    ).rejects.toBeTruthy();
  });

  it("logout 성공 시 signOut 호출", async () => {
    (supabase.auth.signOut as ReturnType<typeof vi.fn>).mockResolvedValue({ error: null });
    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.logout(); });
    expect(supabase.auth.signOut).toHaveBeenCalled();
  });

  it("언마운트 시 구독 해제", async () => {
    const unsubscribe = vi.fn();
    (supabase.auth.onAuthStateChange as ReturnType<typeof vi.fn>).mockReturnValue({
      data: { subscription: { unsubscribe } },
    });
    const { unmount } = renderHook(() => useAuth());
    await waitFor(() => {});
    unmount();
    expect(unsubscribe).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
cd /Users/ayoungjo/daily-quest-keeper && bun run test src/hooks/use-auth.test.ts 2>&1 | head -20
```

Expected: `Cannot find module '@/hooks/use-auth'` 에러

- [ ] **Step 3: useAuth 구현**

`src/hooks/use-auth.ts`:

```typescript
import { useState, useEffect } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase-client";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setLoading(false);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  const login = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signup = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
  };

  const logout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  return { user, loading, login, signup, logout };
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
cd /Users/ayoungjo/daily-quest-keeper && bun run test src/hooks/use-auth.test.ts 2>&1
```

Expected: `6 tests passed`

- [ ] **Step 5: 커밋**

```bash
git add src/hooks/use-auth.ts src/hooks/use-auth.test.ts
git commit -m "feat(auth): useAuth 훅 — 로그인/회원가입/로그아웃"
```

---

## Task 5: /auth 로그인·회원가입 페이지

**Files:**
- Create: `src/routes/auth.tsx`

- [ ] **Step 1: auth.tsx 생성**

`src/routes/auth.tsx`:

```tsx
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "로그인 — 루미 가든" },
      { name: "description", content: "루미 가든에 로그인하세요." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { login, signup } = useAuth();
  const [tab, setTab] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [signupDone, setSignupDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (tab === "signup" && password !== passwordConfirm) {
      setError("비밀번호가 일치하지 않아요.");
      return;
    }
    setLoading(true);
    try {
      if (tab === "login") {
        await login(email, password);
        void navigate({ to: "/" });
      } else {
        await signup(email, password);
        setSignupDone(true);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "오류가 발생했어요.");
    } finally {
      setLoading(false);
    }
  };

  if (signupDone) {
    return (
      <div className="min-h-dvh flex items-center justify-center p-6">
        <div className="w-full max-w-sm bg-card/60 border border-white/10 rounded-3xl p-8 text-center space-y-4">
          <div className="text-4xl">📧</div>
          <h1 className="font-bold text-lg">가입 완료!</h1>
          <p className="text-sm text-muted-foreground">
            {email}으로 인증 메일을 보냈어요. 메일을 확인하고 인증을 완료한 뒤 로그인하세요.
          </p>
          <button
            onClick={() => setTab("login")}
            className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition"
          >
            로그인 화면으로
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh flex items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-1">
          <div className="text-4xl">🌱</div>
          <h1 className="text-xl font-bold">루미 가든</h1>
          <p className="text-sm text-muted-foreground">로그인하면 모든 기기에서 데이터가 동기화돼요.</p>
        </div>

        {/* 탭 */}
        <div className="flex bg-card/40 border border-white/10 rounded-2xl p-1 gap-1">
          <button
            onClick={() => { setTab("login"); setError(""); }}
            className={`flex-1 py-2 rounded-xl text-sm font-semibold transition ${tab === "login" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            로그인
          </button>
          <button
            onClick={() => { setTab("signup"); setError(""); }}
            className={`flex-1 py-2 rounded-xl text-sm font-semibold transition ${tab === "signup" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            회원가입
          </button>
        </div>

        {/* 폼 */}
        <form onSubmit={(e) => void handleSubmit(e)} className="bg-card/60 border border-white/10 rounded-3xl p-6 space-y-4">
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">이메일</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="w-full px-3 py-2.5 rounded-xl bg-input/40 border border-white/10 text-sm focus:border-primary/40 focus:outline-none"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">비밀번호</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3 py-2.5 rounded-xl bg-input/40 border border-white/10 text-sm focus:border-primary/40 focus:outline-none"
            />
          </div>
          {tab === "signup" && (
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">비밀번호 확인</label>
              <input
                type="password"
                required
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3 py-2.5 rounded-xl bg-input/40 border border-white/10 text-sm focus:border-primary/40 focus:outline-none"
              />
            </div>
          )}
          {error && <p className="text-xs text-rose-400">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="size-4 animate-spin" />}
            {tab === "login" ? "로그인" : "가입하기"}
          </button>
        </form>

        <div className="text-center">
          <button
            onClick={() => void navigate({ to: "/" })}
            className="text-xs text-muted-foreground hover:text-foreground transition"
          >
            건너뛰기 (로컬 모드)
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: TypeScript 확인**

```bash
cd /Users/ayoungjo/daily-quest-keeper && bun run build 2>&1 | grep -i error | head -10
```

Expected: 타입 에러 없음

- [ ] **Step 3: 커밋**

```bash
git add src/routes/auth.tsx
git commit -m "feat(routes): /auth 로그인·회원가입 페이지"
```

---

## Task 6: garden-store.ts — Sheets 제거, Supabase 연동

**Files:**
- Modify: `src/lib/garden-store.ts:1-10` (imports)
- Modify: `src/lib/garden-store.ts:326-460` (useGarden 훅 내 hydrate/save/focus 이펙트)

이 태스크는 garden-store.ts 내 3개 useEffect와 saveNow를 교체한다.

- [ ] **Step 1: garden-store.ts imports 교체**

파일 상단 (1~5줄) 에서:
```typescript
import { createLocalAdapter } from "@/lib/storage";
import { getScriptUrl, createSheetsAdapter } from "@/lib/sheets-adapter";
```
를 아래로 교체:
```typescript
import { createLocalAdapter } from "@/lib/storage";
import { supabase } from "@/lib/supabase-client";
import { createSupabaseAdapter } from "@/lib/supabase-adapter";
```

- [ ] **Step 2: pendingMigration 상태 추가**

`useGarden()` 함수 안, `const [saveStatus, ...]` 선언 바로 아래에 추가:

```typescript
const [pendingMigration, setPendingMigration] = useState<{
  local: GardenState;
  remote: GardenState;
} | null>(null);
const migrationDone = useRef(false);
```

- [ ] **Step 3: hydrate useEffect 교체**

기존 `// 로드: 로컬 먼저 즉시 렌더...` 주석이 달린 첫 번째 `useEffect(() => { ... }, [])` 전체를 아래로 교체:

```typescript
// hydrate: 로컬 즉시 렌더 → Supabase 로그인 시 원격 동기화
useEffect(() => {
  let cancelled = false;

  const mergeState = (data: Partial<GardenState>): GardenState => ({
    ...initial,
    ...data,
    settings: { ...initial.settings, ...(data.settings || {}) },
    history: (data as GardenState).history || [],
    projects: (data as GardenState).projects || [],
    farms: (data as GardenState).farms || [],
    achievements: (data as GardenState).achievements || {},
    localTools: (data as GardenState).localTools || [],
    pledges: (data as GardenState).pledges || [],
  });

  const applyState = (next: GardenState) => {
    isApplyingRemote.current = true;
    setState(next);
    requestAnimationFrame(() => {
      isApplyingRemote.current = false;
    });
  };

  const run = async () => {
    // ① 로컬 즉시 렌더
    const local = await createLocalAdapter().load();
    if (cancelled) return;
    if (local) {
      const mergedSettings = { ...initial.settings, ...(local.settings || {}) };
      migrateLegacyCondition(local, mergedSettings.morningTime);
    }
    applyState(local ? mergeState(local) : initial);
    setHydrated(true);

    // ② auth 확인
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      if (!cancelled) setSyncReady(true);
      return;
    }

    // ③ Supabase 원격 로드
    try {
      const adapter = createSupabaseAdapter(session.user.id);
      const remote = await adapter.load();
      if (cancelled) return;

      if (!remote) {
        // Supabase에 데이터 없음 → 로컬 데이터 자동 업로드
        if (local) await adapter.save(local).catch(() => {});
        if (!cancelled) setSyncReady(true);
        return;
      }

      const mergedSettings = { ...initial.settings, ...(remote.settings || {}) };
      migrateLegacyCondition(remote, mergedSettings.morningTime);

      // ④ 로컬 + 원격 둘 다 있으면 마이그레이션 선택 대기
      if (local && !migrationDone.current) {
        if (!cancelled) setPendingMigration({ local, remote });
        // syncReady는 resolveMigration 호출 시 설정됨
        return;
      }

      // ⑤ 원격 데이터 적용
      if (!userTouched.current) {
        applyState(mergeState(remote));
      }
      if (!cancelled) setSyncReady(true);
    } catch {
      // Supabase 실패 → 로컬 유지
      if (!cancelled) setSyncReady(true);
    }
  };

  run();
  return () => {
    cancelled = true;
  };
// eslint-disable-next-line react-hooks/exhaustive-deps
}, []);
```

- [ ] **Step 4: resolveMigration 콜백 추가**

`useGarden()` 안, `saveNow` 콜백 바로 위에 추가:

```typescript
const resolveMigration = useCallback(
  async (choice: "local" | "remote") => {
    if (!pendingMigration) return;
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return;

    const adapter = createSupabaseAdapter(session.user.id);
    const chosen =
      choice === "local" ? pendingMigration.local : pendingMigration.remote;

    const mergeState = (data: Partial<GardenState>): GardenState => ({
      ...initial,
      ...data,
      settings: { ...initial.settings, ...(data.settings || {}) },
      history: (data as GardenState).history || [],
      projects: (data as GardenState).projects || [],
      farms: (data as GardenState).farms || [],
      achievements: (data as GardenState).achievements || {},
      localTools: (data as GardenState).localTools || [],
      pledges: (data as GardenState).pledges || [],
    });

    if (choice === "local") {
      await adapter.save(pendingMigration.local).catch(() => {});
    }

    isApplyingRemote.current = true;
    setState(mergeState(chosen));
    requestAnimationFrame(() => {
      isApplyingRemote.current = false;
    });
    migrationDone.current = true;
    setPendingMigration(null);
    setSyncReady(true);
  },
  [pendingMigration],
);
```

- [ ] **Step 5: save useEffect 교체**

기존 `// 저장: StorageAdapter 기반 debounce 저장...` 주석 이펙트를 아래로 교체:

```typescript
// 저장: 로그인 시 Supabase, 비로그인 시 localStorage
useEffect(() => {
  if (!hydrated) return;
  if (!syncReady) return;
  if (isApplyingRemote.current) return;

  if (saveTimer.current) clearTimeout(saveTimer.current);
  saveTimer.current = setTimeout(() => {
    const previous = inFlightSave.current;
    inFlightSave.current = (async () => {
      await previous.catch(() => {});
      setSaveStatus("saving");
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const adapter = session
          ? createSupabaseAdapter(session.user.id)
          : createLocalAdapter();
        await adapter.save(state);
        if (session) await createLocalAdapter().save(state).catch(() => {});
        setSaveStatus("saved");
        if (savedResetTimer.current) clearTimeout(savedResetTimer.current);
        savedResetTimer.current = setTimeout(() => setSaveStatus("idle"), 2000);
      } catch {
        await createLocalAdapter().save(state);
        setSaveStatus("error");
        if (savedResetTimer.current) clearTimeout(savedResetTimer.current);
        savedResetTimer.current = setTimeout(() => setSaveStatus("idle"), 3000);
      }
    })();
  }, 600);

  return () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
  };
}, [state, hydrated, syncReady]);
```

- [ ] **Step 6: focus useEffect 교체**

기존 `// 윈도우 포커스 시 원격 데이터 리패치` 이펙트를 아래로 교체:

```typescript
// 포커스 시 Supabase 원격 리패치
useEffect(() => {
  const onFocus = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return;
    try {
      const remote = await createSupabaseAdapter(session.user.id).load();
      if (!remote) return;
      if (userTouched.current) return;
      isApplyingRemote.current = true;
      setState((prev) => {
        const mergedSettings = {
          ...initial.settings,
          ...(remote.settings || prev.settings),
        };
        migrateLegacyCondition(remote, mergedSettings.morningTime);
        return {
          ...initial,
          ...remote,
          settings: mergedSettings,
          history: remote.history || [],
          projects: remote.projects || [],
          farms: remote.farms || [],
          achievements: remote.achievements || {},
          localTools: remote.localTools || [],
          pledges: remote.pledges || [],
        };
      });
      requestAnimationFrame(() => {
        isApplyingRemote.current = false;
      });
    } catch {
      /* 포커스 리패치 실패 무시 */
    }
  };

  window.addEventListener("focus", onFocus);
  return () => window.removeEventListener("focus", onFocus);
}, []);
```

- [ ] **Step 7: saveNow 내 scriptUrl 교체**

`saveNow` 콜백 안의:
```typescript
const scriptUrl = getScriptUrl();
const adapter = scriptUrl ? createSheetsAdapter(scriptUrl) : createLocalAdapter();
```
를 아래로 교체:
```typescript
const {
  data: { session },
} = await supabase.auth.getSession();
const adapter = session
  ? createSupabaseAdapter(session.user.id)
  : createLocalAdapter();
```

그리고 saveNow 안의 `await createLocalAdapter().save(state)` (catch 블록) 아래에:
```typescript
if (session) await createLocalAdapter().save(state).catch(() => {});
```
는 이미 save 성공 경로에만 필요하지 않으므로, catch 블록의 로컬 저장은 그대로 유지.

- [ ] **Step 8: useGarden return 객체에 pendingMigration, resolveMigration 추가**

`return { state, hydrated, ... }` 객체에:
```typescript
pendingMigration,
resolveMigration,
```
추가.

- [ ] **Step 9: 기존 테스트 통과 확인**

```bash
cd /Users/ayoungjo/daily-quest-keeper && bun run test src/lib/garden-store.test.ts 2>&1 | tail -10
```

Expected: 기존 테스트 모두 통과 (fetch mock이 Sheets 대신 Supabase 경로로 가지 않으므로 구조 변경 필요 없음)

> 주의: 기존 테스트에서 `localStorage.getItem(SCRIPT_URL_KEY)` 시드 코드가 있으면 제거해도 무방.

- [ ] **Step 10: 커밋**

```bash
git add src/lib/garden-store.ts
git commit -m "feat(store): Sheets 제거 — Supabase 어댑터 + 마이그레이션 로직 연동"
```

---

## Task 7: 마이그레이션 다이얼로그 (index.tsx)

**Files:**
- Modify: `src/routes/index.tsx`

- [ ] **Step 1: pendingMigration 다이얼로그 추가**

`src/routes/index.tsx`에서 `useGarden()` 비구조화에 `pendingMigration`, `resolveMigration` 추가:

```typescript
const {
  state, hydrated, saveStatus, /* 기존 필드들... */
  pendingMigration,
  resolveMigration,
} = useGarden();
```

JSX 최상단 (`return (` 직후, 기존 UI 앞) 에 추가:

```tsx
{pendingMigration && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6">
    <div className="w-full max-w-sm bg-card border border-white/15 rounded-3xl p-6 space-y-4">
      <h2 className="font-bold text-base">데이터 선택</h2>
      <p className="text-sm text-muted-foreground">
        이 기기의 로컬 데이터와 클라우드 데이터 중 어느 것을 사용할까요?
      </p>
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => void resolveMigration("local")}
          className="py-3 px-4 rounded-2xl bg-primary/15 border border-primary/40 text-primary text-sm font-semibold hover:bg-primary/25 transition text-left space-y-1"
        >
          <div>📱 이 기기</div>
          <div className="text-xs text-muted-foreground font-normal">
            할일 {pendingMigration.local.tasks?.length ?? 0}개
          </div>
        </button>
        <button
          onClick={() => void resolveMigration("remote")}
          className="py-3 px-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm font-semibold hover:bg-emerald-500/20 transition text-left space-y-1"
        >
          <div>☁️ 클라우드</div>
          <div className="text-xs text-muted-foreground font-normal">
            할일 {pendingMigration.remote.tasks?.length ?? 0}개
          </div>
        </button>
      </div>
    </div>
  </div>
)}
```

- [ ] **Step 2: 빌드 확인**

```bash
cd /Users/ayoungjo/daily-quest-keeper && bun run build 2>&1 | grep -i error | head -10
```

Expected: 에러 없음

- [ ] **Step 3: 커밋**

```bash
git add src/routes/index.tsx
git commit -m "feat(ui): 로그인 시 로컬↔클라우드 데이터 선택 다이얼로그"
```

---

## Task 8: settings.tsx 업데이트

**Files:**
- Modify: `src/routes/settings.tsx`

- [ ] **Step 1: import 교체**

상단 import에서 제거:
```typescript
import QRCode from "react-qr-code";
import { getScriptUrl, setScriptUrl, testScriptUrl } from "@/lib/sheets-adapter";
import { buildSetupLink, isValidScriptUrl } from "@/lib/setup-link";
```

추가:
```typescript
import { useAuth } from "@/hooks/use-auth";
import { useNavigate } from "@tanstack/react-router";
```

lucide-react에서 제거: `Link2`, `Smartphone`, `Copy`, `ExternalLink`
lucide-react에서 추가: `LogIn`, `LogOut`, `User`

- [ ] **Step 2: state 정리**

`SettingsPage` 함수 안에서 아래 state 선언 제거:
```typescript
const [scriptUrl, setScriptUrlState] = useState(() => getScriptUrl());
const [testState, setTestState] = useState<"idle" | "loading" | "ok" | "error">("idle");
const [testError, setTestError] = useState("");
const [linkCopied, setLinkCopied] = useState(false);
const setupLink = useMemo(...);  // buildSetupLink 관련
```

추가:
```typescript
const navigate = useNavigate();
const { user, logout } = useAuth();
```

함수 제거:
- `handleSaveScriptUrl`
- `handleTestUrl`
- `handleCopySetupLink`

- [ ] **Step 3: Apps Script 섹션 교체**

JSX에서 `{/* Apps Script 동기화 */}` 섹션 전체 (`<section>...</section>` 포함)를 아래로 교체:

```tsx
{/* 계정 */}
<section className="bg-card/60 border border-white/10 rounded-3xl p-6 space-y-4">
  <div className="flex items-start gap-3">
    <div className="size-10 rounded-xl bg-gradient-bloom flex items-center justify-center shrink-0">
      <User className="size-5 text-primary" />
    </div>
    <div className="flex-1">
      <h2 className="font-semibold">계정 및 동기화</h2>
      <p className="text-xs text-muted-foreground mt-1">
        {user
          ? "로그인 중 — 모든 기기에서 자동 동기화돼요."
          : "로그인하면 기기 간 데이터가 자동으로 동기화돼요."}
      </p>
    </div>
  </div>

  {user ? (
    <div className="space-y-3">
      <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-input/40 border border-white/10">
        <LogIn className="size-3.5 text-muted-foreground shrink-0" />
        <span className="text-sm text-muted-foreground truncate">{user.email}</span>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={() => void saveNow()}
          disabled={saveStatus === "saving"}
          className="px-4 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 text-sm font-semibold hover:bg-emerald-500/25 transition disabled:opacity-50 flex items-center gap-2"
        >
          {saveStatus === "saving" ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Save className="size-3.5" />
          )}
          {saveStatus === "saving" ? "저장 중..." : "지금 저장"}
        </button>
        {saveStatus === "saved" && (
          <span className="text-xs text-emerald-400 flex items-center gap-1">
            <CheckCircle2 className="size-3.5" /> 저장됨
          </span>
        )}
        {saveStatus === "error" && (
          <span className="text-xs text-rose-400 flex items-center gap-1">
            <XCircle className="size-3.5" /> 저장 실패 (로컬 백업됨)
          </span>
        )}
      </div>
      <button
        onClick={() => { void logout().then(() => void navigate({ to: "/" })); }}
        className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 bg-card/60 hover:border-rose-500/40 text-sm text-muted-foreground hover:text-rose-400 transition"
      >
        <LogOut className="size-3.5" />
        로그아웃
      </button>
    </div>
  ) : (
    <button
      onClick={() => void navigate({ to: "/auth" })}
      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/15 border border-primary/40 text-primary text-sm font-semibold hover:bg-primary/25 transition"
    >
      <LogIn className="size-3.5" />
      로그인 / 회원가입
    </button>
  )}
</section>
```

- [ ] **Step 4: TypeScript + 빌드 확인**

```bash
cd /Users/ayoungjo/daily-quest-keeper && bun run build 2>&1 | grep -i error | head -20
```

Expected: 에러 없음

- [ ] **Step 5: 커밋**

```bash
git add src/routes/settings.tsx
git commit -m "feat(settings): Apps Script 섹션 제거 → 계정/동기화 섹션으로 교체"
```

---

## Task 9: 구버전 코드 정리

**Files:**
- Delete: `src/lib/sheets-adapter.ts`
- Delete: `src/lib/setup-link.ts`
- Delete: `src/lib/setup-link.test.ts`
- Modify: `src/main.tsx`

- [ ] **Step 1: sheets-adapter.ts 삭제 전 미사용 확인**

```bash
grep -r "sheets-adapter\|SCRIPT_URL_KEY\|getScriptUrl\|setScriptUrl\|createSheetsAdapter" /Users/ayoungjo/daily-quest-keeper/src --include="*.ts" --include="*.tsx" | grep -v "\.test\."
```

Expected: 결과 없음 (이미 garden-store에서 제거됨)

- [ ] **Step 2: setup-link.ts 미사용 확인**

```bash
grep -r "setup-link\|buildSetupLink\|isValidScriptUrl\|readSetupParam\|stripSetupParam" /Users/ayoungjo/daily-quest-keeper/src --include="*.ts" --include="*.tsx"
```

Expected: `main.tsx`에만 남아있음

- [ ] **Step 3: main.tsx에서 setup 파라미터 처리 제거**

`src/main.tsx`를 아래로 교체:

```typescript
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { getRouter } from "./router";
import "./styles.css";

const router = getRouter();

const rootElement = document.getElementById("root")!;
createRoot(rootElement).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
);
```

- [ ] **Step 4: 파일 삭제**

```bash
rm /Users/ayoungjo/daily-quest-keeper/src/lib/sheets-adapter.ts
rm /Users/ayoungjo/daily-quest-keeper/src/lib/setup-link.ts
rm /Users/ayoungjo/daily-quest-keeper/src/lib/setup-link.test.ts
```

- [ ] **Step 5: 빌드 + 전체 테스트**

```bash
cd /Users/ayoungjo/daily-quest-keeper && bun run build 2>&1 | grep -i error | head -20 && bun run test 2>&1 | tail -15
```

Expected: 빌드 성공, 테스트 전체 통과

- [ ] **Step 6: 커밋**

```bash
git add -A
git commit -m "chore: sheets-adapter, setup-link 제거 — Apps Script 의존성 완전 삭제"
```

---

## 완료 확인 체크리스트

- [ ] `bun run test` — 전체 테스트 통과
- [ ] `bun run build` — 빌드 성공
- [ ] `/auth` 페이지 접속 → 로그인/회원가입/건너뛰기 UI 표시
- [ ] 비로그인 → localStorage 저장, `/settings`에 "로그인" 버튼 표시
- [ ] 로그인 → Supabase 저장, `/settings`에 계정 이메일 + 로그아웃 버튼
- [ ] 로그인 시 마이그레이션 다이얼로그 표시 (로컬/클라우드 선택)
