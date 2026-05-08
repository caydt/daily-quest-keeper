import { useEffect, useState, useCallback } from "react";

export type Tool = {
  id: string; // row index 기반 안정 ID
  name: string;
  url: string;
  category?: string;
  tags: string[];
  icon?: string; // emoji 또는 짧은 텍스트
  description?: string;
};

const CACHE_KEY = "lumi-tools-cache-v1";

type Cache = {
  url: string;
  fetchedAt: number;
  tools: Tool[];
};

/**
 * 구글 시트 URL을 CSV export URL로 변환.
 * 지원 형식:
 *  - https://docs.google.com/spreadsheets/d/{ID}/edit#gid=0
 *  - https://docs.google.com/spreadsheets/d/{ID}/edit?gid=123
 *  - https://docs.google.com/spreadsheets/d/{ID}/...
 *  - 이미 export?format=csv 형태
 */
export function toCsvUrl(input: string): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (trimmed.includes("/export?")) return trimmed;
  const m = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!m) return null;
  const id = m[1];
  const gidMatch = trimmed.match(/[#?&]gid=(\d+)/);
  const gid = gidMatch ? gidMatch[1] : "0";
  return `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}`;
}

// 간단한 RFC4180 호환 CSV 파서 (따옴표/콤마/개행 처리)
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        cur.push(field);
        field = "";
      } else if (ch === "\n" || ch === "\r") {
        if (ch === "\r" && text[i + 1] === "\n") i++;
        cur.push(field);
        rows.push(cur);
        cur = [];
        field = "";
      } else {
        field += ch;
      }
    }
  }
  if (field.length > 0 || cur.length > 0) {
    cur.push(field);
    rows.push(cur);
  }
  return rows.filter((r) => r.some((c) => c.trim().length > 0));
}

// URL 정규화: 보이지 않는 유니코드(BOM, zero-width space 등) 제거 + 스킴 보정
function normalizeUrl(raw: string): string {
  if (!raw) return "";
  // 제로폭/방향 제어 문자 + BOM 제거, 양쪽 공백 trim
  let u = raw
    .replace(/[\u200B-\u200D\u2060\uFEFF\u202A-\u202E\u2066-\u2069]/g, "")
    .trim();
  if (!u) return "";
  // 스킴이 없으면 https:// 자동 부여 (단, mailto: tel: 제외)
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(u)) {
    u = `https://${u}`;
  }
  return u;
}

function rowsToTools(rows: string[][]): Tool[] {
  if (rows.length === 0) return [];
  const headers = rows[0].map((h) => h.trim().toLowerCase());
  const idx = (key: string) => headers.indexOf(key);
  const iName = idx("name");
  const iUrl = idx("url");
  const iCat = idx("category");
  const iTags = idx("tags");
  const iIcon = idx("icon");
  const iDesc = idx("description");

  const tools: Tool[] = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const name = (iName >= 0 ? row[iName] : row[0])?.trim() ?? "";
    const rawUrl = (iUrl >= 0 ? row[iUrl] : row[1]) ?? "";
    const url = normalizeUrl(rawUrl);
    if (!name || !url) continue;
    tools.push({
      id: url,  // URL을 ID로 사용 — 시트 정렬·이름 변경에 안정적
      name,
      url,
      category: iCat >= 0 ? row[iCat]?.trim() : undefined,
      tags:
        iTags >= 0 && row[iTags]
          ? row[iTags]
              .split(/[,;|]/)
              .map((t) => t.trim())
              .filter(Boolean)
          : [],
      icon: iIcon >= 0 ? row[iIcon]?.trim() : undefined,
      description: iDesc >= 0 ? row[iDesc]?.trim() : undefined,
    });
  }
  return tools;
}

// 저장된 toolId가 새 형식(URL)이면 그대로 lookup,
// 옛 형식("row-3-figma")이면 slug 추출 후 같은 name(slug 비교)으로 fallback.
// 옛 데이터(2026-05 이전 row 기반 ID로 저장된 farm/project/task.toolIds) 호환용.
// slug가 여러 도구와 매치되면 모호하므로 undefined 반환 — 잘못된 도구로 매핑되는 것보다
// "(연결 끊김)" placeholder를 띄워 사용자가 직접 정리하도록 유도.
export const findToolById = (tools: Tool[], savedId: string): Tool | undefined => {
  const direct = tools.find((t) => t.id === savedId);
  if (direct) return direct;
  const m = savedId.match(/^row-\d+-(.+)$/);
  if (!m) return undefined;
  const slug = m[1];
  const matches = tools.filter((t) => t.name.toLowerCase().replace(/\s+/g, "-") === slug);
  if (matches.length === 1) return matches[0];
  return undefined;
};

// 농장/프로젝트 제목과 도구의 카테고리/태그가 단어 단위로 정확 일치하는지 검사.
// 단어 단위: 제목을 공백으로 split → 각 단어가 도구.category 정확 일치 또는
//   도구.tags의 어느 항목과 정확 일치하면 매치.
// 케이스 무시. 부분 문자열 매칭은 의도적으로 제외 (오버매칭 방지).
export const matchToolsForTitle = (title: string, tools: Tool[]): Tool[] => {
  const words = title.toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  return tools.filter((tool) => {
    const cat = tool.category?.toLowerCase().trim();
    const tagSet = new Set(tool.tags.map((t) => t.toLowerCase().trim()));
    return words.some((w) => w === cat || tagSet.has(w));
  });
};

export function useToolsSheet(sheetUrl: string | undefined) {
  const [tools, setTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState<number | null>(null);

  // 캐시 즉시 표시
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (raw) {
        const c: Cache = JSON.parse(raw);
        if (sheetUrl && c.url === sheetUrl) {
          setTools(c.tools);
          setFetchedAt(c.fetchedAt);
        }
      }
    } catch {
      /* ignore */
    }
  }, [sheetUrl]);

  const refresh = useCallback(async () => {
    if (!sheetUrl) {
      setError("시트 URL이 설정되지 않았어요.");
      return;
    }
    const csvUrl = toCsvUrl(sheetUrl);
    if (!csvUrl) {
      setError("올바른 구글 시트 URL이 아니에요.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(csvUrl, { redirect: "follow" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      const rows = parseCsv(text);
      const parsed = rowsToTools(rows);
      setTools(parsed);
      const now = Date.now();
      setFetchedAt(now);
      try {
        localStorage.setItem(
          CACHE_KEY,
          JSON.stringify({ url: sheetUrl, fetchedAt: now, tools: parsed } satisfies Cache),
        );
      } catch {
        /* ignore */
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "알 수 없는 오류";
      setError(
        `시트를 불러오지 못했어요 (${msg}). 시트가 '링크가 있는 모든 사용자'에게 보기 권한으로 공개되어 있는지 확인하세요.`,
      );
    } finally {
      setLoading(false);
    }
  }, [sheetUrl]);

  // URL 바뀌면 자동 1회 페치
  useEffect(() => {
    if (sheetUrl) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheetUrl]);

  return { tools, loading, error, fetchedAt, refresh };
}
