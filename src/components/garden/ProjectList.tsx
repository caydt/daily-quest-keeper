import { useState } from "react";
import type { Project, Task } from "@/lib/garden-store";
import { levelFromXp } from "@/lib/garden-store";
import {
  useDroppable,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Check,
  Trash2,
  Plus,
  Trophy,
  Sparkles,
  CalendarDays,
  GripVertical,
  Crown,
  X,
} from "lucide-react";

type Props = {
  projects: Project[];
  tasks: Task[]; // all tasks (used to count children)
  totalXp: number;
  onAdd: (title: string, description?: string, dueDate?: string) => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onReorder: (orderedIds: string[]) => void;
  onAssignTask: (taskId: string, projectId: string | null) => void;
};

function ProjectCard({
  p,
  childTasks,
  rewardXp,
  onToggle,
  onDelete,
  onUnassign,
}: {
  p: Project;
  childTasks: Task[];
  rewardXp: number;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onUnassign: (taskId: string) => void;
}) {
  const sortable = useSortable({ id: p.id, data: { type: "project", project: p } });
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = sortable;
  const droppable = useDroppable({ id: `project-drop-${p.id}`, data: { type: "project-drop", projectId: p.id } });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const completedChildren = childTasks.filter((t) => t.completed).length;
  const total = childTasks.length;
  const childPct = total === 0 ? 0 : (completedChildren / total) * 100;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative rounded-2xl border-2 transition-all ${
        p.completed
          ? "bg-card/30 border-white/5 opacity-60"
          : droppable.isOver
            ? "bg-accent/10 border-accent shadow-bloom scale-[1.01]"
            : "bg-card border-accent/20 hover:border-accent/50 hover:shadow-bloom"
      }`}
    >
      <div ref={droppable.setNodeRef} className="p-4">
        <div className="flex items-start gap-3">
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-primary p-1 -ml-1 mt-1 touch-none"
            aria-label="드래그"
          >
            <GripVertical className="size-4" />
          </button>

          <button
            onClick={() => onToggle(p.id)}
            className={`mt-0.5 size-10 rounded-xl border-2 flex items-center justify-center transition-all shrink-0 ${
              p.completed
                ? "bg-primary border-primary"
                : "border-accent/40 hover:border-primary bg-gradient-bloom/30"
            }`}
            aria-label="프로젝트 완료 토글"
          >
            {p.completed ? (
              <Check className="size-5 text-primary-foreground" strokeWidth={3} />
            ) : (
              <Crown className="size-5 text-primary" />
            )}
          </button>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`font-bold ${p.completed ? "line-through text-muted-foreground" : ""}`}>
                {p.title}
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full uppercase tracking-wider font-bold bg-accent/15 text-accent border border-accent/30">
                ⚔ BOSS
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
              <div className="text-[11px] text-primary/90 mt-1.5 font-semibold flex items-center gap-1">
                <Sparkles className="size-3" />
                완료 시 +{rewardXp} XP · 즉시 1레벨업 🎉
              </div>
            )}

            {/* Sub-tasks progress */}
            {total > 0 && (
              <div className="mt-3">
                <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                  <span>서브 임무 진행도</span>
                  <span className="tabular-nums font-bold text-primary">{completedChildren}/{total}</span>
                </div>
                <div className="h-1.5 rounded-full bg-black/40 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-accent to-primary transition-all"
                    style={{ width: `${childPct}%` }}
                  />
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {childTasks.map((c) => (
                    <span
                      key={c.id}
                      className={`group/chip inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border ${
                        c.completed
                          ? "border-primary/30 bg-primary/10 text-primary line-through"
                          : "border-white/10 bg-black/30 text-muted-foreground"
                      }`}
                    >
                      {c.title}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onUnassign(c.id);
                        }}
                        className="opacity-0 group-hover/chip:opacity-100 hover:text-destructive transition-opacity"
                        aria-label="해제"
                      >
                        <X className="size-2.5" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {!p.completed && total === 0 && (
              <div className="mt-2 text-[10px] text-muted-foreground/70 italic border border-dashed border-white/10 rounded-lg px-2 py-1.5 text-center">
                ↓ 할일을 여기에 끌어다 놓으면 서브 임무가 됩니다
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
      </div>
    </div>
  );
}

export function ProjectList({
  projects,
  tasks,
  totalXp,
  onAdd,
  onToggle,
  onDelete,
  onReorder,
  onAssignTask,
}: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [open, setOpen] = useState(false);

  // onReorder is consumed by the parent DndContext; keep a no-op reference to avoid lint
  void onReorder;

  const { level, currentXp, nextXp } = levelFromXp(totalXp);
  const rewardXp = Math.max(1, nextXp - currentXp);

  const sorted = [...projects].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    const ao = a.order ?? 0;
    const bo = b.order ?? 0;
    if (ao !== bo) return ao - bo;
    return b.createdAt - a.createdAt;
  });

  return (
    <section className="space-y-4 rounded-3xl border border-accent/20 bg-card/40 p-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-2xl bg-gradient-bloom flex items-center justify-center shadow-bloom">
            <Trophy className="size-5 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-semibold flex items-center gap-2">
              보스 프로젝트
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
          <Plus className="size-3.5" /> 보스 소환
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
              소환
            </button>
          </div>
        </form>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={sorted.map((p) => p.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2.5">
            {sorted.length === 0 && (
              <p className="text-center text-muted-foreground text-sm py-8">
                아직 보스가 없어요. 큰 목표 하나를 소환해보세요 🏆
              </p>
            )}
            {sorted.map((p) => (
              <ProjectCard
                key={p.id}
                p={p}
                childTasks={tasks.filter((t) => t.projectId === p.id)}
                rewardXp={rewardXp}
                onToggle={onToggle}
                onDelete={onDelete}
                onUnassign={(taskId) => onAssignTask(taskId, null)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </section>
  );
}
