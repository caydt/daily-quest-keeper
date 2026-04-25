import { useState } from "react";
import type { Tool } from "@/lib/tools-sheet";
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
};

export function ToolPicker({ availableTools, selectedIds, onToggle, onClose }: Props) {
  const [query, setQuery] = useState("");

  const filtered = availableTools.filter(
    (t) =>
      t.name.toLowerCase().includes(query.toLowerCase()) ||
      (t.category ?? "").toLowerCase().includes(query.toLowerCase()) ||
      t.tags.some((tag) => tag.toLowerCase().includes(query.toLowerCase())),
  );

  return (
    <>
      {/* 배경 클릭 시 닫기 */}
      <div className="fixed inset-0 z-40" onClick={onClose} />

      <div className="absolute left-0 top-full mt-1 z-50 w-64 rounded-xl border border-white/10 bg-card shadow-xl overflow-hidden">
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
              <button
                key={tool.id}
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
                {selectedIds.includes(tool.id) && (
                  <Check className="size-3.5 text-primary shrink-0" />
                )}
              </button>
            ))
          )}
        </div>
      </div>
    </>
  );
}
