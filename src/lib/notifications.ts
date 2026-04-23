import { useEffect } from "react";
import type { Task } from "./garden-store";

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

const FIRED_KEY = "lumi-fired-v1";
const loadFired = (): Record<string, boolean> => {
  try {
    return JSON.parse(localStorage.getItem(FIRED_KEY) || "{}");
  } catch {
    return {};
  }
};
const saveFired = (m: Record<string, boolean>) =>
  localStorage.setItem(FIRED_KEY, JSON.stringify(m));

export function useReminders(tasks: Task[], enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const tick = () => {
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, "0");
      const mm = String(now.getMinutes()).padStart(2, "0");
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      const fired = loadFired();

      // Morning brief at 08:00
      const morningKey = `${today}-morning`;
      if (hh === "08" && mm === "00" && !fired[morningKey]) {
        const todays = tasks.filter((t) => t.date === today && !t.completed);
        notify("🌅 오늘의 정원", `오늘 가꿀 일 ${todays.length}개가 기다리고 있어요.`);
        fired[morningKey] = true;
      }
      // Evening reflect at 21:00
      const eveningKey = `${today}-evening`;
      if (hh === "21" && mm === "00" && !fired[eveningKey]) {
        const remaining = tasks.filter((t) => t.date === today && !t.completed);
        notify(
          "🌙 저녁 회고",
          remaining.length > 0
            ? `미완료 ${remaining.length}개. 자정까지 끝내면 벌점을 막을 수 있어요.`
            : "오늘의 정원이 완벽하게 피었습니다 ✨",
        );
        fired[eveningKey] = true;
      }
      // Per-task reminders
      for (const t of tasks) {
        if (t.completed || t.date !== today) continue;
        if (t.time === `${hh}:${mm}`) {
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
  }, [tasks, enabled]);
}
