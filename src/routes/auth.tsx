import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "로그인 — 루미 가든" },
      { name: "description", content: "이메일 또는 Google로 루미 가든에 로그인하세요." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && user) navigate({ to: "/" });
  }, [user, loading, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null); setMsg(null); setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: `${window.location.origin}/` },
        });
        if (error) throw error;
        setMsg("가입 완료! 바로 로그인됩니다. (확인 메일이 비활성이라면 자동 진입돼요)");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (e: any) {
      setErr(e?.message ?? "오류가 발생했어요.");
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    setErr(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/` },
    });
    if (error) setErr(error.message);
  };

  return (
    <div className="min-h-dvh flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <h1 className="font-display text-3xl text-gradient-gold">루미 가든</h1>
          <p className="text-xs text-muted-foreground uppercase tracking-widest">
            기기 간 동기화를 위해 로그인하세요
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-card/60 p-6 space-y-4">
          <div className="flex rounded-xl bg-background/40 p-1 text-xs">
            <button
              type="button"
              onClick={() => setMode("signin")}
              className={`flex-1 py-2 rounded-lg transition ${mode === "signin" ? "bg-primary/20 text-primary" : "text-muted-foreground"}`}
            >로그인</button>
            <button
              type="button"
              onClick={() => setMode("signup")}
              className={`flex-1 py-2 rounded-lg transition ${mode === "signup" ? "bg-primary/20 text-primary" : "text-muted-foreground"}`}
            >회원가입</button>
          </div>

          <form onSubmit={submit} className="space-y-3">
            <div>
              <label className="text-[11px] uppercase tracking-wider text-muted-foreground">이메일</label>
              <input
                type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full px-3 py-2.5 rounded-xl bg-background/60 border border-white/10 focus:border-primary/40 outline-none text-sm"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-wider text-muted-foreground">비밀번호</label>
              <input
                type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full px-3 py-2.5 rounded-xl bg-background/60 border border-white/10 focus:border-primary/40 outline-none text-sm"
                placeholder="••••••••"
              />
            </div>
            {err && <p className="text-xs text-rose-400">{err}</p>}
            {msg && <p className="text-xs text-emerald-400">{msg}</p>}
            <button
              type="submit" disabled={busy}
              className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition disabled:opacity-50"
            >
              {busy ? "처리 중..." : mode === "signin" ? "로그인" : "가입하기"}
            </button>
          </form>

          <div className="flex items-center gap-2 text-[10px] text-muted-foreground uppercase tracking-widest">
            <div className="flex-1 h-px bg-white/10" /> 또는 <div className="flex-1 h-px bg-white/10" />
          </div>

          <button
            onClick={google}
            className="w-full py-2.5 rounded-xl border border-white/10 bg-background/40 hover:border-primary/40 text-sm transition flex items-center justify-center gap-2"
          >
            <span>🔑</span> Google로 계속하기
          </button>
        </div>

        <p className="text-center text-[11px] text-muted-foreground">
          <Link to="/" className="hover:text-primary">← 홈으로</Link>
        </p>
      </div>
    </div>
  );
}
