import { useEffect, useState, useCallback } from "react";

export type TaskKind = "must" | "flex"; // must = 당일 필수(벌점), flex = 연기 가능(벌점 없음)

export type Task = {
  id: string;
  title: string;
  time: string; // "HH:MM"
  difficulty: "easy" | "medium" | "hard";
  kind: TaskKind;
  completed: boolean;
  completedAt?: number;
  createdAt: number;
  date: string; // YYYY-MM-DD (현재 예정일)
  postponedCount?: number;
};

export type Settings = {
  morningTime: string; // "HH:MM"
  eveningTime: string;
};

export type DayLog = {
  date: string;
  completed: number;
  total: number;
  xpGained: number;
  xpLost: number;
};

export type GardenState = {
  xp: number;
  totalXp: number;
  streak: number;
  lastActiveDate: string | null;
  tasks: Task[];
  notificationsEnabled: boolean;
  settings: Settings;
  history: DayLog[];
};

const STORAGE_KEY = "lumi-garden-v2";

export const XP_REWARD = { easy: 20, medium: 45, hard: 80 } as const;
export const XP_PENALTY = { easy: 10, medium: 20, hard: 35 } as const;

export const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export const addDays = (dateStr: string, days: number) => {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
};

export const levelFromXp = (xp: number) => {
  let level = 1;
  let need = 200;
  let remaining = xp;
  while (remaining >= need) {
    remaining -= need;
    level += 1;
    need = level * 200;
  }
  return { level, currentXp: remaining, nextXp: need };
};

const initial: GardenState = {
  xp: 0,
  totalXp: 0,
  streak: 0,
  lastActiveDate: null,
  tasks: [],
  notificationsEnabled: false,
  settings: { morningTime: "08:00", eveningTime: "21:00" },
  history: [],
};

const load = (): GardenState => {
  if (typeof window === "undefined") return initial;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      // migrate from v1 if exists
      const v1 = localStorage.getItem("lumi-garden-v1");
      if (v1) {
        const old = JSON.parse(v1);
        const migrated = {
          ...initial,
          ...old,
          tasks: (old.tasks || []).map((t: any) => ({ ...t, kind: t.kind ?? "must" })),
          settings: initial.settings,
          history: [],
        };
        return migrated;
      }
      return initial;
    }
    const parsed = JSON.parse(raw);
    return {
      ...initial,
      ...parsed,
      settings: { ...initial.settings, ...(parsed.settings || {}) },
      history: parsed.history || [],
    };
  } catch {
    return initial;
  }
};

const save = (s: GardenState) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
};

export function useGarden() {
  const [state, setState] = useState<GardenState>(initial);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setState(load());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) save(state);
  }, [state, hydrated]);

  // 일일 정산: 어제까지의 'must' 미완료에만 벌점, 'flex'는 그대로 다음 날로 이월
  useEffect(() => {
    if (!hydrated) return;
    const today = todayStr();
    if (state.lastActiveDate === today) return;

    setState((prev) => {
      let penalty = 0;
      const newTasks: Task[] = [];
      const logsByDate: Record<string, DayLog> = {};

      for (const t of prev.tasks) {
        if (t.completed) {
          newTasks.push(t);
          continue;
        }
        if (t.date >= today) {
          newTasks.push(t);
          continue;
        }
        // 미완료 + 과거
        if (t.kind === "must") {
          penalty += XP_PENALTY[t.difficulty];
          // 기록만 남기고 제거 (시들었음)
          const log = (logsByDate[t.date] ??= {
            date: t.date,
            completed: 0,
            total: 0,
            xpGained: 0,
            xpLost: 0,
          });
          log.total += 1;
          log.xpLost += XP_PENALTY[t.difficulty];
        } else {
          // flex: 오늘로 이월
          newTasks.push({
            ...t,
            date: today,
            postponedCount: (t.postponedCount ?? 0) + 1,
          });
        }
      }

      // 어제 완료 여부로 streak 갱신
      const yStr = addDays(today, -1);
      const completedYesterday = prev.tasks.some((t) => t.date === yStr && t.completed);
      const newStreak = completedYesterday ? prev.streak : 0;

      const newHistory = [...prev.history];
      for (const log of Object.values(logsByDate)) {
        const idx = newHistory.findIndex((h) => h.date === log.date);
        if (idx >= 0) {
          newHistory[idx] = {
            ...newHistory[idx],
            total: newHistory[idx].total + log.total,
            xpLost: newHistory[idx].xpLost + log.xpLost,
          };
        } else {
          newHistory.push(log);
        }
      }

      return {
        ...prev,
        tasks: newTasks,
        xp: Math.max(0, prev.xp - penalty),
        streak: newStreak,
        lastActiveDate: today,
        history: newHistory.slice(-60),
      };
    });
  }, [hydrated, state.lastActiveDate, state.tasks]);

  const addTask = useCallback(
    (title: string, time: string, difficulty: Task["difficulty"], kind: TaskKind) => {
      setState((s) => ({
        ...s,
        tasks: [
          ...s.tasks,
          {
            id: crypto.randomUUID(),
            title,
            time,
            difficulty,
            kind,
            completed: false,
            createdAt: Date.now(),
            date: todayStr(),
            postponedCount: 0,
          },
        ],
      }));
    },
    [],
  );

  const recordHistory = (state: GardenState, date: string, patch: Partial<DayLog>) => {
    const history = [...state.history];
    const idx = history.findIndex((h) => h.date === date);
    if (idx >= 0) {
      history[idx] = {
        ...history[idx],
        completed: history[idx].completed + (patch.completed ?? 0),
        total: history[idx].total + (patch.total ?? 0),
        xpGained: history[idx].xpGained + (patch.xpGained ?? 0),
        xpLost: history[idx].xpLost + (patch.xpLost ?? 0),
      };
    } else {
      history.push({
        date,
        completed: patch.completed ?? 0,
        total: patch.total ?? 0,
        xpGained: patch.xpGained ?? 0,
        xpLost: patch.xpLost ?? 0,
      });
    }
    return history.slice(-60);
  };

  const toggleTask = useCallback((id: string) => {
    setState((s) => {
      const task = s.tasks.find((t) => t.id === id);
      if (!task) return s;
      const wasCompleted = task.completed;
      const reward = XP_REWARD[task.difficulty];
      const today = todayStr();

      const tasks = s.tasks.map((t) =>
        t.id === id
          ? { ...t, completed: !t.completed, completedAt: !t.completed ? Date.now() : undefined }
          : t,
      );

      const xpDelta = wasCompleted ? -reward : reward;
      const newXp = Math.max(0, s.xp + xpDelta);
      const newTotal = Math.max(0, s.totalXp + (wasCompleted ? -reward : reward));

      const completedTodayBefore = s.tasks.some((t) => t.date === today && t.completed);
      let streak = s.streak;
      if (!wasCompleted && !completedTodayBefore) streak = s.streak + 1;

      const history = recordHistory(s, today, {
        completed: wasCompleted ? -1 : 1,
        xpGained: wasCompleted ? -reward : reward,
      });

      return { ...s, tasks, xp: newXp, totalXp: newTotal, streak, history };
    });
  }, []);

  const deleteTask = useCallback((id: string) => {
    setState((s) => ({ ...s, tasks: s.tasks.filter((t) => t.id !== id) }));
  }, []);

  const postponeTask = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      tasks: s.tasks.map((t) =>
        t.id === id && t.kind === "flex"
          ? { ...t, date: addDays(t.date, 1), postponedCount: (t.postponedCount ?? 0) + 1 }
          : t,
      ),
    }));
  }, []);

  const setNotifications = useCallback((enabled: boolean) => {
    setState((s) => ({ ...s, notificationsEnabled: enabled }));
  }, []);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setState((s) => ({ ...s, settings: { ...s.settings, ...patch } }));
  }, []);

  return {
    state,
    hydrated,
    addTask,
    toggleTask,
    deleteTask,
    postponeTask,
    setNotifications,
    updateSettings,
  };
}
