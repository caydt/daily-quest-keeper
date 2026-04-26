export type AiMessage = { role: "user" | "assistant"; content: string };

export type AiSettings = {
  provider: "gemini" | "openai" | "claude";
  apiKey: string;
  model?: string;
};

const DEFAULT_MODELS: Record<string, string> = {
  gemini: "gemini-2.0-flash",
  openai: "gpt-4o-mini",
  claude: "claude-sonnet-4-6",
};

/** Gemini 스트리밍: SSE 청크에서 텍스트 추출 */
async function* streamGemini(
  messages: AiMessage[],
  settings: AiSettings,
): AsyncGenerator<string> {
  const model = settings.model || DEFAULT_MODELS.gemini;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?key=${settings.apiKey}&alt=sse`;

  const contents = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API 오류 (${res.status}): ${err}`);
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const json = line.slice(5).trim();
      if (!json || json === "[DONE]") continue;
      try {
        const parsed = JSON.parse(json);
        const text: string =
          parsed?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
        if (text) yield text;
      } catch {
        /* 파싱 실패 무시 */
      }
    }
  }
}

/** OpenAI 스트리밍: SSE delta 추출 */
async function* streamOpenAI(
  messages: AiMessage[],
  settings: AiSettings,
): AsyncGenerator<string> {
  const model = settings.model || DEFAULT_MODELS.openai;
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${settings.apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      stream: true,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI API 오류 (${res.status}): ${err}`);
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const json = line.slice(5).trim();
      if (!json || json === "[DONE]") continue;
      try {
        const parsed = JSON.parse(json);
        const text: string = parsed?.choices?.[0]?.delta?.content ?? "";
        if (text) yield text;
      } catch {
        /* 파싱 실패 무시 */
      }
    }
  }
}

/**
 * 단일 AI 메시지 전송 인터페이스 — 스트리밍 제너레이터 반환.
 * provider에 따라 Gemini / OpenAI로 라우팅.
 */
export async function* sendMessage(
  messages: AiMessage[],
  settings: AiSettings,
): AsyncGenerator<string> {
  if (!settings.apiKey) {
    throw new Error("API 키가 설정되지 않았어요. 설정 > AI 기능 설정에서 입력해주세요.");
  }

  switch (settings.provider) {
    case "gemini":
      yield* streamGemini(messages, settings);
      break;
    case "openai":
      yield* streamOpenAI(messages, settings);
      break;
    case "claude":
      throw new Error(
        "Claude는 현재 브라우저에서 직접 지원되지 않아요. Gemini 또는 OpenAI를 사용해주세요.",
      );
    default:
      throw new Error("지원하지 않는 AI 제공자예요.");
  }
}

/** Settings → AiSettings 변환 헬퍼 */
export function toAiSettings(settings: {
  aiProvider?: string;
  aiApiKey?: string;
  aiModel?: string;
}): AiSettings | null {
  if (!settings.aiProvider || !settings.aiApiKey) return null;
  return {
    provider: settings.aiProvider as AiSettings["provider"],
    apiKey: settings.aiApiKey,
    model: settings.aiModel,
  };
}
