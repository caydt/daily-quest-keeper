# 포모도로 타이머 설계

## 배경 / 동기

Lumi Garden은 RPG 스타일 할일 추적 앱. 사용자가 집중력을 유지하면서 할일을 진행할 수 있도록 포모도로 타이머를 추가. 25분 집중 + 5분 휴식의 고전 흐름을 따르되, 앱의 게이미피케이션 컨셉과 자연스럽게 통합.

## 목표 / 비목표

**목표**
- 할일 카드에서 즉시 포모도로 시작 (▶ 버튼).
- 풀스크린 `/focus` 페이지로 산만함 차단.
- 어디서든 잔여 시간 확인 (헤더 sticky 미니 타이머).
- 새로고침/탭 닫힘에도 살아남는 벽시계 기반 타이머.
- 알림 + 사운드 + 자동 휴식 전환 (5초 카운트다운).
- 일시정지(시간 멈춤) / 포기(카운트 안 됨) 분리.

**비목표 (별도 PR / v2)**
- 통계 그래프 (주/월 포모도로 차트).
- 흰소음/음악 재생.
- XP 보너스 (할일 자체 완료 시 이미 XP 받음).
- iOS 백그라운드 push 알림 (PWA 설치 별도 작업 필요).
- Supabase 마이그레이션과는 독립적으로 진행 (state shape 변경만 호환 유지).

## 사용자 흐름

```
[할일 카드 ▶] ─→ [/focus 풀스크린 25:00] ─→ 시간 끝 ─→ [알림+사운드+5초 카운트다운]
                       │                                       │
                       │  ⏸ 일시정지                           ▼
                       │  ✕ 포기 → idle (history 안 기록)      [/focus 짧은 휴식 5:00]
                       │                                       │
                       └─── 헤더 미니 타이머에서 클릭하면 복귀  │ 시간 끝 (또는 ▶ 다음 집중 바로)
                                                              ▼
                                                       [/focus 다음 집중 25:00]
                                                              │
                                                  4세트마다 long_break (15:00)
```

## 데이터 모델

`GardenState` 에 `pomodoro` 필드 추가:

```ts
interface PomodoroSettings {
  focusMinutes: number;        // 기본 25
  shortBreakMinutes: number;   // 기본 5
  longBreakMinutes: number;    // 기본 15
  longBreakEvery: number;      // 기본 4 (4세트 후 긴 휴식)
  soundEnabled: boolean;       // 기본 true
}

type PomodoroMode = "focus" | "short_break" | "long_break";

interface ActivePomodoro {
  taskId: string | null;       // 어느 할일에 집중하는지 (또는 freestanding)
  mode: PomodoroMode;
  startedAt: number;           // epoch ms
  pausedAt: number | null;     // 일시정지 시점, 재개되면 null
  pausedAccumMs: number;       // 누적 일시정지 시간
  cycle: number;               // 현재 사이클 번호 (1부터 시작, focus 시작 시 +1)
}

interface PomodoroEntry {
  completedAt: number;
  taskId: string | null;
  mode: PomodoroMode;
  // 포기한 세션은 history에 기록하지 않음.
}

interface PomodoroState {
  settings: PomodoroSettings;
  active: ActivePomodoro | null;
  history: PomodoroEntry[];    // 최근 90일 자동 정리
}

// GardenState 확장
interface GardenState {
  // ... 기존 필드 ...
  pomodoro?: PomodoroState;    // optional — 기존 사용자 데이터 호환
}
```

**왜 optional**: 기존 시트에 저장된 garden state에는 `pomodoro` 필드 없음. hydrate 시 없으면 기본값으로 채워서 사용.

**history 보존**: 최근 90일까지만 유지. 매 INSERT 시 90일 이전 entry 자동 제거.

## 시간 계산 (벽시계 기반)

```ts
function computeRemainingMs(active: ActivePomodoro, settings: PomodoroSettings, now: number): number {
  const durationMs = modeDurationMs(active.mode, settings);
  const currentPauseMs = active.pausedAt !== null ? now - active.pausedAt : 0;
  const elapsedMs = now - active.startedAt - active.pausedAccumMs - currentPauseMs;
  return Math.max(0, durationMs - elapsedMs);
}

function modeDurationMs(mode: PomodoroMode, settings: PomodoroSettings): number {
  switch (mode) {
    case "focus": return settings.focusMinutes * 60 * 1000;
    case "short_break": return settings.shortBreakMinutes * 60 * 1000;
    case "long_break": return settings.longBreakMinutes * 60 * 1000;
  }
}
```

새로고침/탭 닫혀도 `startedAt`/`pausedAccumMs`/`pausedAt`만 garden state에 있으면 정확히 복원.

## 모드 전환 결정

```ts
function decideNextMode(currentMode: PomodoroMode, cycle: number, settings: PomodoroSettings): PomodoroMode {
  if (currentMode === "focus") {
    return cycle % settings.longBreakEvery === 0 ? "long_break" : "short_break";
  }
  return "focus";
}
```

- `cycle`은 focus 시작 시점에 증가.
- 4세트째 focus 끝 → cycle=4 → 4 % 4 === 0 → long_break.

## UI 컴포넌트

### `/focus` 풀스크린 페이지 (새 라우트)

레이아웃 (모바일 우선):
- 헤더: `← 정원으로` 좌상단, 모드 라벨 ("🍅 집중" / "☕ 짧은 휴식" / "🌙 긴 휴식") 중앙.
- 메인: 큰 카운트다운 (모바일 96px, 데스크탑 144px).
- 진행률 링 (SVG circle stroke-dasharray).
- 포커스 중인 할일 제목 (있다면) — 작게.
- 컨트롤 행:
  - 집중 모드: ⏸ 일시정지 (재개 시 ▶), ✕ 포기.
  - 휴식 모드: ▶ 다음 집중 바로 시작.
- 시간 끝나면: 큰 시각 효과 (펄스/플래시) + 알림 + 사운드 + 5초 카운트다운 ("다음 모드 5초 후 시작... 4... 3... 2... 1...") 후 자동 전환.

### 할일별 ▶ 버튼 (`TaskList.tsx`)

기존 할일 카드에 작은 ▶ 버튼 추가. 클릭 흐름:
1. active pomodoro 없음 → `startPomodoro(taskId)` → `/focus` 라우터 이동.
2. active 있고 같은 taskId → 그냥 `/focus` 이동 (이어서 보기).
3. active 있고 다른 taskId → 확인 모달 "다른 할일로 전환할까요? 현재 세션은 포기됩니다" → 확인 시 `abortPomodoro` → `startPomodoro(newId)` → `/focus`.

### 헤더 sticky 미니 타이머 (`PomodoroMiniHeader.tsx`)

active pomodoro 있을 때만 표시. 현재 라우트가 `/focus`이면 숨김 (중복 방지).
- 형태: `🍅 12:34 ▶/⏸` (모드별 이모지) 또는 휴식이면 `☕ 04:50`.
- 클릭 시 `/focus` 이동.
- 1초마다 setInterval로 카운트다운 갱신 (벽시계 재계산).

### 오늘 카운트 위젯

메인 페이지 상단 (StatHeader 옆 또는 안)에 `🍅 N` 작은 칩. history에서 오늘 자정 이후 완료된 focus 모드 entry 수.

### 설정 페이지 추가 섹션

```
🍅 포모도로
─────────────────
집중 시간     [25] 분
짧은 휴식    [ 5] 분
긴 휴식       [15] 분
긴 휴식 주기  [ 4] 세트마다
사운드         [ON/OFF 토글]
```

## 상태 액션 (`garden-store.ts`)

```ts
// 추가 액션
startPomodoro(taskId: string | null): void
  // active=null 일 때만. 이미 있으면 무시 (UI에서 모달로 전환 처리).
  // mode=focus, cycle=prevLastCycle+1, startedAt=now.

pausePomodoro(): void
  // active.mode 무관. pausedAt=now (이미 pausedAt 있으면 무시).

resumePomodoro(): void
  // pausedAccumMs += now - pausedAt, pausedAt=null.

abortPomodoro(): void
  // active=null. history 기록 안 함.

completePomodoro(): void
  // 시간 끝났을 때 호출. history에 entry 추가, active.mode 전환 (decideNextMode).
  // focus → break: cycle 유지.
  // break → focus: cycle 증가.
  // 새 startedAt=now, pausedAccumMs=0, pausedAt=null.

skipBreak(): void
  // 휴식 모드일 때만. completePomodoro와 동일하나 break entry는 history 기록 안 함
  // (스킵은 완료가 아니므로). focus로 전환.

updatePomodoroSettings(patch: Partial<PomodoroSettings>): void
  // 일반 settings 갱신과 동일 패턴. active 중에도 변경 가능하나 현 active의 duration은
  // 모드 시작 시점 설정 기반. 다음 모드부터 새 설정 반영.
```

**Race 고려**: 모든 액션은 `setStateUser` 경유 (현재 store의 mutator 패턴). 원격 동기화는 기존 path 그대로.

## 알림 & 사운드

**알림**:
- `notifications.ts`의 기존 권한 흐름 재사용.
- `completePomodoro` 시점에 `new Notification(...)` — 모드별 메시지:
  - focus 완료 → "집중 끝! ☕ 휴식 시간이에요"
  - short_break 완료 → "다시 시작! 🍅"
  - long_break 완료 → "긴 휴식 끝! 다시 집중!"

**사운드**:
- `public/pomodoro-bell.mp3` (Creative Commons 0 종소리).
- `completePomodoro` 시점에 `new Audio(...).play()`. `settings.soundEnabled` false면 skip.
- iOS Safari는 사용자 인터랙션 컨텍스트에서만 재생 가능 — 시작 버튼 클릭이 그 trigger가 됨.

**5초 카운트다운**:
- `completePomodoro` 직후 모드를 즉시 전환하지 않고, `setTimeout(5000)` 동안 시각 카운트다운만 표시.
- 카운트다운 끝나면 자동 시작.
- 사용자가 그 사이 ⏸ 또는 ✕ 누를 수도 있게 컨트롤 노출 (선택적, v2).

## 새로고침/탭 전환 복원

`useGarden()` 훅이 hydrate 시 `pomodoro.active` 있으면:
1. `computeRemainingMs(active, settings, Date.now())` 계산.
2. 0 이하면 (사용자 자리 비운 사이 끝남):
   - `active.mode === "focus"` 이면 history에 entry 추가 (놓친 시간 보상).
   - active=null 로 클리어 (자동 break 시작 안 함 — 사용자가 자리 비운 사이 break도 끝났을 수도 있고, 의도와 다를 수 있음).
   - 사용자에게 토스트 알림: "🍅 집중 세션 완료됨 (자리 비운 사이)".
3. > 0면: 정상 active 상태로 카운트다운 재개.

`/focus` 마운트 시: `setInterval(1000)`으로 매초 잔여 시간 갱신. 잔여 0 도달 시 `completePomodoro` (이 경로는 자리 비우지 않고 끝났으므로 다음 모드 자동 전환 정상).

**"오늘" 정의** (`isFocusCompletedToday`): 로컬 타임존 자정 기준. settings의 `morningTime`은 무시 (포모도로는 시간대 reset 개념이 다름 — 자정 기준이 직관적).

## 새 파일 & 변경 파일

**새 파일**
- `src/lib/pomodoro.ts` — 순수 함수 + 기본값:
  - `defaultPomodoroState()` — 기본 settings (25/5/15/4, soundEnabled=true), active=null, history=[].
  - `computeRemainingMs(active, settings, now)` — 잔여 ms (clamp to 0).
  - `decideNextMode(currentMode, cycle, settings)` — 다음 모드 결정.
  - `modeDurationMs(mode, settings)` — 모드별 ms.
  - `isFocusCompletedToday(history, now)` — 오늘 자정 이후 focus entry 수.
  - `prunePomodoroHistory(history, now)` — 90일 이전 entry 제거.
- `src/lib/pomodoro.test.ts` — 단위 테스트.
- `src/routes/focus.tsx` — `/focus` 페이지.
- `src/routes/focus.test.tsx` — 라우트 테스트.
- `src/components/garden/PomodoroMiniHeader.tsx` — sticky 미니 타이머.
- `src/components/garden/TodayPomodoroCount.tsx` — 오늘 카운트 칩.
- `public/pomodoro-bell.mp3` — CC0 종소리.

**변경 파일**
- `src/lib/garden-store.ts` — `pomodoro` 필드 + 액션 추가, hydrate 시 누락 복원 + 복귀 시 시간 계산.
- `src/components/garden/TaskList.tsx` — ▶ 버튼.
- `src/routes/settings.tsx` — 포모도로 섹션.
- `src/router.tsx` 또는 메인 layout — 헤더에 `PomodoroMiniHeader` 슬롯.
- `src/lib/notifications.ts` — `notifyPomodoro(mode, taskTitle?)` 헬퍼 추가 (기존 알림 권한 흐름 재사용).

## 테스트 전략 (TDD)

### `src/lib/pomodoro.test.ts` — 순수 함수

- `computeRemainingMs`
  - 시작 직후: duration 그대로.
  - 시작 1분 후 (no pause): duration - 60000.
  - 일시정지 중: pausedAt 기준으로 멈춤.
  - 일시정지 후 재개: pausedAccumMs 누적 정확.
  - 0 이하: clamp to 0.

- `decideNextMode`
  - focus + cycle=1 → short_break.
  - focus + cycle=4 (longBreakEvery=4) → long_break.
  - focus + cycle=8 → long_break.
  - short_break → focus.
  - long_break → focus.

- `modeDurationMs`
  - 각 모드별 settings 곱셈 결과.

- `isFocusCompletedToday`
  - history에 어제 entry 있어도 카운트 안 됨.
  - 오늘 자정 이후 focus entry 만 카운트.
  - short_break/long_break entry는 카운트 제외.

- `prunePomodoroHistory`
  - 90일 이전 entry 제거.
  - 90일 이내 entry 유지.

### `garden-store.test.ts` — 액션

- `startPomodoro(taskId)` → active 채워짐, mode=focus, cycle=1.
- 이미 active 있을 때 `startPomodoro` → 무시 (active 그대로).
- `pausePomodoro` → pausedAt 채워짐.
- `pausePomodoro` 두 번 호출 → 두 번째는 무시.
- `resumePomodoro` → pausedAccumMs 증가, pausedAt=null.
- `abortPomodoro` → active=null, history 길이 그대로.
- `completePomodoro` (focus) → history += focus entry, active.mode=short_break, cycle 유지.
- `completePomodoro` (focus, cycle=4) → mode=long_break.
- `completePomodoro` (short_break) → history += break entry, mode=focus, cycle 증가.
- `skipBreak` (short_break) → history 안 늘어남, mode=focus, cycle 증가.
- `updatePomodoroSettings` → settings 갱신.

### `/focus` 라우트 테스트

- active 없을 때 진입: "포모도로가 진행 중이지 않아요" + "정원으로 돌아가기" 링크.
- active 있을 때: 카운트다운 표시, 잔여 시간 정확.
- ⏸ 클릭 → pausedAt 기록, 카운트 멈춤.
- ✕ 클릭 → 모달 → 확인 → abortPomodoro 호출 + 정원으로 이동.

### TaskList ▶ 버튼

- ▶ 클릭 → `startPomodoro(taskId)` 호출 + `/focus`로 navigate.
- 이미 active 있을 때 다른 task의 ▶ 클릭 → 확인 모달 표시.

### 회귀 방지

- `pomodoro` 필드 없는 옛 garden state hydrate → 기본 settings로 채워짐, 정상 동작.

## 위험 / 대응

| 위험 | 대응 |
|------|------|
| 옛 garden state 호환 | `pomodoro` 필드 optional. hydrate 시 누락이면 `defaultPomodoroState()`로 초기화. |
| iOS Safari 백그라운드에서 setInterval 정확도 떨어짐 | 벽시계 기반 계산이라 다시 active 탭으로 돌아오면 즉시 정확하게 복원. 백그라운드 동안 알림 못 보낼 가능성은 v2에서 PWA + push로 해결. |
| 알림 권한 거부 시 사운드만 | sound도 OFF면 시각 효과만. settings.soundEnabled 토글로 사용자 선택. |
| 새로고침 직후 잔여 시간 음수 → 모드가 이미 끝남 | hydrate에서 0 이하면 `completePomodoro` 자동 호출 (알림은 못 보내지만 history + 모드 전환). |
| 일시정지 중 새로고침 | `pausedAt`/`pausedAccumMs` 보존. 복원 시 정확히 일시정지 상태로 시작. |
| 동시 여러 탭에서 active 조작 | 현재 garden state sync 메커니즘이 그대로 적용 (focus-refetch, save 직렬화). 마지막 탭의 액션이 적용됨. UX 충돌 가능성 낮음 (포모도로 동시 작업 드묾). |
| 모바일에서 ▶ 버튼 누른 직후 즉시 풀스크린 — 이전 페이지로 되돌아가는 동작 혼란 | `/focus`에 명시적 "← 정원으로" 버튼. 백 버튼은 자연스럽게 이전으로. |
| Audio 자동 재생 차단 (iOS) | 사용자 인터랙션 컨텍스트(▶ 버튼 클릭)에서 미리 unlock. 더 robust하게는 Web Audio API로 silent buffer 한 번 재생. |

## 마이그레이션 / 컷오버

별도 단계 없음. 단순 새 기능 추가:
1. 코드 머지 + 배포.
2. 사용자가 처음 접하면 settings에 포모도로 섹션이 새로 보임. 기본값 25/5/15/4 즉시 사용 가능.
3. 옛 garden state에 `pomodoro` 필드 없으면 hydrate가 기본값으로 채움.

## 후속 (별도 PR / 백로그)

- 포모도로 통계 페이지 (`/stats/pomodoro`) — 주/월 차트.
- 흰소음 / 집중 음악 재생.
- 포모도로 완료 누적 시 업적 (`achievements` 활용) — 예: "🍅 100개" 배지.
- PWA + Web Push로 백그라운드 알림 (iOS 포함).
- Supabase 마이그레이션 후 RPC `start_pomodoro` 등으로 race-free 동시 편집 보호.
