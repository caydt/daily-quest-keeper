# 도구 ID 안정화 + Picker UX 개선 — Design Spec

**작성일**: 2026-05-07
**작업자**: Claude (with @ayoungjo)
**상태**: 사용자 검토 대기

## 배경

사용자가 도구 라이브러리 시트를 정렬한 뒤 메인 화면에 와보니 농장/나무에 연결됐던 도구가 사라진 것처럼 보였다. 또한 도구가 많아지면서 picker로 빠르게 찾기 불편하다.

## 원인 분석 — 버그

`src/lib/tools-sheet.ts:118`:
```ts
id: `row-${r}-${name.toLowerCase().replace(/\s+/g, "-")}`,
```

도구 ID가 시트 **행 번호** 기반이다. 시트 정렬로 행 번호가 바뀌면 같은 도구의 ID가 변한다. 저장된 `toolIds`가 새 ID와 매치 안 돼 도구 연결이 끊긴 것처럼 보인다. 데이터 자체는 살아있고, ID lookup 실패가 원인.

## 목표

1. **ID 안정화**: 시트 정렬·이름 변경에 영향 안 받는 ID 체계로 전환
2. **옛 데이터 호환**: 이전에 저장된 `row-N-slug` 형식 ID도 매치되도록 fallback
3. **UX 개선**:
   - 카테고리 칩 필터 (검색 박스 외 추가 차원)
   - picker 폭 확대 (256 → 320)
   - 선택 카운트 + 명시적 "닫기" 버튼
   - 농장/나무 이름 기반 **추천 섹션**: 매칭되는 도구를 상단에 강조, "추천 모두 추가" 버튼

비목표:
- 시트에 ID 컬럼 추가 (사용자 작업 0 원칙)
- 명시적 1회 마이그레이션으로 state.toolIds 전체 교체 (fallback으로 충분)
- 부분 문자열 매칭 (오버매칭 방지)

## 데이터 레이어

### `src/lib/tools-sheet.ts`

`rowsToTools` 함수의 ID 생성을 URL 기반으로 변경:

```ts
tools.push({
  id: url,  // ← URL 자체를 ID로 사용. 정렬·이름 변경에 안정적.
  name,
  url,
  category: ...,
  tags: ...,
  icon: ...,
  description: ...,
});
```

추가: 옛 ID 형식 매칭 헬퍼.

```ts
// 저장된 toolId가 새 형식(URL)이면 그대로 lookup,
// 옛 형식("row-3-figma")이면 slug 추출 후 같은 name으로 fallback.
export const findToolById = (tools: Tool[], savedId: string): Tool | undefined => {
  const direct = tools.find((t) => t.id === savedId);
  if (direct) return direct;
  const m = savedId.match(/^row-\d+-(.+)$/);
  if (!m) return undefined;
  const slug = m[1];
  return tools.find((t) => t.name.toLowerCase().replace(/\s+/g, "-") === slug);
};
```

호출 사이트는 두 곳 (그 외 `availableTools.find(...)` 패턴 발견되면 같이 교체):
- `ToolPicker` 자체 — 선택 상태 표시 (`selectedIds.includes(tool.id)`는 그대로 동작, 변경 불필요. 옛 ID는 새 toolId와 안 맞아도 picker엔 새 ID만 등장하므로 표시상 무해)
- 농장/프로젝트 카드의 도구 pills 표시 (`ToolPills` 같은 컴포넌트가 있다면 거기서 `findToolById` 사용)

### state 마이그레이션 안 함

`state.farms[i].toolIds`, `state.projects[i].toolIds`, `state.tasks[i].toolIds`는 옛 형식 그대로 유지. UI에서 `findToolById` fallback으로 정상 표시. 사용자가 도구를 토글로 다시 추가하면 새 ID(URL)로 저장됨 — 자연 마이그레이션.

리스크: state.toolIds에 옛 형식이 영구 잔존. cosmetic. 최악의 경우 옛 형식 ID가 의미 없어진 시점에서도(매칭되는 도구 사라짐) "유령 ID"로 남음 → 단순한 가비지 콜렉션으로 풀 수 있음 (사용자가 직접 도구 해제). 솔로 프로젝트 영향 미미.

## 매칭 알고리즘

농장/프로젝트 이름과 도구의 카테고리/태그가 단어 단위로 정확 일치하는지.

```ts
// 매치 알고리즘
//  - 제목을 공백으로 split → 단어들 (lowercase)
//  - 각 단어가 도구.category (lowercase, 정확 일치) 또는 도구.tags 배열 안 단어 (정확 일치)에 있으면 매치
export const matchToolsForTitle = (title: string, tools: Tool[]): Tool[] => {
  const words = title.toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  return tools.filter((tool) => {
    const cat = tool.category?.toLowerCase().trim();
    const tagSet = new Set(tool.tags.map((t) => t.toLowerCase().trim()));
    return words.some((w) => w === cat || tagSet.has(w));
  });
};
```

예시 (위 알고리즘으로 검증):
- 제목 "디자인" + 도구 category="디자인" → 매치 ✓
- 제목 "개발 도구" + 도구 tags=["개발","유틸"] → 매치 ✓ ("개발" 단어로)
- 제목 "프로젝트A" + 도구 category="디자인" → 매치 X
- 제목 "디자인" + 도구 tags=["디자인 시스템"] → 매치 X (정확 일치 안 됨)

부분 문자열 매칭은 의도적으로 제외 — "디자" 같은 단편이 "디자인"과 매치되는 오버매칭 방지.

## UI 레이어

### `src/components/garden/ToolPicker.tsx` 변경

**Props 추가**:
```ts
type Props = {
  availableTools: Tool[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  onClose: () => void;
  /** 매칭 기반 추천 — 농장/프로젝트 제목. 비어있거나 미제공이면 추천 섹션 안 보임. */
  recommendForTitle?: string;
};
```

**구조 변경**:

```tsx
export function ToolPicker({ availableTools, selectedIds, onToggle, onClose, recommendForTitle }: Props) {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  // 카테고리 칩들 (도구 목록에서 동적으로 생성)
  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const t of availableTools) if (t.category) set.add(t.category);
    return Array.from(set).sort();
  }, [availableTools]);

  // 추천 도구 (제목이 있을 때만)
  const recommended = useMemo(() => {
    if (!recommendForTitle) return [];
    return matchToolsForTitle(recommendForTitle, availableTools);
  }, [recommendForTitle, availableTools]);

  // 검색 + 카테고리 필터 적용된 도구 목록
  const filtered = useMemo(() => {
    return availableTools.filter((t) => {
      if (activeCategory && t.category !== activeCategory) return false;
      const q = query.toLowerCase();
      if (!q) return true;
      return (
        t.name.toLowerCase().includes(q) ||
        (t.category ?? "").toLowerCase().includes(q) ||
        t.tags.some((tag) => tag.toLowerCase().includes(q))
      );
    });
  }, [availableTools, activeCategory, query]);

  const selectedCount = selectedIds.length;
  const recommendedNotSelected = recommended.filter((t) => !selectedIds.includes(t.id));
  const handleAddAllRecommended = () => {
    for (const t of recommendedNotSelected) onToggle(t.id);
  };

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />

      <div className="absolute left-0 top-full mt-1 z-50 w-80 rounded-xl border border-white/10 bg-card shadow-xl overflow-hidden">
        {/* 검색 */}
        <div className="p-2 border-b border-white/5">
          <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-black/20">
            <Search className="size-3.5 text-muted-foreground shrink-0" />
            <input ... />
          </div>
        </div>

        {/* 카테고리 칩 (categories 비어있으면 숨김) */}
        {categories.length > 0 && (
          <div className="px-2 py-1.5 border-b border-white/5 flex gap-1 overflow-x-auto">
            <CategoryChip label="전체" active={activeCategory === null} onClick={() => setActiveCategory(null)} />
            {categories.map((c) => (
              <CategoryChip key={c} label={c} active={activeCategory === c} onClick={() => setActiveCategory(c)} />
            ))}
          </div>
        )}

        {/* 추천 섹션 (recommended 있을 때만) */}
        {recommendedNotSelected.length > 0 && (
          <div className="p-2 border-b border-white/5 bg-primary/5 space-y-1.5">
            <div className="flex items-center justify-between gap-2 px-1">
              <span className="text-[10px] font-semibold text-primary/80">
                ✨ 추천 ({recommendedNotSelected.length}개)
              </span>
              <button
                onClick={handleAddAllRecommended}
                className="text-[10px] px-2 py-0.5 rounded-md bg-primary/15 border border-primary/30 text-primary hover:bg-primary/25 transition"
              >
                모두 추가
              </button>
            </div>
            {recommendedNotSelected.map((tool) => (
              <ToolRow key={tool.id} tool={tool} selected={false} onToggle={onToggle} />
            ))}
          </div>
        )}

        {/* 도구 목록 */}
        <div className="max-h-52 overflow-y-auto">
          {availableTools.length === 0 ? (...) : filtered.length === 0 ? (...) : (
            filtered.map((tool) => (
              <ToolRow key={tool.id} tool={tool} selected={selectedIds.includes(tool.id)} onToggle={onToggle} />
            ))
          )}
        </div>

        {/* 푸터: 선택 카운트 + 닫기 */}
        <div className="p-2 border-t border-white/5 flex items-center justify-between text-xs">
          <span className="text-muted-foreground">선택됨 {selectedCount}개</span>
          <button onClick={onClose} className="px-2.5 py-1 rounded-md bg-primary/15 border border-primary/30 text-primary hover:bg-primary/25 transition">
            닫기
          </button>
        </div>
      </div>
    </>
  );
}
```

`CategoryChip`, `ToolRow` 같은 작은 sub-component는 같은 파일 내부에 두어 응집도 유지.

### 호출 측 (`src/components/garden/ProjectList.tsx`)

`<ToolPicker>` 두 호출 지점에 `recommendForTitle` prop 추가:

- 프로젝트 카드의 ToolPicker: `recommendForTitle={p.title}`
- 농장 헤더의 ToolPicker: `recommendForTitle={farm.title}`

## 테스트 (vitest)

### `src/lib/tools-sheet.test.ts` (신규)

`findToolById`:
1. 새 형식 ID(URL) 직접 매치 → 정상 반환
2. 옛 형식 ID(`row-3-figma`) → name slug 매치로 도구 반환
3. 옛 형식인데 매치되는 도구 없음 → undefined
4. 잘못된 형식 → undefined

`matchToolsForTitle`:
1. 제목과 카테고리 정확 일치 → 매치
2. 제목 단어 중 하나가 태그 정확 일치 → 매치
3. 부분 문자열 (예: "디자" vs "디자인") → 매치 안 됨
4. 빈 제목 → 빈 배열
5. 케이스 무시 (영문 "Design" vs "design")

### `src/components/garden/ToolPicker.test.tsx` (신규 또는 spot-check)

작은 통합 테스트:
1. 카테고리 칩 클릭 → 해당 카테고리만 표시
2. recommendForTitle 전달 → 추천 섹션 노출
3. "추천 모두 추가" 클릭 → onToggle이 매치된 도구 수만큼 호출됨

## 변경 파일

**Created:**
- `src/lib/tools-sheet.test.ts` — `findToolById`, `matchToolsForTitle` 단위 테스트
- `src/components/garden/ToolPicker.test.tsx` — 카테고리/추천 동작 테스트

**Modified:**
- `src/lib/tools-sheet.ts` — 도구 ID 생성 변경, `findToolById`, `matchToolsForTitle` export
- `src/components/garden/ToolPicker.tsx` — props 추가, 카테고리 칩, 추천 섹션, 푸터, 폭 확대
- `src/components/garden/ProjectList.tsx` — `<ToolPicker>` 두 호출에 `recommendForTitle` 전달
- 도구 pills 표시하는 곳(있다면) — `findToolById` 사용

## 리스크

- **옛 toolIds 잔존**: state에 `row-N-slug` 영구 남음. fallback으로 정상 표시되지만 향후 사용자가 시트에서 도구 이름 바꾸면 fallback도 끊김. 다만 그 시점에 picker로 다시 토글하면 새 ID로 자연스럽게 마이그레이션됨.
- **추천 오버매칭/언더매칭**: 단어 단위 정확 일치 알고리즘은 보수적. 농장 "프로덕트 디자인"이면 "프로덕트" 또는 "디자인" 태그 둘 다 매치 — OK. 다만 영어/한글 혼용("UI Design"이라는 농장에 카테고리 "디자인" 도구는 매치 안 됨). 기본 정도면 충분, 더 똑똑한 매칭은 별도 작업.
- **picker 높이 증가**: 카테고리 칩 + 추천 섹션 + 푸터로 높이 늘어남. 메인 화면에서 농장 카드 헤더에 dropdown으로 떠 있는 형태인데, 모바일에서 하단 가려질 수 있음. 자동 위치 조정은 별도 작업; 초안에서는 그대로 둠.
- **카테고리 칩 가로 스크롤**: 카테고리 많으면 한 줄에 안 들어감. `overflow-x-auto`로 가로 스크롤. 작은 화면 UX 트레이드오프.
