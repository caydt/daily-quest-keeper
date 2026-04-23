import { createFileRoute, Link } from "@tanstack/react-router";
import { useGarden } from "@/lib/garden-store";
import { requestNotificationPermission } from "@/lib/notifications";
import { ArrowLeft, Bell, BellOff, Sunrise, Moon, Wrench, ExternalLink } from "lucide-react";

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
  const { state, hydrated, updateSettings, setNotifications } = useGarden();

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

          <p className="text-xs text-muted-foreground">
            할일 자체의 알람은 각 할일에 설정한 시간으로 자동 발송됩니다.
          </p>
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

          <input
            type="url"
            placeholder="https://docs.google.com/spreadsheets/d/.../edit#gid=0"
            value={state.settings.toolsSheetUrl ?? ""}
            onChange={(e) => updateSettings({ toolsSheetUrl: e.target.value })}
            className="w-full px-3 py-2.5 rounded-xl bg-input/40 border border-white/10 text-sm focus:border-primary/40 focus:outline-none"
          />

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
      </div>
    </div>
  );
}
