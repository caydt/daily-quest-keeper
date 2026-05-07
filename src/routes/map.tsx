import { createFileRoute } from "@tanstack/react-router";
import type { Farm, Project } from "@/lib/garden-store";
import { useGarden, treeStage, farmStage } from "@/lib/garden-store";
import { ArrowLeft } from "lucide-react";
import { TreeStageIcon, FarmStageIcon } from "@/components/garden/StageIcon";

export const Route = createFileRoute("/map")({
  head: () => ({
    meta: [{ title: "세계 지도 — 루미 가든" }],
  }),
  component: MapPage,
});

type TreeData = {
  tree: Project;
  pct: number;
  done: number;
  total: number;
};

function MapPage() {
  const { state, hydrated } = useGarden();

  if (!hydrated) return <div className="min-h-dvh" />;

  const farms = [...state.farms].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  if (farms.length === 0) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center gap-4 text-center px-6">
        <p className="text-5xl">🗺️</p>
        <p className="text-lg font-semibold">아직 농장이 없어요</p>
        <p className="text-sm text-muted-foreground">메인 화면에서 농장을 만들면 여기에 세계가 펼쳐집니다.</p>
        <a
          href="/"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/15 border border-primary/40 text-primary text-sm font-semibold hover:bg-primary/25 transition"
        >
          <ArrowLeft className="size-4" /> 정원으로
        </a>
      </div>
    );
  }

  return (
    <div
      className="min-h-dvh relative"
      style={{
        backgroundImage:
          "radial-gradient(circle, rgba(255,255,255,0.04) 1px, transparent 1px)",
        backgroundSize: "28px 28px",
      }}
    >
      {/* 헤더 */}
      <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-white/5 backdrop-blur-md bg-background/70">
        <a
          href="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition"
        >
          <ArrowLeft className="size-4" /> 정원으로
        </a>
        <h1 className="font-display text-lg text-gradient-gold">🗺️ 세계 지도</h1>
        <p className="text-xs text-muted-foreground">{farms.length}개 농장</p>
      </div>

      {/* 맵 캔버스 */}
      <div className="p-8 md:p-12">
        <div
          className="grid gap-8"
          style={{ gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))" }}
        >
          {farms.map((farm, idx) => {
            const trees = state.projects
              .filter((p) => p.farmId === farm.id)
              .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

            // 나무별 진행률을 한 번만 계산 (FarmTerritory + TreeNode 이중 순회 방지)
            const treeData: TreeData[] = trees.map((tree) => {
              const childTasks = state.tasks.filter((t) => t.projectId === tree.id);
              const total = childTasks.length;
              const done = childTasks.filter((t) => t.completed).length;
              const pct = total === 0 ? (tree.completed ? 100 : 0) : (done / total) * 100;
              return { tree, pct, done, total };
            });

            const avgPct =
              treeData.length === 0
                ? 0
                : treeData.reduce((s, d) => s + d.pct, 0) / treeData.length;
            const stage = farmStage(trees.length, avgPct);

            // 홀짝 행마다 살짝 offset으로 RPG 지도 느낌
            const offset = idx % 2 === 1 ? "mt-6" : "";

            return (
              <div key={farm.id} className={offset}>
                <FarmTerritory farm={farm} treeData={treeData} stage={stage} avgPct={avgPct} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function FarmTerritory({
  farm,
  treeData,
  stage,
  avgPct,
}: {
  farm: Farm;
  treeData: TreeData[];
  stage: { icon: string; label: string; tier: number };
  avgPct: number;
}) {
  return (
    // <a> 중첩 방지: 외부 컨테이너는 div, 내부 TreeNode만 <a> 사용
    <div
      onClick={() => { window.location.href = `/?scroll=farm-${farm.id}`; }}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") window.location.href = `/?scroll=farm-${farm.id}`; }}
      role="link"
      tabIndex={0}
      className="block rounded-3xl border-2 border-emerald-500/30 bg-emerald-950/25 hover:border-emerald-400/50 hover:bg-emerald-950/40 transition-all group cursor-pointer"
    >
      {/* 농장 헤더 */}
      <div className="px-5 pt-5 pb-3 flex items-center gap-3">
        <FarmStageIcon tier={stage.tier as 1 | 2 | 3 | 4 | 5} size={40} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="font-bold text-emerald-300 truncate">{farm.title}</h2>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
              {stage.label}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            나무 {treeData.length}그루 · 평균 {Math.round(avgPct)}%
          </p>
        </div>
        {farm.icon && (
          <span className="text-xl opacity-60 group-hover:opacity-100 transition-opacity">
            {farm.icon}
          </span>
        )}
      </div>

      {/* 진행 바 */}
      <div className="px-5 pb-3">
        <div className="h-1 rounded-full bg-black/30 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-300 transition-all"
            style={{ width: `${avgPct}%` }}
          />
        </div>
      </div>

      {/* 나무 노드들 */}
      <div className="px-5 pb-5">
        {treeData.length === 0 ? (
          <p className="text-xs text-muted-foreground/50 italic text-center py-4">
            아직 나무가 없어요
          </p>
        ) : (
          <div className="flex flex-wrap gap-3">
            {treeData.map(({ tree, pct, done, total }) => (
              <TreeNode key={tree.id} tree={tree} pct={pct} done={done} total={total} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TreeNode({
  tree,
  pct,
  done,
  total,
}: {
  tree: Project;
  pct: number;
  done: number;
  total: number;
}) {
  const stage = treeStage(pct, tree.completed);

  return (
    <a
      href={`/?scroll=project-${tree.id}`}
      onClick={(e) => e.stopPropagation()}
      className={`flex flex-col items-center gap-1 w-16 group/tree transition-opacity ${
        tree.completed ? "opacity-50" : ""
      }`}
      title={tree.title}
    >
      {/* 원형 스테이지 배지 */}
      <TreeStageIcon tier={stage.tier as 1 | 2 | 3 | 4 | 5} size={64} />

      {/* 제목 */}
      <p className="text-[10px] text-center text-muted-foreground leading-tight line-clamp-2 w-full group-hover/tree:text-foreground transition-colors">
        {tree.title}
      </p>

      {/* 진행률 */}
      {total > 0 && (
        <p className="text-[9px] text-primary/70 tabular-nums">
          {done}/{total}
        </p>
      )}
    </a>
  );
}
