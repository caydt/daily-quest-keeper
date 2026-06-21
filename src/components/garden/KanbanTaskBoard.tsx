import { useState } from "react";
import type { Task, TaskKind, KanbanCol } from "@/lib/garden-store";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  useDroppable,
  DragOverlay,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Check, Trash2, Clock, GripVertical, Plus } from "lucide-react";

// must/deadline → kind:"must" (벌점), flex/quick → kind:"flex" (보상)
const COL_KIND: Record<KanbanCol, TaskKind> = {
  must: "must",
  deadline: "must",
  flex: "flex",
  quick: "flex",
};

const COLUMNS: {
  id: KanbanCol;
  icon: string;
  title: string;
  desc: string;
  accent: string;
  border: string;
  penalty: boolean; // true = 미완료 시 벌점
}[] = [
  { id: "must",     icon: "🔥", title: "필수 미션",    desc: "오늘 반드시",    accent: "text-rose-400",    border: "border-rose-500/25",    penalty: true  },
  { id: "deadline", icon: "⏰", title: "데드라인 미션", desc: "기한/외부 요청", accent: "text-amber-400",   border: "border-amber-500/25",   penalty: true  },
  { id: "flex",     icon: "🌿", title: "여유 미션",    desc: "시간이 되면",    accent: "text-emerald-400", border: "border-emerald-500/25", penalty: false },
  { id: "quick",    icon: "⚡", title: "빠른 미션",    desc: "금방 끝나는",    accent: "text-blue-400",    border: "border-blue-500/25",    penalty: false },
];

type Props = {
  tasks: Task[];
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onPostpone: (id: string) => void;
  onAdd: (title: string, time: string, difficulty: Task["difficulty"], kind: TaskKind, kanbanCol?: KanbanCol) => void;
  onUpdateTask: (id: string, patch: Partial<Task>) => void;
  onReorder: (orderedIds: string[]) => void;
};

function KanbanCard({
  task,
  onToggle,
  onDelete,
  onPostpone,
}: {
  task: Task;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onPostpone: (id: string) => void;
}) {
  const colId: KanbanCol = task.kanbanCol ?? "must";
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    data: { type: "kanban-task", colId, task },
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group flex items-center gap-2 px-2.5 py-2 rounded-xl border transition-all ${
        task.completed
          ? "bg-card/20 border-white/5 opacity-50"
          : "bg-card/60 border-white/8 hover:border-primary/30"
      }`}
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-muted-foreground/25 hover:text-primary/60 shrink-0 touch-none"
        aria-label="드래그"
      >
        <GripVertical className="size-3.5" />
      </button>

      <button
        onClick={() => onToggle(task.id)}
        className={`size-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
          task.completed
            ? "bg-primary border-primary"
            : "border-white/20 hover:border-primary"
        }`}
        aria-label="완료"
      >
        {task.completed && (
          <Check className="size-2.5 text-primary-foreground" strokeWidth={3} />
        )}
      </button>

      <span
        className={`flex-1 text-xs min-w-0 leading-snug ${
          task.completed ? "line-through text-muted-foreground" : ""
        }`}
      >
        {task.title}
      </span>

      <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-opacity shrink-0">
        {!task.completed && (
          <button
            onClick={() => onPostpone(task.id)}
            className="p-1 rounded hover:bg-white/5 text-muted-foreground hover:text-primary"
            aria-label="연기"
          >
            <Clock className="size-3" />
          </button>
        )}
        <button
          onClick={() => onDelete(task.id)}
          className="p-1 rounded hover:bg-white/5 text-muted-foreground hover:text-rose-400"
          aria-label="삭제"
        >
          <Trash2 className="size-3" />
        </button>
      </div>
    </div>
  );
}

function KanbanColumn({
  col,
  tasks,
  onToggle,
  onDelete,
  onPostpone,
  onAdd,
}: {
  col: (typeof COLUMNS)[number];
  tasks: Task[];
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onPostpone: (id: string) => void;
  onAdd: (col: KanbanCol, title: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");

  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `col-drop-${col.id}`,
    data: { type: "kanban-col", colId: col.id },
  });

  const sorted = tasks.slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const pendingCount = tasks.filter((t) => !t.completed).length;

  const handleAdd = () => {
    const title = newTitle.trim();
    if (!title) return;
    onAdd(col.id, title);
    setNewTitle("");
    setAdding(false);
  };

  return (
    <div
      className={`flex flex-col rounded-2xl border ${col.border} bg-card/25 min-h-[180px]`}
    >
      {/* 헤더 */}
      <div className="flex items-center justify-between px-3 pt-3 pb-2">
        <div className="flex items-center gap-1.5">
          <span className="text-sm">{col.icon}</span>
          <div>
            <div className="flex items-center gap-1.5">
              <p className={`text-xs font-semibold ${col.accent}`}>{col.title}</p>
              {col.penalty ? (
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-rose-500/15 text-rose-400 font-medium border border-rose-500/20">
                  벌점
                </span>
              ) : (
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-medium border border-emerald-500/20">
                  보상
                </span>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground leading-none mt-0.5">
              {col.desc}
            </p>
          </div>
        </div>
        {pendingCount > 0 && (
          <span className="text-[10px] text-muted-foreground bg-white/5 px-1.5 py-0.5 rounded-full">
            {pendingCount}
          </span>
        )}
      </div>

      {/* 드롭 영역 */}
      <div
        ref={setDropRef}
        className={`flex-1 px-2 pb-1 space-y-1.5 transition-colors rounded-xl ${
          isOver ? "bg-white/5" : ""
        }`}
      >
        <SortableContext
          items={sorted.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          {sorted.map((task) => (
            <KanbanCard
              key={task.id}
              task={task}
              onToggle={onToggle}
              onDelete={onDelete}
              onPostpone={onPostpone}
            />
          ))}
        </SortableContext>
      </div>

      {/* 추가 */}
      <div className="px-2 pb-2 pt-1">
        {adding ? (
          <div className="flex gap-1.5">
            <input
              autoFocus
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAdd();
                if (e.key === "Escape") {
                  setAdding(false);
                  setNewTitle("");
                }
              }}
              placeholder="할일 입력..."
              className="flex-1 px-2 py-1.5 text-xs rounded-lg bg-input/40 border border-white/10 focus:border-primary/40 focus:outline-none"
            />
            <button
              onClick={handleAdd}
              className="px-2 py-1.5 text-xs rounded-lg bg-primary text-primary-foreground font-medium"
            >
              추가
            </button>
          </div>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="w-full flex items-center gap-1.5 px-2 py-1.5 text-[11px] text-muted-foreground hover:text-primary transition rounded-lg hover:bg-white/5"
          >
            <Plus className="size-3" />
            추가
          </button>
        )}
      </div>
    </div>
  );
}

export function KanbanTaskBoard({
  tasks,
  onToggle,
  onDelete,
  onPostpone,
  onAdd,
  onUpdateTask,
  onReorder,
}: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  const tasksByCol = Object.fromEntries(
    COLUMNS.map((col) => [
      col.id,
      tasks.filter((t) => (t.kanbanCol ?? "must") === col.id),
    ]),
  ) as Record<KanbanCol, Task[]>;

  const handleDragStart = (e: DragStartEvent) => {
    const data = e.active.data.current as { task?: Task } | undefined;
    setActiveTask(data?.task ?? null);
  };

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveTask(null);
    const { active, over } = e;
    if (!over) return;

    const activeData = active.data.current as {
      type?: string;
      colId?: KanbanCol;
      task?: Task;
    };
    const overData = over.data.current as {
      type?: string;
      colId?: KanbanCol;
    };

    const sourceCol = activeData.colId;
    const targetCol = overData?.colId;
    if (!sourceCol || !targetCol) return;

    const activeId = String(active.id);

    if (sourceCol === targetCol) {
      if (overData?.type === "kanban-col") return;
      const colTasks = tasksByCol[sourceCol]
        .slice()
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      const ids = colTasks.map((t) => t.id);
      const oldIdx = ids.indexOf(activeId);
      const newIdx = ids.indexOf(String(over.id));
      if (oldIdx !== -1 && newIdx !== -1 && oldIdx !== newIdx) {
        onReorder(arrayMove(ids, oldIdx, newIdx));
      }
    } else {
      onUpdateTask(activeId, { kanbanCol: targetCol, kind: COL_KIND[targetCol] });
    }
  };

  const handleAddToCol = (col: KanbanCol, title: string) => {
    onAdd(title, "09:00", "medium", COL_KIND[col], col);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="grid grid-cols-2 gap-3">
        {COLUMNS.map((col) => (
          <KanbanColumn
            key={col.id}
            col={col}
            tasks={tasksByCol[col.id]}
            onToggle={onToggle}
            onDelete={onDelete}
            onPostpone={onPostpone}
            onAdd={handleAddToCol}
          />
        ))}
      </div>
      <DragOverlay>
        {activeTask && (
          <div className="flex items-center gap-2 px-2.5 py-2 rounded-xl border bg-card border-primary/40 shadow-2xl opacity-90">
            <GripVertical className="size-3.5 text-muted-foreground" />
            <span className="text-xs">{activeTask.title}</span>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
