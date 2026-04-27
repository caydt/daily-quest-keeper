import type { GardenState } from "@/lib/garden-store";
import type { StorageAdapter } from "@/lib/storage";

export const SCRIPT_URL_KEY = "lumi-script-url";

const DEFAULT_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycby-kcKgg-nrnp_X64J-fWlGcTv8hyv0DRxWY284lFq6cxRVdx2v7iEAE8h-lFlN5Bq6-A/exec";

export function getScriptUrl(): string {
  if (typeof window === "undefined") return DEFAULT_SCRIPT_URL;
  return localStorage.getItem(SCRIPT_URL_KEY) || DEFAULT_SCRIPT_URL;
}

export function setScriptUrl(url: string) {
  localStorage.setItem(SCRIPT_URL_KEY, url);
}

export function createSheetsAdapter(scriptUrl: string): StorageAdapter {
  return {
    async load() {
      try {
        const res = await fetch(scriptUrl, { method: "GET" });
        if (!res.ok) return null;
        const json = (await res.json()) as { ok: boolean; data: GardenState };
        if (!json.ok || !json.data || Object.keys(json.data).length === 0) return null;
        return json.data;
      } catch {
        return null;
      }
    },
    async save(state) {
      // Content-Type을 text/plain으로 설정: application/json은 CORS preflight를 유발해
      // Google Apps Script가 OPTIONS 요청을 처리하지 못해 POST가 차단됨
      const res = await fetch(scriptUrl, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify(state),
      });
      if (!res.ok) throw new Error(`Apps Script POST 실패: ${res.status}`);
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!json.ok) throw new Error(json.error ?? "Apps Script POST 실패");
    },
  };
}

/** 연결 테스트: GET 성공 여부만 확인 */
export async function testScriptUrl(url: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(url, { method: "GET" });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    const json = (await res.json()) as { ok?: boolean };
    if (!json.ok) return { ok: false, error: "응답 형식이 올바르지 않아요" };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "연결 실패" };
  }
}
