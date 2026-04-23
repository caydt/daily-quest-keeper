import { createFileRoute } from "@tanstack/react-router";
import { useGarden, todayStr } from "@/lib/garden-store";
import { useReminders, requestNotificationPermission } from "@/lib/notifications";
import { StatHeader } from "@/components/garden/StatHeader";
import { TaskList } from "@/components/garden/TaskList";
import { SidePanels } from "@/components/garden/SidePanels";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "루미 가든 — 게이미피케이션 일정 관리" },
      {
        name: "description",
        content:
          "할일을 자주 까먹는 당신을 위한 정원형 투두 앱. 레벨, 보상, 벌점으로 매일을 가꾸세요.",
      },
      { property: "og:title", content: "루미 가든 — 게이미피케이션 일정 관리" },
      {
        property: "og:description",
        content: "보라빛 밤의 정원에서 하루 스케줄을 가꾸고 보상을 수확하세요.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const { state, hydrated, addTask, toggleTask, deleteTask, setNotifications } = useGarden();
  const today = todayStr();
  const todaysTasks = state.tasks.filter((t) => t.date === today);

  useReminders(state.tasks, state.notificationsEnabled && hydrated);

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

  if (!hydrated) {
    return <div className="min-h-dvh" />;
  }

  return (
    <div className="min-h-dvh px-6 py-8 md:px-10 md:py-12">
      <div className="max-w-7xl mx-auto space-y-10">
        <StatHeader
          xp={state.xp}
          totalXp={state.totalXp}
          streak={state.streak}
          notificationsEnabled={state.notificationsEnabled}
          onToggleNotifications={handleToggleNotifications}
        />

        <main className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-8">
          <TaskList
            tasks={todaysTasks}
            onToggle={toggleTask}
            onDelete={deleteTask}
            onAdd={addTask}
          />
          <SidePanels tasks={todaysTasks} streak={state.streak} totalXp={state.totalXp} />
        </main>

        <footer className="text-center text-xs text-muted-foreground pt-8 border-t border-white/5">
          매일 <span className="text-primary">아침 8시</span>와{" "}
          <span className="text-primary">저녁 9시</span>에 정원이 당신을 부릅니다.
        </footer>
      </div>
    </div>
  );
}
