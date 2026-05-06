import { useEffect, useState, useCallback, useRef } from "react";
import type { Tool } from "@/lib/tools-sheet";
import { createLocalAdapter } from "@/lib/storage";
import { getScriptUrl, createSheetsAdapter } from "@/lib/sheets-adapter";

export type TaskKind = "must" | "flex"; // must = 당일 필수(벌점), flex = 연기 가능(벌점 없음)

export type ConditionMode = "best" | "normal" | "low" | "sick";

export const CONDITION_META: Record<
  ConditionMode,
  { label: string; icon: string; desc: string; color: string }
> = {
  best:   { label: "최상",  icon: "🔥", desc: "전체 할일",              color: "text-amber-400"   },
  normal: { label: "보통",  icon: "😊", desc: "필수 + 어려운 할일",     color: "text-emerald-400" },
  low:    { label: "저조",  icon: "😔", desc: "필수 할일만",             color: "text-blue-400"    },
  sick:   { label: "아픔",  icon: "🤒", desc: "최소 필수만 (쉬어가요)", color: "text-rose-400"    },
};

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
  order: number;
  projectId?: string | null; // 프로젝트에 속한 서브태스크
  toolIds?: string[]; // 첨부된 도구 ID들 (시트 행 ID 또는 name)
};

export type Settings = {
  morningTime: string; // "HH:MM"
  eveningTime: string;
  morningMessage?: string; // 아침 알림 커스텀 문구
  eveningMessage?: string; // 저녁 알림 커스텀 문구
  toolsSheetUrl?: string;
  aiProvider?: "gemini" | "openai" | "claude";
  aiApiKey?: string;
  aiModel?: string;
  aiChatEnabled?: boolean;
  aiConditionMessageEnabled?: boolean;
};

export type DayLog = {
  date: string;
  completed: number;
  total: number;
  xpGained: number;
  xpLost: number;
};

export type Pledge = {
  date: string; // YYYY-MM-DD
  text: string;
};

export type Farm = {
  id: string;
  title: string;
  icon?: string;   // 농장 대표 이모지
  createdAt: number;
  order: number;
  toolIds?: string[];
  aiUrl?: string;
};

export type Project = {
  id: string;
  title: string;
  description?: string;
  completed: boolean;
  completedAt?: number;
  createdAt: number;
  dueDate?: string; // YYYY-MM-DD optional
  order: number;
  toolIds?: string[]; // 첨부된 도구 ID들
  farmId?: string | null; // 속한 농장 ID (null = 독립 나무)
  aiUrl?: string;
};

// 나무 성장 단계 (서브태스크 완료율 기반)
export const treeStage = (
  pct: number, // 0~100
  completed: boolean,
): { icon: string; label: string; tier: number } => {
  if (completed)        return { icon: "🏆", label: "완성",    tier: 5 };
  if (pct >= 80)        return { icon: "🌳", label: "거목",    tier: 4 };
  if (pct >= 50)        return { icon: "🌲", label: "성목",    tier: 3 };
  if (pct >= 20)        return { icon: "🌿", label: "새싹",    tier: 2 };
  return                       { icon: "🌱", label: "씨앗",    tier: 1 };
};

// 농장 성장 단계 (포함된 나무 수 + 평균 완료율 기반)
export const farmStage = (
  treeCount: number,
  avgPct: number,
): { icon: string; label: string } => {
  if (treeCount === 0)             return { icon: "🪨", label: "빈 땅"   };
  if (treeCount >= 5 && avgPct >= 80) return { icon: "🏡", label: "마을"   };
  if (treeCount >= 3 && avgPct >= 50) return { icon: "🌾", label: "농장"   };
  if (treeCount >= 2)              return { icon: "🌱", label: "정원"   };
  return                                   { icon: "🪴", label: "묘목장" };
};

export type Achievement = {
  id: string;
  label: string;
  desc: string;
  icon: string; // emoji
  unlockedAt?: number;
};

export type GardenState = {
  xp: number;
  totalXp: number;
  streak: number;
  combo: number; // 연속 완료 콤보
  lastCompletedAt?: number;
  dailyBonusGivenOn?: string; // YYYY-MM-DD: 그 날 일일 보너스 받았는지
  lastActiveDate: string | null;
  tasks: Task[];
  projects: Project[];
  farms: Farm[];
  notificationsEnabled: boolean;
  settings: Settings;
  history: DayLog[];
  achievements: Record<string, number>; // id -> unlockedAt timestamp
  condition: ConditionMode | null;     // 오늘 컨디션 (null = 아직 미선택)
  conditionSetOn: string | null;       // YYYY-MM-DD: 언제 설정했는지
  localTools: Tool[];                  // 앱 안에서 직접 등록한 도구들
  pledges: Pledge[];
};

// 컨디션에 따라 오늘 태스크를 필터링
export const filterTasksByCondition = (tasks: Task[], condition: ConditionMode): Task[] => {
  switch (condition) {
    case "best":
      return tasks;
    case "normal":
      // 필수(must) 전체 + flex 중 hard
      return tasks.filter((t) => t.kind === "must" || t.difficulty === "hard");
    case "low":
      // must 할일만
      return tasks.filter((t) => t.kind === "must");
    case "sick":
      // must 중 hard만 (절대 최소)
      return tasks.filter((t) => t.kind === "must" && t.difficulty === "hard");
  }
};

export const XP_REWARD = { easy: 20, medium: 45, hard: 80 } as const;
export const XP_PENALTY = { easy: 10, medium: 20, hard: 35 } as const;
export const DAILY_CLEAR_BONUS = 75; // 모든 일반 할일 완료 시
export const COMBO_WINDOW_MS = 1000 * 60 * 30; // 30분 내 연속이면 콤보 유지

export const ACHIEVEMENTS: Omit<Achievement, "unlockedAt">[] = [
  { id: "first_bloom", label: "첫 개화", desc: "첫 할일 완료", icon: "🌱" },
  { id: "daily_clear", label: "퍼펙트 데이", desc: "하루 모든 할일 완료", icon: "🏵️" },
  { id: "streak_3", label: "삼일 연승", desc: "3일 연속 완료", icon: "🔥" },
  { id: "streak_7", label: "주간 정원사", desc: "7일 연속", icon: "👑" },
  { id: "combo_5", label: "콤보 마스터", desc: "5콤보 달성", icon: "⚡" },
  { id: "combo_10", label: "전설의 손길", desc: "10콤보 달성", icon: "💫" },
  { id: "project_clear", label: "수확의 기쁨", desc: "프로젝트 1개 완료", icon: "🏆" },
  { id: "project_5", label: "위대한 정원", desc: "프로젝트 5개 완료", icon: "🌳" },
  { id: "level_5", label: "성숙한 정원", desc: "레벨 5 달성", icon: "🌟" },
  { id: "level_10", label: "전설의 정원", desc: "레벨 10 달성", icon: "💎" },
  { id: "no_wither", label: "무결점", desc: "벌점 없이 하루 완주", icon: "🛡️" },
  { id: "early_bird", label: "새벽 정원사", desc: "오전 7시 전 완료", icon: "🌅" },
];

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

// 정원 캐릭터 진화 단계
export const stageFromLevel = (level: number): { name: string; icon: string; tier: number } => {
  if (level >= 15) return { name: "고대 거목", icon: "🌳", tier: 5 };
  if (level >= 10) return { name: "만개한 정원수", icon: "🌸", tier: 4 };
  if (level >= 6) return { name: "꽃 피우는 새싹", icon: "🌷", tier: 3 };
  if (level >= 3) return { name: "어린 새싹", icon: "🌿", tier: 2 };
  return { name: "씨앗", icon: "🌱", tier: 1 };
};

const initial: GardenState = {
  xp: 0,
  totalXp: 0,
  streak: 0,
  combo: 0,
  lastActiveDate: null,
  tasks: [],
  projects: [],
  farms: [],
  notificationsEnabled: false,
  settings: { morningTime: "08:00", eveningTime: "21:00" },
  history: [],
  achievements: {},
  condition: null,
  conditionSetOn: null,
  localTools: [],
  pledges: [],
};

const checkAchievements = (s: GardenState, ctx: { event?: string }): GardenState => {
  const ach = { ...s.achievements };
  const now = Date.now();
  const grant = (id: string) => {
    if (!ach[id]) ach[id] = now;
  };

  if (s.totalXp > 0) grant("first_bloom");
  const { level } = levelFromXp(s.totalXp);
  if (level >= 5) grant("level_5");
  if (level >= 10) grant("level_10");
  if (s.streak >= 3) grant("streak_3");
  if (s.streak >= 7) grant("streak_7");
  if (s.combo >= 5) grant("combo_5");
  if (s.combo >= 10) grant("combo_10");

  const completedProjects = s.projects.filter((p) => p.completed).length;
  if (completedProjects >= 1) grant("project_clear");
  if (completedProjects >= 5) grant("project_5");

  const today = todayStr();
  const todays = s.tasks.filter((t) => t.date === today);
  if (todays.length > 0 && todays.every((t) => t.completed)) grant("daily_clear");

  if (ctx.event === "complete") {
    const h = new Date().getHours();
    if (h < 7) grant("early_bird");
  }

  return { ...s, achievements: ach };
};

export type SaveStatus = "idle" | "saving" | "saved" | "error";

export function useGarden() {
  const [state, setState] = useState<GardenState>(initial);
  const [hydrated, setHydrated] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const isApplyingRemote = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 로드: 로컬 먼저 즉시 렌더 → Apps Script 백그라운드 갱신
  useEffect(() => {
    let cancelled = false;

    const mergeState = (data: Partial<GardenState>): GardenState => ({
      ...initial,
      ...data,
      settings: { ...initial.settings, ...(data.settings || {}) },
      history: (data as GardenState).history || [],
      projects: (data as GardenState).projects || [],
      farms: (data as GardenState).farms || [],
      achievements: (data as GardenState).achievements || {},
      localTools: (data as GardenState).localTools || [],
      pledges: (data as GardenState).pledges || [],
    });

    const applyState = (next: GardenState) => {
      isApplyingRemote.current = true;
      setState(next);
      requestAnimationFrame(() => { isApplyingRemote.current = false; });
    };

    const run = async () => {
      // ① 로컬 데이터 즉시 로드 → 빈 화면 없이 바로 렌더
      const local = await createLocalAdapter().load();
      if (cancelled) return;
      applyState(local ? mergeState(local) : initial);
      setHydrated(true);

      // ② Apps Script URL 있으면 백그라운드에서 원격 데이터 가져와 갱신
      const scriptUrl = getScriptUrl();
      if (!scriptUrl) return;

      try {
        const remote = await createSheetsAdapter(scriptUrl).load();
        if (cancelled) return;

        if (!remote || Object.keys(remote).length === 0) {
          // 시트가 비어있으면 로컬 데이터를 업로드해 초기화
          if (local) await createSheetsAdapter(scriptUrl).save(local).catch(() => {});
          return;
        }

        // 원격 데이터가 있으면 갱신 (로컬보다 우선)
        applyState(mergeState(remote));
      } catch {
        // Apps Script 실패 → 이미 로컬 데이터가 표시된 상태이므로 그대로 유지
      }
    };

    run();
    return () => { cancelled = true; };
  }, []);

  // 저장: StorageAdapter 기반 debounce 저장
  useEffect(() => {
    if (!hydrated) return;
    if (isApplyingRemote.current) return;

    const scriptUrl = getScriptUrl();
    const adapter = scriptUrl ? createSheetsAdapter(scriptUrl) : createLocalAdapter();

    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaveStatus("saving");
      try {
        await adapter.save(state);
        setSaveStatus("saved");
        if (savedResetTimer.current) clearTimeout(savedResetTimer.current);
        savedResetTimer.current = setTimeout(() => setSaveStatus("idle"), 2000);
      } catch {
        await createLocalAdapter().save(state);
        setSaveStatus("error");
        if (savedResetTimer.current) clearTimeout(savedResetTimer.current);
        savedResetTimer.current = setTimeout(() => setSaveStatus("idle"), 3000);
      }
    }, 600);

    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [state, hydrated]);

  // 윈도우 포커스 시 원격 데이터 리패치
  useEffect(() => {
    const onFocus = async () => {
      const scriptUrl = getScriptUrl();
      if (!scriptUrl) return;
      try {
        const remote = await createSheetsAdapter(scriptUrl).load();
        if (!remote) return;
        isApplyingRemote.current = true;
        setState((prev) => ({
          ...initial,
          ...remote,
          settings: { ...initial.settings, ...(remote.settings || prev.settings) },
          history: remote.history || [],
          projects: remote.projects || [],
          farms: remote.farms || [],
          achievements: remote.achievements || {},
          localTools: remote.localTools || [],
          pledges: remote.pledges || [],
        }));
        requestAnimationFrame(() => { isApplyingRemote.current = false; });
      } catch {
        /* 무시 */
      }
    };

    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  // 일일 정산
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
        if (t.kind === "must") {
          penalty += XP_PENALTY[t.difficulty];
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
          newTasks.push({
            ...t,
            date: today,
            postponedCount: (t.postponedCount ?? 0) + 1,
          });
        }
      }

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
        combo: 0,
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
            order: s.tasks.length,
            projectId: null,
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
      const baseReward = XP_REWARD[task.difficulty];
      const today = todayStr();
      const now = Date.now();

      // 콤보 계산
      let combo = s.combo;
      if (!wasCompleted) {
        if (s.lastCompletedAt && now - s.lastCompletedAt < COMBO_WINDOW_MS) {
          combo = s.combo + 1;
        } else {
          combo = 1;
        }
      } else {
        combo = Math.max(0, s.combo - 1);
      }

      // 콤보 보너스 배율: 5콤보부터 1.5배, 10콤보부터 2배
      const multiplier = !wasCompleted ? (combo >= 10 ? 2 : combo >= 5 ? 1.5 : 1) : 1;
      const reward = Math.round(baseReward * multiplier);

      // 개별 할일 XP 캡: 레벨업은 일일 전체 완료 또는 프로젝트 완료 시에만 허용
      // 할일 XP가 레벨 경계를 넘지 않도록 제한
      const { currentXp, nextXp } = levelFromXp(s.totalXp);
      let xpDelta: number;
      if (!wasCompleted) {
        const headroom = Math.max(0, nextXp - currentXp - 1);
        xpDelta = Math.min(reward, headroom);
      } else {
        xpDelta = -reward;
      }

      const tasks = s.tasks.map((t) =>
        t.id === id
          ? { ...t, completed: !t.completed, completedAt: !t.completed ? now : undefined }
          : t,
      );

      let newTotal = Math.max(0, s.totalXp + xpDelta);
      let newXp = Math.max(0, s.xp + xpDelta);

      const completedTodayBefore = s.tasks.some((t) => t.date === today && t.completed);
      let streak = s.streak;
      if (!wasCompleted && !completedTodayBefore) streak = s.streak + 1;

      // 일일 보너스: 오늘 할일을 전부 완료하면 즉시 레벨업 보장
      let dailyBonusGivenOn = s.dailyBonusGivenOn;
      const todaysTasks = tasks.filter((t) => t.date === today);
      const allDone = todaysTasks.length > 0 && todaysTasks.every((t) => t.completed);
      let bonusDelta = 0;
      if (!wasCompleted && allDone && dailyBonusGivenOn !== today) {
        // 현재 레벨에서 남은 XP를 전부 채워 즉시 레벨업
        const { currentXp: cxp, nextXp: nxp } = levelFromXp(newTotal);
        bonusDelta = Math.max(nxp - cxp, DAILY_CLEAR_BONUS);
        dailyBonusGivenOn = today;
        newXp += bonusDelta;
        newTotal += bonusDelta;
      }
      // 보너스 회수: 완료 해제로 allDone이 아닌데 오늘 보너스를 이미 받은 경우
      if (wasCompleted && dailyBonusGivenOn === today && !allDone) {
        bonusDelta = -DAILY_CLEAR_BONUS;
        dailyBonusGivenOn = undefined;
        newXp = Math.max(0, newXp + bonusDelta);
        newTotal = Math.max(0, newTotal + bonusDelta);
      }

      const history = recordHistory(s, today, {
        completed: wasCompleted ? -1 : 1,
        xpGained: xpDelta + bonusDelta,
      });

      const next: GardenState = {
        ...s,
        tasks,
        xp: newXp,
        totalXp: newTotal,
        streak,
        combo,
        lastCompletedAt: !wasCompleted ? now : s.lastCompletedAt,
        dailyBonusGivenOn,
        history,
      };
      return checkAchievements(next, { event: !wasCompleted ? "complete" : "uncomplete" });
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

  // 프로젝트 서브태스크 직접 추가
  const addSubTask = useCallback((projectId: string, title: string, difficulty: Task["difficulty"] = "medium", kind: TaskKind = "flex") => {
    setState((s) => ({
      ...s,
      tasks: [
        ...s.tasks,
        {
          id: crypto.randomUUID(),
          title,
          time: "09:00",
          difficulty,
          kind,
          completed: false,
          createdAt: Date.now(),
          date: todayStr(),
          postponedCount: 0,
          order: s.tasks.length,
          projectId,
        },
      ],
    }));
  }, []);

  // 할일 순서 재정렬
  const reorderTasks = useCallback((orderedIds: string[]) => {
    setState((s) => {
      const map = new Map(orderedIds.map((id, i) => [id, i]));
      return {
        ...s,
        tasks: s.tasks.map((t) => (map.has(t.id) ? { ...t, order: map.get(t.id)! } : t)),
      };
    });
  }, []);

  // 할일을 프로젝트로 이동 (또는 해제)
  const assignTaskToProject = useCallback((taskId: string, projectId: string | null) => {
    setState((s) => ({
      ...s,
      tasks: s.tasks.map((t) => (t.id === taskId ? { ...t, projectId } : t)),
    }));
  }, []);

  // 할일 날짜 변경
  const moveTaskToDate = useCallback((taskId: string, date: string) => {
    setState((s) => ({
      ...s,
      tasks: s.tasks.map((t) => (t.id === taskId ? { ...t, date } : t)),
    }));
  }, []);

  // 도구 첨부/해제
  const toggleTaskTool = useCallback((taskId: string, toolId: string) => {
    setState((s) => ({
      ...s,
      tasks: s.tasks.map((t) => {
        if (t.id !== taskId) return t;
        const cur = t.toolIds ?? [];
        return {
          ...t,
          toolIds: cur.includes(toolId) ? cur.filter((x) => x !== toolId) : [...cur, toolId],
        };
      }),
    }));
  }, []);

  const toggleProjectTool = useCallback((projectId: string, toolId: string) => {
    setState((s) => ({
      ...s,
      projects: s.projects.map((p) => {
        if (p.id !== projectId) return p;
        const cur = p.toolIds ?? [];
        return {
          ...p,
          toolIds: cur.includes(toolId) ? cur.filter((x) => x !== toolId) : [...cur, toolId],
        };
      }),
    }));
  }, []);

  const setNotifications = useCallback((enabled: boolean) => {
    setState((s) => ({ ...s, notificationsEnabled: enabled }));
  }, []);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setState((s) => ({ ...s, settings: { ...s.settings, ...patch } }));
  }, []);

  // ====== Projects ======
  const addProject = useCallback((title: string, description?: string, dueDate?: string, farmId?: string | null) => {
    setState((s) => ({
      ...s,
      projects: [
        ...s.projects,
        {
          id: crypto.randomUUID(),
          title,
          description,
          dueDate,
          completed: false,
          createdAt: Date.now(),
          order: s.projects.length,
          farmId: farmId ?? null,
        },
      ],
    }));
  }, []);

  const deleteProject = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      projects: s.projects.filter((p) => p.id !== id),
      // 해당 프로젝트의 서브태스크는 해제
      tasks: s.tasks.map((t) => (t.projectId === id ? { ...t, projectId: null } : t)),
    }));
  }, []);

  const updateProject = useCallback((id: string, patch: Partial<Pick<Project, "aiUrl" | "title" | "description" | "dueDate">>) => {
    setState((s) => ({
      ...s,
      projects: s.projects.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    }));
  }, []);

  const reorderProjects = useCallback((orderedIds: string[]) => {
    setState((s) => {
      const map = new Map(orderedIds.map((id, i) => [id, i]));
      return {
        ...s,
        projects: s.projects.map((p) =>
          map.has(p.id) ? { ...p, order: map.get(p.id)! } : p,
        ),
      };
    });
  }, []);

  const toggleProject = useCallback((id: string) => {
    setState((s) => {
      const project = s.projects.find((p) => p.id === id);
      if (!project) return s;
      const wasCompleted = project.completed;
      const today = todayStr();

      // 서브태스크가 있어야 진짜 프로젝트 → 즉시 레벨업
      // 서브태스크 없으면 단순 나무 → 일반 XP만 (레벨업 없음)
      const childTasks = s.tasks.filter((t) => t.projectId === id);
      const isRealProject = childTasks.length > 0;

      let delta: number;
      if (isRealProject) {
        // 진짜 프로젝트: 현재 레벨 남은 XP 전부 채워 즉시 레벨업
        const { currentXp, nextXp } = levelFromXp(s.totalXp);
        const reward = Math.max(1, nextXp - currentXp);
        delta = wasCompleted ? -reward : reward;
      } else {
        // 단순 나무: medium XP(45), 레벨 경계 못 넘도록 캡
        const baseReward = XP_REWARD.medium;
        const { currentXp, nextXp } = levelFromXp(s.totalXp);
        const headroom = Math.max(0, nextXp - currentXp - 1);
        delta = wasCompleted ? -baseReward : Math.min(baseReward, headroom);
      }

      const projects = s.projects.map((p) =>
        p.id === id
          ? { ...p, completed: !p.completed, completedAt: !p.completed ? Date.now() : undefined }
          : p,
      );

      const newXp = Math.max(0, s.xp + delta);
      const newTotal = Math.max(0, s.totalXp + delta);

      const history = recordHistory(s, today, { xpGained: delta });

      const next: GardenState = {
        ...s,
        projects,
        xp: newXp,
        totalXp: newTotal,
        history,
      };
      return checkAchievements(next, {});
    });
  }, []);

  // ====== Farms ======
  const addFarm = useCallback((title: string, icon?: string) => {
    setState((s) => ({
      ...s,
      farms: [
        ...s.farms,
        {
          id: crypto.randomUUID(),
          title,
          icon: icon ?? "🌾",
          createdAt: Date.now(),
          order: s.farms.length,
        },
      ],
    }));
  }, []);

  const deleteFarm = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      farms: s.farms.filter((f) => f.id !== id),
      // 해당 농장 나무들은 독립 나무로 전환
      projects: s.projects.map((p) =>
        p.farmId === id ? { ...p, farmId: null } : p,
      ),
    }));
  }, []);

  const updateFarm = useCallback((id: string, patch: Partial<Pick<Farm, "title" | "icon" | "aiUrl" | "toolIds">>) => {
    setState((s) => ({
      ...s,
      farms: s.farms.map((f) => (f.id === id ? { ...f, ...patch } : f)),
    }));
  }, []);

  const toggleFarmTool = useCallback((farmId: string, toolId: string) => {
    setState((s) => ({
      ...s,
      farms: s.farms.map((f) => {
        if (f.id !== farmId) return f;
        const cur = f.toolIds ?? [];
        return {
          ...f,
          toolIds: cur.includes(toolId) ? cur.filter((x) => x !== toolId) : [...cur, toolId],
        };
      }),
    }));
  }, []);

  const moveFarm = useCallback((id: string, direction: "up" | "down") => {
    setState((s) => {
      const sorted = [...s.farms].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      const idx = sorted.findIndex((f) => f.id === id);
      if (idx === -1) return s;
      const swapIdx = direction === "up" ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= sorted.length) return s;

      const a = sorted[idx];
      const b = sorted[swapIdx];
      const orderA = a.order ?? idx;
      const orderB = b.order ?? swapIdx;
      return {
        ...s,
        farms: s.farms.map((f) => {
          if (f.id === a.id) return { ...f, order: orderB };
          if (f.id === b.id) return { ...f, order: orderA };
          return f;
        }),
      };
    });
  }, []);

  // 나무(프로젝트)를 농장으로 이동하거나 독립 나무로 전환
  const moveProjectToFarm = useCallback((projectId: string, farmId: string | null) => {
    setState((s) => ({
      ...s,
      projects: s.projects.map((p) =>
        p.id === projectId ? { ...p, farmId } : p,
      ),
    }));
  }, []);

  // ====== Local Tools CRUD ======
  const addLocalTool = useCallback(
    (tool: Omit<Tool, "id" | "tags"> & { tags?: string[] }) => {
      setState((s) => ({
        ...s,
        localTools: [
          ...s.localTools,
          {
            ...tool,
            id: `local-${crypto.randomUUID()}`,
            tags: tool.tags ?? [],
          },
        ],
      }));
    },
    [],
  );

  const updateLocalTool = useCallback((id: string, patch: Partial<Omit<Tool, "id">>) => {
    setState((s) => ({
      ...s,
      localTools: s.localTools.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    }));
  }, []);

  const deleteLocalTool = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      localTools: s.localTools.filter((t) => t.id !== id),
      // 연결된 할일/프로젝트에서도 제거
      tasks: s.tasks.map((t) => ({ ...t, toolIds: (t.toolIds ?? []).filter((x) => x !== id) })),
      projects: s.projects.map((p) => ({
        ...p,
        toolIds: (p.toolIds ?? []).filter((x) => x !== id),
      })),
    }));
  }, []);

  const setCondition = useCallback((mode: ConditionMode) => {
    setState((s) => ({
      ...s,
      condition: mode,
      conditionSetOn: todayStr(),
    }));
  }, []);

  const setPledge = useCallback((text: string) => {
    const today = todayStr();
    setState((s) => {
      const existing = s.pledges.findIndex((p) => p.date === today);
      const pledges =
        existing >= 0
          ? s.pledges.map((p, i) => (i === existing ? { date: today, text } : p))
          : [...s.pledges, { date: today, text }];
      return { ...s, pledges };
    });
  }, []);

  // 수동 저장
  const saveNow = useCallback(async () => {
    if (!hydrated) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);

    const scriptUrl = getScriptUrl();
    const adapter = scriptUrl ? createSheetsAdapter(scriptUrl) : createLocalAdapter();

    setSaveStatus("saving");
    try {
      await adapter.save(state);
      setSaveStatus("saved");
      if (savedResetTimer.current) clearTimeout(savedResetTimer.current);
      savedResetTimer.current = setTimeout(() => setSaveStatus("idle"), 2000);
    } catch {
      await createLocalAdapter().save(state);
      setSaveStatus("error");
      if (savedResetTimer.current) clearTimeout(savedResetTimer.current);
      savedResetTimer.current = setTimeout(() => setSaveStatus("idle"), 3000);
    }
  }, [state, hydrated]);

  // 오늘 컨디션이 설정됐는지 여부 (날짜 기준 자동 초기화)
  const todayCondition: ConditionMode | null =
    state.conditionSetOn === todayStr() ? state.condition : null;

  return {
    state,
    hydrated,
    saveStatus,
    saveNow,
    todayCondition,
    addTask,
    addSubTask,
    toggleTask,
    deleteTask,
    postponeTask,
    reorderTasks,
    assignTaskToProject,
    moveTaskToDate,
    toggleTaskTool,
    toggleProjectTool,
    setNotifications,
    updateSettings,
    addProject,
    deleteProject,
    reorderProjects,
    toggleProject,
    addFarm,
    deleteFarm,
    updateFarm,
    toggleFarmTool,
    moveFarm,
    moveProjectToFarm,
    updateProject,
    setCondition,
    addLocalTool,
    updateLocalTool,
    deleteLocalTool,
    setPledge,
  };
}
