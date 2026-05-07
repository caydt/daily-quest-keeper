import { useState } from "react";
import type { Task, TaskKind } from "@/lib/garden-store";
import { XP_REWARD, XP_PENALTY, splitMultilinePaste } from "@/lib/garden-store";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Check,
  Trash2,
  Clock,
  Plus,
  ChevronsRight,
  ShieldAlert,
  Leaf,
  GripVertical,
  Swords,
} from "lucide-react";

type Props = {
  tasks: Task[];
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onPostpone: (id: string) => void;
  onAdd: (title: string, time: string, difficulty: Task["difficulty"], kind: TaskKind) => void;
  onReorder: (orderedIds: string[]) => void;
};

const diffMeta = {
  easy: { label: "씨앗", color: "text-emerald-300" },
  medium: { label: "새싹", color: "text-primary" },
  hard: { label: "개화", color: "text-accent" },
} as const;

function TaskRow({
  t,
  onToggle,
  onDelete,
  onPostpone,
  burstId,
}: {
  t: Task;
  onToggle: (t: Task) => void;
  onDelete: (id: string) => void;
  onPostpone: (id: string) => void;
  burstId: string | null;
}) {
  const sortable = useSortable({ id: t.id, data: { type: "task", task: t } });
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = sortable;
  const meta = diffMeta[t.difficulty];
  const isFlex = t.kind === "flex";

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative flex items-center gap-3 p-4 rounded-2xl border transition-all ${
        t.completed
          ? "bg-card/30 border-white/5 opacity-60"
          : isFlex
            ? "bg-card border-primary/15 hover:border-primary/40"
            : "bg-card border-white/10 hover:border-accent/40"
      }`}
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-primary p-1 -ml-1 touch-none"
        aria-label="드래그"
      >
        <GripVertical className="size-4" />
      </button>

      <button
        onClick={() => onToggle(t)}
        className={`relative size-8 rounded-full border-2 flex items-center justify-center transition-all shrink-0 ${
          t.completed ? "bg-primary border-primary" : "border-white/20 hover:border-primary"
        }`}
        aria-label="완료 토글"
      >
        {t.completed && <Check className="size-4 text-primary-foreground" strokeWidth={3} />}
        {burstId === t.id && (
          <>
            <span className="pointer-events-none absolute inset-0 rounded-full bg-primary/40 animate-bloom-burst" />
            <span className="pointer-events-none absolute -top-2 left-1/2 -translate-x-1/2 text-base animate-petal" style={{ animationDelay: "0ms" }}>🌸</span>
            <span className="pointer-events-none absolute -top-2 left-1/2 -translate-x-1/2 text-base animate-petal" style={{ animationDelay: "120ms", filter: "hue-rotate(40deg)" }}>✨</span>
            <span className="pointer-events-none absolute -top-2 left-1/2 -translate-x-1/2 text-base animate-petal" style={{ animationDelay: "240ms" }}>🌟</span>
          </>
        )}
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`font-medium ${t.completed ? "line-through text-muted-foreground" : ""}`}>
            {t.title}
          </span>
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded-full uppercase tracking-wider font-bold ${
              isFlex
                ? "bg-primary/15 text-primary border border-primary/30"
                : "bg-destructive/15 text-destructive border border-destructive/30"
            }`}
          >
            {isFlex ? "FLEX" : "MUST"}
          </span>
          {t.postponedCount && t.postponedCount > 0 ? (
            <span className="text-[10px] text-muted-foreground">↻ {t.postponedCount}회</span>
          ) : null}
        </div>
        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="size-3" /> {t.time}
          </span>
          <span className={meta.color}>● {meta.label}</span>
          <span className="text-muted-foreground/70">
            {isFlex ? "벌점 없음" : `미완료 시 -${XP_PENALTY[t.difficulty]}`}
          </span>
        </div>
      </div>

      <div className="text-xs font-bold text-primary tabular-nums whitespace-nowrap">
        +{XP_REWARD[t.difficulty]} XP
      </div>

      {isFlex && !t.completed && (
        <button
          onClick={() => onPostpone(t.id)}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-primary p-1"
          aria-label="내일로 미루기"
          title="내일로 미루기"
        >
          <ChevronsRight className="size-4" />
        </button>
      )}

      <button
        onClick={() => onDelete(t.id)}
        className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive p-1"
        aria-label="삭제"
      >
        <Trash2 className="size-4" />
      </button>
    </div>
  );
}

export function TaskList({ tasks, onToggle, onDelete, onPostpone, onAdd, onReorder: _onReorder }: Props) {
  const [title, setTitle] = useState("");
  const [time, setTime] = useState("09:00");
  const [difficulty, setDifficulty] = useState<Task["difficulty"]>("medium");
  const [kind, setKind] = useState<TaskKind>("must");
  const [burstId, setBurstId] = useState<string | null>(null);

  const sorted = [...tasks].sort((a, b) => {
    const ao = a.order ?? 0;
    const bo = b.order ?? 0;
    if (ao !== bo) return ao - bo;
    return a.time.localeCompare(b.time);
  });

  const handleToggle = (t: Task) => {
    if (!t.completed) {
      setBurstId(t.id);
      window.setTimeout(() => setBurstId(null), 1200);
    }
    onToggle(t.id);
  };

  const mustCount = sorted.filter((t) => t.kind === "must" && !t.completed).length;
  const totalCount = sorted.length;
  const doneCount = sorted.filter((t) => t.completed).length;
  const allDone = totalCount > 0 && doneCount === totalCount;

  return (
    <section className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Swords className="size-5 text-primary" />
          오늘의 임무
          <span className="text-muted-foreground font-normal">{tasks.length}</span>
        </h2>
        <div className="flex items-center gap-2 flex-wrap">
          {allDone && (
            <span className="text-xs px-2 py-1 rounded-full bg-primary/20 text-primary border border-primary/40 font-semibold animate-pulse">
              🏆 레벨업 달성!
            </span>
          )}
          {!allDone && totalCount > 0 && (
            <span className="text-xs px-2 py-1 rounded-full bg-card border border-white/10 text-muted-foreground">
              전부 완료하면 레벨업 🏆 ({doneCount}/{totalCount})
            </span>
          )}
          {mustCount > 0 && (
            <span className="text-xs px-2 py-1 rounded-full bg-destructive/15 text-destructive border border-destructive/30 font-semibold">
              ⚠ 필수 {mustCount}개 미완료 시 벌점
            </span>
          )}
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!title.trim()) return;
          onAdd(title.trim(), time, difficulty, kind);
          setTitle("");
        }}
        className="bg-card/60 border border-white/10 rounded-2xl p-4 space-y-3"
      >
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onPaste={(e) => {
            const text = e.clipboardData.getData("text");
            if (!text.includes("\n")) return;
            e.preventDefault();
            const titles = splitMultilinePaste(text);
            if (titles.length === 0) return;
            for (const t of titles) onAdd(t, time, difficulty, kind);
            setTitle("");
          }}
          placeholder="새로운 씨앗 심기..."
          className="w-full bg-transparent border-b border-white/10 focus:border-primary outline-none px-2 py-2 text-sm"
        />
        <div className="grid grid-cols-2 md:grid-cols-[auto_auto_1fr_auto] gap-2 items-center">
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
          <div className="col-span-2 md:col-span-1 inline-flex rounded-lg border border-white/10 bg-input/40 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setKind("must")}
              className={`flex-1 px-3 py-1.5 rounded-md flex items-center justify-center gap-1.5 transition ${
                kind === "must" ? "bg-destructive/30 text-destructive-foreground" : "text-muted-foreground"
              }`}
            >
              <ShieldAlert className="size-3.5" /> 필수 (-{XP_PENALTY[difficulty]})
            </button>
            <button
              type="button"
              onClick={() => setKind("flex")}
              className={`flex-1 px-3 py-1.5 rounded-md flex items-center justify-center gap-1.5 transition ${
                kind === "flex" ? "bg-primary/20 text-primary" : "text-muted-foreground"
              }`}
            >
              <Leaf className="size-3.5" /> 미뤄도 OK
            </button>
          </div>
          <button
            type="submit"
            className="col-span-2 md:col-span-1 bg-gradient-bloom text-foreground rounded-lg px-4 py-2 text-sm font-semibold hover:shadow-bloom transition-shadow flex items-center justify-center gap-1.5"
          >
            <Plus className="size-4" /> 심기
          </button>
        </div>
      </form>

      {sorted.length > 0 && (
        <p className="text-[11px] text-muted-foreground/70 flex items-center gap-1.5 px-1">
          <GripVertical className="size-3" /> 드래그로 순서를 바꾸거나, 보스 카드에 떨어뜨려 서브 임무로 편입시킬 수 있어요.
        </p>
      )}

      <SortableContext items={sorted.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-3">
          {sorted.length === 0 && (
            <p className="text-center text-muted-foreground text-sm py-12">
              아직 심은 씨앗이 없어요. 첫 일을 추가해보세요 🌱
            </p>
          )}
          {sorted.map((t) => (
            <TaskRow
              key={t.id}
              t={t}
              onToggle={handleToggle}
              onDelete={onDelete}
              onPostpone={onPostpone}
              burstId={burstId}
            />
          ))}
        </div>
      </SortableContext>
    </section>
  );
}
