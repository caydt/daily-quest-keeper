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
  const connected = toolIds
    .map((id) => findToolById(availableTools, id))
    .filter((t): t is Tool => t !== undefined);

  if (connected.length === 0 && !onAdd) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {connected.map((tool) => (
        <span
          key={tool.id}
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
                onRemove(tool.id);
              }}
              className="opacity-0 group-hover/chip:opacity-100 hover:text-destructive transition-opacity ml-0.5"
              aria-label={`${tool.name} 연결 해제`}
            >
              <X className="size-2.5" />
            </button>
          )}
        </span>
      ))}
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
