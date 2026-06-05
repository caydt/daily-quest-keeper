import { useEffect } from "react";
import type { Farm, Project, Task, Settings } from "@/lib/garden-store";
import { treeStage, farmStage } from "@/lib/garden-store";
import { X, Plus } from "lucide-react";
import { TreeStageIcon, FarmStageIcon } from "./StageIcon";

type Props = {
  farm: Farm;
  trees: Project[];
  tasks: Task[];
  onClose: () => void;
  onToggleProject: (id: string) => void;
  onAddTree: (farmId: string, title: string) => void;
  settings: Settings;
};

// 3×3 그리드 슬롯 매핑: null = 중앙(농장), 0~7 = 나무 인덱스
const SLOT_MAP = [0, 1, 2, 3, null, 4, 5, 6, 7] as const;

export function MandalartOverlay({
  farm, trees, tasks, onClose, onToggleProject, onAddTree,
}: Props) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const slottedTrees = trees.slice(0, 8);
  const overflowTrees = trees.slice(8);

  const treeStats = trees.map(p => {
    const childTasks = tasks.filter(t => t.projectId === p.id);
    const total = childTasks.length;
    const done = childTasks.filter(t => t.completed).length;
    return total === 0 ? (p.completed ? 100 : 0) : (done / total) * 100;
  });
  const avgPct = treeStats.length === 0 ? 0 : treeStats.reduce((a, b) => a + b, 0) / treeStats.length;
  const stage = farmStage(trees.length, avgPct);

  const handleAddTree = (slotIdx: number) => {
    const title = window.prompt(`슬롯 ${slotIdx + 1}: 나무 이름을 입력하세요`);
    if (title?.trim()) onAddTree(farm.id, title.trim());
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-xl rounded-3xl bg-card border border-emerald-500/20 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-emerald-500/10">
          <div className="flex items-center gap-3">
            <FarmStageIcon tier={stage.tier as 1 | 2 | 3 | 4 | 5} size={28} />
            <div>
              <h2 className="font-bold text-emerald-300">{farm.title}</h2>
              <p className="text-[11px] text-muted-foreground">
                만다라트 · 나무 {trees.length}그루 · 평균 {Math.round(avgPct)}%
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="만다라트 닫기"
            className="p-2 rounded-xl hover:bg-white/5 text-muted-foreground hover:text-foreground transition"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* 3×3 그리드 */}
        <div className="p-5">
          <div className="grid grid-cols-3 gap-2" data-testid="mandalart-grid">
            {SLOT_MAP.map((slotIdx, cellPos) => {
              // 중앙 셀 (농장)
              if (slotIdx === null) {
                return (
                  <div
                    key="center"
                    data-testid="mandalart-center"
                    className="aspect-square flex flex-col items-center justify-center rounded-2xl bg-emerald-950/40 border-2 border-emerald-500/40 p-2 text-center"
                  >
                    <span className="text-xl mb-1">{farm.icon ?? "🌾"}</span>
                    <p className="text-[11px] font-bold text-emerald-300 leading-tight line-clamp-2">
                      {farm.title}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{Math.round(avgPct)}%</p>
                  </div>
                );
              }

              const tree = slottedTrees[slotIdx];

              // 빈 슬롯
              if (!tree) {
                return (
                  <button
                    key={`empty-${slotIdx}`}
                    data-testid={`mandalart-empty-${slotIdx}`}
                    onClick={() => handleAddTree(slotIdx)}
                    className="aspect-square flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 hover:border-emerald-500/30 hover:bg-emerald-950/20 text-muted-foreground hover:text-emerald-400 transition"
                  >
                    <Plus className="size-4" />
                  </button>
                );
              }

              // 나무 셀
              const childTasks = tasks.filter(t => t.projectId === tree.id);
              const total = childTasks.length;
              const done = childTasks.filter(t => t.completed).length;
              const pct = total === 0 ? (tree.completed ? 100 : 0) : (done / total) * 100;
              const tStage = treeStage(pct, tree.completed);

              return (
                <button
                  key={tree.id}
                  data-testid={`mandalart-tree-${tree.id}`}
                  onClick={() => onToggleProject(tree.id)}
                  className={`aspect-square flex flex-col items-center justify-center rounded-2xl border-2 p-2 text-center transition ${
                    tree.completed
                      ? "border-primary/30 bg-primary/5 opacity-60"
                      : "border-accent/20 bg-card hover:border-accent/50 hover:shadow-bloom"
                  }`}
                >
                  <TreeStageIcon tier={tStage.tier as 1 | 2 | 3 | 4 | 5} size={22} />
                  <p className="text-[10px] font-medium mt-1 leading-tight line-clamp-2 w-full">
                    {tree.title}
                  </p>
                  {total > 0 && (
                    <p className="text-[9px] text-primary/60 mt-0.5">{done}/{total}</p>
                  )}
                </button>
              );
            })}
          </div>

          {/* 8개 초과 나무 */}
          {overflowTrees.length > 0 && (
            <div className="mt-4 space-y-1" data-testid="mandalart-overflow">
              <p className="text-[10px] text-muted-foreground mb-2">
                나머지 나무 ({overflowTrees.length})
              </p>
              {overflowTrees.map(tree => (
                <button
                  key={tree.id}
                  data-testid={`mandalart-overflow-tree-${tree.id}`}
                  onClick={() => onToggleProject(tree.id)}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-card/60 border border-white/5 hover:border-accent/20 text-sm text-left transition"
                >
                  <span className={tree.completed ? "line-through text-muted-foreground" : ""}>
                    {tree.title}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
