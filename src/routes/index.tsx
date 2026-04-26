import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useGarden, todayStr, filterTasksByCondition, CONDITION_META } from "@/lib/garden-store";
import { useToolsSheet } from "@/lib/tools-sheet";
import type { ConditionMode } from "@/lib/garden-store";
import { useReminders, requestNotificationPermission } from "@/lib/notifications";
import { Avatar } from "@/components/garden/Avatar";
import { TaskList } from "@/components/garden/TaskList";
import { ProjectList } from "@/components/garden/ProjectList";
import { QuestPanel } from "@/components/garden/QuestPanel";
import { AchievementCodex } from "@/components/garden/AchievementCodex";
import { SidePanels } from "@/components/garden/SidePanels";
import { ConditionSelector } from "@/components/garden/ConditionSelector";
import { AiSidePanel } from "@/components/AiSidePanel";
import { PledgeBoard } from "@/components/PledgeBoard";
import { Settings as SettingsIcon, BarChart3, Bell, BellOff, Wrench, Sparkles } from "lucide-react";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "루미 가든 — 게이미피케이션 일정 관리" },
      {
        name: "description",
        content:
          "할일을 자주 까먹는 당신을 위한 정원형 RPG 투두 앱. 레벨, 콤보, 보스, 업적으로 매일을 가꾸세요.",
      },
      { property: "og:title", content: "루미 가든 — RPG 투두" },
      {
        property: "og:description",
        content: "보라빛 밤의 정원에서 캐릭터를 키우고 보상을 수확하세요.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const {
    state,
    hydrated,
    todayCondition,
    setCondition,
    addTask,
    toggleTask,
    deleteTask,
    postponeTask,
    reorderTasks,
    assignTaskToProject,
    setNotifications,
    addProject,
    toggleProject,
    deleteProject,
    reorderProjects,
    addFarm,
    deleteFarm,
    updateFarm,
    moveProjectToFarm,
    toggleFarmTool,
    toggleProjectTool,
    updateProject,
    setPledge,
  } = useGarden();
  const { tools: sheetTools } = useToolsSheet(state.settings.toolsSheetUrl ?? "");
  const availableTools = useMemo(() => [...(state.localTools ?? []), ...sheetTools], [state.localTools, sheetTools]);
  const today = todayStr();
  const todaysTasks = state.tasks.filter((t) => t.date === today);
  const standalone = todaysTasks.filter((t) => !t.projectId);
  const todayPendingTasks = todaysTasks.filter((t) => !t.completed);
  const [showAiPanel, setShowAiPanel] = useState(false);

  // 컨디션 필터 적용
  const visibleStandalone = todayCondition
    ? filterTasksByCondition(standalone, todayCondition)
    : standalone;

  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  useReminders(state.tasks, state.settings, state.notificationsEnabled && hydrated);

  const handleToggleNotifications = async () => {
    if (state.notificationsEnabled) {
      setNotifications(false);
      return;
    }
    const ok = await requestNotificationPermission();
    setNotifications(ok);
    if (ok) {
      new Notification("🌸 루미 가든", { body: "이제 할일 알림을 받을 수 있어요." });
    } else {
      alert("브라우저 알림 권한이 거부되었어요. 브라우저 설정에서 허용해주세요.");
    }
  };

  const handleDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;

    const activeData = active.data.current as { type?: string } | undefined;
    const overData = over.data.current as { type?: string; projectId?: string } | undefined;

    // Task → Project drop
    if (activeData?.type === "task" && overData?.type === "project-drop" && overData.projectId) {
      assignTaskToProject(String(active.id), overData.projectId);
      return;
    }

    // Task → Task reorder (within standalone list)
    if (activeData?.type === "task" && overData?.type === "task") {
      const ids = standalone
        .slice()
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .map((t) => t.id);
      const oldIdx = ids.indexOf(String(active.id));
      const newIdx = ids.indexOf(String(over.id));
      if (oldIdx !== -1 && newIdx !== -1 && oldIdx !== newIdx) {
        reorderTasks(arrayMove(ids, oldIdx, newIdx));
      }
      return;
    }

    // Project reorder
    if (activeData?.type === "project" && overData?.type === "project") {
      const ids = state.projects
        .slice()
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .map((p) => p.id);
      const oldIdx = ids.indexOf(String(active.id));
      const newIdx = ids.indexOf(String(over.id));
      if (oldIdx !== -1 && newIdx !== -1 && oldIdx !== newIdx) {
        reorderProjects(arrayMove(ids, oldIdx, newIdx));
      }
    }
  };

  const handleAddTasksToProject = (_projectId: string | null, titles: string[]) => {
    for (const title of titles) {
      addTask(title, "09:00", "medium", "flex");
    }
  };

  if (!hydrated) {
    return <div className="min-h-dvh" />;
  }

  return (
    <div className="min-h-dvh px-4 py-6 md:px-10 md:py-10">
      {/* 컨디션 미선택 시 오버레이 */}
      {!todayCondition && (
        <ConditionSelector
          onSelect={setCondition}
          settings={state.settings}
          pendingTasks={todayPendingTasks}
        />
      )}

      <AiSidePanel
        open={showAiPanel}
        onClose={() => setShowAiPanel(false)}
        projects={state.projects}
        tasks={state.tasks}
        settings={state.settings}
        onAddTasksToProject={handleAddTasksToProject}
      />

      <div className="max-w-7xl mx-auto space-y-6">
        {/* Game HUD top bar */}
        <header className="flex items-center justify-between gap-4 border-b border-white/5 pb-4">
          <div>
            <h1 className="font-display text-2xl md:text-3xl text-gradient-gold leading-none">
              루미 가든 RPG
            </h1>
            <p className="text-[11px] text-muted-foreground mt-1 uppercase tracking-widest">
              밤의 정원사 길드
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* 컨디션 칩 — 현재 상태 표시 + 클릭 시 변경 */}
            {todayCondition && (
              <ConditionChip
                condition={todayCondition}
                onChange={setCondition}
              />
            )}
            <button
              onClick={handleToggleNotifications}
              className="size-10 rounded-xl bg-card/60 border border-white/10 hover:border-primary/40 transition flex items-center justify-center"
              aria-label="알림"
            >
              {state.notificationsEnabled ? (
                <Bell className="size-4 text-primary" />
              ) : (
                <BellOff className="size-4 text-muted-foreground" />
              )}
            </button>
            <Link
              to="/tools"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-white/10 bg-card/60 hover:border-primary/40 text-xs font-medium text-muted-foreground hover:text-primary transition"
            >
              <Wrench className="size-3.5" /> <span className="hidden sm:inline">도구</span>
            </Link>
            <Link
              to="/review"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-white/10 bg-card/60 hover:border-primary/40 text-xs font-medium text-muted-foreground hover:text-primary transition"
            >
              <BarChart3 className="size-3.5" /> <span className="hidden sm:inline">주간 회고</span>
            </Link>
            {(state.settings.aiChatEnabled ?? true) && (
              <button
                onClick={() => setShowAiPanel(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-white/10 bg-card/60 hover:border-primary/40 text-xs font-medium text-muted-foreground hover:text-primary transition"
                title="AI 어시스턴트"
              >
                <Sparkles className="size-3.5" /> <span className="hidden sm:inline">AI</span>
              </button>
            )}
            <Link
              to="/settings"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-white/10 bg-card/60 hover:border-primary/40 text-xs font-medium text-muted-foreground hover:text-primary transition"
            >
              <SettingsIcon className="size-3.5" /> <span className="hidden sm:inline">설정</span>
            </Link>
          </div>
        </header>

        {/* 각오 보드 */}
        <PledgeBoard pledges={state.pledges ?? []} onSet={setPledge} />

        {/* Avatar HUD */}
        <Avatar
          totalXp={state.totalXp}
          xp={state.xp}
          combo={state.combo}
          streak={state.streak}
        />

        {/* Main grid */}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <main className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">
            <div className="space-y-6 min-w-0">
              <ProjectList
                projects={state.projects}
                farms={state.farms}
                tasks={state.tasks}
                totalXp={state.totalXp}
                availableTools={availableTools}
                onAdd={addProject}
                onToggle={toggleProject}
                onDelete={deleteProject}
                onReorder={reorderProjects}
                onAssignTask={assignTaskToProject}
                onAddFarm={addFarm}
                onDeleteFarm={deleteFarm}
                onUpdateFarm={updateFarm}
                onMoveProjectToFarm={moveProjectToFarm}
                onToggleFarmTool={toggleFarmTool}
                onToggleProjectTool={toggleProjectTool}
                onUpdateProject={updateProject}
                settings={state.settings}
                onAddTasksToProject={handleAddTasksToProject}
              />
              <TaskList
                tasks={visibleStandalone}
                onToggle={toggleTask}
                onDelete={deleteTask}
                onPostpone={postponeTask}
                onAdd={addTask}
                onReorder={reorderTasks}
              />
            </div>
            <aside className="space-y-6">
              <QuestPanel tasks={todaysTasks} projects={state.projects} combo={state.combo} />
              <SidePanels tasks={todaysTasks} streak={state.streak} totalXp={state.totalXp} />
              <AchievementCodex unlocked={state.achievements} />
            </aside>
          </main>
        </DndContext>

        <footer className="text-center text-xs text-muted-foreground pt-6 border-t border-white/5">
          매일 <span className="text-primary">{state.settings.morningTime}</span>와{" "}
          <span className="text-primary">{state.settings.eveningTime}</span>에 정원이 당신을 부릅니다.
        </footer>
      </div>
    </div>
  );
}

// 헤더 컨디션 칩: 클릭하면 드롭다운으로 변경 가능
function ConditionChip({
  condition,
  onChange,
}: {
  condition: ConditionMode;
  onChange: (m: ConditionMode) => void;
}) {
  const [open, setOpen] = useState(false);
  const meta = CONDITION_META[condition];
  const ALL: ConditionMode[] = ["best", "normal", "low", "sick"];

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-white/10 bg-card/60 hover:border-primary/40 text-xs font-medium transition"
      >
        <span>{meta.icon}</span>
        <span className={meta.color}>{meta.label}</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-50 w-44 rounded-xl border border-white/10 bg-card shadow-xl overflow-hidden">
            {ALL.map((m) => {
              const cm = CONDITION_META[m];
              return (
                <button
                  key={m}
                  onClick={() => { onChange(m); setOpen(false); }}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 text-xs hover:bg-white/5 transition text-left ${m === condition ? "bg-white/5" : ""}`}
                >
                  <span>{cm.icon}</span>
                  <div>
                    <p className={`font-medium ${cm.color}`}>{cm.label}</p>
                    <p className="text-muted-foreground text-[10px]">{cm.desc}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
