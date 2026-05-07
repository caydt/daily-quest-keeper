# OpenClaw 연동 (텔레그램 → 루미 가든) — Design Spec

**작성일**: 2026-05-08
**작업자**: Claude (with @ayoungjo)
**상태**: 사용자 검토 대기

## 배경

사용자는 Mac mini에 OpenClaw(Claude 기반 자연어 에이전트)를 텔레그램 봇과 연동해 운영 중. 텔레그램에서 자연어로 명령하면 OpenClaw가 처리. 루미 가든도 같은 인터페이스로 다루고 싶다 — "운동 추가해줘", "오늘 뭐 해야 해?", "운동 완료" 같은 메시지로.

루미 가든은 이미 Apps Script 웹앱(`/exec`) 기반의 GET/POST 인터페이스를 마스터 데이터로 사용 중. OpenClaw가 그 엔드포인트를 호출할 수 있으면 추가 백엔드 없이 통합 완료.

## 사용자 워크플로

### Sub-project 1 (이번 spec)
- 입력 흐름: 텔레그램 → OpenClaw → Apps Script `/exec` → 시트 → 루미 가든 web (focus-refetch로 sync)
- "할일 추가: 운동, 책 읽기" → OpenClaw가 두 task 추가, "추가했어" 응답
- "오늘 뭐 있어?" → OpenClaw가 state 읽고 자연어 요약
- "운동 완료" → OpenClaw가 task 토글, "잘했어. 콤보 3 유지" 같은 응답

### Sub-project 2 (별도)
- 시간 트리거 알림 — Apps Script time-driven trigger가 morning/evening 시각에 텔레그램 봇 API로 push.
- 본 spec 범위 밖.

## 목표

1. **A — 깔끔한 API 문서**: 남편이 OpenClaw에 도구 등록할 때 참고할 한국어 문서. 기존 GET/POST + 새 action endpoint 사용 예시 포함.
2. **B — Apps Script에 action endpoint 추가**: full-state replace에 더해 `add_task`, `complete_task`, `set_condition`, `add_farm`, `add_tree` 5개 단순 명령 처리. read-modify-write를 LockService로 감쌈. 응답엔 갱신된 state 포함.
3. 루미 가든 web 코드 변경 0. 데이터 모델 변경 0.

비목표:
- OpenClaw 쪽 도구 정의/구현 (남편 영역)
- 텔레그램 알림 push (Sub-project 2)
- 추가 액션 (delete, rename, reorder 등) — 필요 시 후속

## 아키텍처

```
[텔레그램]
   ↓
[OpenClaw + Lumi 도구]
   ↓
[Apps Script /exec]  ← LockService로 동시성 보호
   ↓
[Google Sheet "Sheet1" A1 셀: GardenState JSON]
   ↑
[루미 가든 web]  (focus-refetch + 디바운스 save)
```

## API 명세 (Sub-project 1 산출물의 일부)

### 1. 전체 state 조회 (기존)

**GET** `https://script.google.com/macros/s/<DEPLOYMENT_ID>/exec`

응답: `{ ok: true, data: GardenState }`

### 2. 전체 state 갱신 (기존, 호환 유지)

**POST** `/exec` with `Content-Type: text/plain`, body = `JSON.stringify(state)`

응답: `{ ok: true }`

`body`에 `action` 필드 없을 때 적용. 루미 가든 web 앱이 사용하는 경로.

### 3. action endpoint (신규)

**POST** `/exec` with `Content-Type: text/plain`, body = action JSON.

**공통 응답 형식**:
- 성공: `{ ok: true, data: <updated GardenState>, action: "<name>" }`
- 실패: `{ ok: false, error: "<message>" }`

**액션별 body**:

#### `add_task`
```json
{
  "action": "add_task",
  "title": "운동",
  "time": "07:00",          // 선택. 기본 "09:00"
  "difficulty": "medium",   // 선택. easy|medium|hard, 기본 medium
  "kind": "flex",           // 선택. must|flex, 기본 flex
  "date": "2026-05-08",     // 선택. YYYY-MM-DD, 기본 오늘 (서버 기준)
  "projectId": null         // 선택. 프로젝트에 속하면 ID, 기본 null
}
```

서버 자동 생성: `id` (UUID), `createdAt` (now), `order` (`tasks.length`), `completed: false`, `postponedCount: 0`.

#### `complete_task`
```json
{
  "action": "complete_task",
  "id": "<uuid>"            // 또는 title로 대체 가능
  // OR
  "title": "운동"           // id 미제공 시 오늘 task 중 title 일치 첫 1개 토글
}
```

토글 동작: 이미 completed면 false로, 아니면 true로. completedAt도 같이 갱신.

매치 안 되면 `{ ok: false, error: "task not found" }`.

#### `set_condition`
```json
{
  "action": "set_condition",
  "mode": "best"            // best|normal|low|sick
}
```

서버에서 `state.condition = mode`, `state.conditionSetAt = Date.now()` 설정.

(루미 가든 web의 `conditionStampFor` 로직 — pre-morningTime stamp 처리 — 은 서버 기준 시간으로는 단순화. 사용자가 텔레그램으로 명시적 picked할 때는 그 의도를 그대로 timestamp로 stamp.)

#### `add_farm`
```json
{
  "action": "add_farm",
  "title": "디자인",
  "icon": "🎨"              // 선택, 기본 "🌾"
}
```

서버 자동: `id`, `createdAt`, `order = farms.length`.

#### `add_tree`
```json
{
  "action": "add_tree",
  "title": "포트폴리오 리뉴얼",
  "farmId": null,           // 선택. 농장 ID, 기본 null = 독립 나무
  "description": ""         // 선택
}
```

서버 자동: `id`, `createdAt`, `order = projects.length`, `completed: false`.

## Apps Script 구현

`apps-script/Code.gs` (사용자 시트의 Apps Script 에디터에 붙여넣을 코드. 본 repo에는 reference로 유지.)

```js
const SHEET_NAME = "Sheet1";

function getSheet_() {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
}

function readState_() {
  const raw = getSheet_().getRange("A1").getValue();
  return raw ? JSON.parse(raw) : {};
}

function writeState_(state) {
  const sheet = getSheet_();
  sheet.getRange("A1").setValue(JSON.stringify(state));
  sheet.getRange("A2").setValue(new Date().toISOString());
}

function todayStr_() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function jsonOk_(data, extra) {
  const payload = Object.assign({ ok: true }, extra || {}, data ? { data } : {});
  return ContentService.createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function jsonError_(message) {
  return ContentService.createTextOutput(JSON.stringify({ ok: false, error: message }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet() {
  const data = readState_();
  return jsonOk_(data);
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return jsonError_("busy, try again");
  try {
    const body = JSON.parse(e.postData.contents);
    if (body && typeof body.action === "string") {
      return handleAction_(body);
    }
    // 기존 full-state replace (루미 가든 web 앱 경로)
    writeState_(body);
    return jsonOk_(null);
  } catch (err) {
    return jsonError_(err.message || "unknown error");
  } finally {
    lock.releaseLock();
  }
}

function handleAction_(body) {
  const state = readState_();
  // 누락 필드 안전한 default
  state.tasks = state.tasks || [];
  state.farms = state.farms || [];
  state.projects = state.projects || [];

  switch (body.action) {
    case "add_task":
      return addTaskAction_(state, body);
    case "complete_task":
      return completeTaskAction_(state, body);
    case "set_condition":
      return setConditionAction_(state, body);
    case "add_farm":
      return addFarmAction_(state, body);
    case "add_tree":
      return addTreeAction_(state, body);
    default:
      return jsonError_(`unknown action: ${body.action}`);
  }
}

function addTaskAction_(state, body) {
  const title = (body.title || "").trim();
  if (!title) return jsonError_("title is required");
  state.tasks.push({
    id: Utilities.getUuid(),
    title,
    time: body.time || "09:00",
    difficulty: body.difficulty || "medium",
    kind: body.kind || "flex",
    completed: false,
    createdAt: Date.now(),
    date: body.date || todayStr_(),
    postponedCount: 0,
    order: state.tasks.length,
    projectId: body.projectId || null,
  });
  writeState_(state);
  return jsonOk_(state, { action: "add_task" });
}

function completeTaskAction_(state, body) {
  let target = null;
  if (body.id) {
    target = state.tasks.find((t) => t.id === body.id);
  } else if (body.title) {
    const today = todayStr_();
    const titleLower = body.title.toLowerCase();
    target = state.tasks.find(
      (t) => t.date === today && t.title.toLowerCase() === titleLower,
    );
  }
  if (!target) return jsonError_("task not found");
  target.completed = !target.completed;
  target.completedAt = target.completed ? Date.now() : undefined;
  writeState_(state);
  return jsonOk_(state, { action: "complete_task" });
}

function setConditionAction_(state, body) {
  const mode = body.mode;
  if (!["best", "normal", "low", "sick"].includes(mode)) {
    return jsonError_(`invalid mode: ${mode}`);
  }
  state.condition = mode;
  state.conditionSetAt = Date.now();
  writeState_(state);
  return jsonOk_(state, { action: "set_condition" });
}

function addFarmAction_(state, body) {
  const title = (body.title || "").trim();
  if (!title) return jsonError_("title is required");
  state.farms.push({
    id: Utilities.getUuid(),
    title,
    icon: body.icon || "🌾",
    createdAt: Date.now(),
    order: state.farms.length,
  });
  writeState_(state);
  return jsonOk_(state, { action: "add_farm" });
}

function addTreeAction_(state, body) {
  const title = (body.title || "").trim();
  if (!title) return jsonError_("title is required");
  state.projects.push({
    id: Utilities.getUuid(),
    title,
    description: body.description || "",
    completed: false,
    createdAt: Date.now(),
    order: state.projects.length,
    farmId: body.farmId || null,
  });
  writeState_(state);
  return jsonOk_(state, { action: "add_tree" });
}
```

### 사용자 작업
1. 스프레드시트 열기 → 확장 프로그램 → Apps Script
2. 기존 코드 전체 삭제 → 위 코드 붙여넣기 → 저장
3. 배포 → 배포 관리 → "새 배포 만들기" — 액세스: 모든 사용자 (로그인 불필요), 실행: 나
4. 새 배포 URL은 기존과 동일하면 그대로, 변경되면 루미 가든 settings에 새 URL 입력

⚠️ 주의: 기존 deployment URL을 그대로 유지하려면 "배포 관리"에서 기존 배포 편집 → 새 버전. 새 배포 만들면 URL 바뀌고 모든 클라이언트(루미 가든 web, OpenClaw, 다른 디바이스)에 새 URL 알려야 함.

## settings.tsx UI snippet 동기화

`src/routes/settings.tsx:307~330`의 `<pre>` 블록(Apps Script 코드 안내)을 새 코드로 교체. 사용자가 처음 셋업할 때 또는 새로 배포할 때 참고용.

루미 가든 web의 동작은 변경 없음 (기존 doPost full-state 경로 그대로 사용).

## API 문서 (산출물 — Sub-project 1의 핵심)

`docs/openclaw-integration.md` 신규 생성. 포함 내용:

1. **개요** — 루미 가든 ↔ OpenClaw 연동 흐름 다이어그램
2. **준비** — Apps Script 배포 URL 확보, Content-Type 주의사항
3. **API 레퍼런스** — GET/POST + 5개 action endpoint, 각각 요청/응답 예시
4. **시나리오별 코드 스니펫** — pseudocode
   - 할일 N개 추가
   - 오늘 임무 조회/요약
   - 완료 토글
   - 컨디션 설정
   - 농장/나무 추가
5. **OpenClaw 도구 정의 가이드** — 도구 이름, 파라미터, 응답 처리. JSON Schema 형태로 5개 도구 명세 + 1개 fallback (전체 state 조회)
6. **에러 처리** — `{ok: false, error: "..."}` 패턴, 재시도 가이드
7. **race condition 노트** — LockService로 서버 atomic 보장, 그래도 사용자 web 앱과 동시 편집 시 last-write-wins 규칙 설명
8. **테스트 방법** — `curl`로 각 action 호출 예시

## 테스트

### Apps Script 코드 검증

서버 측 자동 테스트 환경 없음 — `curl`로 수동 검증.

```bash
URL="https://script.google.com/macros/s/.../exec"

# 1. GET state
curl -L "$URL"

# 2. add_task
curl -L -X POST "$URL" \
  -H "Content-Type: text/plain" \
  -d '{"action":"add_task","title":"테스트 임무"}'

# 3. complete_task by title
curl -L -X POST "$URL" \
  -H "Content-Type: text/plain" \
  -d '{"action":"complete_task","title":"테스트 임무"}'

# 4. set_condition
curl -L -X POST "$URL" \
  -H "Content-Type: text/plain" \
  -d '{"action":"set_condition","mode":"normal"}'

# 5. add_farm
curl -L -X POST "$URL" \
  -H "Content-Type: text/plain" \
  -d '{"action":"add_farm","title":"테스트 농장"}'

# 6. add_tree
curl -L -X POST "$URL" \
  -H "Content-Type: text/plain" \
  -d '{"action":"add_tree","title":"테스트 나무"}'

# 7. error case
curl -L -X POST "$URL" \
  -H "Content-Type: text/plain" \
  -d '{"action":"unknown"}'
```

각 응답이 `ok: true/false` + 갱신된 data 포함 확인.

### 루미 가든 web 회귀

기존 `useGarden`이 `doPost` full-state 경로를 그대로 쓰므로 변경 영향 없음. 시트 데이터 갱신 → focus-refetch → web에 반영. 단위 테스트 변경 없음.

수동 검증:
- 텔레그램에서 OpenClaw로 "테스트 임무 추가" → 루미 가든 web 새로고침 → 임무 표시
- web에서 같은 임무 토글 → 텔레그램에서 "오늘 뭐 했어" 시 완료 상태 반영

## 변경 파일

**Created:**
- `docs/openclaw-integration.md` — API 문서 + OpenClaw 도구 정의 가이드 (남편이 참고)
- `apps-script/Code.gs` — Apps Script 코드 reference (사용자가 시트의 에디터에 붙여넣을 원본)

**Modified:**
- `src/routes/settings.tsx` — UI 안내 코드 블록(line 307~330)을 새 코드로 동기화

**Not modified:**
- `src/lib/garden-store.ts` — 변경 없음
- 다른 web 앱 코드 — 변경 없음

## 리스크

- **Apps Script 코드 배포 절차**: 사용자가 시트의 Apps Script 에디터에서 코드 교체 + 새 배포 필요. 사용자에게 명확한 단계별 안내 제공.
- **새 deployment URL**: 새 배포 만들면 URL 바뀜 → 루미 가든 settings에서 새 URL 입력해야 함. "기존 배포 편집"으로 가면 URL 유지 가능 (안내 문서에 명시).
- **race**: web 사용 중 OpenClaw가 동시 write → 사용자 변경 일부 손실 가능. LockService는 서버 측 atomic만 보장. 클라이언트 read-modify-write race는 별개 (이전 input-preservation 픽스가 그 일부 다룸).
- **action endpoint 인증 없음**: Apps Script `/exec`는 "모든 사용자, 로그인 불필요"로 배포됨. URL 자체가 secret. 노출되면 누구나 state 변경 가능. 솔로 사용자한테 acceptable, 향후 토큰 추가 가능.
- **state shape 누락 필드**: 옛 데이터에 새 필드(예: `state.pledges`)가 없을 수 있음. action 핸들러에서 null-safe 접근. spec의 코드는 `state.tasks = state.tasks || []` 등으로 방어.
- **`set_condition`의 conditionSetAt이 morningTime 로직과 어긋날 수 있음**: 텔레그램으로 새벽 3시에 set_condition 보내면 stamp = Date.now() = 새벽 3시. 루미 가든의 `lastMorningCrossing` 비교에서 어제 윈도우 안 → 오늘 morningTime 지나면 picker 다시 노출. 의도 안 맞으면 OpenClaw 측에서 next morningTime 보정 가능. 일단 단순하게 Date.now() 사용.
