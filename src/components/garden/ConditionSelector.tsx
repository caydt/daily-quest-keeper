import { useState } from "react";
import type { ConditionMode, Settings, Task } from "@/lib/garden-store";
import { CONDITION_META } from "@/lib/garden-store";
import { getRandomFutureSelfMessage } from "@/lib/condition-messages";
import { sendMessage, toAiSettings } from "@/lib/ai-adapter";
import { buildConditionContext } from "@/lib/ai-context";

type Props = {
  onSelect: (mode: ConditionMode) => void;
  settings: Settings;
  pendingTasks: Task[];
};

const CONDITIONS: ConditionMode[] = ["best", "normal", "low", "sick"];

const CHEER_MESSAGES: Record<ConditionMode, string[]> = {
  best: [
    "🔥 오늘은 무적이야! 다 해치워버리자!",
    "⚡ 이 에너지 실화? 오늘 역대급 날 될 거야.",
    "🚀 최상 컨디션! 미루던 것까지 다 끝내버리자.",
    "💪 오늘의 너는 못 막아. 달려!",
    "🌟 에너지 넘치는 날, 가장 어려운 것부터 시작해봐.",
  ],
  normal: [
    "😊 오늘도 꾸준히! 작은 걸 쌓으면 결국 이겨.",
    "🌿 보통이 제일 안정적이야. 묵묵히 가자.",
    "✨ 완벽하지 않아도 괜찮아. 조금씩 앞으로.",
    "🎯 오늘 해야 할 것만 딱 집중하자.",
    "🌸 평범한 하루도 쌓이면 위대해져.",
  ],
  low: [
    "😔 힘들어도 여기 있어줘서 고마워. 최소한만 해도 충분해.",
    "🌙 저조한 날도 있어. 필수만 하고 쉬어.",
    "💙 지금 이 상태로도 잘하고 있어.",
    "🕯️ 작은 불꽃도 꺼지지 않으면 괜찮아.",
    "🍃 오늘은 쉬면서 내일을 위한 에너지 충전해.",
  ],
  sick: [
    "🤒 많이 힘들지? 오늘은 정말 최소한만. 몸이 먼저야.",
    "💊 아픈 날엔 살아있는 것만으로도 충분해.",
    "🛌 꼭 필요한 것만 하고 푹 쉬어. 회복이 최우선.",
    "🤗 힘들 때도 할일 앱 켜는 너, 진짜 대단해.",
    "🌡️ 아파도 버티는 거 알아. 오늘은 그냥 쉬어도 돼.",
  ],
};

function getRandomCheer(mode: ConditionMode): string {
  const list = CHEER_MESSAGES[mode];
  return list[Math.floor(Math.random() * list.length)];
}

export function ConditionSelector({ onSelect, settings, pendingTasks }: Props) {
  const [cheer, setCheer] = useState<{ mode: ConditionMode; msg: string } | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleSelect = async (mode: ConditionMode) => {
    // 먼저 정적 메시지로 즉시 표시
    const staticMsg = getRandomFutureSelfMessage(mode);
    setCheer({ mode, msg: staticMsg });
    setIsGenerating(false);

    // AI 활성화 && API 키 있으면 AI 메시지로 교체 시도
    const aiSettings = toAiSettings(settings);
    const useAi =
      (settings.aiConditionMessageEnabled ?? true) &&
      aiSettings &&
      aiSettings.provider !== "claude";

    if (useAi && aiSettings) {
      setIsGenerating(true);
      try {
        const context = buildConditionContext(mode, pendingTasks);
        const systemPrompt =
          "당신은 사용자의 10년 뒤 미래 자아입니다. 지금의 나를 돌아보며 따뜻하고 담담하게 한 마디 해주세요. 2-3문장, 한국어로만 답하세요. 격식 없이 편하게.";
        let aiMsg = "";
        const gen = sendMessage(
          [{ role: "user", content: `${systemPrompt}\n\n${context}` }],
          aiSettings,
        );
        for await (const chunk of gen) {
          aiMsg += chunk;
          setCheer({ mode, msg: aiMsg });
        }
      } catch {
        // AI 실패 시 정적 메시지 유지
      } finally {
        setIsGenerating(false);
      }
    }

    // 1.5초 후 선택 완료
    setTimeout(() => onSelect(mode), 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm space-y-6">
        {cheer ? (
          /* 응원 메시지 화면 */
          <div className="text-center space-y-4 animate-in fade-in duration-300">
            <span className="text-6xl block">
              {CONDITION_META[cheer.mode].icon}
            </span>
            <p className={`text-lg font-semibold ${CONDITION_META[cheer.mode].color}`}>
              {CONDITION_META[cheer.mode].label} 모드
            </p>
            <p className="text-base text-foreground leading-relaxed px-2">
              {cheer.msg}
            </p>
            {isGenerating && (
              <p className="text-[11px] text-muted-foreground animate-pulse">✨ 미래의 내가 말을 고르는 중...</p>
            )}
          </div>
        ) : (
          <>
            {/* 헤더 */}
            <div className="text-center space-y-1">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">오늘의 루미 가든</p>
              <h2 className="font-display text-2xl text-gradient-gold">오늘 컨디션이 어때?</h2>
              <p className="text-sm text-muted-foreground">선택에 따라 오늘 할일이 자동으로 맞춰져.</p>
            </div>

            {/* 컨디션 버튼 4개 */}
            <div className="grid grid-cols-2 gap-3">
              {CONDITIONS.map((mode) => {
                const meta = CONDITION_META[mode];
                return (
                  <button
                    key={mode}
                    onClick={() => void handleSelect(mode)}
                    className="group flex flex-col items-center gap-2 p-5 rounded-2xl border border-white/10 bg-card hover:border-primary/50 hover:bg-card/80 active:scale-95 transition-all duration-150"
                  >
                    <span className="text-4xl group-hover:scale-110 transition-transform duration-150">
                      {meta.icon}
                    </span>
                    <span className={`text-base font-semibold ${meta.color}`}>{meta.label}</span>
                    <span className="text-[11px] text-muted-foreground text-center leading-tight">
                      {meta.desc}
                    </span>
                  </button>
                );
              })}
            </div>

            <p className="text-center text-[11px] text-muted-foreground">
              언제든 상단에서 바꿀 수 있어요
            </p>
          </>
        )}
      </div>
    </div>
  );
}
