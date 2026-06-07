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
            onClick={() => { setSignupDone(false); setTab("login"); }}
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
