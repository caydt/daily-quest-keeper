import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useGarden, todayStr } from "@/lib/garden-store";
import { useReminders, requestNotificationPermission } from "@/lib/notifications";
import { Avatar } from "@/components/garden/Avatar";
import { TaskList } from "@/components/garden/TaskList";
import { ProjectList } from "@/components/garden/ProjectList";
import { QuestPanel } from "@/components/garden/QuestPanel";
import { AchievementCodex } from "@/components/garden/AchievementCodex";
import { SidePanels } from "@/components/garden/SidePanels";
import { Settings as SettingsIcon, BarChart3, Bell, BellOff } from "lucide-react";
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
  } = useGarden();
  const today = todayStr();
  const todaysTasks = state.tasks.filter((t) => t.date === today);
  const standalone = todaysTasks.filter((t) => !t.projectId);

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

  if (!hydrated) {
    return <div className="min-h-dvh" />;
  }

  return (
    <div className="min-h-dvh px-4 py-6 md:px-10 md:py-10">
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
              to="/review"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-white/10 bg-card/60 hover:border-primary/40 text-xs font-medium text-muted-foreground hover:text-primary transition"
            >
              <BarChart3 className="size-3.5" /> <span className="hidden sm:inline">주간 회고</span>
            </Link>
            <Link
              to="/settings"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-white/10 bg-card/60 hover:border-primary/40 text-xs font-medium text-muted-foreground hover:text-primary transition"
            >
              <SettingsIcon className="size-3.5" /> <span className="hidden sm:inline">설정</span>
            </Link>
          </div>
        </header>

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
                tasks={state.tasks}
                totalXp={state.totalXp}
                onAdd={addProject}
                onToggle={toggleProject}
                onDelete={deleteProject}
                onReorder={reorderProjects}
                onAssignTask={assignTaskToProject}
              />
              <TaskList
                tasks={standalone}
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
{/* activeId reserved for future drag overlay */}
{void 0}
