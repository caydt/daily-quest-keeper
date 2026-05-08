import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useGarden } from "@/lib/garden-store";
import { requestNotificationPermission } from "@/lib/notifications";
import { getScriptUrl, setScriptUrl, testScriptUrl } from "@/lib/sheets-adapter";
import { ArrowLeft, Bell, BellOff, Sunrise, Moon, Wrench, ExternalLink, Link2, CheckCircle2, XCircle, Loader2, Save, Bot, ToggleLeft, ToggleRight } from "lucide-react";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "설정 — 루미 가든" },
      { name: "description", content: "알람 시간과 알림을 설정하세요." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { state, hydrated, updateSettings, setNotifications, saveNow, saveStatus } = useGarden();
  const [scriptUrl, setScriptUrlState] = useState(() => getScriptUrl());
  const [testState, setTestState] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [testError, setTestError] = useState("");
  const [aiProvider, setAiProvider] = useState<"gemini" | "openai" | "claude">(
    (state.settings.aiProvider as "gemini" | "openai" | "claude") ?? "gemini",
  );
  const [aiApiKey, setAiApiKey] = useState(state.settings.aiApiKey ?? "");
  const [aiModel, setAiModel] = useState(state.settings.aiModel ?? "");
  const [aiTestState, setAiTestState] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [aiTestError, setAiTestError] = useState("");
  const [toolsSheetUrlInput, setToolsSheetUrlInput] = useState(state.settings.toolsSheetUrl ?? "");

  const handleSaveScriptUrl = () => {
    setScriptUrl(scriptUrl.trim());
    window.location.reload();
  };

  const handleTestAi = async () => {
    if (!aiApiKey.trim()) {
      setAiTestState("error");
      setAiTestError("API 키를 입력해주세요.");
      return;
    }
    setAiTestState("loading");
    setAiTestError("");
    try {
      const { sendMessage } = await import("@/lib/ai-adapter");
      const gen = sendMessage(
        [{ role: "user", content: "안녕하세요! 연결 테스트입니다. 한 문장으로 응답해주세요." }],
        { provider: aiProvider, apiKey: aiApiKey.trim(), model: aiModel.trim() || undefined },
      );
      let result = "";
      for await (const chunk of gen) {
        result += chunk;
        if (result.length > 10) break;
      }
      if (result) {
        setAiTestState("ok");
      } else {
        throw new Error("응답이 비어있어요.");
      }
    } catch (e: unknown) {
      setAiTestState("error");
      setAiTestError(e instanceof Error ? e.message : "알 수 없는 오류");
    }
  };

  const handleSaveAiSettings = () => {
    updateSettings({
      aiProvider,
      aiApiKey: aiApiKey.trim(),
      aiModel: aiModel.trim() || undefined,
    });
  };

  const handleTestUrl = async () => {
    setTestState("loading");
    const result = await testScriptUrl(scriptUrl.trim());
    if (result.ok) {
      setTestState("ok");
    } else {
      setTestState("error");
      setTestError(result.error ?? "알 수 없는 오류");
    }
  };

  if (!hydrated) return <div className="min-h-dvh" />;

  const handleToggleNotifications = async () => {
    if (state.notificationsEnabled) {
      setNotifications(false);
      return;
    }
    const ok = await requestNotificationPermission();
    setNotifications(ok);
    if (!ok) {
      alert("브라우저 알림 권한이 거부되었어요. 브라우저 설정에서 허용해주세요.");
    }
  };

  return (
    <div className="min-h-dvh px-6 py-8 md:px-10 md:py-12">
      <div className="max-w-2xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition"
          >
            <ArrowLeft className="size-4" /> 정원으로
          </Link>
        </div>

        <header>
          <h1 className="font-display text-4xl text-gradient-gold">설정</h1>
          <p className="text-sm text-muted-foreground mt-2">
            알람 시간과 알림 권한을 자유롭게 조정하세요.
          </p>
        </header>

        {/* Notifications */}
        <section className="bg-card/60 border border-white/10 rounded-3xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold">브라우저 알림</h2>
              <p className="text-xs text-muted-foreground mt-1">
                지정한 시간에 푸시 알림으로 할일을 알려드려요.
              </p>
            </div>
            <button
              onClick={handleToggleNotifications}
              className={`px-4 py-2 rounded-xl border text-sm font-semibold transition flex items-center gap-2 ${
                state.notificationsEnabled
                  ? "bg-primary/15 border-primary/40 text-primary"
                  : "bg-card border-white/10 text-muted-foreground hover:border-primary/40"
              }`}
            >
              {state.notificationsEnabled ? <Bell className="size-4" /> : <BellOff className="size-4" />}
              {state.notificationsEnabled ? "켜짐" : "꺼짐"}
            </button>
          </div>
        </section>

        {/* Times */}
        <section className="bg-card/60 border border-white/10 rounded-3xl p-6 space-y-5">
          <h2 className="font-semibold">알람 시간</h2>

          <label className="flex items-center justify-between gap-4 p-4 rounded-2xl bg-card border border-white/10">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-gradient-bloom flex items-center justify-center">
                <Sunrise className="size-5 text-primary" />
              </div>
              <div>
                <div className="font-medium text-sm">아침 브리핑</div>
                <div className="text-xs text-muted-foreground">오늘 할일 요약을 알려줍니다</div>
              </div>
            </div>
            <input
              type="time"
              value={state.settings.morningTime}
              onChange={(e) => updateSettings({ morningTime: e.target.value })}
              className="bg-input/40 rounded-lg px-3 py-2 text-base border border-white/10 tabular-nums"
            />
          </label>

          <label className="flex items-center justify-between gap-4 p-4 rounded-2xl bg-card border border-white/10">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-gradient-bloom flex items-center justify-center">
                <Moon className="size-5 text-primary" />
              </div>
              <div>
                <div className="font-medium text-sm">저녁 회고</div>
                <div className="text-xs text-muted-foreground">남은 할일을 마지막으로 짚어줍니다</div>
              </div>
            </div>
            <input
              type="time"
              value={state.settings.eveningTime}
              onChange={(e) => updateSettings({ eveningTime: e.target.value })}
              className="bg-input/40 rounded-lg px-3 py-2 text-base border border-white/10 tabular-nums"
            />
          </label>

          {/* 아침 문구 */}
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground flex items-center gap-1">
              <Sunrise className="size-3" /> 아침 알림 문구 <span className="text-muted-foreground/50">(비워두면 기본값)</span>
            </label>
            <input
              type="text"
              value={state.settings.morningMessage ?? ""}
              onChange={(e) => updateSettings({ morningMessage: e.target.value || undefined })}
              placeholder="오늘 가꿀 일 N개가 기다리고 있어요."
              className="w-full px-3 py-2 rounded-xl bg-input/40 border border-white/10 text-sm focus:border-primary/40 focus:outline-none"
            />
          </div>

          {/* 저녁 문구 */}
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground flex items-center gap-1">
              <Moon className="size-3" /> 저녁 알림 문구 <span className="text-muted-foreground/50">(비워두면 기본값)</span>
            </label>
            <input
              type="text"
              value={state.settings.eveningMessage ?? ""}
              onChange={(e) => updateSettings({ eveningMessage: e.target.value || undefined })}
              placeholder="미완료 N개 남았어요. 자정 전에 완료하세요."
              className="w-full px-3 py-2 rounded-xl bg-input/40 border border-white/10 text-sm focus:border-primary/40 focus:outline-none"
            />
          </div>

          <p className="text-xs text-muted-foreground">
            할일 자체의 알람은 각 할일에 설정한 시간으로 자동 발송됩니다.
          </p>
        </section>

        {/* Apps Script 동기화 */}
        <section className="bg-card/60 border border-white/10 rounded-3xl p-6 space-y-4">
          <div className="flex items-start gap-3">
            <div className="size-10 rounded-xl bg-gradient-bloom flex items-center justify-center shrink-0">
              <Link2 className="size-5 text-primary" />
            </div>
            <div className="flex-1">
              <h2 className="font-semibold">데이터 동기화 (Google Apps Script)</h2>
              <p className="text-xs text-muted-foreground mt-1">
                구글 시트에 Apps Script 웹앱을 배포하고 URL을 붙여넣으면 모든 기기에서 데이터가 동기화돼요.
              </p>
            </div>
          </div>

          <input
            type="url"
            placeholder="https://script.google.com/macros/s/.../exec"
            value={scriptUrl}
            onChange={(e) => {
              setScriptUrlState(e.target.value);
              setTestState("idle");
            }}
            className="w-full px-3 py-2.5 rounded-xl bg-input/40 border border-white/10 text-sm focus:border-primary/40 focus:outline-none"
          />

          <div className="flex items-center gap-2">
            <button
              onClick={() => void handleTestUrl()}
              disabled={!scriptUrl.trim() || testState === "loading"}
              className="px-4 py-2 rounded-xl border border-white/10 bg-card/60 hover:border-primary/40 text-sm text-muted-foreground hover:text-primary transition disabled:opacity-50 flex items-center gap-2"
            >
              {testState === "loading" && <Loader2 className="size-3.5 animate-spin" />}
              {testState === "ok" && <CheckCircle2 className="size-3.5 text-emerald-400" />}
              {testState === "error" && <XCircle className="size-3.5 text-rose-400" />}
              {testState === "idle" && "연결 테스트"}
              {testState === "loading" && "테스트 중..."}
              {testState === "ok" && "연결 성공!"}
              {testState === "error" && "연결 실패"}
            </button>

            <button
              onClick={handleSaveScriptUrl}
              disabled={!scriptUrl.trim()}
              className="px-4 py-2 rounded-xl bg-primary/15 border border-primary/40 text-primary text-sm font-semibold hover:bg-primary/25 transition disabled:opacity-40"
            >
              저장
            </button>
          </div>

          {testState === "error" && (
            <p className="text-xs text-rose-400">{testError}</p>
          )}

          {/* 수동 저장 */}
          {getScriptUrl() && (
            <div className="flex items-center gap-3 pt-1">
              <button
                onClick={() => void saveNow()}
                disabled={saveStatus === "saving"}
                className="px-4 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 text-sm font-semibold hover:bg-emerald-500/25 transition disabled:opacity-50 flex items-center gap-2"
              >
                {saveStatus === "saving" ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Save className="size-3.5" />
                )}
                {saveStatus === "saving" ? "저장 중..." : "지금 저장"}
              </button>
              {saveStatus === "saved" && (
                <span className="text-xs text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="size-3.5" /> 저장됨
                </span>
              )}
              {saveStatus === "error" && (
                <span className="text-xs text-rose-400 flex items-center gap-1">
                  <XCircle className="size-3.5" /> 저장 실패 (로컬에 백업됨)
                </span>
              )}
            </div>
          )}

          <div className="rounded-2xl bg-amber-500/5 border border-amber-500/20 p-4 text-xs text-amber-200/80 space-y-1">
            <p className="font-semibold text-amber-300">⚠️ 다른 기기에서 연동하려면</p>
            <p>Script URL은 기기마다 직접 입력해야 합니다. 위 URL을 다른 기기의 설정 페이지에도 붙여넣고 저장하세요.</p>
            <p className="pt-1 text-amber-200/60">연동이 안 된다면 → Apps Script 배포 시 <strong className="text-amber-300">액세스: 모든 사용자 (로그인 불필요)</strong> 로 설정했는지 확인하세요.</p>
          </div>

          <div className="rounded-2xl bg-background/40 border border-white/10 p-4 text-xs text-muted-foreground space-y-2">
            <div className="font-semibold text-foreground">⚙️ Apps Script 배포 방법</div>
            <ol className="space-y-1 list-decimal list-inside">
              <li>구글 시트 열기 → 확장 프로그램 → Apps Script</li>
              <li>아래 코드를 붙여넣고 저장</li>
            </ol>
            <pre className="bg-black/30 rounded px-2 py-2 text-[10px] font-mono text-primary/90 overflow-x-auto whitespace-pre">{`/**
 * 루미 가든 Apps Script 백엔드.
 * 자세한 API: docs/openclaw-integration.md
 */
const SHEET_NAME = "Sheet1";

function getSheet_() {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
}
function readState_() {
  const raw = getSheet_().getRange("A1").getValue();
  return raw ? JSON.parse(raw) : {};
}
function writeState_(state) {
  const sheet = getSheet_();
  sheet.getRange("A1").setValue(JSON.stringify(state));
  sheet.getRange("A2").setValue(new Date().toISOString());
}
function todayStr_() {
  const d = new Date();
  return d.getFullYear() + "-" +
    String(d.getMonth() + 1).padStart(2, "0") + "-" +
    String(d.getDate()).padStart(2, "0");
}
function jsonOk_(data, extra) {
  const p = Object.assign({ ok: true }, extra || {}, data ? { data } : {});
  return ContentService.createTextOutput(JSON.stringify(p))
    .setMimeType(ContentService.MimeType.JSON);
}
function jsonError_(msg) {
  return ContentService.createTextOutput(JSON.stringify({ ok: false, error: msg }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet() {
  return jsonOk_(readState_());
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return jsonError_("busy, try again");
  try {
    const body = JSON.parse(e.postData.contents);
    if (body && typeof body.action === "string") return handleAction_(body);
    writeState_(body);
    return jsonOk_(null);
  } catch (err) {
    return jsonError_(err.message || "unknown error");
  } finally {
    lock.releaseLock();
  }
}

function handleAction_(body) {
  const state = readState_();
  state.tasks = state.tasks || [];
  state.farms = state.farms || [];
  state.projects = state.projects || [];
  switch (body.action) {
    case "add_task": return addTaskAction_(state, body);
    case "complete_task": return completeTaskAction_(state, body);
    case "set_condition": return setConditionAction_(state, body);
    case "add_farm": return addFarmAction_(state, body);
    case "add_tree": return addTreeAction_(state, body);
    default: return jsonError_("unknown action: " + body.action);
  }
}

function addTaskAction_(state, body) {
  const title = (body.title || "").trim();
  if (!title) return jsonError_("title is required");
  state.tasks.push({
    id: Utilities.getUuid(), title: title,
    time: body.time || "09:00", difficulty: body.difficulty || "medium",
    kind: body.kind || "flex", completed: false, createdAt: Date.now(),
    date: body.date || todayStr_(), postponedCount: 0,
    order: state.tasks.length, projectId: body.projectId || null,
  });
  writeState_(state);
  return jsonOk_(state, { action: "add_task" });
}

function completeTaskAction_(state, body) {
  let target = null;
  if (body.id) target = state.tasks.find(function(t) { return t.id === body.id; });
  else if (body.title) {
    const t = todayStr_(), tl = body.title.toLowerCase();
    target = state.tasks.find(function(x) { return x.date === t && x.title.toLowerCase() === tl; });
  }
  if (!target) return jsonError_("task not found");
  target.completed = !target.completed;
  if (target.completed) target.completedAt = Date.now();
  else delete target.completedAt;
  writeState_(state);
  return jsonOk_(state, { action: "complete_task" });
}

function setConditionAction_(state, body) {
  if (["best","normal","low","sick"].indexOf(body.mode) === -1)
    return jsonError_("invalid mode: " + body.mode);
  state.condition = body.mode;
  state.conditionSetAt = Date.now();
  writeState_(state);
  return jsonOk_(state, { action: "set_condition" });
}

function addFarmAction_(state, body) {
  const title = (body.title || "").trim();
  if (!title) return jsonError_("title is required");
  state.farms.push({
    id: Utilities.getUuid(), title: title,
    icon: body.icon || "🌾", createdAt: Date.now(),
    order: state.farms.length,
  });
  writeState_(state);
  return jsonOk_(state, { action: "add_farm" });
}

function addTreeAction_(state, body) {
  const title = (body.title || "").trim();
  if (!title) return jsonError_("title is required");
  state.projects.push({
    id: Utilities.getUuid(), title: title,
    description: body.description || "", completed: false,
    createdAt: Date.now(), order: state.projects.length,
    farmId: body.farmId || null,
  });
  writeState_(state);
  return jsonOk_(state, { action: "add_tree" });
}`}</pre>
            <ol start={3} className="space-y-1 list-decimal list-inside">
              <li>배포 → 새 배포 → 유형: 웹앱</li>
              <li><strong className="text-foreground">실행: 나 / 액세스: 모든 사용자 (로그인 불필요)</strong></li>
              <li>배포 후 URL 복사해서 위에 붙여넣기</li>
              <li className="text-rose-400/80">⚠️ "Google 계정이 있는 사용자"로 설정하면 다른 기기에서 막힙니다</li>
            </ol>
          </div>
        </section>

        {/* Tools sheet */}
        <section className="bg-card/60 border border-white/10 rounded-3xl p-6 space-y-4">
          <div className="flex items-start gap-3">
            <div className="size-10 rounded-xl bg-gradient-bloom flex items-center justify-center shrink-0">
              <Wrench className="size-5 text-primary" />
            </div>
            <div className="flex-1">
              <h2 className="font-semibold">도구 라이브러리 (구글 시트)</h2>
              <p className="text-xs text-muted-foreground mt-1">
                자주 쓰는 도구 링크를 정리한 공개 구글 시트 URL을 붙여넣으세요. 도구 탭에서 검색하고
                할일/프로젝트에 첨부할 수 있어요.
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <input
              type="url"
              placeholder="https://docs.google.com/spreadsheets/d/.../edit#gid=0"
              value={toolsSheetUrlInput}
              onChange={(e) => setToolsSheetUrlInput(e.target.value)}
              className="flex-1 px-3 py-2.5 rounded-xl bg-input/40 border border-white/10 text-sm focus:border-primary/40 focus:outline-none"
            />
            <button
              type="button"
              onClick={() =>
                updateSettings({
                  toolsSheetUrl: toolsSheetUrlInput.trim() || undefined,
                })
              }
              className="px-4 py-2 rounded-xl bg-primary/15 border border-primary/40 text-primary text-sm font-semibold hover:bg-primary/25 transition shrink-0"
            >
              저장
            </button>
          </div>

          <div className="rounded-2xl bg-background/40 border border-white/10 p-4 text-xs text-muted-foreground space-y-2">
            <div className="font-semibold text-foreground">📋 시트 준비 방법</div>
            <ol className="space-y-1 list-decimal list-inside">
              <li>새 구글 시트를 만들고 첫 행에 헤더를 입력하세요:</li>
            </ol>
            <code className="block bg-black/30 rounded px-2 py-1.5 text-[11px] font-mono text-primary/90">
              name | url | category | tags | icon | description
            </code>
            <ol start={2} className="space-y-1 list-decimal list-inside">
              <li>각 행에 도구 정보를 채우세요. (tags는 쉼표로 구분, icon은 이모지 1개)</li>
              <li>
                우측 상단 <strong className="text-foreground">공유</strong> →{" "}
                <strong className="text-foreground">링크가 있는 모든 사용자</strong> →{" "}
                <strong className="text-foreground">뷰어</strong>로 설정
              </li>
              <li>주소창의 시트 URL을 복사해서 위에 붙여넣기</li>
            </ol>
            <p className="pt-2 border-t border-white/10 mt-2">
              ⚠️ 읽기 전용입니다. 추가/수정은 시트에서 직접 하고, 도구 탭에서 새로고침하세요.
            </p>
          </div>

          <Link
            to="/tools"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/15 border border-primary/40 text-primary text-sm font-semibold hover:bg-primary/25 transition"
          >
            <ExternalLink className="size-4" /> 도구 탭 열기
          </Link>
        </section>
        {/* AI 기능 설정 */}
        <section className="bg-card/60 border border-white/10 rounded-3xl p-6 space-y-4">
          <div className="flex items-start gap-3">
            <div className="size-10 rounded-xl bg-gradient-bloom flex items-center justify-center shrink-0">
              <Bot className="size-5 text-primary" />
            </div>
            <div className="flex-1">
              <h2 className="font-semibold">AI 기능 설정</h2>
              <p className="text-xs text-muted-foreground mt-1">
                Gemini 또는 OpenAI API 키를 입력하면 농장/나무 카드에서 AI와 대화하며 할일을 추가할 수 있어요.
              </p>
            </div>
          </div>

          {/* Provider 선택 */}
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">AI 제공자</label>
            <select
              value={aiProvider}
              onChange={(e) => setAiProvider(e.target.value as "gemini" | "openai" | "claude")}
              className="w-full px-3 py-2 rounded-xl bg-input/40 border border-white/10 text-sm focus:border-primary/40 focus:outline-none"
            >
              <option value="gemini">Gemini (Google)</option>
              <option value="openai">OpenAI (ChatGPT)</option>
              <option value="claude" disabled>Claude (Anthropic) — 준비 중</option>
            </select>
          </div>

          {/* API 키 */}
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">API 키</label>
            <input
              type="password"
              value={aiApiKey}
              onChange={(e) => setAiApiKey(e.target.value)}
              placeholder="API 키를 입력하세요"
              className="w-full px-3 py-2.5 rounded-xl bg-input/40 border border-white/10 text-sm focus:border-primary/40 focus:outline-none"
            />
          </div>

          {/* 모델 (선택사항) */}
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">모델 (선택사항, 비워두면 기본값 사용)</label>
            <input
              type="text"
              value={aiModel}
              onChange={(e) => setAiModel(e.target.value)}
              placeholder={aiProvider === "gemini" ? "gemini-2.0-flash" : "gpt-4o-mini"}
              className="w-full px-3 py-2.5 rounded-xl bg-input/40 border border-white/10 text-sm focus:border-primary/40 focus:outline-none"
            />
          </div>

          {/* 저장 + 테스트 버튼 */}
          <div className="flex gap-2">
            <button
              onClick={handleSaveAiSettings}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/15 border border-primary/40 text-primary text-sm font-semibold hover:bg-primary/25 transition"
            >
              <Save className="size-4" /> 저장
            </button>
            <button
              onClick={() => void handleTestAi()}
              disabled={aiTestState === "loading"}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 bg-card/60 hover:border-primary/40 text-sm text-muted-foreground hover:text-primary transition disabled:opacity-50"
            >
              {aiTestState === "loading" ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : aiTestState === "ok" ? (
                <CheckCircle2 className="size-3.5 text-emerald-400" />
              ) : aiTestState === "error" ? (
                <XCircle className="size-3.5 text-rose-400" />
              ) : (
                <ExternalLink className="size-3.5" />
              )}
              연결 테스트
            </button>
          </div>
          {aiTestState === "ok" && (
            <p className="text-xs text-emerald-400">✓ 연결 성공! AI 기능을 사용할 수 있어요.</p>
          )}
          {aiTestState === "error" && aiTestError && (
            <p className="text-xs text-rose-400">{aiTestError}</p>
          )}

          {/* 온오프 토글 */}
          <div className="border-t border-white/5 pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">AI 채팅</p>
                <p className="text-[11px] text-muted-foreground">농장/나무 카드에서 AI와 대화하며 할일 추가</p>
              </div>
              <button
                onClick={() => updateSettings({ aiChatEnabled: !(state.settings.aiChatEnabled ?? true) })}
                className="text-primary hover:text-primary/80 transition"
              >
                {(state.settings.aiChatEnabled ?? true) ? (
                  <ToggleRight className="size-8" />
                ) : (
                  <ToggleLeft className="size-8 text-muted-foreground" />
                )}
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">AI 응원 메시지</p>
                <p className="text-[11px] text-muted-foreground">컨디션 선택 시 미래 자아의 조언 생성 (OFF 시 기본 메시지)</p>
              </div>
              <button
                onClick={() => updateSettings({ aiConditionMessageEnabled: !(state.settings.aiConditionMessageEnabled ?? true) })}
                className="text-primary hover:text-primary/80 transition"
              >
                {(state.settings.aiConditionMessageEnabled ?? true) ? (
                  <ToggleRight className="size-8" />
                ) : (
                  <ToggleLeft className="size-8 text-muted-foreground" />
                )}
              </button>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}
