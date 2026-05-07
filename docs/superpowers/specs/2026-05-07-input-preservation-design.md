# 로드 중 사용자 입력 보존 — Design Spec

**작성일**: 2026-05-07
**작업자**: Claude (with @ayoungjo)
**상태**: 사용자 검토 대기

## 배경

`useGarden` 훅의 hydrate 흐름에서 local 데이터를 즉시 렌더한 뒤 1~2초 후 Apps Script GET 응답이 도착하면 `applyState(mergeState(remote))`로 state를 통째로 덮는다. 이 1~2초 윈도우 사이에 사용자가 인풋(설정 페이지의 도구 시트 URL, AI API 키 등)을 입력하거나 저장 버튼을 누르면 그 변화가 원격 응답으로 덮여 사라진다. focus-refetch 경로도 동일.

이전에 이미 [hydrate/save 레이스 픽스](2026-05-07-hydrate-save-race-fix-design.md)로 "빈 state가 시트를 통째로 덮는" catastrophic 버그는 막았다. 이번 spec은 사용자 input이 원격 응답에 묻히는 별개 이슈를 다룬다.

## 재현 시나리오

### 시나리오 1: 도구 시트 URL 입력 중 덮임

1. 사용자가 페이지 로드 직후 `/settings`로 이동
2. 도구 시트 URL 인풋에 한 글자 입력 → `updateSettings({toolsSheetUrl: "h"})` → `state.settings.toolsSheetUrl = "h"`
3. 1.5초 뒤 Apps Script GET 응답 도착 → `applyState(mergeState(remote))` → `state.settings`가 원격 값(toolsSheetUrl 없음)으로 통째 교체
4. 인풋 value가 `state.settings.toolsSheetUrl`을 가리키므로 화면에서 "h"가 사라짐 → 사용자 혼란

### 시나리오 2: AI API 키 저장 직후 덮임

1. 사용자가 `/settings`에서 API 키 입력 (local component state에 저장됨, 아직 garden store 미반영)
2. "저장" 버튼 클릭 → `updateSettings({aiApiKey: "..."})` → `state.settings.aiApiKey` 갱신
3. save effect의 600ms 디바운스 타이머 시작
4. 1초 뒤 원격 응답 도착 → `applyState(mergeState(remote))` → `state.settings.aiApiKey`가 원격의 옛 값(키 없음)으로 교체
5. 디바운스 타이머 발화 → `adapter.save(state)` — 이때 state는 이미 덮인 상태 → 원격에 POST되는 값에 새 키 없음 → 키 유실

## 목표

- hydrate의 원격 apply 시점에 **사용자가 어떤 입력/액션을 했다면 원격 적용을 건너뜀**
- focus-refetch 경로도 동일 보호
- 도구 시트 URL 인풋을 AI API 키 인풋처럼 **local component state + 명시적 저장 버튼**으로 변경 (UX polish)

비목표:
- 크로스 디바이스 동기화 보장 (사용자가 입력 중인 세션은 원격을 무시 → 다음 새로고침/focus 시 동기화)
- 데일리 리셋이 false-positive로 userTouched를 발화시키는 케이스 (드물고 영향 작음 → 별도 처리 안 함)

## 설계 — Part B: userTouched ref

### `useGarden` 내부

새 ref 추가:

```ts
const userTouched = useRef(false);
```

state 변경 watcher:

```ts
useEffect(() => {
  if (!hydrated) return;
  if (isApplyingRemote.current) return;
  userTouched.current = true;
}, [state, hydrated]);
```

원격 적용 가드 (hydrate ② 경로):

```ts
const remote = await createSheetsAdapter(scriptUrl).load();
if (cancelled) return;
if (!remote || ...) { ... return; }

if (userTouched.current) {
  // 사용자가 입력 중 → 원격 적용 스킵. 다음 save effect가 local→remote 동기화 처리.
  return;
}

const mergedSettings = ...;
migrateLegacyCondition(remote, mergedSettings.morningTime);
applyState(mergeState(remote));
```

focus-refetch 경로에도 동일 가드:

```ts
const remote = await createSheetsAdapter(scriptUrl).load();
if (!remote) return;
if (userTouched.current) {
  // 단, focus-refetch는 사용자가 탭으로 막 돌아온 시점이라 보통 안전.
  // userTouched는 hydrate 이후 누적되므로, 첫 focus-refetch 직전에 reset할지 결정 필요.
  // 결정: reset하지 않음. 한 세션 안에서는 사용자 입력이 항상 우선.
  return;
}
isApplyingRemote.current = true;
setState((prev) => { ... });
```

### Why userEffect-based?

- 모든 callback에 `userTouched.current = true` 줄을 추가하는 것보다 light touch
- React 18 batching 내에서도 state ref 변화는 정확히 감지됨
- `isApplyingRemote.current === true` 인 동안 발생한 state 변경(applyState 자체)은 false-positive로 잡지 않음
- 단점: 데일리 리셋 effect도 state 변경 → false-positive. 영향: 그 세션의 원격 동기화 1회 스킵. 다음 새로고침/focus 시 정상 sync. 솔로 사용자에게 사실상 무영향.

### 테스트 (vitest)

`src/lib/garden-store.test.ts`에 새 describe `"userTouched gate"` 추가:

1. **사용자 액션 후 원격 도착 → 원격 미적용**: hydrate 완료 후 `addFarm` 등 호출 → fetch mock으로 원격 응답 → `state.farms`에 원격 데이터 안 들어옴.
2. **사용자 액션 없음 + 원격 도착 → 원격 적용 정상**: hydrate 완료 후 사용자 액션 0 → 원격 응답 → `state.farms`에 원격 데이터 들어옴.
3. **hydrate의 applyState는 userTouched 발화 안 함**: 단독 검증 어려움 (시나리오 2에서 함께 커버됨).

## 설계 — Part C: 도구 시트 URL 인풋 UX

### `src/routes/settings.tsx`

현재:
```tsx
<input
  type="url"
  value={state.settings.toolsSheetUrl ?? ""}
  onChange={(e) => updateSettings({ toolsSheetUrl: e.target.value })}
  ...
/>
```

변경:
```tsx
const [toolsSheetUrl, setToolsSheetUrlInput] = useState(state.settings.toolsSheetUrl ?? "");

// 외부에서 garden state가 변하면 local 인풋도 동기화 (단, 사용자가 편집 중이 아닐 때만 — 단순화 위해 onChange 추적 생략, mount 시점만 sync)
useEffect(() => {
  setToolsSheetUrlInput(state.settings.toolsSheetUrl ?? "");
}, [state.settings.toolsSheetUrl]);

// JSX:
<input
  type="url"
  value={toolsSheetUrl}
  onChange={(e) => setToolsSheetUrlInput(e.target.value)}
  ...
/>
<button onClick={() => updateSettings({ toolsSheetUrl: toolsSheetUrl.trim() || undefined })}>
  저장
</button>
```

`useEffect` 의존성으로 `state.settings.toolsSheetUrl`을 두면 외부 변경(다른 디바이스 sync 등)이 인풋에 반영되는 동시에, 사용자가 입력 중이라면 onChange가 매번 호출돼 인풋 값이 매번 바뀌므로 effect의 setToolsSheetUrlInput 호출은 idempotent에 가깝게 작동. (실제로는 작은 트레이드오프 있음 — 동시 편집은 거의 없는 시나리오라 acceptable.)

### 테스트

수동 검증만:
- /settings → 도구 시트 URL 인풋에 입력 → 화면에서 사라지지 않음
- 저장 버튼 클릭 → garden store에 반영 → 페이지 새로고침 후에도 유지

자동 컴포넌트 테스트는 settings 페이지 의존성이 무거워 비용 대비 가치 낮음 → 생략.

## 변경 파일

**Modified:**
- `src/lib/garden-store.ts` — `userTouched` ref + state watcher + 두 원격 적용 경로 가드
- `src/lib/garden-store.test.ts` — userTouched gate 테스트 케이스 2개
- `src/routes/settings.tsx` — toolsSheetUrl 인풋을 local state + 저장 버튼으로 변경

## 리스크

- **데일리 리셋 false-positive**: 자정 후 첫 사용자 액션 시 daily reset effect가 state를 변경 → userTouched=true → 그 세션의 첫 원격 sync 스킵. 다음 focus/reload 시 sync됨. 솔로 워크플로에서 거의 무영향.
- **focus-refetch 영구 스킵**: 한 번 userTouched=true가 되면 그 세션 내 모든 focus-refetch 스킵. 사용자가 5시간 동안 앱 켜둔 채 다른 디바이스에서 변경한 데이터를 절대 볼 수 없음. 트레이드오프: 입력 보존 vs 즉시 sync. 입력 보존이 우선이라 판단.
- **인풋 외부 변경 감지**: useEffect 의존성으로 외부 변경 추적하지만 사용자가 편집 중이면 매 onChange마다 effect 재발화. 큰 영향 없으나 미세한 깜빡임 가능. 실사용 영향 미미.
