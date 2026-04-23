import { useState } from "react";
import type { Task } from "@/lib/garden-store";
import { XP_REWARD } from "@/lib/garden-store";
import { Check, Trash2, Clock, Plus } from "lucide-react";

type Props = {
  tasks: Task[];
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onAdd: (title: string, time: string, difficulty: Task["difficulty"]) => void;
};

const diffMeta = {
  easy: { label: "씨앗", color: "text-emerald-300" },
  medium: { label: "새싹", color: "text-primary" },
  hard: { label: "개화", color: "text-accent" },
} as const;

export function TaskList({ tasks, onToggle, onDelete, onAdd }: Props) {
  const [title, setTitle] = useState("");
  const [time, setTime] = useState("09:00");
  const [difficulty, setDifficulty] = useState<Task["difficulty"]>("medium");

  const sorted = [...tasks].sort((a, b) => a.time.localeCompare(b.time));

  return (
    <section className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">
          오늘의 정원 <span className="text-muted-foreground font-normal ml-2">{tasks.length}</span>
        </h2>
      </div>

      {/* Add form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!title.trim()) return;
          onAdd(title.trim(), time, difficulty);
          setTitle("");
        }}
        className="bg-card/60 border border-white/10 rounded-2xl p-4 grid grid-cols-1 md:grid-cols-[1fr_auto_auto_auto] gap-3"
      >
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="새로운 씨앗 심기..."
          className="bg-transparent border-b border-white/10 focus:border-primary outline-none px-2 py-2 text-sm"
        />
        <input
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          className="bg-input/40 rounded-lg px-3 py-2 text-sm border border-white/10"
        />
        <select
          value={difficulty}
          onChange={(e) => setDifficulty(e.target.value as Task["difficulty"])}
          className="bg-input/40 rounded-lg px-3 py-2 text-sm border border-white/10"
        >
          <option value="easy">씨앗 +20</option>
          <option value="medium">새싹 +45</option>
          <option value="hard">개화 +80</option>
        </select>
        <button
          type="submit"
          className="bg-gradient-bloom text-foreground rounded-lg px-4 py-2 text-sm font-semibold hover:shadow-bloom transition-shadow flex items-center gap-1.5"
        >
          <Plus className="size-4" /> 심기
        </button>
      </form>

      {/* Task list */}
      <div className="space-y-3">
        {sorted.length === 0 && (
          <p className="text-center text-muted-foreground text-sm py-12">
            아직 심은 씨앗이 없어요. 첫 일을 추가해보세요 🌱
          </p>
        )}
        {sorted.map((t) => {
          const meta = diffMeta[t.difficulty];
          return (
            <div
              key={t.id}
              className={`group flex items-center gap-4 p-4 rounded-2xl border transition-all ${
                t.completed
                  ? "bg-card/30 border-white/5 opacity-60"
                  : "bg-card border-white/10 hover:border-primary/30"
              }`}
            >
              <button
                onClick={() => onToggle(t.id)}
                className={`size-8 rounded-full border-2 flex items-center justify-center transition-all shrink-0 ${
                  t.completed
                    ? "bg-primary border-primary"
                    : "border-white/20 hover:border-primary"
                }`}
                aria-label="완료 토글"
              >
                {t.completed && <Check className="size-4 text-primary-foreground" strokeWidth={3} />}
              </button>

              <div className="flex-1 min-w-0">
                <div
                  className={`font-medium ${t.completed ? "line-through text-muted-foreground" : ""}`}
                >
                  {t.title}
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="size-3" /> {t.time}
                  </span>
                  <span className={meta.color}>● {meta.label}</span>
                </div>
              </div>

              <div className="text-xs font-bold text-primary tabular-nums">
                +{XP_REWARD[t.difficulty]} XP
              </div>

              <button
                onClick={() => onDelete(t.id)}
                className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive p-1"
                aria-label="삭제"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
