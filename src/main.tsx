import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { getRouter } from "./router";
import { readSetupParam, stripSetupParam } from "./lib/setup-link";
import { getScriptUrl, setScriptUrl, SCRIPT_URL_KEY } from "./lib/sheets-adapter";
import "./styles.css";

// 기기 간 연동: ?script=<URL>이 있으면 검증 후 localStorage 저장 + URL 정리.
// 렌더 전에 실행해야 useGarden hydrate가 새 URL을 사용함.
function applySetupParamIfPresent() {
  if (typeof window === "undefined") return;
  const setup = readSetupParam(window.location.href);
  if (!setup) return;

  const hasExisting = !!localStorage.getItem(SCRIPT_URL_KEY);
  const existing = getScriptUrl();
  const replacing = hasExisting && existing !== setup.scriptUrl;

  let proceed = true;
  if (replacing) {
    proceed = window.confirm(
      "다른 기기의 시트로 연결하려고 해요.\n\n" +
        `현재: ${existing}\n` +
        `새 시트: ${setup.scriptUrl}\n\n` +
        "계속하면 이 기기는 새 시트의 데이터를 받아옵니다. 계속할까요?",
    );
  }
  if (proceed) {
    setScriptUrl(setup.scriptUrl);
  }
  // URL은 항상 정리(파라미터를 그대로 두면 새로고침 시 다시 confirm).
  window.history.replaceState({}, "", stripSetupParam(window.location.href));
}

applySetupParamIfPresent();

const router = getRouter();

const rootElement = document.getElementById("root")!;
createRoot(rootElement).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
);
