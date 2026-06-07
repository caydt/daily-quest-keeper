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
