import { X } from "lucide-react";
import { AiChatPanel } from "@/components/garden/AiChatPanel";
import type { Project, Task, Settings } from "@/lib/garden-store";
import { buildGlobalContext } from "@/lib/ai-context";
import { useState } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  projects: Project[];
  tasks: Task[];
  settings: Settings;
  onAddTasksToProject: (projectId: string | null, titles: string[]) => void;
};

export function AiSidePanel({ open, onClose, projects, tasks, settings, onAddTasksToProject }: Props) {
  const [targetProjectId, setTargetProjectId] = useState<string | "none">("none");

  const activeProjects = projects.filter((p) => !p.completed);

  return (
    <>
      {/* 배경 오버레이 */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
          onClick={onClose}
        />
      )}

      {/* 사이드 패널 */}
      <div
        className={`fixed top-0 right-0 h-full w-full max-w-sm z-50 flex flex-col bg-card border-l border-white/10 shadow-2xl transition-transform duration-300 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-white/10">
          <div>
            <h2 className="font-semibold text-sm">✨ AI 어시스턴트</h2>
            <p className="text-[11px] text-muted-foreground">전체 프로젝트 기반 대화</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-white/5 rounded-lg text-muted-foreground hover:text-foreground transition">
            <X className="size-4" />
          </button>
        </div>

        {/* 할일 추가 대상 선택 */}
        <div className="px-4 py-3 border-b border-white/5">
          <label className="text-[11px] text-muted-foreground">AI 제안 할일 추가 대상</label>
          <select
            value={targetProjectId}
            onChange={(e) => setTargetProjectId(e.target.value)}
            className="mt-1 w-full px-3 py-1.5 rounded-lg bg-input/40 border border-white/10 text-xs focus:border-primary/40 focus:outline-none"
          >
            <option value="none">독립 할일 (프로젝트 없음)</option>
            {activeProjects.map((p) => (
              <option key={p.id} value={p.id}>{p.title}</option>
            ))}
          </select>
        </div>

        {/* 채팅 */}
        <div className="flex-1 overflow-hidden px-4 py-4">
          {open && (
            <AiChatPanel
              initialContext={buildGlobalContext(projects, tasks)}
              settings={settings}
              onAddTasks={(titles) =>
                onAddTasksToProject(
                  targetProjectId === "none" ? null : targetProjectId,
                  titles,
                )
              }
            />
          )}
        </div>
      </div>
    </>
  );
}
