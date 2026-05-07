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
