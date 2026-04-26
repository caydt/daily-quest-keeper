import { useState } from "react";
import { Pencil, Check, X } from "lucide-react";
import type { Pledge } from "@/lib/garden-store";
import { todayStr } from "@/lib/garden-store";

type Props = {
  pledges: Pledge[];
  onSet: (text: string) => void;
};

export function PledgeBoard({ pledges, onSet }: Props) {
  const today = todayStr();
  const todayPledge = pledges.find((p) => p.date === today);
  const history = pledges
    .filter((p) => p.date !== today)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5);

  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState(todayPledge?.text ?? "");

  const handleSave = () => {
    const text = input.trim();
    if (text) onSet(text);
    setEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSave(); }
    if (e.key === "Escape") setEditing(false);
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-card px-5 py-4 space-y-3">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">🔥 나의 각오</p>
        {!editing && (
          <button
            onClick={() => { setInput(todayPledge?.text ?? ""); setEditing(true); }}
            className="p-1 rounded hover:bg-white/5 text-muted-foreground hover:text-primary transition"
          >
            <Pencil className="size-3.5" />
          </button>
        )}
      </div>

      {/* 오늘 각오 */}
      {editing ? (
        <div className="space-y-2">
          <textarea
            autoFocus
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="오늘의 각오를 적어보세요..."
            rows={2}
            className="w-full bg-input/40 border border-white/10 rounded-lg px-3 py-2 text-sm resize-none focus:border-primary/40 focus:outline-none"
          />
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/15 border border-primary/40 text-primary text-xs font-semibold hover:bg-primary/25 transition"
            >
              <Check className="size-3" /> 저장
            </button>
            <button
              onClick={() => setEditing(false)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-muted-foreground text-xs hover:bg-white/5 transition"
            >
              <X className="size-3" /> 취소
            </button>
          </div>
        </div>
      ) : todayPledge ? (
        <p
          className="text-sm text-foreground leading-relaxed cursor-pointer hover:text-primary/80 transition"
          onClick={() => { setInput(todayPledge.text); setEditing(true); }}
        >
          "{todayPledge.text}"
        </p>
      ) : (
        <p
          className="text-sm text-muted-foreground/60 italic cursor-pointer hover:text-muted-foreground transition"
          onClick={() => { setInput(""); setEditing(true); }}
        >
          오늘의 각오를 적어보세요 ✏️
        </p>
      )}

      {/* 이전 각오 히스토리 */}
      {history.length > 0 && (
        <div className="space-y-1.5 border-t border-white/5 pt-3">
          {history.map((p) => (
            <div key={p.date} className="flex items-start gap-2.5 text-muted-foreground/60">
              <span className="text-[10px] shrink-0 mt-0.5 tabular-nums">{p.date.slice(5)}</span>
              <span className="text-xs leading-snug">"{p.text}"</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
