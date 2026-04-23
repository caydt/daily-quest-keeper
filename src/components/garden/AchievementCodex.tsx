import { ACHIEVEMENTS } from "@/lib/garden-store";
import { BookOpen } from "lucide-react";

type Props = {
  unlocked: Record<string, number>;
};

export function AchievementCodex({ unlocked }: Props) {
  const total = ACHIEVEMENTS.length;
  const got = ACHIEVEMENTS.filter((a) => unlocked[a.id]).length;

  return (
    <div className="rounded-3xl border border-white/10 bg-card/60 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
          <BookOpen className="size-3.5 text-primary" />
          업적 도감
        </h3>
        <span className="text-[10px] text-primary font-bold tabular-nums">
          {got} / {total}
        </span>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {ACHIEVEMENTS.map((a) => {
          const isUnlocked = !!unlocked[a.id];
          return (
            <div
              key={a.id}
              title={`${a.label} — ${a.desc}`}
              className={`group relative aspect-square rounded-xl border flex flex-col items-center justify-center p-1.5 transition-all ${
                isUnlocked
                  ? "border-primary/40 bg-gradient-to-br from-primary/10 to-bloom/10 shadow-gold hover:scale-110"
                  : "border-white/5 bg-black/30 opacity-40 grayscale"
              }`}
            >
              <span className="text-2xl">{isUnlocked ? a.icon : "❓"}</span>
              <span className="text-[8px] text-center mt-0.5 leading-tight font-semibold line-clamp-1">
                {isUnlocked ? a.label : "???"}
              </span>
              {/* tooltip */}
              <div className="pointer-events-none absolute -top-2 left-1/2 -translate-x-1/2 -translate-y-full opacity-0 group-hover:opacity-100 transition-opacity bg-card border border-white/10 rounded-lg px-2 py-1 text-[10px] whitespace-nowrap z-10 shadow-lg">
                <div className="font-bold text-primary">{a.label}</div>
                <div className="text-muted-foreground">{a.desc}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
