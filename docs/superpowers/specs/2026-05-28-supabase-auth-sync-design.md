# 루미가든 Supabase 인증 + 기기 간 동기화 — Design Spec

**작성일**: 2026-05-28
**작업자**: Claude (with @ayoungjo)
**상태**: 사용자 검토 대기

---

## 배경

루미가든은 현재 Google Apps Script(GAS) + localStorage 이중 저장소를 사용한다.
GAS 의존성을 제거하고 Supabase 기반 인증 + 클라우드 동기화로 전환하여 기기 간 데이터 공유를 구현한다.

Supabase 프로젝트(`bizzvqdkczuwfekrrwrq`)와 `garden_state` 마이그레이션은 이미 준비돼 있다.

---

## 목표

1. 이메일+비밀번호 로그인/회원가입 추가
2. 로그인 시 `garden_state` 테이블 (user_id PK, state JSONB, version BIGINT)에 저장
3. 비로그인 시 기존 localStorage 모드 유지 (기능 저하 없음)
4. Apps Script 의존성 완전 제거
5. 로그인 후 기존 localStorage 데이터 자동 업로드

---

## 아키텍처

### 현재

```
garden-store → [GAS URL 있으면] SheetsAdapter (Google Apps Script)
               [없으면]         LocalAdapter  (localStorage)
```

### 목표

```
AuthContext (Supabase 세션)
       ↓
garden-store → [로그인됨] SupabaseAdapter (Supabase DB)
               [비로그인] LocalAdapter    (localStorage)
```

### 신규 파일

| 파일 | 역할 |
|------|------|
| `src/lib/supabase-client.ts` | Supabase 클라이언트 싱글턴 |
| `src/lib/supabase-adapter.ts` | `StorageAdapter` 구현 — `garden_state` upsert/select |
| `src/hooks/use-auth.ts` | 세션 상태 + 로그인/로그아웃/회원가입 훅 |
| `src/routes/auth.tsx` | 로그인·회원가입 페이지 (`/auth`) |

### 수정 파일

| 파일 | 변경 내용 |
|------|-----------|
| `src/lib/garden-store.ts` | SheetsAdapter 제거, auth 상태에 따라 어댑터 선택 |
| `src/routes/settings.tsx` | Apps Script URL 섹션 제거, 계정 섹션 추가 |
| `src/lib/sheets-adapter.ts` | 파일 삭제 |
| `package.json` | `@supabase/supabase-js` 추가 |

---

## 데이터 흐름

### Hydrate (앱 시작)

```
1. AuthContext 초기화 → Supabase 세션 확인
2. 로그인됨 → SupabaseAdapter.load() → DB에서 state 조회
   비로그인 → LocalAdapter.load() → localStorage 조회
3. 둘 다 null → initialState 사용
4. setHydrated(true)
```

### Save (state 변경 시)

```
로그인됨:
  1. SupabaseAdapter.save() → DB upsert (낙관적, debounce 600ms)
  2. 실패 시 → LocalAdapter.save() (fallback) + saveStatus="error"

비로그인:
  1. LocalAdapter.save() → localStorage
```

### 로그인 시 마이그레이션 (한 번만 실행)

```
로그인 성공 시:
  A. localStorage 데이터 있음 + DB 데이터 없음
     → 자동으로 localStorage 데이터를 DB에 업로드
  B. localStorage 데이터 있음 + DB 데이터 있음
     → "로컬 데이터 / 클라우드 데이터" 선택 다이얼로그
  C. localStorage 없음
     → DB 데이터를 로컬에 적용 (hydrate)
```

### 기기 간 동기화

- 앱 window focus 시 SupabaseAdapter.load() re-fetch (현재 GAS 방식과 동일)
- Realtime 구독은 v1 제외 (YAGNI)

---

## UI

### `/auth` — 로그인/회원가입 페이지

- 탭: "로그인" / "회원가입" 전환
- 로그인 탭: 이메일 + 비밀번호 입력 + "로그인" 버튼
- 회원가입 탭: 이메일 + 비밀번호 + 비밀번호 확인 + "가입" 버튼
- 하단: "건너뛰기 (로컬 모드)" 텍스트 링크 → `/` 이동
- 로그인/가입 성공 → `/` 리다이렉트

### 설정 페이지 변경

**제거:**
- Apps Script URL 입력 섹션
- 연결 테스트 버튼

**추가 (계정 섹션):**
- 비로그인 상태: "로그인하면 기기 간 동기화가 가능해요" + "로그인" 버튼 (`/auth`로)
- 로그인 상태: 계정 이메일 표시 + "로그아웃" 버튼

### SaveStatus 표시 (기존 구조 유지)

- idle / saving / saved / error — 기존 그대로 유지
- 비로그인일 때는 "로컬 저장 중" 툴팁 추가 (선택 사항)

---

## Supabase 어댑터 인터페이스

기존 `StorageAdapter` 인터페이스를 그대로 사용:

```typescript
interface StorageAdapter {
  load(): Promise<GardenState | null>;
  save(state: GardenState): Promise<void>;
}
```

`SupabaseAdapter`는 `user_id` 기반으로 `garden_state` 테이블에 upsert:

```sql
-- upsert: state 덮어쓰기 (version은 DB trigger로 자동 증가 대신 클라이언트 타임스탬프 사용)
INSERT INTO garden_state (user_id, state)
VALUES ($user_id, $state)
ON CONFLICT (user_id) DO UPDATE SET state = EXCLUDED.state;
```

---

## 환경변수

`.env.local`에 추가:

```
VITE_SUPABASE_URL=https://bizzvqdkczuwfekrrwrq.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key>
```

---

## 테스트 계획

- `supabase-adapter.ts`: load/save 단위 테스트 (Supabase 클라이언트 mock)
- `use-auth.ts`: 로그인/로그아웃/세션 상태 훅 테스트
- `garden-store.ts`: 로그인 상태별 어댑터 선택 로직 테스트
- 마이그레이션 시나리오 A/B/C 통합 테스트

---

## 비고

- Apps Script URL 설정 localStorage key(`lumi-script-url`)는 마이그레이션 완료 후 정리
- `version` 컬럼은 현재 사용 안 함 (conflict resolution은 "클라우드 우선" 또는 사용자 선택)
- Realtime 구독, 낙관적 충돌 해결은 v2 후보
