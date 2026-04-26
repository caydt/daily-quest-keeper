import type { Project, Task, Farm, ConditionMode } from "@/lib/garden-store";
import { todayStr } from "@/lib/garden-store";

function formatTasks(tasks: Task[], label: string): string {
  if (tasks.length === 0) return "";
  return `${label}:\n${tasks.map((t) => `  - ${t.title}`).join("\n")}`;
}

/** 나무(프로젝트) 컨텍스트 — 인라인 채팅용 */
export function buildProjectContext(project: Project, tasks: Task[]): string {
  const today = todayStr();
  const sub = tasks.filter((t) => t.projectId === project.id);
  const pending = sub.filter((t) => !t.completed);
  const done = sub.filter((t) => t.completed);

  const lines: string[] = [
    `[프로젝트] ${project.title}`,
  ];
  if (project.description) lines.push(`설명: ${project.description}`);
  if (project.dueDate) lines.push(`마감: ${project.dueDate}`);
  if (pending.length > 0) lines.push(formatTasks(pending, "할일 (미완료)"));
  if (done.length > 0) lines.push(formatTasks(done, "완료된 할일"));

  // 오늘 독립 할일도 포함
  const todayTasks = tasks.filter((t) => t.date === today && !t.projectId && !t.completed);
  if (todayTasks.length > 0) lines.push(formatTasks(todayTasks, "오늘 다른 할일"));

  return lines.join("\n");
}

/** 농장 컨텍스트 — 인라인 채팅용 */
export function buildFarmContext(farm: Farm, projects: Project[], tasks: Task[]): string {
  const farmProjects = projects.filter((p) => p.farmId === farm.id && !p.completed);

  const lines: string[] = [`[농장] ${farm.title}`];
  if (farmProjects.length === 0) {
    lines.push("(나무 없음)");
  } else {
    for (const p of farmProjects) {
      lines.push(`\n[나무] ${p.title}`);
      if (p.description) lines.push(`  설명: ${p.description}`);
      const sub = tasks.filter((t) => t.projectId === p.id);
      const pending = sub.filter((t) => !t.completed);
      const done = sub.filter((t) => t.completed);
      if (pending.length > 0) lines.push(formatTasks(pending, "  할일 (미완료)"));
      if (done.length > 0) lines.push(formatTasks(done, "  완료된 할일"));
    }
  }

  return lines.join("\n");
}

/** 전체 컨텍스트 — 사이드 패널용 */
export function buildGlobalContext(projects: Project[], tasks: Task[]): string {
  const today = todayStr();
  const todayTasks = tasks.filter((t) => t.date === today && !t.projectId);
  const pending = todayTasks.filter((t) => !t.completed);
  const done = todayTasks.filter((t) => t.completed);
  const activeProjects = projects.filter((p) => !p.completed);

  const lines: string[] = ["[루미 가든 전체 현황]"];

  if (pending.length > 0) lines.push(formatTasks(pending, "\n오늘 할일 (미완료)"));
  if (done.length > 0) lines.push(formatTasks(done, "\n오늘 완료한 할일"));

  if (activeProjects.length > 0) {
    lines.push("\n[진행중인 프로젝트]");
    for (const p of activeProjects) {
      const sub = tasks.filter((t) => t.projectId === p.id);
      const pendingSub = sub.filter((t) => !t.completed);
      lines.push(`\n[${p.title}]`);
      if (p.description) lines.push(`  설명: ${p.description}`);
      if (pendingSub.length > 0) lines.push(formatTasks(pendingSub, "  할일 (미완료)"));
    }
  }

  return lines.join("\n");
}

/** 컨디션 메시지용 컨텍스트 */
export function buildConditionContext(condition: ConditionMode, pendingTasks: Task[]): string {
  const conditionLabel: Record<ConditionMode, string> = {
    best: "최상",
    normal: "보통",
    low: "저조",
    sick: "아픔",
  };

  const lines = [`오늘 컨디션: ${conditionLabel[condition]}`];
  if (pendingTasks.length > 0) {
    lines.push("아직 해야 할 일:");
    for (const t of pendingTasks) {
      lines.push(`- ${t.title}`);
    }
  } else {
    lines.push("(아직 할일이 없어요)");
  }
  return lines.join("\n");
}
