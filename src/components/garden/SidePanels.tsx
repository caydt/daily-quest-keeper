import type { Task } from "@/lib/garden-store";
import { Award, AlertTriangle, Sprout } from "lucide-react";

type Props = { tasks: Task[]; streak: number; totalXp: number };

export function SidePanels({ tasks, streak, totalXp }: Props) {
  const today = tasks;
  const completed = today.filter((t) => t.completed).length;
  const remaining = today.length - completed;
  const completionRate = today.length === 0 ? 0 : Math.round((completed / today.length) * 100);

  const rewards = [
    { id: "first", label: "첫 개화", desc: "첫 할일 완료", unlocked: totalXp > 0, color: "from-primary to-gold-soft" },
    { id: "week", label: "7일 연승", desc: "일주일 연속", unlocked: streak >= 7, color: "from-accent to-bloom" },
    { id: "master", label: "정원의 주인", desc: "총 1,000 XP", unlocked: totalXp >= 1000, color: "from-bloom to-primary" },
  ];

  return (
    <aside className="space-y-5">
      {/* Streak hero */}
      <div className="relative overflow-hidden p-7 rounded-3xl border border-white/10 bg-gradient-bloom shadow-bloom">
        <div className="relative z-10">
          <h3 className="text-xs font-bold uppercase tracking-widest text-foreground/70 mb-3">
            연속 개화
          </h3>
          <div className="flex items-baseline gap-2">
            <span className="font-display text-7xl text-gradient-gold tabular-nums leading-none">
              {streak}
            </span>
            <span className="text-lg text-foreground/80">일째</span>
          </div>
          <p className="mt-3 text-sm text-foreground/70 max-w-[22ch]">
            {streak > 0
              ? "정원이 활발하게 번성하고 있어요."
              : "첫 할일을 완료해 연승을 시작하세요."}
          </p>
        </div>
        <div className="absolute -right-8 -bottom-8 size-40 bg-primary/30 blur-3xl rounded-full" />
      </div>

      {/* Today summary */}
      <div className="p-6 rounded-2xl border border-white/10 bg-card">
        <div className="flex items-center gap-2 mb-4">
          <Sprout className="size-4 text-primary" />
          <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
            오늘의 성장
          </h3>
        </div>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <div className="font-display text-3xl text-gradient-gold tabular-nums">{completed}</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">완료</div>
          </div>
          <div>
            <div className="font-display text-3xl text-accent tabular-nums">{remaining}</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">남음</div>
          </div>
          <div>
            <div className="font-display text-3xl text-bloom tabular-nums">{completionRate}%</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">달성률</div>
          </div>
        </div>
      </div>

      {/* Penalty warning */}
      {remaining > 0 && (
        <div className="p-5 rounded-2xl border border-destructive/30 bg-destructive/10 flex gap-3">
          <div className="size-9 shrink-0 rounded-xl bg-destructive/20 flex items-center justify-center border border-destructive/30">
            <AlertTriangle className="size-4 text-destructive" />
          </div>
          <div>
            <h4 className="font-semibold text-sm text-destructive">시듦 주의</h4>
            <p className="text-xs text-destructive/80 mt-1 leading-relaxed">
              자정까지 미완료 시 난이도별로 XP가 차감되고 연승이 초기화됩니다.
            </p>
          </div>
        </div>
      )}

      {/* Rewards */}
      <div>
        <div className="flex items-center gap-2 mb-3 px-1">
          <Award className="size-4 text-primary" />
          <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
            보상
          </h3>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {rewards.map((r) => (
            <div
              key={r.id}
              className={`p-3 rounded-2xl border text-center transition-all ${
                r.unlocked
                  ? "border-primary/40 bg-card shadow-gold"
                  : "border-white/5 bg-card/40 opacity-50 grayscale"
              }`}
            >
              <div
                className={`size-10 mx-auto rounded-full bg-gradient-to-br ${r.color} flex items-center justify-center mb-2`}
              >
                <Award className="size-5 text-foreground" />
              </div>
              <div className="text-[11px] font-semibold leading-tight">{r.label}</div>
              <div className="text-[9px] text-muted-foreground mt-0.5">{r.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}
