import { type Tool, findToolById } from "@/lib/tools-sheet";
import { X, Plus } from "lucide-react";

type Props = {
  /** 전체 도구 목록 — ID 조회에 사용 */
  availableTools: Tool[];
  /** 현재 연결된 도구 ID 목록 */
  toolIds: string[];
  /** 제거 버튼 클릭 핸들러 (없으면 × 버튼 숨김) */
  onRemove?: (id: string) => void;
  /** + 버튼 클릭 핸들러 (없으면 + 버튼 숨김) */
  onAdd?: () => void;
};

export function ToolChipBar({ availableTools, toolIds, onRemove, onAdd }: Props) {
  // 매치 안 된 ID는 dangling 상태로 표시 → 사용자가 X로 직접 정리 가능.
  // (URL이 바뀌었거나 slug 충돌로 findToolById가 undefined를 돌려준 경우)
  const resolved = toolIds.map((id) => ({ id, tool: findToolById(availableTools, id) }));

  if (resolved.length === 0 && !onAdd) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {resolved.map(({ id, tool }) =>
        tool ? (
          <span
            key={id}
            className="group/chip inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-full border border-white/10 bg-black/20 text-muted-foreground hover:border-primary/30 hover:text-foreground transition"
          >
            {tool.icon && <span className="text-xs">{tool.icon}</span>}
            <a
              href={tool.url}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-primary transition"
              onClick={(e) => e.stopPropagation()}
            >
              {tool.name}
            </a>
            {onRemove && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(id);
                }}
                className="opacity-0 group-hover/chip:opacity-100 hover:text-destructive transition-opacity ml-0.5"
                aria-label={`${tool.name} 연결 해제`}
              >
                <X className="size-2.5" />
              </button>
            )}
          </span>
        ) : (
          <span
            key={id}
            className="group/chip inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-full border border-destructive/30 bg-destructive/10 text-destructive/80"
            title="시트에서 도구가 사라졌거나 URL이 변경되었어요"
          >
            <span>(연결 끊김)</span>
            {onRemove && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(id);
                }}
                className="hover:text-destructive transition-opacity ml-0.5"
                aria-label="끊긴 연결 해제"
              >
                <X className="size-2.5" />
              </button>
            )}
          </span>
        ),
      )}
      {onAdd && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onAdd();
          }}
          className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-full border border-dashed border-white/10 text-muted-foreground hover:border-primary/40 hover:text-primary transition"
        >
          <Plus className="size-3" /> 도구 연결
        </button>
      )}
    </div>
  );
}
