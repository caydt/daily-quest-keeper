import type { GardenState } from "@/lib/garden-store";
import type { StorageAdapter } from "@/lib/storage";

export const SCRIPT_URL_KEY = "lumi-script-url";

export function getScriptUrl(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(SCRIPT_URL_KEY) ?? "";
}

export function setScriptUrl(url: string) {
  localStorage.setItem(SCRIPT_URL_KEY, url);
}

export function createSheetsAdapter(scriptUrl: string): StorageAdapter {
  return {
    async load() {
      const res = await fetch(scriptUrl, { method: "GET" });
      if (!res.ok) throw new Error(`Apps Script GET 실패: ${res.status}`);
      const json = (await res.json()) as { ok: boolean; data: GardenState };
      if (!json.ok || !json.data || Object.keys(json.data).length === 0) return null;
      return json.data;
    },
    async save(state) {
      const res = await fetch(scriptUrl, {
        method: "POST",
        body: JSON.stringify(state),
      });
      if (!res.ok) throw new Error(`Apps Script POST 실패: ${res.status}`);
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
