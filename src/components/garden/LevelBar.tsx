import { levelFromXp } from "@/lib/garden-store";
import { Sparkles, TrendingUp } from "lucide-react";

type Props = { totalXp: number; xp: number };

export function LevelBar({ totalXp, xp }: Props) {
  const { level, currentXp, nextXp } = levelFromXp(totalXp);
  const pct = Math.min(100, (currentXp / nextXp) * 100);
  const remaining = Math.max(0, nextXp - currentXp);

  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-card/60 p-6 shadow-bloom">
      <div className="absolute -top-12 -right-12 size-40 bg-primary/20 blur-3xl rounded-full pointer-events-none" />
      <div className="absolute -bottom-16 -left-10 size-40 bg-accent/20 blur-3xl rounded-full pointer-events-none" />

      <div className="relative flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="size-11 rounded-2xl bg-gradient-bloom flex items-center justify-center shadow-gold">
            <Sparkles className="size-5 text-primary" />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Garden Level</div>
            <div className="font-display text-3xl text-gradient-gold leading-none mt-0.5">Lv. {level}</div>
          </div>
        </div>
        <div className="text-right">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground justify-end">
            <TrendingUp className="size-3" /> 다음 레벨까지
          </div>
          <div className="font-display text-xl text-primary tabular-nums">{remaining} XP</div>
        </div>
      </div>

      <div className="relative">
        <div className="h-4 rounded-full bg-card border border-white/10 overflow-hidden p-0.5">
          <div
            className="relative h-full rounded-full bg-gradient-to-r from-accent via-bloom to-primary shadow-gold transition-all duration-700"
            style={{ width: `${pct}%` }}
          >
            <div className="absolute inset-0 rounded-full bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.4),transparent)] animate-shimmer" />
          </div>
        </div>
        <div className="flex justify-between mt-2 text-xs">
          <span className="text-primary font-bold tabular-nums">
            {currentXp} <span className="text-muted-foreground font-normal">/ {nextXp}</span>
          </span>
          <span className="text-muted-foreground">
            현재 별 <span className="text-primary font-semibold">{xp}</span>
          </span>
        </div>
      </div>
    </div>
  );
}
