import fs from "node:fs/promises";
import { env } from "../config/env.js";
import { ApiError } from "../utils/ApiError.js";

const INDEX_TIMEOUT_MS = 10 * 60 * 1000; // embedding on CPU can be slow
const GENERATE_TIMEOUT_MS = 12 * 60 * 1000; // local LLM generation on CPU can be slow
const UI_CASE_TIMEOUT_MS = 8 * 60 * 1000; // script writing + browser run
const FIX_TIMEOUT_MS = 12 * 60 * 1000; // the 7B code model on CPU

function messageFrom(data, status) {
  if (typeof data?.detail === "string") return data.detail;
  if (Array.isArray(data?.detail))
    return data.detail.map((d) => d.msg).join("; ");
  return `AI engine error (HTTP ${status})`;
}

async function call(
  path,
  { method = "GET", json, form, timeoutMs = env.AI_ENGINE_TIMEOUT_MS } = {},
) {
  const options = { method, signal: AbortSignal.timeout(timeoutMs) };
  if (json !== undefined) {
    options.headers = { "Content-Type": "application/json" };
    options.body = JSON.stringify(json);
  }
  if (form) options.body = form;

  let res;
  try {
    res = await fetch(`${env.AI_ENGINE_URL}/api${path}`, options);
  } catch (e) {
    throw new ApiError(
      502,
      e.name === "TimeoutError"
        ? "The AI engine timed out"
        : `AI engine is not reachable at ${env.AI_ENGINE_URL}. Is uvicorn running on port 8002?`,
    );
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok)
    throw new ApiError(
      res.status >= 500 ? 502 : res.status,
      messageFrom(data, res.status),
    );
  return data;
}

// Converts an engine case result to the shape the backend stores and returns
export const fromEngine = (r) => ({
  status: r.status,
  durationMs: r.duration_ms ?? 0,
  errorMessage: r.error_message ?? null,
  logs: r.logs ?? [],
  screenshotB64: r.screenshot_b64 ?? null,
  response: r.response ?? null,
});

const mobileTarget = (m) => ({
  apk_path: m.apkPath || null,
  app_package: m.appPackage || null,
  app_activity: m.appActivity || null,
  udid: m.udid || null,
  auto_grant: !!m.autoGrant,
});
export const aiEngine = {
  async indexFile({ projectId, requirementId, filePath, filename }) {
    const buffer = await fs.readFile(filePath);
    const form = new FormData();
    form.append("project_id", projectId);
    form.append("requirement_id", requirementId);
    form.append("file", new Blob([buffer]), filename);
    return call("/requirements/index-file", {
      method: "POST",
      form,
      timeoutMs: INDEX_TIMEOUT_MS,
    });
  },

  indexUrl({ projectId, requirementId, url }) {
    return call("/requirements/index-url", {
      method: "POST",
      json: { project_id: projectId, requirement_id: requirementId, url },
      timeoutMs: INDEX_TIMEOUT_MS,
    });
  },

  search({ projectId, query, topK = 5, requirementIds }) {
    return call("/requirements/search", {
      method: "POST",
      json: {
        project_id: projectId,
        query,
        top_k: topK,
        requirement_ids: requirementIds,
      },
    });
  },

  generateTests({
    projectId,
    testType,
    count,
    platform,
    projectName,
    baseUrl,
    module,
    requirementIds,
    avoidTitles,
  }) {
    return call("/testgen/generate", {
      method: "POST",
      json: {
        project_id: projectId,
        test_type: testType,
        count,
        platform,
        project_name: projectName,
        base_url: baseUrl || null,
        module: module || null,
        requirement_ids: requirementIds || null,
        avoid_titles: avoidTitles || [],
      },
      timeoutMs: GENERATE_TIMEOUT_MS,
    });
  },

  // ───────── execution ─────────

  preflight({ url, needBrowser }) {
    return call("/execute/preflight", {
      method: "POST",
      json: { url, need_browser: !!needBrowser },
      timeoutMs: 2 * 60 * 1000,
    });
  },

  async executeApiCase({ baseUrl, testData, authToken }) {
    const data = await call("/execute/api-case", {
      method: "POST",
      json: {
        base_url: baseUrl || null,
        test_data: testData ?? {},
        auth_token: authToken || null,
      },
      timeoutMs: 60 * 1000,
    });
    return fromEngine(data);
  },

  async executeUiCase({ runId, testCase, baseUrl, headless }) {
    const data = await call("/execute/ui-case", {
      method: "POST",
      json: {
        run_id: runId,
        case_id: testCase.id,
        title: testCase.title,
        steps: Array.isArray(testCase.steps) ? testCase.steps : [],
        preconditions: testCase.preconditions,
        expected_result: testCase.expectedResult,
        test_data:
          testCase.testData && typeof testCase.testData === "object"
            ? testCase.testData
            : null,
        base_url: baseUrl,
        headless,
      },
      timeoutMs: UI_CASE_TIMEOUT_MS,
    });
    return fromEngine(data);
  },

  clearScreenshots(runId) {
    return call(`/execute/screenshots/${encodeURIComponent(runId)}`, {
      method: "DELETE",
    });
  },

  // ───────── bugs ─────────

  analyzeBug(b) {
    return call("/bugs/analyze", {
      method: "POST",
      json: {
        project_id: b.projectId,
        title: b.title,
        module: b.module || null,
        test_type: b.testType,
        priority: b.priority,
        result_status: b.resultStatus,
        steps: b.steps ?? [],
        expected_result: b.expectedResult || null,
        error_message: b.errorMessage || null,
        logs: b.logs || null,
        response:
          b.response && typeof b.response === "object" ? b.response : null,
      },
      timeoutMs: 3 * 60 * 1000,
    });
  },

  checkDuplicates({ projectId, bugId, text }) {
    return call("/duplicates/check", {
      method: "POST",
      json: { project_id: projectId, bug_id: bugId, text, index: true },
      timeoutMs: 2 * 60 * 1000,
    });
  },

  suggestFix({
    projectId,
    title,
    module,
    errorMessage,
    explanation,
    requirementIds,
  }) {
    return call("/bugs/fix", {
      method: "POST",
      json: {
        project_id: projectId,
        title,
        module: module || null,
        error_message: errorMessage || null,
        explanation: explanation || null,
        requirement_ids: requirementIds,
      },
      timeoutMs: FIX_TIMEOUT_MS,
    });
  },

  removeBugVector(projectId, bugId) {
    return call(
      `/duplicates/${encodeURIComponent(projectId)}/${encodeURIComponent(bugId)}`,
      {
        method: "DELETE",
      },
    );
  },

  bugEngineStatus() {
    return call("/bugs/status", { timeoutMs: 10 * 1000 });
  },

  // ───────── reports ─────────

  async generateReport({ title, facts }) {
    const d = await call("/report/generate", {
      method: "POST",
      json: { title, facts },
      timeoutMs: 5 * 60 * 1000,
    });
    return {
      sections: {
        executiveSummary: d.sections.executive_summary,
        keyFindings: d.sections.key_findings,
        risks: d.sections.risks,
        recommendations: d.sections.recommendations,
      },
      health: d.health,
      caveats: d.caveats,
      aiWritten: d.ai_written,
      provider: d.provider,
      model: d.model,
      warnings: d.warnings,
      pdfB64: d.pdf_b64,
    };
  },

  // ───────── prioritization, risk, chat ─────────

  rankCases({ projectId, cases }) {
    return call("/prioritize/rank", {
      method: "POST",
      json: { project_id: projectId, cases },
      timeoutMs: 60 * 1000,
    });
  },

  estimateRisk(facts) {
    return call("/risk/estimate", {
      method: "POST",
      json: { facts },
      timeoutMs: 30 * 1000,
    });
  },

  chat({ projectId, message, context, history }) {
    return call("/chat/ask", {
      method: "POST",
      json: { project_id: projectId, message, context, history },
      timeoutMs: 2 * 60 * 1000,
    });
  },

  // ───────── mobile ─────────

  mobileStatus() {
    return call("/mobile/status", { timeoutMs: 30 * 1000 });
  },

  mobilePreflight(target) {
    return call("/mobile/preflight", {
      method: "POST",
      json: { target: mobileTarget(target) },
      timeoutMs: 6 * 60 * 1000, // installing an APK and starting the driver can be slow the first time
    });
  },

  async executeMobileCase({ runId, testCase, target }) {
    const data = await call("/mobile/case", {
      method: "POST",
      json: {
        run_id: runId,
        case_id: testCase.id,
        title: testCase.title,
        steps: Array.isArray(testCase.steps) ? testCase.steps : [],
        preconditions: testCase.preconditions,
        expected_result: testCase.expectedResult,
        test_data:
          testCase.testData && typeof testCase.testData === "object"
            ? testCase.testData
            : null,
        target: mobileTarget(target),
      },
      timeoutMs: 12 * 60 * 1000,
    });
    return fromEngine(data);
  },
  // ───────── cleanup ─────────

  deleteRequirement(projectId, requirementId) {
    return call(
      `/requirements/${encodeURIComponent(projectId)}/${encodeURIComponent(requirementId)}`,
      { method: "DELETE" },
    );
  },

  async deleteProject(projectId) {
    const id = encodeURIComponent(projectId);
    await call(`/requirements/project/${id}`, { method: "DELETE" });
    await call(`/duplicates/project/${id}`, { method: "DELETE" }).catch(
      () => {},
    );
  },
};
