import type { Task, Project } from "@/lib/garden-store";
import { DAILY_CLEAR_BONUS } from "@/lib/garden-store";
import { Swords, Target, Zap, Trophy } from "lucide-react";

type Props = {
  tasks: Task[]; // today's tasks
  projects: Project[];
  combo: number;
};

export function QuestPanel({ tasks, projects, combo }: Props) {
  const standalone = tasks.filter((t) => !t.projectId);
  const mustTasks = standalone.filter((t) => t.kind === "must");
  const completedMust = mustTasks.filter((t) => t.completed).length;
  const allDone = standalone.length > 0 && standalone.every((t) => t.completed);
  const activeProjects = projects.filter((p) => !p.completed).length;

  const quests = [
    {
      id: "daily",
      icon: <Target className="size-4" />,
      label: "데일리: 모든 할일 완료",
      progress: standalone.length === 0 ? 0 : (standalone.filter((t) => t.completed).length / standalone.length) * 100,
      reward: `+${DAILY_CLEAR_BONUS} XP 보너스`,
      done: allDone,
      color: "from-primary to-gold-soft",
    },
    {
      id: "must",
      icon: <Swords className="size-4" />,
      label: "필수 임무 사수",
      progress: mustTasks.length === 0 ? 0 : (completedMust / mustTasks.length) * 100,
      reward: mustTasks.length === 0 ? "필수 할일 없음" : "벌점 회피",
      done: mustTasks.length > 0 && completedMust === mustTasks.length,
      color: "from-destructive to-bloom",
    },
    {
      id: "combo",
      icon: <Zap className="size-4" />,
      label: "5콤보 달성",
      progress: Math.min(100, (combo / 5) * 100),
      reward: "XP x1.5 부스터",
      done: combo >= 5,
      color: "from-bloom to-accent",
    },
    {
      id: "boss",
      icon: <Trophy className="size-4" />,
      label: "보스: 프로젝트 클리어",
      progress: activeProjects === 0 ? 100 : 0,
      reward: "즉시 +1 LEVEL UP",
      done: false,
      color: "from-accent to-primary",
    },
  ];

  return (
    <div className="rounded-3xl border border-white/10 bg-card/60 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
          <Swords className="size-3.5 text-primary" />
          오늘의 퀘스트
        </h3>
        <span className="text-[10px] text-muted-foreground">자정에 초기화</span>
      </div>

      <div className="space-y-3">
        {quests.map((q) => (
          <div
            key={q.id}
            className={`relative p-3 rounded-2xl border transition-all ${
              q.done
                ? "border-primary/40 bg-primary/5"
                : "border-white/10 bg-black/20"
            }`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`size-8 rounded-xl flex items-center justify-center shrink-0 ${
                  q.done ? "bg-gradient-bloom text-primary shadow-gold" : "bg-black/40 text-muted-foreground"
                }`}
              >
                {q.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className={`text-xs font-semibold ${q.done ? "text-primary" : "text-foreground"}`}>
                    {q.label}
                  </span>
                  {q.done && <span className="text-[10px] text-primary font-bold">✓ 완료</span>}
                </div>
                <div className="h-1.5 rounded-full bg-black/40 overflow-hidden">
                  <div
                    className={`h-full rounded-full bg-gradient-to-r ${q.color} transition-all duration-500`}
                    style={{ width: `${q.progress}%` }}
                  />
                </div>
                <div className="text-[10px] text-muted-foreground mt-1">보상: <span className="text-primary/80 font-medium">{q.reward}</span></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
