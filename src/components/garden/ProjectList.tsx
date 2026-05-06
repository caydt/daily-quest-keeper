import { useState } from "react";
import type { Project, Task, Farm } from "@/lib/garden-store";
import { levelFromXp, treeStage, farmStage } from "@/lib/garden-store";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Check,
  Trash2,
  Plus,
  Trophy,
  Sparkles,
  CalendarDays,
  GripVertical,
  X,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Pencil,
  MoveRight,
  ExternalLink,
  Link2,
} from "lucide-react";
import { ToolChipBar } from "@/components/garden/ToolChipBar";
import { ToolPicker } from "@/components/garden/ToolPicker";
import { AiChatPanel } from "@/components/garden/AiChatPanel";
import type { Tool } from "@/lib/tools-sheet";
import type { Settings } from "@/lib/garden-store";
import { buildProjectContext, buildFarmContext } from "@/lib/ai-context";
import { MessageCircle } from "lucide-react";

type Props = {
  projects: Project[];
  farms: Farm[];
  tasks: Task[];
  totalXp: number;
  availableTools: Tool[];
  onAdd: (title: string, description?: string, dueDate?: string, farmId?: string | null) => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onReorder: (orderedIds: string[]) => void;
  onAssignTask: (taskId: string, projectId: string | null) => void;
  onAddFarm: (title: string, icon?: string) => void;
  onDeleteFarm: (id: string) => void;
  onUpdateFarm: (id: string, patch: { title?: string; icon?: string; aiUrl?: string; toolIds?: string[] }) => void;
  onMoveProjectToFarm: (projectId: string, farmId: string | null) => void;
  onToggleFarmTool: (farmId: string, toolId: string) => void;
  onToggleProjectTool: (projectId: string, toolId: string) => void;
  onUpdateProject: (id: string, patch: { aiUrl?: string }) => void;
  onAddSubTask: (projectId: string, title: string) => void;
  settings: Settings;
  onAddTasksToProject: (projectId: string | null, titles: string[]) => void;
};

// ── 나무 성장 단계 컴포넌트
function TreeIcon({ pct, completed }: { pct: number; completed: boolean }) {
  const stage = treeStage(pct, completed);
  return (
    <span
      className="text-2xl leading-none"
      title={`${stage.label} (${Math.round(pct)}%)`}
    >
      {stage.icon}
    </span>
  );
}

// ── 나무(프로젝트) 카드
function ProjectCard({
  p,
  childTasks,
  rewardXp,
  farms,
  availableTools,
  onToggle,
  onDelete,
  onUnassign,
  onMoveToFarm,
  onToggleProjectTool,
  onUpdateProject,
  onAddSubTask,
  settings,
  onAddTasksToProject,
}: {
  p: Project;
  childTasks: Task[];
  rewardXp: number;
  farms: Farm[];
  availableTools: Tool[];
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onUnassign: (taskId: string) => void;
  onMoveToFarm: (farmId: string | null) => void;
  onToggleProjectTool: (toolId: string) => void;
  onUpdateProject: (patch: { aiUrl?: string }) => void;
  onAddSubTask: (projectId: string, title: string) => void;
  settings: Settings;
  onAddTasksToProject: (projectId: string | null, titles: string[]) => void;
}) {
  const sortable = useSortable({ id: p.id, data: { type: "project", project: p } });
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = sortable;
  const droppable = useDroppable({
    id: `project-drop-${p.id}`,
    data: { type: "project-drop", projectId: p.id },
  });
  const [showMoveMenu, setShowMoveMenu] = useState(false);
  const [showProjectPicker, setShowProjectPicker] = useState(false);
  const [editingAiUrl, setEditingAiUrl] = useState(false);
  const [aiUrlInput, setAiUrlInput] = useState(p.aiUrl ?? "");
  const [showAiChat, setShowAiChat] = useState(false);
  const [showSubTaskAdd, setShowSubTaskAdd] = useState(false);
  const [subTaskTitle, setSubTaskTitle] = useState("");

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const completedCount = childTasks.filter((t) => t.completed).length;
  const total = childTasks.length;
  const pct = total === 0 ? 0 : (completedCount / total) * 100;

  return (
    <div
      id={`project-${p.id}`}
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
          {/* 드래그 핸들 */}
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-primary p-1 -ml-1 mt-1 touch-none"
            aria-label="드래그"
          >
            <GripVertical className="size-4" />
          </button>

          {/* 나무 아이콘 (완료 토글) */}
          <button
            onClick={() => onToggle(p.id)}
            className="mt-0.5 size-10 rounded-xl border-2 flex items-center justify-center transition-all shrink-0 border-accent/30 hover:border-primary bg-card/60"
            aria-label="완료 토글"
          >
            {p.completed
              ? <Check className="size-5 text-primary" strokeWidth={3} />
              : <TreeIcon pct={pct} completed={false} />
            }
          </button>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`font-bold ${p.completed ? "line-through text-muted-foreground" : ""}`}>
                {p.title}
              </span>
              {p.dueDate && (
                <span className="text-[10px] text-muted-foreground inline-flex items-center gap-1">
                  <CalendarDays className="size-3" /> {p.dueDate}
                </span>
              )}
              {/* 소속 농장 뱃지 */}
              {p.farmId && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  {farms.find(f => f.id === p.farmId)?.icon ?? "🌾"}{" "}
                  {farms.find(f => f.id === p.farmId)?.title ?? "농장"}
                </span>
              )}
            </div>

            {p.description && (
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{p.description}</p>
            )}
            {!p.completed && total > 0 && (
              <div className="text-[11px] text-primary/60 mt-1.5 flex items-center gap-1">
                <Sparkles className="size-3" />
                프로젝트 완료 시 즉시 레벨업 🏆
              </div>
            )}

            {/* 서브태스크 진행도 */}
            {total > 0 && (
              <div className="mt-3">
                <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                  <span>서브 임무 진행도</span>
                  <span className="tabular-nums font-bold text-primary">{completedCount}/{total}</span>
                </div>
                <div className="h-1.5 rounded-full bg-black/40 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-accent to-primary transition-all"
                    style={{ width: `${pct}%` }}
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
                        onClick={(e) => { e.stopPropagation(); onUnassign(c.id); }}
                        className="opacity-0 group-hover/chip:opacity-100 hover:text-destructive transition-opacity"
                      >
                        <X className="size-2.5" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {!p.completed && total === 0 && !showSubTaskAdd && (
              <p className="mt-2 text-[10px] text-muted-foreground/50 italic text-center">
                위 + 버튼으로 할일 추가, 또는 끌어다 놓기
              </p>
            )}
          </div>

          {/* 액션 버튼들 */}
          <div className="flex items-center gap-1 shrink-0">
            {/* 할일 추가 — 항상 보임 */}
            {!p.completed && (
              <button
                onClick={() => { setShowSubTaskAdd((v) => !v); setSubTaskTitle(""); }}
                className={`p-1.5 rounded-lg transition text-sm font-bold ${showSubTaskAdd ? "bg-accent/20 text-accent" : "bg-accent/10 text-accent hover:bg-accent/20"}`}
                title="할일 추가"
                aria-label="할일 추가"
              >
                <Plus className="size-4" />
              </button>
            )}
          </div>
          {/* 나머지 액션 버튼들 (hover 시) */}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            {/* AI 채팅 버튼 */}
            {(settings.aiChatEnabled ?? true) && (
              <button
                onClick={() => setShowAiChat((v) => !v)}
                className={`p-1.5 rounded-lg hover:bg-white/5 transition ${showAiChat ? "text-primary" : "text-muted-foreground hover:text-primary"}`}
                title="AI와 대화"
              >
                <MessageCircle className="size-3.5" />
              </button>
            )}
            {/* AI URL */}
            <div className="relative">
              {p.aiUrl ? (
                <>
                  <a
                    href={p.aiUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded-lg hover:bg-white/5 text-primary hover:text-primary/80 transition inline-flex"
                    title="AI 열기"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Link2 className="size-3.5" />
                  </a>
                  <button
                    onClick={() => { setEditingAiUrl((v) => !v); setAiUrlInput(p.aiUrl ?? ""); }}
                    className="p-1.5 rounded-lg hover:bg-white/5 text-muted-foreground hover:text-primary transition"
                    title="AI URL 수정"
                  >
                    <Pencil className="size-3.5" />
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setEditingAiUrl((v) => !v)}
                  className="p-1.5 rounded-lg hover:bg-white/5 text-muted-foreground hover:text-primary transition"
                  title="AI URL 연결"
                >
                  <Link2 className="size-3.5" />
                </button>
              )}
            </div>
            {/* 도구 연결 */}
            <button
              onClick={() => setShowProjectPicker((v) => !v)}
              className="p-1.5 rounded-lg hover:bg-white/5 text-muted-foreground hover:text-primary transition"
              title="도구 연결"
            >
              <Plus className="size-3.5" />
            </button>
            {/* 농장으로 이동 */}
            {farms.length > 0 && (
              <div className="relative">
                <button
                  onClick={() => setShowMoveMenu(v => !v)}
                  className="p-1.5 rounded-lg hover:bg-white/5 text-muted-foreground hover:text-primary transition"
                  title="농장으로 이동"
                >
                  <MoveRight className="size-3.5" />
                </button>
                {showMoveMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowMoveMenu(false)} />
                    <div className="absolute right-0 top-full mt-1 z-50 w-44 rounded-xl border border-white/10 bg-card shadow-xl overflow-hidden">
                      <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground border-b border-white/5">
                        농장 선택
                      </div>
                      {p.farmId && (
                        <button
                          onClick={() => { onMoveToFarm(null); setShowMoveMenu(false); }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-white/5 text-muted-foreground"
                        >
                          🌱 독립 나무로
                        </button>
                      )}
                      {farms.map(f => (
                        <button
                          key={f.id}
                          onClick={() => { onMoveToFarm(f.id); setShowMoveMenu(false); }}
                          className={`w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-white/5 ${
                            p.farmId === f.id ? "text-primary bg-white/5" : "text-foreground"
                          }`}
                        >
                          {f.icon} {f.title}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
            <button
              onClick={() => onDelete(p.id)}
              className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition"
              aria-label="삭제"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        </div>

        {/* AI URL 인라인 입력 */}
        {editingAiUrl && (
          <div className="mt-3 flex items-center gap-2">
            <input
              autoFocus
              type="url"
              value={aiUrlInput}
              onChange={(e) => setAiUrlInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  onUpdateProject({ aiUrl: aiUrlInput.trim() || undefined });
                  setEditingAiUrl(false);
                }
                if (e.key === "Escape") setEditingAiUrl(false);
              }}
              placeholder="https://notebooklm.google.com/..."
              className="flex-1 px-3 py-1.5 rounded-lg bg-input/40 border border-white/10 text-xs focus:border-primary/40 focus:outline-none"
            />
            <button
              onClick={() => { onUpdateProject({ aiUrl: aiUrlInput.trim() || undefined }); setEditingAiUrl(false); }}
              className="px-2 py-1.5 rounded-lg bg-primary/15 border border-primary/40 text-primary text-xs font-semibold hover:bg-primary/25 transition"
            >
              저장
            </button>
            <button
              onClick={() => setEditingAiUrl(false)}
              className="px-2 py-1.5 rounded-lg text-muted-foreground text-xs"
            >
              취소
            </button>
          </div>
        )}

        {/* 도구 바 */}
        {((p.toolIds ?? []).length > 0 || showProjectPicker) && (
          <div className="mt-3 relative">
            <ToolChipBar
              availableTools={availableTools}
              toolIds={p.toolIds ?? []}
              onRemove={onToggleProjectTool}
              onAdd={() => setShowProjectPicker((v) => !v)}
            />
            {showProjectPicker && (
              <ToolPicker
                availableTools={availableTools}
                selectedIds={p.toolIds ?? []}
                onToggle={onToggleProjectTool}
                onClose={() => setShowProjectPicker(false)}
              />
            )}
          </div>
        )}

        {/* 서브 할일 직접 추가 */}
        {showSubTaskAdd && (
          <form
            className="mt-3 flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const t = subTaskTitle.trim();
              if (!t) return;
              onAddSubTask(p.id, t);
              setSubTaskTitle("");
              setShowSubTaskAdd(false);
            }}
          >
            <input
              autoFocus
              value={subTaskTitle}
              onChange={(e) => setSubTaskTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Escape") { setShowSubTaskAdd(false); setSubTaskTitle(""); } }}
              placeholder="할일 입력..."
              className="flex-1 px-3 py-1.5 rounded-lg bg-input/40 border border-accent/20 text-xs focus:border-accent/50 focus:outline-none"
            />
            <button
              type="submit"
              className="px-3 py-1.5 rounded-lg bg-accent/15 border border-accent/30 text-accent text-xs font-semibold hover:bg-accent/25 transition"
            >
              추가
            </button>
            <button
              type="button"
              onClick={() => { setShowSubTaskAdd(false); setSubTaskTitle(""); }}
              className="px-2 py-1.5 rounded-lg text-muted-foreground text-xs"
            >
              취소
            </button>
          </form>
        )}

        {/* AI 채팅 패널 */}
        {showAiChat && (
          <div className="mt-3">
            <AiChatPanel
              initialContext={buildProjectContext(p, childTasks)}
              settings={settings}
              onAddTasks={(titles) => onAddTasksToProject(p.id, titles)}
              onClose={() => setShowAiChat(false)}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ── 농장 카드 (나무들을 담는 컨테이너)
// 테스트 노출용 export — 외부 사용 금지, 다른 모듈에서 import하지 말 것
export function FarmCard({
  farm,
  trees,
  tasks,
  rewardXp,
  allFarms,
  availableTools,
  onToggleProject,
  onDeleteProject,
  onDeleteFarm,
  onUpdateFarm,
  onToggleFarmTool,
  onUnassign,
  onMoveProjectToFarm,
  onAddTree,
  onAddSubTask,
  onToggleProjectTool,
  onUpdateProject,
  settings,
  onAddTasksToProject,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
}: {
  farm: Farm;
  trees: Project[];
  tasks: Task[];
  rewardXp: number;
  allFarms: Farm[];
  availableTools: Tool[];
  onToggleProject: (id: string) => void;
  onDeleteProject: (id: string) => void;
  onDeleteFarm: (id: string) => void;
  onUpdateFarm: (id: string, patch: { title?: string; icon?: string; aiUrl?: string; toolIds?: string[] }) => void;
  onToggleFarmTool: (toolId: string) => void;
  onUnassign: (taskId: string) => void;
  onMoveProjectToFarm: (projectId: string, farmId: string | null) => void;
  onAddTree: (farmId: string, title: string) => void;
  onAddSubTask: (projectId: string, title: string) => void;
  onToggleProjectTool: (projectId: string, toolId: string) => void;
  onUpdateProject: (id: string, patch: { aiUrl?: string }) => void;
  settings: Settings;
  onAddTasksToProject: (projectId: string | null, titles: string[]) => void;
  isFirst: boolean;
  isLast: boolean;
  onMoveUp: (farmId: string) => void;
  onMoveDown: (farmId: string) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(farm.title);
  const [editIcon, setEditIcon] = useState(farm.icon ?? "🌾");
  const [editAiUrl, setEditAiUrl] = useState(farm.aiUrl ?? "");
  const [showFarmPicker, setShowFarmPicker] = useState(false);
  const [showAiChat, setShowAiChat] = useState(false);
  const [showInlineAdd, setShowInlineAdd] = useState(false);
  const [inlineTitle, setInlineTitle] = useState("");

  // 농장 성장 계산
  const treeStats = trees.map(p => {
    const childTasks = tasks.filter(t => t.projectId === p.id);
    const total = childTasks.length;
    const done = childTasks.filter(t => t.completed).length;
    return total === 0 ? (p.completed ? 100 : 0) : (done / total) * 100;
  });
  const avgPct = treeStats.length === 0 ? 0 : treeStats.reduce((a, b) => a + b, 0) / treeStats.length;
  const stage = farmStage(trees.length, avgPct);

  return (
    <div id={`farm-${farm.id}`} className="rounded-3xl border border-emerald-500/20 bg-emerald-950/20 overflow-hidden">
      {/* 농장 헤더 */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-emerald-500/10">
        <button
          onClick={() => setCollapsed(v => !v)}
          className="text-muted-foreground hover:text-foreground transition"
        >
          {collapsed ? <ChevronRight className="size-4" /> : <ChevronDown className="size-4" />}
        </button>

        <span className="text-2xl leading-none">{stage.icon}</span>

        {editing ? (
          <form
            className="flex items-center gap-2 flex-1"
            onSubmit={(e) => {
              e.preventDefault();
              onUpdateFarm(farm.id, { title: editTitle, icon: editIcon, aiUrl: editAiUrl.trim() || undefined });
              setEditing(false);
            }}
          >
            <input
              value={editIcon}
              onChange={e => setEditIcon(e.target.value)}
              className="w-10 bg-input/40 border border-white/10 rounded-lg text-center text-sm py-1"
              placeholder="🌾"
            />
            <input
              value={editTitle}
              onChange={e => setEditTitle(e.target.value)}
              className="flex-1 bg-input/40 border border-white/10 rounded-lg px-2 py-1 text-sm"
              autoFocus
            />
            <input
              value={editAiUrl}
              onChange={(e) => setEditAiUrl(e.target.value)}
              placeholder="AI URL (NotebookLM, ChatGPT 등, 선택)"
              className="flex-1 bg-input/40 border border-white/10 rounded-lg px-2 py-1 text-sm mt-1"
              type="url"
            />
            <button type="submit" className="text-xs text-primary font-semibold px-2">저장</button>
            <button type="button" onClick={() => setEditing(false)} className="text-xs text-muted-foreground px-1">취소</button>
          </form>
        ) : (
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-emerald-300">{farm.title}</h3>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                {stage.label}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              나무 {trees.length}그루 · 평균 {Math.round(avgPct)}% 완료
            </p>
          </div>
        )}

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            aria-label="농장 위로 이동"
            disabled={isFirst}
            onClick={(e) => { e.stopPropagation(); onMoveUp(farm.id); }}
            className="p-1.5 rounded-lg hover:bg-white/5 text-muted-foreground hover:text-primary transition disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
            title="농장 위로 이동"
          >
            <ChevronUp className="size-3.5" />
          </button>
          <button
            type="button"
            aria-label="농장 아래로 이동"
            disabled={isLast}
            onClick={(e) => { e.stopPropagation(); onMoveDown(farm.id); }}
            className="p-1.5 rounded-lg hover:bg-white/5 text-muted-foreground hover:text-primary transition disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
            title="농장 아래로 이동"
          >
            <ChevronDown className="size-3.5" />
          </button>
          {(settings.aiChatEnabled ?? true) && (
            <button
              onClick={(e) => { e.stopPropagation(); setShowAiChat((v) => !v); }}
              className={`p-1.5 rounded-lg hover:bg-white/5 transition ${showAiChat ? "text-primary" : "text-muted-foreground hover:text-primary"}`}
              title="AI와 대화"
            >
              <MessageCircle className="size-3.5" />
            </button>
          )}
          {farm.aiUrl && (
            <a
              href={farm.aiUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 rounded-lg hover:bg-white/5 text-emerald-400 hover:text-emerald-300 transition"
              title="AI 열기"
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink className="size-3.5" />
            </a>
          )}
          <button
            onClick={() => setEditing(v => !v)}
            className="p-1.5 rounded-lg hover:bg-white/5 text-muted-foreground hover:text-primary transition"
            title="농장 수정"
          >
            <Pencil className="size-3.5" />
          </button>
          <button
            onClick={() => { setShowInlineAdd(v => !v); setInlineTitle(""); }}
            className="p-1.5 rounded-lg hover:bg-emerald-500/10 text-muted-foreground hover:text-emerald-400 transition"
            title="이 농장에 나무 추가"
          >
            <Plus className="size-3.5" />
          </button>
          <button
            onClick={() => onDeleteFarm(farm.id)}
            className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition"
            title="농장 삭제"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>

      {/* 도구 바 */}
      <div className="px-5 py-2 border-b border-emerald-500/10 relative">
        <ToolChipBar
          availableTools={availableTools}
          toolIds={farm.toolIds ?? []}
          onRemove={(toolId) => onToggleFarmTool(toolId)}
          onAdd={() => setShowFarmPicker((v) => !v)}
        />
        {showFarmPicker && (
          <ToolPicker
            availableTools={availableTools}
            selectedIds={farm.toolIds ?? []}
            onToggle={(toolId) => onToggleFarmTool(toolId)}
            onClose={() => setShowFarmPicker(false)}
          />
        )}
      </div>

      {/* 인라인 나무 추가 폼 */}
      {showInlineAdd && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const t = inlineTitle.trim();
            if (!t) return;
            onAddTree(farm.id, t);
            setInlineTitle("");
            setShowInlineAdd(false);
          }}
          className="px-4 py-3 border-b border-emerald-500/10 flex items-center gap-2"
        >
          <input
            autoFocus
            value={inlineTitle}
            onChange={(e) => setInlineTitle(e.target.value)}
            placeholder="나무 이름 입력..."
            className="flex-1 bg-input/40 border border-emerald-500/20 rounded-lg px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
            onKeyDown={(e) => { if (e.key === "Escape") { setShowInlineAdd(false); setInlineTitle(""); } }}
          />
          <button
            type="submit"
            className="px-3 py-2 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-semibold hover:bg-emerald-500/30 transition"
          >
            심기 🌱
          </button>
          <button
            type="button"
            onClick={() => { setShowInlineAdd(false); setInlineTitle(""); }}
            className="px-2 py-2 rounded-lg text-muted-foreground text-xs hover:bg-white/5 transition"
          >
            취소
          </button>
        </form>
      )}

      {/* AI 채팅 패널 */}
      {showAiChat && (
        <div className="px-4 py-3 border-b border-emerald-500/10">
          <AiChatPanel
            initialContext={buildFarmContext(farm, trees, tasks)}
            settings={settings}
            onAddTasks={(titles) => onAddTasksToProject(null, titles)}
            onClose={() => setShowAiChat(false)}
          />
        </div>
      )}

      {/* 나무 목록 */}
      {!collapsed && (
        <div className="p-4 space-y-2.5">
          {trees.length === 0 ? (
            <p className="text-center text-muted-foreground text-sm py-6">
              아직 나무가 없어요. 프로젝트를 이 농장으로 옮기거나{" "}
              <button
                onClick={() => { setShowInlineAdd(true); setInlineTitle(""); }}
                className="text-emerald-400 underline underline-offset-2"
              >
                새 나무를 심어보세요
              </button>
            </p>
          ) : (
            <SortableContext items={trees.map(p => p.id)} strategy={verticalListSortingStrategy}>
              {trees.map(p => (
                <ProjectCard
                  key={p.id}
                  p={p}
                  childTasks={tasks.filter(t => t.projectId === p.id)}
                  rewardXp={rewardXp}
                  farms={allFarms}
                  availableTools={availableTools}
                  onToggle={onToggleProject}
                  onDelete={onDeleteProject}
                  onUnassign={onUnassign}
                  onMoveToFarm={(farmId) => onMoveProjectToFarm(p.id, farmId)}
                  onToggleProjectTool={(toolId) => onToggleProjectTool(p.id, toolId)}
                  onUpdateProject={(patch) => onUpdateProject(p.id, patch)}
                  onAddSubTask={onAddSubTask}
                  settings={settings}
                  onAddTasksToProject={onAddTasksToProject}
                />
              ))}
            </SortableContext>
          )}
        </div>
      )}
    </div>
  );
}

// ── 메인 컴포넌트
export function ProjectList({
  projects,
  farms,
  tasks,
  totalXp,
  availableTools,
  onAdd,
  onToggle,
  onDelete,
  onReorder,
  onAssignTask,
  onAddFarm,
  onDeleteFarm,
  onUpdateFarm,
  onMoveProjectToFarm,
  onToggleFarmTool,
  onToggleProjectTool,
  onUpdateProject,
  settings,
  onAddTasksToProject,
  onAddSubTask,
}: Props) {
  const [showAddProject, setShowAddProject] = useState(false);
  const [addingToFarmId, setAddingToFarmId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");

  const [showAddFarm, setShowAddFarm] = useState(false);
  const [farmTitle, setFarmTitle] = useState("");
  const [farmIcon, setFarmIcon] = useState("🌾");

  void onReorder;

  const { level, currentXp, nextXp } = levelFromXp(totalXp);
  const rewardXp = Math.max(1, nextXp - currentXp);

  // 독립 나무 (농장 없는 프로젝트)
  const standaloneTrees = projects
    .filter(p => !p.farmId)
    .sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      return (a.order ?? 0) - (b.order ?? 0);
    });

  const sortedFarms = [...farms].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const submitProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onAdd(title.trim(), description.trim() || undefined, dueDate || undefined, addingToFarmId);
    setTitle(""); setDescription(""); setDueDate("");
    setShowAddProject(false); setAddingToFarmId(null);
  };

  return (
    <section className="space-y-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-2xl bg-gradient-bloom flex items-center justify-center shadow-bloom">
            <Trophy className="size-5 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-semibold flex items-center gap-2">
              나무 & 농장
              <span className="text-muted-foreground font-normal text-sm">
                {projects.length}그루 · {farms.length}농장
              </span>
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
              <Sparkles className="size-3 text-primary" />
              나무 완료 → <span className="text-primary font-bold">Lv.{level + 1}</span> 즉시 레벨업
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowAddFarm(v => !v)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-semibold transition"
          >
            <Plus className="size-3.5" /> 농장 만들기
          </button>
          <button
            type="button"
            onClick={() => { setAddingToFarmId(null); setShowAddProject(v => !v); }}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-primary/30 bg-primary/10 hover:bg-primary/20 text-primary text-xs font-semibold transition"
          >
            <Plus className="size-3.5" /> 나무 심기
          </button>
        </div>
      </div>

      {/* 농장 추가 폼 */}
      {showAddFarm && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!farmTitle.trim()) return;
            onAddFarm(farmTitle.trim(), farmIcon);
            setFarmTitle(""); setFarmIcon("🌾"); setShowAddFarm(false);
          }}
          className="bg-emerald-950/30 border border-emerald-500/20 rounded-2xl p-4 space-y-3"
        >
          <div className="flex items-center gap-2">
            <input
              value={farmIcon}
              onChange={e => setFarmIcon(e.target.value)}
              className="w-12 bg-input/40 border border-white/10 rounded-lg text-center text-lg py-2"
              placeholder="🌾"
              maxLength={2}
            />
            <input
              value={farmTitle}
              onChange={e => setFarmTitle(e.target.value)}
              placeholder="농장 이름 (예: 내 앱 개발)"
              className="flex-1 bg-transparent border-b border-white/10 focus:border-emerald-400 outline-none px-2 py-2 text-sm font-medium"
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowAddFarm(false)} className="px-3 py-2 rounded-lg text-xs text-muted-foreground">취소</button>
            <button type="submit" className="px-4 py-2 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">농장 만들기</button>
          </div>
        </form>
      )}

      {/* 프로젝트(나무) 추가 폼 */}
      {showAddProject && (
        <form
          onSubmit={submitProject}
          className="bg-card/70 border border-white/10 rounded-2xl p-4 space-y-3"
        >
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="나무 이름 (프로젝트)"
            className="w-full bg-transparent border-b border-white/10 focus:border-primary outline-none px-2 py-2 text-sm font-medium"
            autoFocus
          />
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="설명 (선택)"
            rows={2}
            className="w-full bg-input/40 rounded-lg px-3 py-2 text-sm border border-white/10 outline-none focus:border-primary/40 resize-none"
          />
          <div className="flex items-center gap-2 flex-wrap">
            <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
              <CalendarDays className="size-3.5" /> 마감
              <input
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                className="bg-input/40 rounded-lg px-2 py-1.5 text-xs border border-white/10"
              />
            </label>
            <div className="flex-1" />
            <button type="button" onClick={() => setShowAddProject(false)} className="px-3 py-2 rounded-lg text-xs text-muted-foreground">취소</button>
            <button type="submit" className="bg-gradient-bloom rounded-lg px-4 py-2 text-xs font-semibold hover:shadow-bloom transition-shadow">심기 🌱</button>
          </div>
        </form>
      )}

      {/* 농장들 */}
      {sortedFarms.map((farm, idx) => (
        <FarmCard
          key={farm.id}
          farm={farm}
          trees={projects.filter(p => p.farmId === farm.id).sort((a, b) => (a.order ?? 0) - (b.order ?? 0))}
          tasks={tasks}
          rewardXp={rewardXp}
          allFarms={farms}
          availableTools={availableTools}
          onToggleProject={onToggle}
          onDeleteProject={onDelete}
          onDeleteFarm={onDeleteFarm}
          onUpdateFarm={onUpdateFarm}
          onToggleFarmTool={(toolId) => onToggleFarmTool(farm.id, toolId)}
          onUnassign={(taskId) => onAssignTask(taskId, null)}
          onMoveProjectToFarm={onMoveProjectToFarm}
          onAddTree={(farmId, title) => onAdd(title, undefined, undefined, farmId)}
          onAddSubTask={onAddSubTask}
          onToggleProjectTool={onToggleProjectTool}
          onUpdateProject={onUpdateProject}
          settings={settings}
          onAddTasksToProject={onAddTasksToProject}
          isFirst={idx === 0}
          isLast={idx === sortedFarms.length - 1}
          onMoveUp={() => {}}
          onMoveDown={() => {}}
        />
      ))}

      {/* 독립 나무들 */}
      {standaloneTrees.length > 0 && (
        <div className="rounded-3xl border border-accent/20 bg-card/40 p-5 space-y-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <span>🌱</span>
            <span>독립 나무 ({standaloneTrees.length}그루)</span>
            <span className="text-[10px]">— 농장으로 옮겨 함께 키울 수 있어요</span>
          </div>
          <SortableContext items={standaloneTrees.map(p => p.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2.5">
              {standaloneTrees.map(p => (
                <ProjectCard
                  key={p.id}
                  p={p}
                  childTasks={tasks.filter(t => t.projectId === p.id)}
                  rewardXp={rewardXp}
                  farms={farms}
                  availableTools={availableTools}
                  onToggle={onToggle}
                  onDelete={onDelete}
                  onUnassign={(taskId) => onAssignTask(taskId, null)}
                  onMoveToFarm={(farmId) => onMoveProjectToFarm(p.id, farmId)}
                  onToggleProjectTool={(toolId) => onToggleProjectTool(p.id, toolId)}
                  onUpdateProject={(patch) => onUpdateProject(p.id, patch)}
                  onAddSubTask={onAddSubTask}
                  settings={settings}
                  onAddTasksToProject={onAddTasksToProject}
                />
              ))}
            </div>
          </SortableContext>
        </div>
      )}

      {/* 빈 상태 */}
      {projects.length === 0 && farms.length === 0 && (
        <div className="rounded-3xl border border-dashed border-white/10 p-10 text-center space-y-3">
          <p className="text-4xl">🌱</p>
          <p className="text-muted-foreground text-sm">아직 아무것도 없어요.</p>
          <p className="text-muted-foreground/60 text-xs">나무를 심거나 농장을 만들어보세요.</p>
        </div>
      )}
    </section>
  );
}
