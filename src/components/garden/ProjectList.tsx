import { useState } from "react";
import type { Project } from "@/lib/garden-store";
import { levelFromXp } from "@/lib/garden-store";
import { Check, Trash2, Plus, Trophy, Sparkles, CalendarDays } from "lucide-react";

type Props = {
  projects: Project[];
  totalXp: number;
  onAdd: (title: string, description?: string, dueDate?: string) => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
};

export function ProjectList({ projects, totalXp, onAdd, onToggle, onDelete }: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [open, setOpen] = useState(false);

  const { level, currentXp, nextXp } = levelFromXp(totalXp);
  const rewardXp = Math.max(1, nextXp - currentXp);

  const sorted = [...projects].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    return b.createdAt - a.createdAt;
  });

  return (
    <section className="space-y-5 rounded-3xl border border-accent/20 bg-card/40 p-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-2xl bg-gradient-bloom flex items-center justify-center shadow-bloom">
            <Trophy className="size-5 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-semibold flex items-center gap-2">
              프로젝트
              <span className="text-muted-foreground font-normal">{projects.length}</span>
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
              <Sparkles className="size-3 text-primary" />
              완료 시 <span className="text-primary font-bold">즉시 Lv.{level + 1} 달성</span>
              <span className="text-muted-foreground/70">(+{rewardXp} XP 보장)</span>
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-primary/30 bg-primary/10 hover:bg-primary/20 text-primary text-xs font-semibold transition"
        >
          <Plus className="size-3.5" /> 새 프로젝트
        </button>
      </div>

      {open && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!title.trim()) return;
            onAdd(title.trim(), description.trim() || undefined, dueDate || undefined);
            setTitle("");
            setDescription("");
            setDueDate("");
            setOpen(false);
          }}
          className="bg-card/70 border border-white/10 rounded-2xl p-4 space-y-3"
        >
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="프로젝트 이름 (예: 포트폴리오 사이트)"
            className="w-full bg-transparent border-b border-white/10 focus:border-primary outline-none px-2 py-2 text-sm font-medium"
            autoFocus
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="설명 (선택)"
            rows={2}
            className="w-full bg-input/40 rounded-lg px-3 py-2 text-sm border border-white/10 outline-none focus:border-primary/40 resize-none"
          />
          <div className="flex items-center gap-2">
            <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
              <CalendarDays className="size-3.5" /> 마감
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="bg-input/40 rounded-lg px-2 py-1.5 text-xs border border-white/10"
              />
            </label>
            <div className="flex-1" />
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="px-3 py-2 rounded-lg text-xs text-muted-foreground hover:text-foreground"
            >
              취소
            </button>
            <button
              type="submit"
              className="bg-gradient-bloom rounded-lg px-4 py-2 text-xs font-semibold hover:shadow-bloom transition-shadow"
            >
              만들기
            </button>
          </div>
        </form>
      )}

      <div className="space-y-2.5">
        {sorted.length === 0 && (
          <p className="text-center text-muted-foreground text-sm py-8">
            아직 프로젝트가 없어요. 큰 목표 하나를 심어보세요 🏆
          </p>
        )}
        {sorted.map((p) => (
          <div
            key={p.id}
            className={`group relative flex items-start gap-4 p-4 rounded-2xl border transition-all ${
              p.completed
                ? "bg-card/30 border-white/5 opacity-60"
                : "bg-card border-accent/20 hover:border-accent/50 hover:shadow-bloom"
            }`}
          >
            <button
              onClick={() => onToggle(p.id)}
              className={`mt-0.5 size-9 rounded-xl border-2 flex items-center justify-center transition-all shrink-0 ${
                p.completed
                  ? "bg-primary border-primary"
                  : "border-accent/40 hover:border-primary bg-gradient-bloom/30"
              }`}
              aria-label="프로젝트 완료 토글"
            >
              {p.completed ? (
                <Check className="size-4 text-primary-foreground" strokeWidth={3} />
              ) : (
                <Trophy className="size-4 text-primary" />
              )}
            </button>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={`font-semibold ${p.completed ? "line-through text-muted-foreground" : ""}`}
                >
                  {p.title}
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full uppercase tracking-wider font-bold bg-accent/15 text-accent border border-accent/30">
                  PROJECT
                </span>
                {p.dueDate && (
                  <span className="text-[10px] text-muted-foreground inline-flex items-center gap-1">
                    <CalendarDays className="size-3" /> {p.dueDate}
                  </span>
                )}
              </div>
              {p.description && (
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{p.description}</p>
              )}
              {!p.completed && (
                <div className="text-[11px] text-primary/80 mt-1.5 font-medium">
                  완료 시 +{rewardXp} XP · 즉시 레벨업 🎉
                </div>
              )}
            </div>

            <button
              onClick={() => onDelete(p.id)}
              className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive p-1"
              aria-label="삭제"
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
