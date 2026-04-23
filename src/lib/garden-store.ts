import { useEffect, useState, useCallback } from "react";

export type Task = {
  id: string;
  title: string;
  time: string; // "HH:MM"
  difficulty: "easy" | "medium" | "hard";
  completed: boolean;
  completedAt?: number;
  createdAt: number;
  date: string; // YYYY-MM-DD
};

export type GardenState = {
  xp: number;
  totalXp: number;
  streak: number;
  lastActiveDate: string | null;
  tasks: Task[];
  notificationsEnabled: boolean;
};

const STORAGE_KEY = "lumi-garden-v1";

export const XP_REWARD = { easy: 20, medium: 45, hard: 80 } as const;
export const XP_PENALTY = { easy: 10, medium: 20, hard: 35 } as const;

export const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export const levelFromXp = (xp: number) => {
  // each level requires (level * 200) xp cumulatively-ish: simple curve
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
};

const load = (): GardenState => {
  if (typeof window === "undefined") return initial;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return initial;
    return { ...initial, ...JSON.parse(raw) };
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

  // Apply penalties for yesterday's missed tasks once per day
  useEffect(() => {
    if (!hydrated) return;
    const today = todayStr();
    if (state.lastActiveDate === today) return;

    setState((prev) => {
      let penalty = 0;
      const yesterdayMissed = prev.tasks.filter(
        (t) => t.date !== today && !t.completed,
      );
      for (const t of yesterdayMissed) penalty += XP_PENALTY[t.difficulty];

      // streak logic: if yesterday had completions, streak preserved/incremented
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;
      const completedYesterday = prev.tasks.some(
        (t) => t.date === yStr && t.completed,
      );
      const newStreak =
        prev.lastActiveDate === yStr && completedYesterday
          ? prev.streak
          : completedYesterday
            ? prev.streak + 0 // already counted
            : 0;

      return {
        ...prev,
        xp: Math.max(0, prev.xp - penalty),
        streak: newStreak,
        lastActiveDate: today,
      };
    });
  }, [hydrated, state.lastActiveDate, state.tasks]);

  const addTask = useCallback(
    (title: string, time: string, difficulty: Task["difficulty"]) => {
      setState((s) => ({
        ...s,
        tasks: [
          ...s.tasks,
          {
            id: crypto.randomUUID(),
            title,
            time,
            difficulty,
            completed: false,
            createdAt: Date.now(),
            date: todayStr(),
          },
        ],
      }));
    },
    [],
  );

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
      const newTotal = Math.max(0, s.totalXp + (wasCompleted ? 0 : reward));

      // Update streak when first completion of today
      const completedToday = tasks.some((t) => t.date === today && t.completed);
      const streak =
        !wasCompleted && completedToday && s.lastActiveDate !== today + ":streak"
          ? Math.max(s.streak, s.streak + (s.tasks.some((t) => t.date === today && t.completed) ? 0 : 1))
          : s.streak;

      return { ...s, tasks, xp: newXp, totalXp: newTotal, streak };
    });
  }, []);

  const deleteTask = useCallback((id: string) => {
    setState((s) => ({ ...s, tasks: s.tasks.filter((t) => t.id !== id) }));
  }, []);

  const setNotifications = useCallback((enabled: boolean) => {
    setState((s) => ({ ...s, notificationsEnabled: enabled }));
  }, []);

  return {
    state,
    hydrated,
    addTask,
    toggleTask,
    deleteTask,
    setNotifications,
  };
}
