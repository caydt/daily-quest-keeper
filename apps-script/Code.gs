/**
 * 루미 가든 Apps Script 백엔드.
 *
 * 두 가지 path:
 *   1. 루미 가든 web 앱 — POST body가 GardenState 통째 → A1 셀 통째 갱신 (기존 동작)
 *   2. OpenClaw 등 외부 에이전트 — POST body에 action 필드 → 단순 명령 처리, atomic
 *
 * 자세한 API 명세: docs/openclaw-integration.md
 */

const SHEET_NAME = "Sheet1";

function getSheet_() {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
}

function readState_() {
  const raw = getSheet_().getRange("A1").getValue();
  return raw ? JSON.parse(raw) : {};
}

function writeState_(state) {
  const sheet = getSheet_();
  sheet.getRange("A1").setValue(JSON.stringify(state));
  sheet.getRange("A2").setValue(new Date().toISOString());
}

function todayStr_() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function jsonOk_(data, extra) {
  const payload = Object.assign({ ok: true }, extra || {}, data ? { data } : {});
  return ContentService.createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function jsonError_(message) {
  return ContentService.createTextOutput(JSON.stringify({ ok: false, error: message }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet() {
  const data = readState_();
  return jsonOk_(data);
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return jsonError_("busy, try again");
  try {
    const body = JSON.parse(e.postData.contents);
    if (body && typeof body.action === "string") {
      return handleAction_(body);
    }
    // 기존 full-state replace (루미 가든 web 앱 경로)
    writeState_(body);
    return jsonOk_(null);
  } catch (err) {
    return jsonError_(err.message || "unknown error");
  } finally {
    lock.releaseLock();
  }
}

function handleAction_(body) {
  const state = readState_();
  state.tasks = state.tasks || [];
  state.farms = state.farms || [];
  state.projects = state.projects || [];

  switch (body.action) {
    case "add_task":
      return addTaskAction_(state, body);
    case "complete_task":
      return completeTaskAction_(state, body);
    case "set_condition":
      return setConditionAction_(state, body);
    case "add_farm":
      return addFarmAction_(state, body);
    case "add_tree":
      return addTreeAction_(state, body);
    default:
      return jsonError_("unknown action: " + body.action);
  }
}

function addTaskAction_(state, body) {
  const title = (body.title || "").trim();
  if (!title) return jsonError_("title is required");
  state.tasks.push({
    id: Utilities.getUuid(),
    title: title,
    time: body.time || "09:00",
    difficulty: body.difficulty || "medium",
    kind: body.kind || "flex",
    completed: false,
    createdAt: Date.now(),
    date: body.date || todayStr_(),
    postponedCount: 0,
    order: state.tasks.length,
    projectId: body.projectId || null,
  });
  writeState_(state);
  return jsonOk_(state, { action: "add_task" });
}

function completeTaskAction_(state, body) {
  let target = null;
  if (body.id) {
    target = state.tasks.find(function (t) { return t.id === body.id; });
  } else if (body.title) {
    const today = todayStr_();
    const titleLower = body.title.toLowerCase();
    target = state.tasks.find(function (t) {
      return t.date === today && t.title.toLowerCase() === titleLower;
    });
  }
  if (!target) return jsonError_("task not found");
  target.completed = !target.completed;
  if (target.completed) {
    target.completedAt = Date.now();
  } else {
    delete target.completedAt;
  }
  writeState_(state);
  return jsonOk_(state, { action: "complete_task" });
}

function setConditionAction_(state, body) {
  const mode = body.mode;
  const valid = ["best", "normal", "low", "sick"];
  if (valid.indexOf(mode) === -1) {
    return jsonError_("invalid mode: " + mode);
  }
  state.condition = mode;
  state.conditionSetAt = Date.now();
  writeState_(state);
  return jsonOk_(state, { action: "set_condition" });
}

function addFarmAction_(state, body) {
  const title = (body.title || "").trim();
  if (!title) return jsonError_("title is required");
  state.farms.push({
    id: Utilities.getUuid(),
    title: title,
    icon: body.icon || "🌾",
    createdAt: Date.now(),
    order: state.farms.length,
  });
  writeState_(state);
  return jsonOk_(state, { action: "add_farm" });
}

function addTreeAction_(state, body) {
  const title = (body.title || "").trim();
  if (!title) return jsonError_("title is required");
  state.projects.push({
    id: Utilities.getUuid(),
    title: title,
    description: body.description || "",
    completed: false,
    createdAt: Date.now(),
    order: state.projects.length,
    farmId: body.farmId || null,
  });
  writeState_(state);
  return jsonOk_(state, { action: "add_tree" });
}
