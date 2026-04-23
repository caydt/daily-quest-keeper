import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useGarden } from "@/lib/garden-store";
import { useToolsSheet } from "@/lib/tools-sheet";
import type { Tool } from "@/lib/tools-sheet";
import {
  ArrowLeft,
  ExternalLink,
  RefreshCw,
  Search,
  Wrench,
  Plus,
  Check,
  Copy,
  Settings as SettingsIcon,
  Pencil,
  Trash2,
  X,
  Database,
  LayoutList,
} from "lucide-react";

export const Route = createFileRoute("/tools")({
  head: () => ({
    meta: [
      { title: "도구 라이브러리 — 루미 가든" },
      {
        name: "description",
        content: "도구 링크를 관리하고 할일/프로젝트에 첨부하세요.",
      },
    ],
  }),
  component: ToolsPage,
});

type Tab = "local" | "sheet";

// 도구 추가/수정 폼 초기값
const EMPTY_FORM = { name: "", url: "", category: "", icon: "", description: "" };

function ToolsPage() {
  const {
    state,
    hydrated,
    toggleTaskTool,
    toggleProjectTool,
    addLocalTool,
    updateLocalTool,
    deleteLocalTool,
  } = useGarden();

  const sheetUrl = state.settings.toolsSheetUrl;
  const { tools: sheetTools, loading, error, fetchedAt, refresh } = useToolsSheet(sheetUrl);

  const [tab, setTab] = useState<Tab>("local");
  const [q, setQ] = useState("");
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [attachOpenFor, setAttachOpenFor] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // 로컬 도구 폼 상태
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const tools: Tool[] = tab === "local" ? state.localTools : sheetTools;

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

  const copyUrl = async (id: string, url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(id);
      setTimeout(() => setCopiedId((c) => (c === id ? null : c)), 1500);
    } catch {
      window.prompt("링크 복사 (Ctrl/Cmd+C)", url);
    }
  };

  const openAddForm = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const openEditForm = (tool: Tool) => {
    setEditingId(tool.id);
    setForm({
      name: tool.name,
      url: tool.url,
      category: tool.category ?? "",
      icon: tool.icon ?? "",
      description: tool.description ?? "",
    });
    setShowForm(true);
  };

  const submitForm = () => {
    if (!form.name.trim() || !form.url.trim()) return;
    const url = form.url.trim().startsWith("http") ? form.url.trim() : `https://${form.url.trim()}`;
    if (editingId) {
      updateLocalTool(editingId, { ...form, url });
    } else {
      addLocalTool({ ...form, url });
    }
    setShowForm(false);
    setForm(EMPTY_FORM);
    setEditingId(null);
  };

  if (!hydrated) return <div className="min-h-dvh" />;

  return (
    <div className="min-h-dvh px-4 py-6 md:px-10 md:py-10">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* 탑바 */}
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

        {/* 헤더 */}
        <header className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h1 className="font-display text-3xl md:text-4xl text-gradient-gold flex items-center gap-3">
              <Wrench className="size-7 text-primary" /> 도구 라이브러리
            </h1>
            <p className="text-sm text-muted-foreground mt-2">
              직접 등록하거나 구글 시트에서 불러온 도구를 한눈에.
            </p>
          </div>
        </header>

        {/* 탭 */}
        <div className="flex gap-2 border-b border-white/5 pb-1">
          <TabBtn
            active={tab === "local"}
            icon={<LayoutList className="size-3.5" />}
            label={`직접 등록 (${state.localTools.length})`}
            onClick={() => { setTab("local"); setActiveCat(null); }}
          />
          <TabBtn
            active={tab === "sheet"}
            icon={<Database className="size-3.5" />}
            label={`구글 시트 (${sheetTools.length})`}
            onClick={() => { setTab("sheet"); setActiveCat(null); }}
          />
        </div>

        {/* 로컬 탭 — 추가 버튼 */}
        {tab === "local" && (
          <div className="flex justify-end">
            <button
              onClick={openAddForm}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/15 border border-primary/40 text-primary text-sm font-semibold hover:bg-primary/25 transition"
            >
              <Plus className="size-4" /> 도구 추가
            </button>
          </div>
        )}

        {/* 시트 탭 — 안내 + 새로고침 */}
        {tab === "sheet" && (
          <div className="flex items-center justify-between flex-wrap gap-3">
            <p className="text-xs text-muted-foreground">
              시트 헤더: <code>name, url, category, tags, icon, description</code>
            </p>
            <button
              onClick={refresh}
              disabled={loading || !sheetUrl}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 bg-card/60 hover:border-primary/40 text-sm font-medium text-muted-foreground hover:text-primary transition disabled:opacity-50"
            >
              <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
              {loading ? "불러오는 중..." : "새로고침"}
            </button>
          </div>
        )}

        {/* 시트 URL 미설정 안내 */}
        {tab === "sheet" && !sheetUrl && (
          <div className="rounded-3xl border border-dashed border-white/15 bg-card/40 p-8 text-center space-y-3">
            <p className="text-sm text-muted-foreground">아직 구글 시트가 연결되지 않았어요.</p>
            <Link
              to="/settings"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/15 border border-primary/40 text-primary text-sm font-semibold"
            >
              <SettingsIcon className="size-4" /> 설정에서 시트 URL 입력
            </Link>
          </div>
        )}

        {/* 시트 에러 */}
        {tab === "sheet" && error && (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* 로컬 탭 비어있을 때 */}
        {tab === "local" && state.localTools.length === 0 && (
          <div className="rounded-3xl border border-dashed border-white/15 bg-card/40 p-10 text-center space-y-3">
            <p className="text-2xl">🔧</p>
            <p className="text-sm text-muted-foreground">아직 등록된 도구가 없어요.</p>
            <button
              onClick={openAddForm}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/15 border border-primary/40 text-primary text-sm font-semibold"
            >
              <Plus className="size-4" /> 첫 도구 추가하기
            </button>
          </div>
        )}

        {/* 검색 + 카테고리 필터 (도구가 있을 때만) */}
        {tools.length > 0 && (
          <>
            <div className="flex flex-col md:flex-row gap-3">
              <div className="flex-1 relative">
                <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="이름, 카테고리, 설명으로 검색…"
                  className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-input/40 border border-white/10 text-sm focus:border-primary/40 focus:outline-none"
                />
              </div>
              {tab === "sheet" && fetchedAt && (
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
          </>
        )}

        {/* 도구 카드 그리드 */}
        {filtered.length === 0 && tools.length > 0 && (
          <div className="rounded-2xl border border-white/10 bg-card/40 p-8 text-center text-sm text-muted-foreground">
            조건에 맞는 도구가 없어요.
          </div>
        )}

        {filtered.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((tool) => {
              const attachedCount =
                state.tasks.filter((t) => t.toolIds?.includes(tool.id)).length +
                state.projects.filter((p) => p.toolIds?.includes(tool.id)).length;
              return (
                <ToolCard
                  key={tool.id}
                  tool={tool}
                  isLocal={tab === "local"}
                  attachedCount={attachedCount}
                  isCopied={copiedId === tool.id}
                  attachOpen={attachOpenFor === tool.id}
                  tasks={state.tasks}
                  projects={state.projects}
                  onCopy={() => copyUrl(tool.id, tool.url)}
                  onEdit={() => openEditForm(tool)}
                  onDelete={() => deleteLocalTool(tool.id)}
                  onToggleAttach={() =>
                    setAttachOpenFor(attachOpenFor === tool.id ? null : tool.id)
                  }
                  onToggleTask={(taskId) => toggleTaskTool(taskId, tool.id)}
                  onToggleProject={(projectId) => toggleProjectTool(projectId, tool.id)}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* 도구 추가/수정 모달 */}
      {showForm && (
        <ToolFormModal
          form={form}
          isEditing={!!editingId}
          onChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
          onSubmit={submitForm}
          onClose={() => { setShowForm(false); setEditingId(null); }}
        />
      )}
    </div>
  );
}

// ── 탭 버튼
function TabBtn({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-t-xl text-sm font-medium border-b-2 transition ${
        active
          ? "border-primary text-primary"
          : "border-transparent text-muted-foreground hover:text-foreground"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

// ── 도구 카드
function ToolCard({
  tool,
  isLocal,
  attachedCount,
  isCopied,
  attachOpen,
  tasks,
  projects,
  onCopy,
  onEdit,
  onDelete,
  onToggleAttach,
  onToggleTask,
  onToggleProject,
}: {
  tool: Tool;
  isLocal: boolean;
  attachedCount: number;
  isCopied: boolean;
  attachOpen: boolean;
  tasks: ReturnType<typeof useGarden>["state"]["tasks"];
  projects: ReturnType<typeof useGarden>["state"]["projects"];
  onCopy: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggleAttach: () => void;
  onToggleTask: (id: string) => void;
  onToggleProject: (id: string) => void;
}) {
  return (
    <article className="rounded-2xl border border-white/10 bg-card/60 p-4 flex flex-col gap-3 hover:border-primary/30 transition">
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
        {/* 로컬 도구만 수정/삭제 */}
        {isLocal && (
          <div className="flex gap-1 shrink-0">
            <button
              onClick={onEdit}
              className="size-7 rounded-lg hover:bg-white/5 flex items-center justify-center text-muted-foreground hover:text-primary transition"
              title="수정"
            >
              <Pencil className="size-3.5" />
            </button>
            <button
              onClick={onDelete}
              className="size-7 rounded-lg hover:bg-destructive/10 flex items-center justify-center text-muted-foreground hover:text-destructive transition"
              title="삭제"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        )}
      </div>

      {tool.description && (
        <p className="text-xs text-muted-foreground line-clamp-2">{tool.description}</p>
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
          onClick={onCopy}
          className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs transition ${
            isCopied
              ? "border-primary/40 text-primary bg-primary/10"
              : "border-white/10 text-muted-foreground hover:border-primary/30"
          }`}
          title="링크 복사"
        >
          {isCopied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
        </button>
        <button
          onClick={onToggleAttach}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-white/10 hover:border-primary/30 text-xs text-muted-foreground"
          title="할일/프로젝트에 첨부"
        >
          <Plus className="size-3.5" />
          {attachedCount > 0 && <span className="text-primary font-medium">{attachedCount}</span>}
        </button>
      </div>

      {/* 첨부 패널 */}
      {attachOpen && (
        <div className="rounded-xl bg-background/40 border border-white/10 p-3 space-y-3 max-h-72 overflow-y-auto">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">프로젝트</div>
            {projects.length === 0 ? (
              <p className="text-xs text-muted-foreground">프로젝트가 없어요.</p>
            ) : (
              <div className="space-y-1">
                {projects.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => onToggleProject(p.id)}
                    className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded hover:bg-white/5 text-left"
                  >
                    <span className="text-xs truncate">{p.title}</span>
                    {p.toolIds?.includes(tool.id) && <Check className="size-3.5 text-primary shrink-0" />}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">할일</div>
            {tasks.length === 0 ? (
              <p className="text-xs text-muted-foreground">할일이 없어요.</p>
            ) : (
              <div className="space-y-1">
                {tasks.slice(0, 50).map((t) => (
                  <button
                    key={t.id}
                    onClick={() => onToggleTask(t.id)}
                    className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded hover:bg-white/5 text-left"
                  >
                    <span className="text-xs truncate">
                      <span className="text-muted-foreground mr-1.5">{t.date}</span>
                      {t.title}
                    </span>
                    {t.toolIds?.includes(tool.id) && <Check className="size-3.5 text-primary shrink-0" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </article>
  );
}

// ── 도구 추가/수정 모달
function ToolFormModal({
  form,
  isEditing,
  onChange,
  onSubmit,
  onClose,
}: {
  form: typeof EMPTY_FORM;
  isEditing: boolean;
  onChange: (patch: Partial<typeof EMPTY_FORM>) => void;
  onSubmit: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-card p-6 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg text-gradient-gold">
            {isEditing ? "도구 수정" : "도구 추가"}
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="size-5" />
          </button>
        </div>

        <div className="space-y-3">
          <Field
            label="이름 *"
            value={form.name}
            placeholder="Notion"
            onChange={(v) => onChange({ name: v })}
          />
          <Field
            label="URL *"
            value={form.url}
            placeholder="https://notion.so"
            onChange={(v) => onChange({ url: v })}
          />
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="카테고리"
              value={form.category}
              placeholder="문서"
              onChange={(v) => onChange({ category: v })}
            />
            <Field
              label="아이콘 (이모지)"
              value={form.icon}
              placeholder="📝"
              onChange={(v) => onChange({ icon: v })}
            />
          </div>
          <Field
            label="설명"
            value={form.description}
            placeholder="팀 문서 및 노트 관리"
            onChange={(v) => onChange({ description: v })}
          />
        </div>

        <div className="flex gap-2 pt-2">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-xl border border-white/10 text-sm text-muted-foreground hover:text-foreground transition"
          >
            취소
          </button>
          <button
            onClick={onSubmit}
            disabled={!form.name.trim() || !form.url.trim()}
            className="flex-1 py-2 rounded-xl bg-primary/15 border border-primary/40 text-primary text-sm font-semibold hover:bg-primary/25 transition disabled:opacity-40"
          >
            {isEditing ? "저장" : "추가"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs text-muted-foreground">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 rounded-xl bg-input/40 border border-white/10 text-sm focus:border-primary/40 focus:outline-none"
      />
    </div>
  );
}
