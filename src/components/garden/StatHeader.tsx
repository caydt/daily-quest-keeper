import { levelFromXp } from "@/lib/garden-store";
import { Bell, BellOff, Flame, Sparkles } from "lucide-react";

type Props = {
  xp: number;
  totalXp: number;
  streak: number;
  notificationsEnabled: boolean;
  onToggleNotifications: () => void;
};

export function StatHeader({
  xp,
  totalXp,
  streak,
  notificationsEnabled,
  onToggleNotifications,
}: Props) {
  const { level, currentXp, nextXp } = levelFromXp(totalXp);
  const pct = Math.min(100, (currentXp / nextXp) * 100);

  return (
    <header className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between border-b border-white/5 pb-6">
      <div className="flex items-center gap-4">
        <div className="size-14 rounded-2xl bg-gradient-bloom shadow-bloom flex items-center justify-center animate-bloom">
          <Sparkles className="size-6 text-primary" />
        </div>
        <div>
          <h1 className="font-display text-3xl text-gradient-gold leading-none">루미 가든</h1>
          <p className="text-sm text-muted-foreground mt-1">
            밤의 정원사 · 빛나는 별 <span className="text-primary font-semibold">{xp}</span>
          </p>
        </div>
      </div>

      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2 text-sm">
          <Flame className="size-4 text-accent" />
          <span className="font-display text-2xl text-gradient-gold tabular-nums">{streak}</span>
          <span className="text-muted-foreground">일 연속</span>
        </div>

        <div className="w-56">
          <div className="flex justify-between mb-1.5 text-xs">
            <span className="uppercase tracking-widest text-muted-foreground">
              Level <span className="text-primary font-bold">{level}</span>
            </span>
            <span className="text-primary/80 tabular-nums font-medium">
              {currentXp} / {nextXp}
            </span>
          </div>
          <div className="h-2.5 bg-card rounded-full p-0.5 border border-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-accent via-bloom to-primary shadow-gold transition-all duration-700"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        <button
          onClick={onToggleNotifications}
          className="size-11 rounded-xl bg-card border border-white/10 hover:border-primary/40 transition-colors flex items-center justify-center"
          aria-label="알림 토글"
        >
          {notificationsEnabled ? (
            <Bell className="size-4 text-primary" />
          ) : (
            <BellOff className="size-4 text-muted-foreground" />
          )}
        </button>
      </div>
    </header>
  );
}
