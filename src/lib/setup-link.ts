// 기기 간 연동: Apps Script URL을 ?script= 파라미터로 안전하게 전달.
// 악의적 링크가 사용자의 데이터를 다른 시트로 빼돌리지 못하도록 패턴 검증 필수.

const APPS_SCRIPT_URL_RE =
  /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/;

export function isValidScriptUrl(url: string): boolean {
  if (!url) return false;
  return APPS_SCRIPT_URL_RE.test(url.trim());
}

// origin/pathname 베이스에 ?script=<url>을 붙여 셋업 링크 생성.
export function buildSetupLink(scriptUrl: string, base: string): string {
  const u = new URL(base);
  u.searchParams.set("script", scriptUrl);
  return u.toString();
}

// 현재 href에서 ?script= 파라미터를 읽어 valid한 경우만 반환.
export function readSetupParam(href: string): { scriptUrl: string } | null {
  try {
    const u = new URL(href);
    const param = u.searchParams.get("script");
    if (!param) return null;
    if (!isValidScriptUrl(param)) return null;
    return { scriptUrl: param.trim() };
  } catch {
    return null;
  }
}

// href에서 ?script= 파라미터만 제거.
export function stripSetupParam(href: string): string {
  try {
    const u = new URL(href);
    u.searchParams.delete("script");
    return u.toString();
  } catch {
    return href;
  }
}
