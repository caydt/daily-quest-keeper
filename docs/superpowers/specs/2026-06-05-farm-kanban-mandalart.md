# 농장 칸반 + 만다라트 레이아웃 설계

**날짜:** 2026-06-05  
**범위:** `ProjectList` 컴포넌트 레이아웃 개편 + `MandalartOverlay` 신규 컴포넌트

---

## 목표

현재 농장들이 세로로 쌓이는 구조를 Trello 스타일 **가로 칸반 열**로 전환하고, 각 농장에서 **만다라트 3×3 그리드** 오버레이를 열 수 있도록 한다.

---

## 1. 칸반 열 레이아웃

### 변경 대상
- `src/components/garden/ProjectList.tsx` — `ProjectList` 컴포넌트 내 농장 렌더링 부분

### 구조

```
<가로 스크롤 컨테이너 (overflow-x: auto, scroll-snap-x)>
  [FarmColumn: 🌾 사이드 프로젝트]
  [FarmColumn: 💼 회사 업무]
  [FarmColumn: 📚 학습]
  [FarmColumn: 🌱 독립 나무]   ← farmId 없는 프로젝트들
  [+ 농장 만들기 버튼]
</가로 스크롤 컨테이너>
```

### FarmColumn 스펙
- **폭:** `min-w-[260px] max-w-[260px]` 고정
- **높이:** 열 내부 스크롤 없음 — 페이지 전체 스크롤로 처리
- **헤더:** 기존 FarmCard 헤더 유지 (아이콘, 제목, 위/아래 이동 버튼 → 이제 좌/우 이동 버튼으로 교체)
- **나무 목록:** 기존 `ProjectCard`를 세로로 쌓음
- **하단:** `[+ 나무 심기]` 인라인 추가 버튼

### 독립 나무 열
- 항상 마지막에 위치하는 고정 열
- farmId가 없는 프로젝트들을 표시
- 이동 버튼 없음

### 모바일 대응
- `scroll-snap-type: x mandatory` + `scroll-snap-align: start`로 스와이프 시 열 단위로 스냅
- 열 폭은 `min-w-[85vw]`로 모바일에서 거의 전체폭 사용

---

## 2. 만다라트 오버레이

### 신규 컴포넌트
- `src/components/garden/MandalartOverlay.tsx`

### 트리거
- `FarmColumn` 헤더에 **만다라트 아이콘 버튼** (LayoutGrid 아이콘) 추가
- 클릭 시 해당 농장의 만다라트 오버레이 열림

### 그리드 구조 (3×3 = 9칸)

```
[0] [1] [2]
[3] [★] [4]   ← ★ = 중앙 (농장 이름/아이콘)
[5] [6] [7]
```

- 슬롯 0~7: 나무(Project) 카드 순서대로 배치
- 나무가 8개 미만: 빈 슬롯에 `[+ 나무 추가]` 버튼
- 나무가 8개 초과: 그리드 하단에 초과 나무 목록 표시 (스크롤 가능)

### 나무 셀 표시
- 나무 아이콘 (TreeStageIcon)
- 제목 (1~2줄, 넘치면 말줄임)
- 완료율 퍼센트 또는 완료 체크 표시
- 클릭 시: 기존 `ProjectCard` 기능을 담은 드로어/팝업 열림 (완료 토글, 서브 할일 확인)

### 중앙 셀
- 농장 아이콘 + 제목
- 나무 수, 평균 완료율 표시

### 오버레이 UX
- `position: fixed; inset: 0` 전체화면
- 배경 블러 (`backdrop-blur`)
- 우상단 `[X]` 닫기 버튼
- ESC 키로 닫기

---

## 3. 데이터 모델 변경 없음

- Farm, Project 타입 변경 없음
- `farm.order` 기준으로 열 정렬 (기존과 동일)
- 만다라트에서 나무 순서는 `project.order` 기준

---

## 4. DnD 처리

- 칸반 열 내 나무 드래그 앤 드롭: 기존 sortable 유지
- 열 간 드래그 (나무를 다른 농장 열로 이동): 기존 `moveProjectToFarm` 호출 — 드롭 타겟을 열 헤더 또는 열 본문으로 확장
- 만다라트 오버레이 내에서는 DnD 없음 (읽기/조작은 클릭으로만)

---

## 5. 테스트 계획

- `FarmCard.test.tsx` → `FarmColumn`으로 rename + 칸반 열 렌더링 테스트
- `MandalartOverlay.test.tsx` 신규: 9칸 렌더링, 빈 칸 표시, 8개 초과 처리, ESC 닫기

---

## 변경 파일 목록

| 파일 | 변경 유형 |
|------|----------|
| `src/components/garden/ProjectList.tsx` | 대규모 수정 (레이아웃 개편) |
| `src/components/garden/MandalartOverlay.tsx` | 신규 |
| `src/components/garden/FarmCard.test.tsx` | 수정 (FarmColumn 테스트로 업데이트) |
| `src/components/garden/MandalartOverlay.test.tsx` | 신규 |
