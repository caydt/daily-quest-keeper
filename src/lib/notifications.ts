import { useEffect } from "react";
import type { Task, Settings } from "./garden-store";

export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof window === "undefined" || !("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const result = await Notification.requestPermission();
  return result === "granted";
}

export function notify(title: string, body: string) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  try {
    new Notification(title, { body, icon: "/favicon.ico" });
  } catch {
    /* ignore */
  }
}

const FIRED_KEY = "lumi-fired-v2";
const loadFired = (): Record<string, boolean> => {
  try {
    return JSON.parse(localStorage.getItem(FIRED_KEY) || "{}");
  } catch {
    return {};
  }
};
const saveFired = (m: Record<string, boolean>) =>
  localStorage.setItem(FIRED_KEY, JSON.stringify(m));

export function useReminders(tasks: Task[], settings: Settings, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const tick = () => {
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, "0");
      const mm = String(now.getMinutes()).padStart(2, "0");
      const cur = `${hh}:${mm}`;
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      const fired = loadFired();

      const morningKey = `${today}-morning`;
      if (cur === settings.morningTime && !fired[morningKey]) {
        const todays = tasks.filter((t) => t.date === today && !t.completed);
        const defaultMorning = `오늘 가꿀 일 ${todays.length}개가 기다리고 있어요.`;
        notify("🌅 오늘의 정원", settings.morningMessage || defaultMorning);
        fired[morningKey] = true;
      }
      const eveningKey = `${today}-evening`;
      if (cur === settings.eveningTime && !fired[eveningKey]) {
        const remaining = tasks.filter((t) => t.date === today && !t.completed);
        const must = remaining.filter((t) => t.kind === "must").length;
        const defaultEvening = remaining.length > 0
          ? `미완료 ${remaining.length}개 (필수 ${must}). 자정 전에 완료하세요.`
          : "오늘의 정원이 완벽하게 피었습니다 ✨";
        notify("🌙 저녁 회고", settings.eveningMessage || defaultEvening);
        fired[eveningKey] = true;
      }
      for (const t of tasks) {
        if (t.completed || t.date !== today) continue;
        if (t.time === cur) {
          const key = `${today}-${t.id}`;
          if (!fired[key]) {
            notify("⏰ 시간이 됐어요", `${t.title}`);
            fired[key] = true;
          }
        }
      }
      saveFired(fired);
    };

    tick();
    const id = window.setInterval(tick, 30_000);
    return () => window.clearInterval(id);
  }, [tasks, enabled, settings.morningTime, settings.eveningTime]);
}
