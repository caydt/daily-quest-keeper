# Hydrate/Save 레이스 컨디션 픽스 — Design Spec

**작성일**: 2026-05-07
**작업자**: Claude (with @ayoungjo)
**상태**: 사용자 검토 대기

## 배경

`src/lib/garden-store.ts:270~351`의 초기 hydrate 로직과 디바운스 save 로직 사이에 데이터 손실 레이스가 있다. 2026-05-07 실제 발생: 새 origin(`feature/farm-reorder` 워크트리 dev 서버)에서 앱을 띄웠을 때 Google Sheets의 농장/나무 데이터가 빈 상태로 덮였다.

## 재현 시나리오

1. 사용자 origin의 localStorage에 `lumi-garden-v3` 키 없음 (새 포트, 새 브라우저, 시크릿 모드 등)
2. Apps Script URL은 하드코딩 기본값으로 자동 연결됨 (`20788ac feat: Apps Script URL 기본값 하드코딩`)
3. 앱 로드:
   - ① `createLocalAdapter().load()` → `null` → `applyState(initial)` (빈 state)
   - ② `setHydrated(true)`
   - ③ save effect의 `[state, hydrated]` deps 충족 → 600ms 디바운스 타이머 시작 (`garden-store.ts:332`)
   - ④ Apps Script GET 진행 중 (보통 1~2초)
   - ⑤ **600ms 경과 → 빈 state가 Sheets에 POST → A1 셀 데이터 소실**
   - ⑥ Apps Script GET 응답 도착 → 이미 빈 상태 → 복구 불가

## 원인

`isApplyingRemote` ref는 React commit + RAF 사이에서만 true이고 useEffect 시점엔 이미 false다. save effect가 발화하는 걸 막을 수단이 없다. 즉 "원격 fetch가 끝나기 전에는 save 금지"라는 시맨틱이 코드에 없다.

## 목표

**원격 데이터 fetch가 완료(성공/실패/Apps Script URL 없음 모두 포함)되기 전엔 save effect가 절대 시트에 POST하지 않게 한다.**

비목표:
- focus 리패치 경로의 동시성 정리 (별도 이슈, 데이터 손실 아님)
- 로컬 Adapter만 쓰는 환경의 첫 save 지연 (해당 없음)
- Apps Script 응답 시간 단축 (인프라 영역)

## 설계

### 새 state: `syncReady`

```ts
const [syncReady, setSyncReady] = useState(false);
```

의미: "원격 동기화가 한 번 완료(성공/실패/skip) 되어 save가 안전한가?"

### hydrate 로직 변경 (`garden-store.ts:271~322`)

```ts
useEffect(() => {
  let cancelled = false;
  const mergeState = (...) => ({ ... });  // 기존 그대로
  const applyState = (...) => { ... };    // 기존 그대로

  const run = async () => {
    const local = await createLocalAdapter().load();
    if (cancelled) return;
    applyState(local ? mergeState(local) : initial);
    setHydrated(true);

    const scriptUrl = getScriptUrl();
    if (!scriptUrl) {
      setSyncReady(true);   // 원격 없음 → 즉시 save 허용
      return;
    }

    try {
      const remote = await createSheetsAdapter(scriptUrl).load();
      if (cancelled) return;
      if (!remote || Object.keys(remote).length === 0) {
        if (local) await createSheetsAdapter(scriptUrl).save(local).catch(() => {});
      } else {
        applyState(mergeState(remote));
      }
    } catch {
      // 무시
    } finally {
      if (!cancelled) setSyncReady(true);
    }
  };

  run();
  return () => { cancelled = true; };
}, []);
```

### save effect 변경 (`garden-store.ts:325~351`)

가드 한 줄 추가 + deps 한 항목 추가:

```ts
useEffect(() => {
  if (!hydrated) return;
  if (!syncReady) return;            // ← 신규
  if (isApplyingRemote.current) return;
  // ...기존 그대로
}, [state, hydrated, syncReady]);    // ← syncReady 추가
```

사용자 트리거 수동 저장 `saveNow` (`garden-store.ts:930~949`)에도 동일 가드 적용 (defense-in-depth):

```ts
const saveNow = useCallback(async () => {
  if (!hydrated) return;
  if (!syncReady) return;            // ← 신규
  // ...기존 그대로
}, [state, hydrated, syncReady]);    // ← syncReady 추가
```

### 의미 변화

| 조건 | 기존 동작 | 변경 후 |
|---|---|---|
| 로컬 있음, 원격 fetch 진행 중 | save effect 발화 | save effect 대기 (syncReady=false) |
| 로컬 없음, 원격 fetch 진행 중 | **빈 save 발화 → 시트 손실** | save effect 대기 |
| 원격 fetch 성공 | save 가능 | save 가능 (syncReady=true) |
| 원격 fetch 실패 | save 가능 | save 가능 (catch 후 finally에서 syncReady=true) |
| Apps Script URL 없음 | save 가능 | save 가능 (즉시 syncReady=true) |

## 테스트

`src/lib/garden-store.test.ts`에 회귀 테스트 추가. vitest + jsdom 기존 인프라 그대로.

```ts
describe("hydrate/save race", () => {
  // 핵심: localStorage 비어있고 Apps Script URL 설정된 상태에서
  // 600ms 안에 시트 POST가 발생하지 않는지 확인
});
```

### 테스트 케이스

1. **빈 local + 느린 sheets fetch (>600ms) → 그 동안 sheets save 호출 0회**
2. **빈 local + Apps Script URL 없음 → syncReady 즉시 true → 사용자 액션 후 save 발화**
3. **로컬 있음 + remote 응답 후 → save 정상 발화 (remote 도착 전엔 보류)**
4. **remote fetch 실패(throw) → finally에서 syncReady=true → save 가능**

### 모킹 전략

- `fetch` 글로벌 mock으로 Apps Script POST/GET 가로채기 (vi.fn + Promise 수동 resolve)
- `getScriptUrl()`은 localStorage 기반이므로 `localStorage.setItem("lumi-script-url", "https://test")` 로 시드
- 기본 하드코딩 URL이 작동하지 않게 fetch mock에서 명시적 응답 정의

## 변경 파일

- 수정: `src/lib/garden-store.ts` — `syncReady` state + hydrate finally + save effect 가드 (2곳)
- 수정: `src/lib/garden-store.test.ts` — 회귀 테스트 4개

## 리스크

- **save 지연**: 사용자가 로드 직후 1~2초 안에 액션을 하면 첫 save가 fetch 완료까지 대기. 디바운스 600ms 안에서 흡수되므로 체감 영향 거의 없음.
- **focus 리패치 경로**: 본 spec 범위 밖. 사용자가 만든 변경분이 원격 fetch 응답으로 덮일 수는 있지만 데이터 영구 손실은 아님 (시트엔 이전 값 그대로). 별도 이슈로 추적.
- **타이머 누수**: hydrate가 cancelled 된 뒤 syncReady 셋팅 안 되도록 `if (!cancelled)` 가드 포함.
