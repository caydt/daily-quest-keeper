import { useState, useRef, useEffect } from "react";
import { Send, X, ChevronDown, ChevronUp, Check, Plus } from "lucide-react";
import type { AiMessage } from "@/lib/ai-adapter";
import { sendMessage, toAiSettings } from "@/lib/ai-adapter";
import type { Settings } from "@/lib/garden-store";

type Props = {
  /** AI에게 전달할 초기 컨텍스트 텍스트 */
  initialContext: string;
  /** 선택한 할일 제목 목록을 추가하는 콜백 */
  onAddTasks: (titles: string[]) => void;
  /** 패널 닫기 (side 모드에서 사용) */
  onClose?: () => void;
  /** 앱 설정 (AI provider/key/model 포함) */
  settings: Settings;
};

/** AI 응답에서 할일 목록 파싱 — 3개 이상이면 체크박스 UI */
function parseTasks(text: string): string[] {
  const lines = text.split("\n");
  const tasks: string[] = [];
  for (const line of lines) {
    const m = line.match(/^[\s]*[-*•][\s]*(?:\[[\sx]\][\s]*)?(.*\S)/);
    if (m) { tasks.push(m[1].trim()); continue; }
    const m2 = line.match(/^[\s]*\d+[.)]\s+(.*\S)/);
    if (m2) { tasks.push(m2[1].trim()); continue; }
  }
  return tasks.filter((t) => t.length > 1 && t.length < 200);
}

export function AiChatPanel({ initialContext, onAddTasks, onClose, settings }: Props) {
  const [context, setContext] = useState(initialContext);
  const [showContext, setShowContext] = useState(false);
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const aiSettings = toAiSettings(settings);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isStreaming) return;
    if (!aiSettings) {
      setError("설정에서 API 키를 먼저 입력해주세요.");
      return;
    }

    setError(null);
    setInput("");

    const systemMsg: AiMessage = {
      role: "user",
      content: `[컨텍스트]\n${context}\n\n할일 제안 시 목록 형식(- 항목)으로 작성해주세요.`,
    };
    const userMsg: AiMessage = { role: "user", content: text };

    const history = messages.length === 0
      ? [systemMsg, userMsg]
      : [...messages, userMsg];

    setMessages((prev) => [
      ...(prev.length === 0 ? [{ role: "user" as const, content: `[컨텍스트]\n${context}` }] : prev),
      userMsg,
    ]);
    setIsStreaming(true);

    const assistantMsg: AiMessage = { role: "assistant", content: "" };
    setMessages((prev) => [...prev, assistantMsg]);

    try {
      const gen = sendMessage(history, aiSettings);
      for await (const chunk of gen) {
        assistantMsg.content += chunk;
        setMessages((prev) => [
          ...prev.slice(0, -1),
          { ...assistantMsg },
        ]);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "AI 응답 오류");
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setIsStreaming(false);
    }
  };

  const lastAssistant = messages.filter((m) => m.role === "assistant").at(-1);
  const parsedTasks = lastAssistant ? parseTasks(lastAssistant.content) : [];
  const showCheckboxes = parsedTasks.length >= 3;

  const toggleSelect = (title: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(title) ? next.delete(title) : next.add(title);
      return next;
    });
  };

  const handleAddSelected = () => {
    if (selected.size === 0) return;
    onAddTasks([...selected]);
    setSelected(new Set());
  };

  return (
    <div className="flex flex-col border border-white/10 rounded-2xl bg-card/80 overflow-hidden">
      {/* 컨텍스트 헤더 */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/5 bg-black/10">
        <button
          onClick={() => setShowContext((v) => !v)}
          className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition"
        >
          {showContext ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
          📋 컨텍스트
        </button>
        {onClose && (
          <button onClick={onClose} className="p-1 hover:text-foreground text-muted-foreground transition">
            <X className="size-3.5" />
          </button>
        )}
      </div>

      {/* 컨텍스트 편집 영역 */}
      {showContext && (
        <textarea
          value={context}
          onChange={(e) => setContext(e.target.value)}
          className="px-3 py-2 text-xs bg-black/20 text-muted-foreground resize-none focus:outline-none focus:text-foreground border-b border-white/5"
          rows={5}
        />
      )}

      {/* 메시지 목록 */}
      <div className="flex-1 overflow-y-auto max-h-72 px-3 py-3 space-y-3 text-sm">
        {messages.length === 0 && (
          <p className="text-center text-xs text-muted-foreground py-6">
            AI에게 무엇이든 물어보세요.<br />
            <span className="text-[10px] opacity-60">할일 제안, 우선순위 정리, 방향 조언 등</span>
          </p>
        )}
        {messages
          .filter((m) => !m.content.startsWith("[컨텍스트]"))
          .map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap ${
                  m.role === "user"
                    ? "bg-primary/20 text-foreground"
                    : "bg-white/5 text-foreground"
                }`}
              >
                {m.content}
                {m.role === "assistant" && isStreaming && i === messages.length - 1 && (
                  <span className="inline-block w-1 h-3 ml-0.5 bg-primary animate-pulse" />
                )}
              </div>
            </div>
          ))}
        <div ref={bottomRef} />
      </div>

      {/* 파싱된 할일 체크박스 */}
      {showCheckboxes && (
        <div className="px-3 py-2 border-t border-white/5 space-y-1.5 bg-black/10">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">제안된 할일</p>
          {parsedTasks.map((title) => (
            <label key={title} className="flex items-center gap-2 cursor-pointer group">
              <div
                onClick={() => toggleSelect(title)}
                className={`size-4 rounded border flex items-center justify-center flex-shrink-0 transition ${
                  selected.has(title)
                    ? "border-primary bg-primary/20"
                    : "border-white/20 group-hover:border-white/40"
                }`}
              >
                {selected.has(title) && <Check className="size-2.5 text-primary" />}
              </div>
              <span className="text-xs text-foreground leading-tight">{title}</span>
            </label>
          ))}
          {selected.size > 0 && (
            <button
              onClick={handleAddSelected}
              className="mt-2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/15 border border-primary/40 text-primary text-xs font-semibold hover:bg-primary/25 transition"
            >
              <Plus className="size-3" /> {selected.size}개 추가
            </button>
          )}
        </div>
      )}

      {/* 에러 */}
      {error && (
        <div className="px-3 py-2 text-xs text-rose-400 border-t border-white/5 bg-rose-500/5">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">닫기</button>
        </div>
      )}

      {/* 입력창 */}
      <div className="flex items-center gap-2 px-3 py-2 border-t border-white/10">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void handleSend(); } }}
          placeholder={aiSettings ? "AI에게 질문하거나 할일을 요청해보세요..." : "설정에서 API 키를 먼저 입력해주세요"}
          disabled={!aiSettings || isStreaming}
          className="flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground/50 disabled:opacity-50"
        />
        <button
          onClick={() => void handleSend()}
          disabled={!input.trim() || isStreaming || !aiSettings}
          className="p-1.5 rounded-lg bg-primary/15 text-primary hover:bg-primary/25 transition disabled:opacity-30"
        >
          <Send className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
