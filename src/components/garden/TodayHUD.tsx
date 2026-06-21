import type { Task, Project } from "@/lib/garden-store";
import { DAILY_CLEAR_BONUS } from "@/lib/garden-store";

type Props = {
  tasks: Task[];      // today's tasks (standalone, no projectId)
  projects: Project[];
  streak: number;
  combo: number;
};

function QuestMini({
  icon,
  label,
  progress,
  reward,
  done,
  penaltyMode,
}: {
  icon: string;
  label: string;
  progress: number;
  reward: string;
  done: boolean;
  penaltyMode?: boolean;
}) {
  return (
    <div
      className={`relative p-3 rounded-2xl border transition-all overflow-hidden ${
        done
          ? "border-primary/50 bg-primary/8"
          : penaltyMode
            ? "border-rose-500/25 bg-rose-500/5"
            : "border-white/8 bg-card/50"
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="text-base leading-none">{icon}</span>
        <span
          className={`text-[11px] font-semibold leading-tight flex-1 min-w-0 ${
            done ? "text-primary" : "text-foreground/80"
          }`}
        >
          {label}
        </span>
        {done && (
          <span className="text-[9px] font-bold text-primary bg-primary/15 px-1.5 py-0.5 rounded-full shrink-0">
            ✓
          </span>
        )}
      </div>

      <div className="h-1.5 rounded-full bg-black/30 overflow-hidden mb-1.5">
        <div
          className={`h-full rounded-full transition-all duration-700 ${
            done
              ? "bg-primary"
              : penaltyMode
                ? "bg-gradient-to-r from-rose-500 to-orange-400"
                : "bg-gradient-to-r from-primary to-accent"
          }`}
          style={{ width: `${Math.max(3, progress)}%` }}
        />
      </div>

      <div className="flex items-center justify-between">
        <span
          className={`text-[10px] font-medium ${
            penaltyMode ? "text-rose-400/80" : "text-primary/70"
          }`}
        >
          {penaltyMode ? "⚠️ " : "🎁 "}
          {reward}
        </span>
        <span className="text-[10px] text-muted-foreground tabular-nums">
          {Math.round(progress)}%
        </span>
      </div>
    </div>
  );
}

export function TodayHUD({ tasks, projects, streak, combo }: Props) {
  const mustTasks = tasks.filter((t) => t.kind === "must");
  const completedMust = mustTasks.filter((t) => t.completed).length;
  const completed = tasks.filter((t) => t.completed).length;
  const remaining = tasks.length - completed;
  const pct = tasks.length === 0 ? 0 : Math.round((completed / tasks.length) * 100);
  const allDone = tasks.length > 0 && tasks.every((t) => t.completed);
  const activeProjects = projects.filter((p) => !p.completed).length;

  const streakMsg =
    streak >= 30 ? "전설의 정원사 🏆" :
    streak >= 14 ? "불꽃 정원사 🔥" :
    streak >= 7  ? "성장하는 정원 🌳" :
    streak > 0   ? "정원이 피어나요 🌸" :
                   "오늘 첫 할일을 완료하세요";

  return (
    <div className="space-y-3">
      {/* 상단 2열: 연속개화 + 오늘의 성장 */}
      <div className="grid grid-cols-2 gap-3">
        {/* 연속개화 */}
        <div className="relative overflow-hidden rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/20 via-accent/10 to-transparent p-4">
          <div className="relative z-10">
            <p className="text-[10px] uppercase tracking-widest text-foreground/50 mb-1">
              연속 개화
            </p>
            <div className="flex items-baseline gap-1">
              <span className="font-display text-5xl text-gradient-gold leading-none tabular-nums">
                {streak}
              </span>
              <span className="text-sm text-foreground/70">일</span>
            </div>
            <p className="text-[11px] text-foreground/60 mt-1.5 leading-tight">
              {streakMsg}
            </p>
          </div>
          <div className="absolute -right-6 -bottom-6 size-24 bg-primary/25 blur-2xl rounded-full pointer-events-none" />
        </div>

        {/* 오늘의 성장 */}
        <div className="rounded-2xl border border-white/10 bg-card/60 p-4 flex flex-col justify-between">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-3">
            오늘의 성장
          </p>
          <div className="grid grid-cols-3 gap-1 text-center">
            <div>
              <div className="font-display text-3xl text-primary leading-none tabular-nums">
                {completed}
              </div>
              <div className="text-[10px] text-muted-foreground mt-1">완료</div>
            </div>
            <div>
              <div className="font-display text-3xl text-rose-400 leading-none tabular-nums">
                {remaining}
              </div>
              <div className="text-[10px] text-muted-foreground mt-1">남음</div>
            </div>
            <div>
              <div className="font-display text-3xl text-accent leading-none tabular-nums">
                {pct}%
              </div>
              <div className="text-[10px] text-muted-foreground mt-1">달성</div>
            </div>
          </div>

          {/* 달성률 바 */}
          <div className="mt-3 h-1.5 rounded-full bg-black/30 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all duration-700"
              style={{ width: `${Math.max(pct, pct > 0 ? 4 : 0)}%` }}
            />
          </div>
        </div>
      </div>

      {/* 퀘스트 2×2 그리드 */}
      <div className="grid grid-cols-2 gap-2">
        <QuestMini
          icon="🎯"
          label="데일리 클리어"
          progress={tasks.length === 0 ? 0 : (completed / tasks.length) * 100}
          reward={`+${DAILY_CLEAR_BONUS} XP 보너스`}
          done={allDone}
          penaltyMode={false}
        />
        <QuestMini
          icon="⚔️"
          label="필수 임무 사수"
          progress={mustTasks.length === 0 ? 100 : (completedMust / mustTasks.length) * 100}
          reward={mustTasks.length === 0 ? "필수 없음" : "벌점 회피"}
          done={mustTasks.length === 0 || completedMust === mustTasks.length}
          penaltyMode={mustTasks.length > 0 && completedMust < mustTasks.length}
        />
        <QuestMini
          icon="⚡"
          label="5콤보 달성"
          progress={Math.min(100, (combo / 5) * 100)}
          reward="XP ×1.5 부스터"
          done={combo >= 5}
          penaltyMode={false}
        />
        <QuestMini
          icon="🏆"
          label="보스 클리어"
          progress={activeProjects === 0 ? 100 : 0}
          reward="+1 레벨 업"
          done={activeProjects === 0}
          penaltyMode={false}
        />
      </div>
    </div>
  );
}
