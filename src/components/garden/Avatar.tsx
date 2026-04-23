import { levelFromXp, stageFromLevel } from "@/lib/garden-store";

type Props = {
  totalXp: number;
  xp: number;
  combo: number;
  streak: number;
};

export function Avatar({ totalXp, xp, combo, streak }: Props) {
  const { level, currentXp, nextXp } = levelFromXp(totalXp);
  const stage = stageFromLevel(level);
  const pct = Math.min(100, (currentXp / nextXp) * 100);
  // 콤보 게이지 (0~10)
  const comboPct = Math.min(100, (combo / 10) * 100);

  return (
    <div className="relative overflow-hidden rounded-3xl border border-primary/30 bg-gradient-to-br from-card via-card to-violet-deep/40 p-5 shadow-bloom">
      {/* glow */}
      <div className="absolute -top-16 -right-16 size-48 bg-primary/30 blur-3xl rounded-full pointer-events-none" />
      <div className="absolute -bottom-20 -left-12 size-44 bg-accent/30 blur-3xl rounded-full pointer-events-none" />

      <div className="relative flex items-center gap-4">
        {/* Character */}
        <div className="relative">
          <div className="size-20 rounded-2xl bg-gradient-bloom border-2 border-primary/40 flex items-center justify-center shadow-gold animate-bloom">
            <span className="text-5xl drop-shadow-lg">{stage.icon}</span>
          </div>
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold tabular-nums shadow-gold">
            Lv.{level}
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-display text-xl text-gradient-gold leading-none">{stage.name}</span>
            <span className="text-[9px] uppercase tracking-widest text-muted-foreground border border-white/10 rounded-full px-1.5 py-0.5">
              T{stage.tier}
            </span>
          </div>

          {/* HP/XP style bars */}
          <div className="space-y-1.5">
            {/* XP bar */}
            <div>
              <div className="flex justify-between text-[10px] uppercase tracking-wider mb-0.5">
                <span className="text-primary/80 font-bold">XP</span>
                <span className="text-muted-foreground tabular-nums">
                  {currentXp}/{nextXp}
                </span>
              </div>
              <div className="h-2 rounded-full bg-black/40 border border-white/10 overflow-hidden p-px">
                <div
                  className="relative h-full rounded-full bg-gradient-to-r from-accent via-bloom to-primary shadow-gold transition-all duration-700"
                  style={{ width: `${pct}%` }}
                >
                  <div className="absolute inset-0 rounded-full bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.4),transparent)] animate-shimmer" />
                </div>
              </div>
            </div>

            {/* Combo bar */}
            <div>
              <div className="flex justify-between text-[10px] uppercase tracking-wider mb-0.5">
                <span className={`font-bold ${combo > 0 ? "text-bloom" : "text-muted-foreground"}`}>
                  COMBO ⚡
                </span>
                <span className={`tabular-nums font-bold ${combo >= 5 ? "text-bloom animate-pulse" : "text-muted-foreground"}`}>
                  x{combo}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-black/40 border border-white/10 overflow-hidden p-px">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-bloom to-destructive transition-all duration-300"
                  style={{ width: `${comboPct}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Streak badge */}
        <div className="hidden sm:flex flex-col items-center justify-center min-w-[64px] p-2 rounded-2xl bg-black/30 border border-accent/30">
          <span className="text-2xl">🔥</span>
          <span className="font-display text-2xl text-gradient-gold leading-none tabular-nums">
            {streak}
          </span>
          <span className="text-[9px] uppercase tracking-widest text-muted-foreground">streak</span>
        </div>
      </div>

      {combo >= 5 && (
        <div className="relative mt-3 text-center text-xs font-bold text-bloom animate-pulse">
          🔥 콤보 활성! XP 보너스 x{combo >= 10 ? "2" : "1.5"}
        </div>
      )}

      <div className="relative mt-3 flex items-center justify-between text-[10px] text-muted-foreground">
        <span>현재 별 ⭐ <span className="text-primary font-bold tabular-nums">{xp}</span></span>
        <span>다음 진화까지 <span className="text-primary font-bold tabular-nums">{Math.max(0, nextXp - currentXp)}</span> XP</span>
      </div>
    </div>
  );
}
