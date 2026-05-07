# OpenClaw 연동 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apps Script에 5개 action endpoint 추가 + 한국어 API 문서 작성. 남편이 OpenClaw에 도구 등록할 때 참고 가능. 루미 가든 web 코드 변경 0.

**Architecture:** Apps Script `doPost`에 body.action 분기 추가. 5개 action(`add_task`, `complete_task`, `set_condition`, `add_farm`, `add_tree`)이 LockService로 감싸진 read-modify-write로 처리, 응답에 갱신된 state 포함. 기존 full-state replace 경로(루미 가든 web 사용)는 호환 유지. 새 Apps Script 코드는 `apps-script/Code.gs`에 reference로 저장 + settings.tsx의 안내 코드 블록도 동기화.

**Tech Stack:** Google Apps Script (V8), Google Sheets, Markdown 문서.

**Spec:** `docs/superpowers/specs/2026-05-08-openclaw-integration-design.md`

---

## File Structure

**Created:**
- `apps-script/Code.gs` — Apps Script 전체 코드 (사용자가 시트의 Apps Script 에디터에 붙여넣을 reference 원본). repo에서 source-of-truth.
- `docs/openclaw-integration.md` — 한국어 API 문서. 남편이 OpenClaw에 도구 등록 시 참고.

**Modified:**
- `src/routes/settings.tsx` — 라인 313~336의 inline `<pre>` 블록의 Apps Script 코드를 새 action-aware 버전으로 교체. UI 가이드 본문(번호 매김)은 그대로.

**Not modified:**
- `src/lib/garden-store.ts` — 변경 없음
- 다른 web 앱 코드 — 변경 없음
- 단위 테스트 — 변경 없음 (코드 변경 영향 없음)

---

## Task 1: `apps-script/Code.gs` 생성 (action-aware Apps Script reference)

**Files:**
- Create: `apps-script/Code.gs`

테스트 코드 자체는 자동화 어려움 (GAS는 별도 환경). Task 1에서는 reference 파일만 만들고, 실제 동작 검증은 Task 4 (사용자 수동 deploy + curl)에서.

- [ ] **Step 1: 디렉토리 생성**

```bash
cd /Users/ayoungjo/daily-quest-keeper
mkdir -p apps-script
```

- [ ] **Step 2: `apps-script/Code.gs` 생성**

다음 내용을 그대로 작성:

```js
/**
 * 루미 가든 Apps Script 백엔드.
 *
 * 두 가지 path:
 *   1. 루미 가든 web 앱 — POST body가 GardenState 통째 → A1 셀 통째 갱신 (기존 동작)
 *   2. OpenClaw 등 외부 에이전트 — POST body에 action 필드 → 단순 명령 처리, atomic
 *
 * 자세한 API 명세: docs/openclaw-integration.md
 */

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
      return jsonError_("unknown action: " + body.action);
  }
}

function addTaskAction_(state, body) {
  const title = (body.title || "").trim();
  if (!title) return jsonError_("title is required");
  state.tasks.push({
    id: Utilities.getUuid(),
    title: title,
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
    target = state.tasks.find(function (t) { return t.id === body.id; });
  } else if (body.title) {
    const today = todayStr_();
    const titleLower = body.title.toLowerCase();
    target = state.tasks.find(function (t) {
      return t.date === today && t.title.toLowerCase() === titleLower;
    });
  }
  if (!target) return jsonError_("task not found");
  target.completed = !target.completed;
  if (target.completed) {
    target.completedAt = Date.now();
  } else {
    delete target.completedAt;
  }
  writeState_(state);
  return jsonOk_(state, { action: "complete_task" });
}

function setConditionAction_(state, body) {
  const mode = body.mode;
  const valid = ["best", "normal", "low", "sick"];
  if (valid.indexOf(mode) === -1) {
    return jsonError_("invalid mode: " + mode);
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
    title: title,
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
    title: title,
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

- [ ] **Step 3: 빌드 확인 (영향 없음 검증)**

`apps-script/` 디렉토리는 Vite 번들 대상 아님. 그래도 빌드 확인:

```bash
npm run build
```

기대: 빌드 성공, 새 파일은 dist에 안 들어감.

- [ ] **Step 4: 커밋**

```bash
git add apps-script/Code.gs
git commit -m "feat(apps-script): action-aware backend (add_task/complete_task/set_condition/add_farm/add_tree)

OpenClaw 등 외부 에이전트가 단순 명령으로 루미 가든 state를 변경할 수
있게 하는 5개 action endpoint. LockService로 read-modify-write 보호,
응답에 갱신된 state 포함. 기존 full-state replace 경로는 호환 유지."
```

---

## Task 2: `src/routes/settings.tsx`의 안내 코드 블록 동기화

**Files:**
- Modify: `src/routes/settings.tsx` (line 313~336 부근의 `<pre>` 블록)

- [ ] **Step 1: `<pre>` 블록 교체**

`src/routes/settings.tsx`의 라인 313~336 부근의 `<pre className="bg-black/30 rounded px-2 py-2 text-[10px] font-mono text-primary/90 overflow-x-auto whitespace-pre">{...}</pre>` 블록 안의 코드 문자열을 새 action-aware 코드로 교체.

원래:
```tsx
            <pre className="bg-black/30 rounded px-2 py-2 text-[10px] font-mono text-primary/90 overflow-x-auto whitespace-pre">{`const SHEET_NAME = "Sheet1";

function doGet() {
  const sheet = SpreadsheetApp
    .getActiveSpreadsheet()
    .getSheetByName(SHEET_NAME);
  const raw = sheet.getRange("A1").getValue();
  const data = raw ? JSON.parse(raw) : {};
  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, data }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  const sheet = SpreadsheetApp
    .getActiveSpreadsheet()
    .getSheetByName(SHEET_NAME);
  const body = JSON.parse(e.postData.contents);
  sheet.getRange("A1").setValue(JSON.stringify(body));
  sheet.getRange("A2").setValue(new Date().toISOString());
  return ContentService
    .createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}`}</pre>
```

교체:
```tsx
            <pre className="bg-black/30 rounded px-2 py-2 text-[10px] font-mono text-primary/90 overflow-x-auto whitespace-pre">{`/**
 * 루미 가든 Apps Script 백엔드.
 * 자세한 API: docs/openclaw-integration.md
 */
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
  return d.getFullYear() + "-" +
    String(d.getMonth() + 1).padStart(2, "0") + "-" +
    String(d.getDate()).padStart(2, "0");
}
function jsonOk_(data, extra) {
  const p = Object.assign({ ok: true }, extra || {}, data ? { data } : {});
  return ContentService.createTextOutput(JSON.stringify(p))
    .setMimeType(ContentService.MimeType.JSON);
}
function jsonError_(msg) {
  return ContentService.createTextOutput(JSON.stringify({ ok: false, error: msg }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet() {
  return jsonOk_(readState_());
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return jsonError_("busy, try again");
  try {
    const body = JSON.parse(e.postData.contents);
    if (body && typeof body.action === "string") return handleAction_(body);
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
  state.tasks = state.tasks || [];
  state.farms = state.farms || [];
  state.projects = state.projects || [];
  switch (body.action) {
    case "add_task": return addTaskAction_(state, body);
    case "complete_task": return completeTaskAction_(state, body);
    case "set_condition": return setConditionAction_(state, body);
    case "add_farm": return addFarmAction_(state, body);
    case "add_tree": return addTreeAction_(state, body);
    default: return jsonError_("unknown action: " + body.action);
  }
}

function addTaskAction_(state, body) {
  const title = (body.title || "").trim();
  if (!title) return jsonError_("title is required");
  state.tasks.push({
    id: Utilities.getUuid(), title: title,
    time: body.time || "09:00", difficulty: body.difficulty || "medium",
    kind: body.kind || "flex", completed: false, createdAt: Date.now(),
    date: body.date || todayStr_(), postponedCount: 0,
    order: state.tasks.length, projectId: body.projectId || null,
  });
  writeState_(state);
  return jsonOk_(state, { action: "add_task" });
}

function completeTaskAction_(state, body) {
  let target = null;
  if (body.id) target = state.tasks.find(function(t) { return t.id === body.id; });
  else if (body.title) {
    const t = todayStr_(), tl = body.title.toLowerCase();
    target = state.tasks.find(function(x) { return x.date === t && x.title.toLowerCase() === tl; });
  }
  if (!target) return jsonError_("task not found");
  target.completed = !target.completed;
  if (target.completed) target.completedAt = Date.now();
  else delete target.completedAt;
  writeState_(state);
  return jsonOk_(state, { action: "complete_task" });
}

function setConditionAction_(state, body) {
  if (["best","normal","low","sick"].indexOf(body.mode) === -1)
    return jsonError_("invalid mode: " + body.mode);
  state.condition = body.mode;
  state.conditionSetAt = Date.now();
  writeState_(state);
  return jsonOk_(state, { action: "set_condition" });
}

function addFarmAction_(state, body) {
  const title = (body.title || "").trim();
  if (!title) return jsonError_("title is required");
  state.farms.push({
    id: Utilities.getUuid(), title: title,
    icon: body.icon || "🌾", createdAt: Date.now(),
    order: state.farms.length,
  });
  writeState_(state);
  return jsonOk_(state, { action: "add_farm" });
}

function addTreeAction_(state, body) {
  const title = (body.title || "").trim();
  if (!title) return jsonError_("title is required");
  state.projects.push({
    id: Utilities.getUuid(), title: title,
    description: body.description || "", completed: false,
    createdAt: Date.now(), order: state.projects.length,
    farmId: body.farmId || null,
  });
  writeState_(state);
  return jsonOk_(state, { action: "add_tree" });
}`}</pre>
```

(주: settings.tsx의 `<pre>` 안 코드는 reference이지만 Code.gs와 의미적으로 동일해야 함. 압축 위해 한 줄에 여러 함수 정의가 들어가도 동작은 같아야 함.)

- [ ] **Step 2: 빌드 + 전체 테스트**

```bash
cd /Users/ayoungjo/daily-quest-keeper
npm run build
npm run test:run
```

기대: 빌드 성공 (settings.tsx의 큰 문자열 변경 외엔 영향 없음), 모든 테스트 PASS (코드 변경 없으므로 기존 80개).

- [ ] **Step 3: 커밋**

```bash
git add src/routes/settings.tsx
git commit -m "docs(settings): 안내 Apps Script 코드를 action-aware 버전으로 동기화

apps-script/Code.gs와 의미적으로 동일한 코드를 settings 페이지의
안내 블록에 표시. 사용자가 새 시트 셋업 시 이 코드를 그대로
붙여넣으면 OpenClaw 연동까지 함께 활성화됨."
```

---

## Task 3: `docs/openclaw-integration.md` API 문서 작성

**Files:**
- Create: `docs/openclaw-integration.md`

- [ ] **Step 1: 문서 작성**

`docs/openclaw-integration.md` 신규 생성. 다음 내용 그대로:

````markdown
# 루미 가든 ↔ OpenClaw 연동 가이드

루미 가든의 Apps Script 백엔드는 두 가지 인터페이스를 제공합니다:

1. **full state GET/POST** — 루미 가든 web 앱이 사용. state 전체를 주고받음.
2. **action endpoint** — OpenClaw 등 외부 에이전트가 사용. 단순 명령(예: "할일 추가") 1회 호출로 처리.

이 문서는 OpenClaw에 루미 가든 도구를 등록할 때 참고용입니다.

## 흐름

```
[텔레그램 메시지]
   ↓
[OpenClaw + Lumi 도구]
   ↓ HTTPS POST/GET
[Apps Script /exec]  ← LockService로 동시성 보호
   ↓
[Google Sheet "Sheet1" A1 셀: GardenState JSON]
   ↑
[루미 가든 web]  (focus-refetch + 디바운스 save)
```

OpenClaw가 시트에 변경을 가하면, 루미 가든 web 앱은 다음 focus 또는 reload 시 자동으로 반영합니다.

## 준비

1. Apps Script 코드를 시트에 배포 (`apps-script/Code.gs`의 코드를 시트의 Apps Script 에디터에 복사 → 저장 → 배포 관리 → 새 버전).
2. 배포 옵션: **실행: 나 / 액세스: 모든 사용자 (로그인 불필요)**.
3. deployment URL 확보 (https://script.google.com/macros/s/<DEPLOYMENT_ID>/exec). 이하 `URL`로 표기.
4. **모든 POST는 `Content-Type: text/plain`로 보낼 것**. `application/json`은 Apps Script가 OPTIONS preflight 처리 못 해서 차단됨.

## API 레퍼런스

### `GET URL` — 전체 state 조회

응답:
```json
{ "ok": true, "data": { /* GardenState */ } }
```

### `POST URL` — full state 갱신 (web 앱 경로)

`body.action` 필드가 없으면 body 전체를 새 GardenState로 시트에 저장.

요청:
- Headers: `Content-Type: text/plain`
- Body: `JSON.stringify(state)`

응답: `{ "ok": true }`

OpenClaw는 보통 이 경로를 직접 쓰지 않음 — 5개 action endpoint 사용 권장.

### `POST URL` — action endpoint (외부 에이전트 경로)

`body.action`에 해당하는 명령 처리. 응답엔 갱신된 GardenState 포함.

**공통 응답**:
- 성공: `{ "ok": true, "data": <updated GardenState>, "action": "<name>" }`
- 실패: `{ "ok": false, "error": "<message>" }`

#### 1. `add_task` — 할일 추가

요청 body:
```json
{
  "action": "add_task",
  "title": "운동",
  "time": "07:00",
  "difficulty": "medium",
  "kind": "flex",
  "date": "2026-05-08",
  "projectId": null
}
```

필수: `title`. 나머지는 선택 (기본값: time `"09:00"`, difficulty `"medium"`, kind `"flex"`, date 오늘, projectId `null`).

서버 자동: `id` (UUID), `createdAt`, `order`, `completed: false`, `postponedCount: 0`.

#### 2. `complete_task` — 완료 토글

요청 body (둘 중 하나):
```json
{ "action": "complete_task", "id": "<task-uuid>" }
```
또는
```json
{ "action": "complete_task", "title": "운동" }
```

`title`로 보내면 오늘 날짜의 task 중 정확 일치(케이스 무시) 첫 1개를 토글. 없으면 `task not found` 에러.

토글 동작: `completed`를 반전. `true`면 `completedAt` stamp, `false`로 돌리면 제거.

#### 3. `set_condition` — 컨디션 설정

요청 body:
```json
{ "action": "set_condition", "mode": "best" }
```

`mode` ∈ `["best", "normal", "low", "sick"]`. 다른 값이면 에러.

서버 자동: `state.condition = mode`, `state.conditionSetAt = Date.now()`.

#### 4. `add_farm` — 농장 추가

요청 body:
```json
{ "action": "add_farm", "title": "디자인", "icon": "🎨" }
```

필수: `title`. `icon` 선택 (기본 `"🌾"`).

서버 자동: `id` (UUID), `createdAt`, `order`.

#### 5. `add_tree` — 나무(프로젝트) 추가

요청 body:
```json
{
  "action": "add_tree",
  "title": "포트폴리오 리뉴얼",
  "farmId": "<farm-uuid-or-null>",
  "description": ""
}
```

필수: `title`. `farmId`는 농장에 속하면 그 ID, 독립 나무면 `null` (또는 생략).

서버 자동: `id` (UUID), `createdAt`, `order`, `completed: false`.

## OpenClaw 도구 정의 가이드

OpenClaw에 5개 도구 + 1개 fallback (전체 state 조회)을 등록. 각 도구는 위 action endpoint 호출의 wrapper.

### 도구 1: `lumi_get_state`

- 설명: 루미 가든의 현재 전체 state(할일, 농장, 나무, 컨디션 등)를 가져옴.
- 파라미터: 없음
- 호출: `GET URL`
- 반환: `data` 필드의 GardenState

### 도구 2: `lumi_add_task`

- 설명: 오늘 또는 지정 날짜에 할일을 추가.
- 파라미터:
  - `title` (string, 필수)
  - `time` (string, 선택, 형식 "HH:MM")
  - `difficulty` (string, 선택, "easy"/"medium"/"hard")
  - `kind` (string, 선택, "must"/"flex")
  - `date` (string, 선택, 형식 "YYYY-MM-DD")
- 호출: `POST URL`, body = `{action: "add_task", ...params}`
- 반환: 갱신된 state

### 도구 3: `lumi_complete_task`

- 설명: 할일 완료 토글. id 또는 title 중 하나로 식별.
- 파라미터:
  - `id` (string, 선택)
  - `title` (string, 선택, id 미제공 시 사용)
- 호출: `POST URL`, body = `{action: "complete_task", id?, title?}`

### 도구 4: `lumi_set_condition`

- 설명: 오늘 컨디션 설정.
- 파라미터:
  - `mode` (string, 필수, "best"/"normal"/"low"/"sick")
- 호출: `POST URL`, body = `{action: "set_condition", mode}`

### 도구 5: `lumi_add_farm`

- 설명: 새 농장 추가.
- 파라미터:
  - `title` (string, 필수)
  - `icon` (string, 선택)
- 호출: `POST URL`, body = `{action: "add_farm", title, icon?}`

### 도구 6: `lumi_add_tree`

- 설명: 새 나무(프로젝트) 추가. 농장에 속하거나 독립.
- 파라미터:
  - `title` (string, 필수)
  - `farmId` (string|null, 선택)
  - `description` (string, 선택)
- 호출: `POST URL`, body = `{action: "add_tree", title, farmId?, description?}`

## 시나리오별 의사 코드

OpenClaw가 텔레그램 메시지를 받았을 때 도구를 어떻게 조합하는지 예시.

### "운동, 책 읽기, 코드 리뷰 추가해줘"
1. 메시지 파싱 → 항목 3개
2. `lumi_add_task({title: "운동"})`
3. `lumi_add_task({title: "책 읽기"})`
4. `lumi_add_task({title: "코드 리뷰"})`
5. 응답: "3개 추가했어. 오늘 총 N개 임무 있어."

### "오늘 뭐 해야 해?"
1. `lumi_get_state()`
2. `data.tasks`에서 `date === 오늘`이고 `completed === false`인 것들 추출
3. 자연어 요약: "오늘 임무 N개: ...."

### "운동 완료"
1. `lumi_complete_task({title: "운동"})`
2. 응답이 ok → "운동 완료! 콤보 N 유지."
3. 응답이 not found → "오늘 '운동' 임무를 못 찾았어."

### "컨디션 sick"
1. `lumi_set_condition({mode: "sick"})`
2. 응답: "컨디션 'sick'로 설정. 오늘은 must 중 hard만 표시될 거야."

### "디자인 농장 만들고 거기에 포트폴리오 리뉴얼 추가"
1. `lumi_add_farm({title: "디자인"})` → 응답에서 새 farmId 추출
2. `lumi_add_tree({title: "포트폴리오 리뉴얼", farmId: <newId>})`
3. 응답: "디자인 농장에 포트폴리오 리뉴얼 나무 심었어."

## 에러 처리

응답이 `{ok: false, error: "..."}`:

- `"busy, try again"` — LockService 5초 timeout. 잠시 후 재시도.
- `"title is required"` — 필수 파라미터 누락. 사용자에게 다시 물어봄.
- `"task not found"` — title로 매치되는 오늘 task 없음. 다른 날짜의 것일 수 있음 → state 조회 후 안내.
- `"invalid mode"` — set_condition의 mode 값 오타.
- `"unknown action"` — 도구 정의 오류 가능성. 디버깅.

## race condition 노트

- LockService로 서버 측 read-modify-write는 atomic.
- 하지만 사용자가 루미 가든 web에서 편집 중에 OpenClaw가 동시 명령 → 늦은 쪽 write가 이김 (last-write-wins).
- 일반적인 솔로 사용에선 거의 문제 안 됨. 대규모 동시 활동 가능성 거의 없음.

## 인증

현재 Apps Script는 **누구나 접근 가능** 모드로 배포됨 (URL 자체가 secret). 다른 누군가에게 URL이 노출되면 state 변경 가능. 솔로 사용 + URL 비공개 유지로 충분. 향후 토큰 인증 필요 시 별도 spec.

## 테스트 예시

`curl`로 각 action 검증:

```bash
URL="https://script.google.com/macros/s/.../exec"

# state 조회
curl -L "$URL"

# 할일 추가
curl -L -X POST "$URL" \
  -H "Content-Type: text/plain" \
  -d '{"action":"add_task","title":"테스트 임무"}'

# 완료 토글
curl -L -X POST "$URL" \
  -H "Content-Type: text/plain" \
  -d '{"action":"complete_task","title":"테스트 임무"}'

# 컨디션 설정
curl -L -X POST "$URL" \
  -H "Content-Type: text/plain" \
  -d '{"action":"set_condition","mode":"normal"}'

# 농장 추가
curl -L -X POST "$URL" \
  -H "Content-Type: text/plain" \
  -d '{"action":"add_farm","title":"테스트 농장"}'

# 나무 추가
curl -L -X POST "$URL" \
  -H "Content-Type: text/plain" \
  -d '{"action":"add_tree","title":"테스트 나무"}'
```

각 응답이 `ok: true` + 갱신된 data 포함 확인.
````

- [ ] **Step 2: 빌드 + 테스트 (영향 없음 검증)**

```bash
cd /Users/ayoungjo/daily-quest-keeper
npm run build
npm run test:run
```

기대: 둘 다 통과 (문서만 추가).

- [ ] **Step 3: 커밋**

```bash
git add docs/openclaw-integration.md
git commit -m "docs: OpenClaw 연동 가이드 — Apps Script API + 도구 정의"
```

---

## Task 4: 사용자 deploy + 수동 검증 + 머지

**Files:** 코드 변경 없음.

⚠️ 이 task는 **사용자 작업 필요** — Apps Script 코드 deploy + curl 검증.

- [ ] **Step 1: Apps Script 코드 deploy 안내**

사용자에게 다음 단계 안내:

1. Google Sheets 열기 → 확장 프로그램 → Apps Script
2. 기존 코드 전체 삭제 → `apps-script/Code.gs`의 내용 통째로 복사 → 붙여넣기 → 저장
3. 우측 상단 **배포 → 배포 관리** → 기존 deployment의 ✏️ 편집 → 버전 "새 버전" 선택 → 설명 "OpenClaw action endpoint 추가" → **배포**
4. URL은 그대로 유지 (기존 web 앱 클라이언트 영향 0)

⚠️ "새 배포"가 아니라 **"배포 관리 → 기존 편집"** 으로 진행해야 URL 유지됨. 새 배포는 URL이 바뀜.

- [ ] **Step 2: curl로 5개 action 검증**

deployment URL을 변수로 셋팅 후 차례로:

```bash
URL="https://script.google.com/macros/s/.../exec"  # 사용자의 실제 URL

# state 확인 (기존 데이터 보존됐는지)
curl -L "$URL" | head -c 500
```

기대: `{"ok":true,"data":{...현재 시트 데이터...}}`. 농장/나무 데이터 그대로 살아있어야 함.

```bash
# add_task
curl -L -X POST "$URL" -H "Content-Type: text/plain" \
  -d '{"action":"add_task","title":"OpenClaw 테스트 임무"}'
```

기대: `ok: true`, data.tasks에 새 임무 포함.

```bash
# complete_task by title
curl -L -X POST "$URL" -H "Content-Type: text/plain" \
  -d '{"action":"complete_task","title":"OpenClaw 테스트 임무"}'
```

기대: ok, 해당 task의 completed: true.

```bash
# set_condition
curl -L -X POST "$URL" -H "Content-Type: text/plain" \
  -d '{"action":"set_condition","mode":"normal"}'
```

기대: ok, state.condition: "normal".

```bash
# add_farm
curl -L -X POST "$URL" -H "Content-Type: text/plain" \
  -d '{"action":"add_farm","title":"OpenClaw 테스트 농장"}'
```

기대: ok, farms에 새 농장.

```bash
# add_tree
curl -L -X POST "$URL" -H "Content-Type: text/plain" \
  -d '{"action":"add_tree","title":"OpenClaw 테스트 나무"}'
```

기대: ok, projects에 새 나무.

```bash
# 에러 케이스 — 잘못된 action
curl -L -X POST "$URL" -H "Content-Type: text/plain" \
  -d '{"action":"unknown"}'
```

기대: `{"ok":false,"error":"unknown action: unknown"}`.

- [ ] **Step 3: 루미 가든 web 회귀 확인**

`npm run dev` → 브라우저에서 페이지 열기 → 새로고침 → 위 curl로 추가한 테스트 임무/농장/나무가 표시됨 → 일반적인 web 앱 동작(추가/삭제/토글) 정상 작동 확인.

- [ ] **Step 4: 정리 — 테스트 데이터 삭제**

curl로 추가한 "OpenClaw 테스트 ..." 항목들을 web 앱에서 삭제 (또는 두고 가도 무방).

- [ ] **Step 5: 남편에게 문서 공유**

`docs/openclaw-integration.md` 파일을 남편에게 전달 (GitHub URL 또는 직접 복사). OpenClaw에 도구 등록은 남편 영역.

- [ ] **Step 6: push**

검증 통과 → push:

```bash
git push origin main
```

(워크트리 사용 시 finishing-a-development-branch 스킬에서 머지.)

---

## 완료 후

- 남편이 OpenClaw에 도구 등록 후 텔레그램에서 테스트
- 시간 알림 (Sub-project 2)은 별도 spec/plan 필요 시 새 brainstorm

다음 후보:
- 텔레그램 시간 알림 (Sub-project 2 — Apps Script time-driven trigger)
- 컨디션 잔여 P2 정리
- /map 추가 강화
