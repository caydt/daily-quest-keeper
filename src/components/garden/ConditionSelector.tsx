import type { ConditionMode } from "@/lib/garden-store";
import { CONDITION_META } from "@/lib/garden-store";

type Props = {
  onSelect: (mode: ConditionMode) => void;
};

const CONDITIONS: ConditionMode[] = ["best", "normal", "low", "sick"];

export function ConditionSelector({ onSelect }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm space-y-6">
        {/* 헤더 */}
        <div className="text-center space-y-1">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">오늘의 루미 가든</p>
          <h2 className="font-display text-2xl text-gradient-gold">오늘 컨디션이 어때?</h2>
          <p className="text-sm text-muted-foreground">선택에 따라 오늘 할일이 자동으로 맞춰져.</p>
        </div>

        {/* 컨디션 버튼 4개 */}
        <div className="grid grid-cols-2 gap-3">
          {CONDITIONS.map((mode) => {
            const meta = CONDITION_META[mode];
            return (
              <button
                key={mode}
                onClick={() => onSelect(mode)}
                className="group flex flex-col items-center gap-2 p-5 rounded-2xl border border-white/10 bg-card hover:border-primary/50 hover:bg-card/80 active:scale-95 transition-all duration-150"
              >
                <span className="text-4xl group-hover:scale-110 transition-transform duration-150">
                  {meta.icon}
                </span>
                <span className={`text-base font-semibold ${meta.color}`}>{meta.label}</span>
                <span className="text-[11px] text-muted-foreground text-center leading-tight">
                  {meta.desc}
                </span>
              </button>
            );
          })}
        </div>

        <p className="text-center text-[11px] text-muted-foreground">
          언제든 상단에서 바꿀 수 있어요
        </p>
      </div>
    </div>
  );
}
