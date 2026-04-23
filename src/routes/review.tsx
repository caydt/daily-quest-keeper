import { createFileRoute, Link } from "@tanstack/react-router";
import { useGarden, todayStr, addDays } from "@/lib/garden-store";
import { ArrowLeft, TrendingUp, TrendingDown, Trophy, CalendarDays } from "lucide-react";

export const Route = createFileRoute("/review")({
  head: () => ({
    meta: [
      { title: "주간 회고 — 루미 가든" },
      { name: "description", content: "지난 7일 동안 정원이 얼마나 자랐는지 확인하세요." },
    ],
  }),
  component: ReviewPage,
});

function ReviewPage() {
  const { state, hydrated } = useGarden();
  if (!hydrated) return <div className="min-h-dvh" />;

  const today = todayStr();
  const days = Array.from({ length: 7 }).map((_, i) => addDays(today, -6 + i));

  const dayData = days.map((d) => {
    const log = state.history.find((h) => h.date === d);
    // 오늘의 데이터는 history에 누적되어 있음
    return {
      date: d,
      completed: log?.completed ?? 0,
      xpGained: log?.xpGained ?? 0,
      xpLost: log?.xpLost ?? 0,
    };
  });

  const totalGained = dayData.reduce((s, d) => s + d.xpGained, 0);
  const totalLost = dayData.reduce((s, d) => s + d.xpLost, 0);
  const totalCompleted = dayData.reduce((s, d) => s + d.completed, 0);
  const net = totalGained - totalLost;
  const best = [...dayData].sort((a, b) => b.xpGained - a.xpGained)[0];
  const maxXp = Math.max(50, ...dayData.map((d) => Math.max(d.xpGained, d.xpLost)));

  const dayLabel = (d: string) => {
    const [y, m, day] = d.split("-").map(Number);
    const dt = new Date(y, m - 1, day);
    return ["일", "월", "화", "수", "목", "금", "토"][dt.getDay()];
  };

  return (
    <div className="min-h-dvh px-6 py-8 md:px-10 md:py-12">
      <div className="max-w-4xl mx-auto space-y-8">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition"
        >
          <ArrowLeft className="size-4" /> 정원으로
        </Link>

        <header>
          <h1 className="font-display text-4xl text-gradient-gold">주간 회고</h1>
          <p className="text-sm text-muted-foreground mt-2">지난 7일간의 성장을 돌아보세요.</p>
        </header>

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-5 rounded-2xl border border-white/10 bg-card/60">
            <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-widest">
              <Trophy className="size-3.5" /> 완료
            </div>
            <div className="font-display text-3xl text-gradient-gold mt-2 tabular-nums">
              {totalCompleted}
            </div>
          </div>
          <div className="p-5 rounded-2xl border border-white/10 bg-card/60">
            <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-widest">
              <TrendingUp className="size-3.5 text-primary" /> 획득 XP
            </div>
            <div className="font-display text-3xl text-primary mt-2 tabular-nums">+{totalGained}</div>
          </div>
          <div className="p-5 rounded-2xl border border-white/10 bg-card/60">
            <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-widest">
              <TrendingDown className="size-3.5 text-destructive" /> 차감 XP
            </div>
            <div className="font-display text-3xl text-destructive mt-2 tabular-nums">-{totalLost}</div>
          </div>
          <div className="p-5 rounded-2xl border border-white/10 bg-card/60">
            <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-widest">
              <CalendarDays className="size-3.5" /> 순 성장
            </div>
            <div
              className={`font-display text-3xl mt-2 tabular-nums ${net >= 0 ? "text-gradient-gold" : "text-destructive"}`}
            >
              {net >= 0 ? "+" : ""}
              {net}
            </div>
          </div>
        </div>

        {/* Bar chart */}
        <section className="p-6 rounded-3xl border border-white/10 bg-card/60">
          <h2 className="font-semibold mb-6">일별 XP 변화</h2>
          <div className="grid grid-cols-7 gap-3 items-end h-56">
            {dayData.map((d) => {
              const gainedH = (d.xpGained / maxXp) * 100;
              const lostH = (d.xpLost / maxXp) * 100;
              const isToday = d.date === today;
              return (
                <div key={d.date} className="flex flex-col items-center gap-2 h-full">
                  <div className="flex-1 w-full flex items-end justify-center gap-1">
                    <div className="w-1/2 flex flex-col justify-end h-full">
                      <div
                        className="rounded-t-lg bg-gradient-to-t from-primary/40 to-primary transition-all"
                        style={{ height: `${gainedH}%`, minHeight: d.xpGained > 0 ? "4px" : "0" }}
                        title={`+${d.xpGained} XP`}
                      />
                    </div>
                    <div className="w-1/2 flex flex-col justify-end h-full">
                      <div
                        className="rounded-t-lg bg-gradient-to-t from-destructive/40 to-destructive transition-all"
                        style={{ height: `${lostH}%`, minHeight: d.xpLost > 0 ? "4px" : "0" }}
                        title={`-${d.xpLost} XP`}
                      />
                    </div>
                  </div>
                  <div
                    className={`text-xs ${isToday ? "text-primary font-bold" : "text-muted-foreground"}`}
                  >
                    {dayLabel(d.date)}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex justify-center gap-5 mt-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm bg-primary" /> 획득
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm bg-destructive" /> 차감
            </span>
          </div>
        </section>

        {/* Insights */}
        <section className="p-6 rounded-3xl border border-white/10 bg-card/60 space-y-3">
          <h2 className="font-semibold">이번 주 인사이트</h2>
          <ul className="space-y-2 text-sm">
            <li className="flex gap-2">
              <span className="text-primary">●</span>
              {best && best.xpGained > 0 ? (
                <span>
                  최고의 날은 <strong className="text-primary">{best.date}</strong> ({best.xpGained}{" "}
                  XP) 였어요.
                </span>
              ) : (
                <span className="text-muted-foreground">아직 완료 기록이 없어요. 첫 씨앗을 심어보세요.</span>
              )}
            </li>
            <li className="flex gap-2">
              <span className="text-primary">●</span>
              <span>
                현재 연속 개화: <strong className="text-primary">{state.streak}일</strong>
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-primary">●</span>
              <span>
                {totalLost > totalGained
                  ? "이번 주는 미완료가 더 많았어요. 다음 주는 '미뤄도 OK' 옵션을 활용해보세요."
                  : totalGained > 0
                    ? "이번 주의 정원은 활발하게 자라고 있어요. 계속 가꿔주세요!"
                    : "이번 주에 새 씨앗을 심어보세요."}
              </span>
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}
