import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useGarden } from "@/lib/garden-store";
import { useToolsSheet } from "@/lib/tools-sheet";
import {
  ArrowLeft,
  ExternalLink,
  RefreshCw,
  Search,
  Wrench,
  Plus,
  Check,
  Settings as SettingsIcon,
} from "lucide-react";

export const Route = createFileRoute("/tools")({
  head: () => ({
    meta: [
      { title: "도구 라이브러리 — 루미 가든" },
      {
        name: "description",
        content: "구글 시트에 정리한 도구 링크들을 빠르게 검색하고 할일/프로젝트에 첨부하세요.",
      },
    ],
  }),
  component: ToolsPage,
});

function ToolsPage() {
  const { state, hydrated, toggleTaskTool, toggleProjectTool } = useGarden();
  const sheetUrl = state.settings.toolsSheetUrl;
  const { tools, loading, error, fetchedAt, refresh } = useToolsSheet(sheetUrl);

  const [q, setQ] = useState("");
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [attachOpenFor, setAttachOpenFor] = useState<string | null>(null); // toolId

  const categories = useMemo(() => {
    const set = new Set<string>();
    tools.forEach((t) => t.category && set.add(t.category));
    return Array.from(set).sort();
  }, [tools]);

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return tools.filter((t) => {
      if (activeCat && t.category !== activeCat) return false;
      if (!ql) return true;
      return (
        t.name.toLowerCase().includes(ql) ||
        (t.description?.toLowerCase().includes(ql) ?? false) ||
        t.tags.some((tag) => tag.toLowerCase().includes(ql)) ||
        (t.category?.toLowerCase().includes(ql) ?? false)
      );
    });
  }, [tools, q, activeCat]);

  if (!hydrated) return <div className="min-h-dvh" />;

  return (
    <div className="min-h-dvh px-4 py-6 md:px-10 md:py-10">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition"
          >
            <ArrowLeft className="size-4" /> 정원으로
          </Link>
          <Link
            to="/settings"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-white/10 bg-card/60 hover:border-primary/40 text-xs font-medium text-muted-foreground hover:text-primary transition"
          >
            <SettingsIcon className="size-3.5" /> 시트 URL 설정
          </Link>
        </div>

        <header className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h1 className="font-display text-3xl md:text-4xl text-gradient-gold flex items-center gap-3">
              <Wrench className="size-7 text-primary" /> 도구 라이브러리
            </h1>
            <p className="text-sm text-muted-foreground mt-2">
              공개 구글 시트에서 도구 목록을 불러옵니다. 시트에서 직접 추가/수정하고 새로고침하세요.
            </p>
          </div>
          <button
            onClick={refresh}
            disabled={loading || !sheetUrl}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 bg-card/60 hover:border-primary/40 text-sm font-medium text-muted-foreground hover:text-primary transition disabled:opacity-50"
          >
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
            {loading ? "불러오는 중..." : "새로고침"}
          </button>
        </header>

        {!sheetUrl && (
          <div className="rounded-3xl border border-dashed border-white/15 bg-card/40 p-8 text-center space-y-3">
            <p className="text-sm text-muted-foreground">
              아직 도구 시트가 연결되지 않았어요.
            </p>
            <Link
              to="/settings"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/15 border border-primary/40 text-primary text-sm font-semibold"
            >
              <SettingsIcon className="size-4" /> 설정에서 구글 시트 URL 입력
            </Link>
            <p className="text-[11px] text-muted-foreground">
              시트 헤더 예시: <code>name, url, category, tags, icon, description</code>
            </p>
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        {sheetUrl && (
          <>
            <div className="flex flex-col md:flex-row gap-3">
              <div className="flex-1 relative">
                <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="이름, 태그, 카테고리, 설명으로 검색…"
                  className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-input/40 border border-white/10 text-sm focus:border-primary/40 focus:outline-none"
                />
              </div>
              {fetchedAt && (
                <div className="text-[11px] text-muted-foreground self-center">
                  마지막 업데이트: {new Date(fetchedAt).toLocaleTimeString()}
                </div>
              )}
            </div>

            {categories.length > 0 && (
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setActiveCat(null)}
                  className={`px-3 py-1.5 rounded-full text-xs border transition ${
                    activeCat === null
                      ? "bg-primary/15 border-primary/40 text-primary"
                      : "border-white/10 text-muted-foreground hover:border-primary/30"
                  }`}
                >
                  전체 ({tools.length})
                </button>
                {categories.map((c) => {
                  const count = tools.filter((t) => t.category === c).length;
                  const active = activeCat === c;
                  return (
                    <button
                      key={c}
                      onClick={() => setActiveCat(active ? null : c)}
                      className={`px-3 py-1.5 rounded-full text-xs border transition ${
                        active
                          ? "bg-primary/15 border-primary/40 text-primary"
                          : "border-white/10 text-muted-foreground hover:border-primary/30"
                      }`}
                    >
                      {c} ({count})
                    </button>
                  );
                })}
              </div>
            )}

            {filtered.length === 0 && !loading ? (
              <div className="rounded-2xl border border-white/10 bg-card/40 p-8 text-center text-sm text-muted-foreground">
                {tools.length === 0
                  ? "시트에 도구가 없거나 헤더(name, url …)를 인식하지 못했어요."
                  : "조건에 맞는 도구가 없어요."}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.map((tool) => {
                  const attachedTaskCount = state.tasks.filter((t) =>
                    t.toolIds?.includes(tool.id),
                  ).length;
                  const attachedProjectCount = state.projects.filter((p) =>
                    p.toolIds?.includes(tool.id),
                  ).length;
                  const totalAttached = attachedTaskCount + attachedProjectCount;
                  return (
                    <article
                      key={tool.id}
                      className="rounded-2xl border border-white/10 bg-card/60 p-4 flex flex-col gap-3 hover:border-primary/30 transition"
                    >
                      <div className="flex items-start gap-3">
                        <div className="size-10 rounded-xl bg-gradient-bloom flex items-center justify-center text-lg shrink-0">
                          {tool.icon || "🔧"}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="font-semibold text-sm truncate">{tool.name}</h3>
                          {tool.category && (
                            <p className="text-[11px] text-muted-foreground uppercase tracking-wider mt-0.5">
                              {tool.category}
                            </p>
                          )}
                        </div>
                      </div>
                      {tool.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {tool.description}
                        </p>
                      )}
                      {tool.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {tool.tags.slice(0, 5).map((tag) => (
                            <span
                              key={tag}
                              className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-muted-foreground"
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="flex items-center gap-2 mt-auto pt-2 border-t border-white/5">
                        <a
                          href={tool.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/15 border border-primary/40 text-primary text-xs font-semibold hover:bg-primary/25 transition"
                        >
                          <ExternalLink className="size-3.5" /> 열기
                        </a>
                        <button
                          onClick={() =>
                            setAttachOpenFor(attachOpenFor === tool.id ? null : tool.id)
                          }
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-white/10 hover:border-primary/30 text-xs text-muted-foreground"
                          title="할일/프로젝트에 첨부"
                        >
                          <Plus className="size-3.5" />
                          {totalAttached > 0 && (
                            <span className="text-primary font-medium">{totalAttached}</span>
                          )}
                        </button>
                      </div>

                      {attachOpenFor === tool.id && (
                        <div className="rounded-xl bg-background/40 border border-white/10 p-3 space-y-3 max-h-72 overflow-y-auto">
                          <div>
                            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
                              프로젝트
                            </div>
                            {state.projects.length === 0 ? (
                              <div className="text-xs text-muted-foreground">
                                프로젝트가 없어요.
                              </div>
                            ) : (
                              <div className="space-y-1">
                                {state.projects.map((p) => {
                                  const on = p.toolIds?.includes(tool.id) ?? false;
                                  return (
                                    <button
                                      key={p.id}
                                      onClick={() => toggleProjectTool(p.id, tool.id)}
                                      className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded hover:bg-white/5 text-left"
                                    >
                                      <span className="text-xs truncate">{p.title}</span>
                                      {on && <Check className="size-3.5 text-primary shrink-0" />}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                          <div>
                            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
                              할일
                            </div>
                            {state.tasks.length === 0 ? (
                              <div className="text-xs text-muted-foreground">할일이 없어요.</div>
                            ) : (
                              <div className="space-y-1">
                                {state.tasks.slice(0, 50).map((t) => {
                                  const on = t.toolIds?.includes(tool.id) ?? false;
                                  return (
                                    <button
                                      key={t.id}
                                      onClick={() => toggleTaskTool(t.id, tool.id)}
                                      className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded hover:bg-white/5 text-left"
                                    >
                                      <span className="text-xs truncate">
                                        <span className="text-muted-foreground mr-1.5">
                                          {t.date}
                                        </span>
                                        {t.title}
                                      </span>
                                      {on && <Check className="size-3.5 text-primary shrink-0" />}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
