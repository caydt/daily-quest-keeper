import { useMemo, useState } from "react";
import { type Tool, matchToolsForTitle } from "@/lib/tools-sheet";
import { Search, Check } from "lucide-react";

type Props = {
  /** 선택 가능한 전체 도구 목록 */
  availableTools: Tool[];
  /** 현재 선택된 도구 ID 목록 */
  selectedIds: string[];
  /** 선택/해제 토글 */
  onToggle: (id: string) => void;
  /** 드롭다운 닫기 */
  onClose: () => void;
  /** 매칭 기반 추천 — 농장/프로젝트 제목. 비어있거나 미제공이면 추천 섹션 안 보임. */
  recommendForTitle?: string;
};

export function ToolPicker({
  availableTools,
  selectedIds,
  onToggle,
  onClose,
  recommendForTitle,
}: Props) {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const t of availableTools) if (t.category) set.add(t.category);
    return Array.from(set).sort();
  }, [availableTools]);

  const recommended = useMemo(() => {
    if (!recommendForTitle) return [];
    return matchToolsForTitle(recommendForTitle, availableTools);
  }, [recommendForTitle, availableTools]);

  const recommendedNotSelected = recommended.filter((t) => !selectedIds.includes(t.id));

  const filtered = useMemo(() => {
    return availableTools.filter((t) => {
      if (activeCategory && t.category !== activeCategory) return false;
      const q = query.toLowerCase();
      if (!q) return true;
      return (
        t.name.toLowerCase().includes(q) ||
        (t.category ?? "").toLowerCase().includes(q) ||
        t.tags.some((tag) => tag.toLowerCase().includes(q))
      );
    });
  }, [availableTools, activeCategory, query]);

  const handleAddAllRecommended = () => {
    for (const t of recommendedNotSelected) onToggle(t.id);
  };

  const selectedCount = selectedIds.length;

  return (
    <>
      {/* 배경 클릭 시 닫기 */}
      <div className="fixed inset-0 z-40" onClick={onClose} />

      <div className="absolute left-0 top-full mt-1 z-50 w-80 rounded-xl border border-white/10 bg-card shadow-xl overflow-hidden">
        {/* 검색 */}
        <div className="p-2 border-b border-white/5">
          <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-black/20">
            <Search className="size-3.5 text-muted-foreground shrink-0" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="도구 검색..."
              className="bg-transparent text-xs outline-none flex-1 placeholder:text-muted-foreground/50"
            />
          </div>
        </div>

        {/* 카테고리 칩 */}
        {categories.length > 0 && (
          <div className="px-2 py-1.5 border-b border-white/5 flex gap-1 overflow-x-auto">
            <CategoryChip
              label="전체"
              active={activeCategory === null}
              onClick={() => setActiveCategory(null)}
            />
            {categories.map((c) => (
              <CategoryChip
                key={c}
                label={c}
                active={activeCategory === c}
                onClick={() => setActiveCategory(c)}
              />
            ))}
          </div>
        )}

        {/* 추천 섹션 */}
        {recommendedNotSelected.length > 0 && (
          <div className="p-2 border-b border-white/5 bg-primary/5 space-y-1">
            <div className="flex items-center justify-between gap-2 px-1">
              <span className="text-[10px] font-semibold text-primary/80">
                ✨ 추천 ({recommendedNotSelected.length}개)
              </span>
              <button
                type="button"
                onClick={handleAddAllRecommended}
                className="text-[10px] px-2 py-0.5 rounded-md bg-primary/15 border border-primary/30 text-primary hover:bg-primary/25 transition"
              >
                모두 추가
              </button>
            </div>
            {recommendedNotSelected.map((tool) => (
              <ToolRow key={tool.id} tool={tool} selected={false} onToggle={onToggle} />
            ))}
          </div>
        )}

        {/* 도구 목록 */}
        <div className="max-h-52 overflow-y-auto">
          {availableTools.length === 0 ? (
            <p className="text-center text-xs text-muted-foreground py-4 px-3">
              도구 라이브러리를 먼저 설정해주세요
              <br />
              <span className="text-[10px] opacity-60">(설정 → 도구 라이브러리)</span>
            </p>
          ) : filtered.length === 0 ? (
            <p className="text-center text-xs text-muted-foreground py-4">검색 결과 없음</p>
          ) : (
            filtered.map((tool) => (
              <ToolRow
                key={tool.id}
                tool={tool}
                selected={selectedIds.includes(tool.id)}
                onToggle={onToggle}
              />
            ))
          )}
        </div>

        {/* 푸터 */}
        <div className="p-2 border-t border-white/5 flex items-center justify-between text-xs">
          <span className="text-muted-foreground">선택됨 {selectedCount}개</span>
          <button
            type="button"
            onClick={onClose}
            className="px-2.5 py-1 rounded-md bg-primary/15 border border-primary/30 text-primary hover:bg-primary/25 transition"
          >
            닫기
          </button>
        </div>
      </div>
    </>
  );
}

function CategoryChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-[10px] px-2 py-0.5 rounded-full border whitespace-nowrap transition shrink-0 ${
        active
          ? "bg-primary/20 border-primary/40 text-primary"
          : "bg-transparent border-white/10 text-muted-foreground hover:border-white/20 hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
}

function ToolRow({
  tool,
  selected,
  onToggle,
}: {
  tool: Tool;
  selected: boolean;
  onToggle: (id: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onToggle(tool.id)}
      className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-white/5 transition"
    >
      {tool.icon ? (
        <span className="text-sm w-5 text-center shrink-0">{tool.icon}</span>
      ) : (
        <span className="w-5 shrink-0" />
      )}
      <span className="flex-1 text-left text-foreground truncate">{tool.name}</span>
      {tool.category && (
        <span className="text-[10px] text-muted-foreground shrink-0">{tool.category}</span>
      )}
      {selected && <Check className="size-3.5 text-primary shrink-0" />}
    </button>
  );
}
