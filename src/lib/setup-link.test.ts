import { describe, it, expect } from "vitest";
import {
  isValidScriptUrl,
  buildSetupLink,
  readSetupParam,
  stripSetupParam,
} from "./setup-link";

const VALID =
  "https://script.google.com/macros/s/AKfycby-kcKgg-nrnp_X64J-fWlGcTv8hyv0DRxWY284lFq6cxRVdx2v7iEAE8h-lFlN5Bq6-A/exec";

describe("isValidScriptUrl", () => {
  it("정상 Apps Script URL 통과", () => {
    expect(isValidScriptUrl(VALID)).toBe(true);
  });

  it("/exec 누락 → 거절", () => {
    expect(isValidScriptUrl("https://script.google.com/macros/s/abc123/dev")).toBe(false);
  });

  it("script.google.com 도메인 아님 → 거절", () => {
    expect(isValidScriptUrl("https://evil.com/macros/s/abc/exec")).toBe(false);
  });

  it("http (TLS 없음) → 거절", () => {
    expect(isValidScriptUrl("http://script.google.com/macros/s/abc/exec")).toBe(false);
  });

  it("빈 문자열 → 거절", () => {
    expect(isValidScriptUrl("")).toBe(false);
  });

  it("공백 끼어 있어도 trim 후 valid", () => {
    expect(isValidScriptUrl(`  ${VALID}  `)).toBe(true);
  });
});

describe("buildSetupLink", () => {
  it("base 주어지면 ?script= 파라미터 부착", () => {
    const link = buildSetupLink(VALID, "https://app.example.com/");
    const u = new URL(link);
    expect(u.origin + u.pathname).toBe("https://app.example.com/");
    expect(u.searchParams.get("script")).toBe(VALID);
  });

  it("기존 query 있으면 보존", () => {
    const link = buildSetupLink(VALID, "https://app.example.com/?theme=dark");
    const u = new URL(link);
    expect(u.searchParams.get("theme")).toBe("dark");
    expect(u.searchParams.get("script")).toBe(VALID);
  });
});

describe("readSetupParam", () => {
  it("?script= 파라미터에 valid URL → 추출", () => {
    const href = `https://app.example.com/?script=${encodeURIComponent(VALID)}`;
    expect(readSetupParam(href)).toEqual({ scriptUrl: VALID });
  });

  it("파라미터 없음 → null", () => {
    expect(readSetupParam("https://app.example.com/")).toBeNull();
  });

  it("invalid script URL → null (악의적 링크 차단)", () => {
    const href = "https://app.example.com/?script=https%3A%2F%2Fevil.com%2Fexec";
    expect(readSetupParam(href)).toBeNull();
  });

  it("URL 파싱 실패 → null", () => {
    expect(readSetupParam("not-a-url")).toBeNull();
  });
});

describe("stripSetupParam", () => {
  it("script 파라미터만 제거, 나머지 유지", () => {
    const href = `https://app.example.com/?theme=dark&script=${encodeURIComponent(VALID)}`;
    const out = stripSetupParam(href);
    const u = new URL(out);
    expect(u.searchParams.get("script")).toBeNull();
    expect(u.searchParams.get("theme")).toBe("dark");
  });

  it("파라미터 없으면 그대로", () => {
    expect(stripSetupParam("https://app.example.com/")).toBe("https://app.example.com/");
  });
});
