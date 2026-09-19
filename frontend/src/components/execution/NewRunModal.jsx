import { useEffect, useState } from "react";
import { Globe, KeyRound, Link2, Play } from "lucide-react";
import Modal from "../ui/Modal";
import Input from "../ui/Input";
import Select from "../ui/Select";
import Button from "../ui/Button";
import { useToast } from "../ui/Toast";
import { runService } from "../../services/run.service";
import { testcaseService } from "../../services/testcase.service";
import { getErrorMessage } from "../../services/api";
import { TEST_TYPES, TEST_TYPE_LABEL } from "../../utils/constants";
import { cn } from "../../utils/cn";

const MAX_OPTIONS = [5, 10, 20, 30, 50].map((n) => ({
  value: String(n),
  label: `Up to ${n} test cases`,
}));

const toggle = (list, value) =>
  list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

export default function NewRunModal({ open, onClose, project, onStarted }) {
  const toast = useToast();
  const [types, setTypes] = useState(TEST_TYPES);
  const [maxCases, setMaxCases] = useState("10");
  const [targetUrl, setTargetUrl] = useState("");
  const [apiBaseUrl, setApiBaseUrl] = useState("");
  const [authToken, setAuthToken] = useState("");
  const [showBrowser, setShowBrowser] = useState(false);
  const [smartOrder, setSmartOrder] = useState(true);
  const [counts, setCounts] = useState(null); // null = loading
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !project) return;
    setTargetUrl(project.baseUrl ?? "");
    setApiBaseUrl("");
    setCounts(null);
    let cancelled = false;
    testcaseService
      .list(project.id, { limit: 1 })
      .then((d) => !cancelled && setCounts(d.stats.byType ?? {}))
      .catch(() => !cancelled && setCounts({}));
    return () => {
      cancelled = true;
    };
  }, [open, project]);

  const available = types.reduce((sum, t) => sum + (counts?.[t] ?? 0), 0);
  const willRun = Math.min(available, Number(maxCases));
  const hasApi = types.includes("API");
  const hasUi = types.some((t) => t !== "API");
  const canSubmit = types.length > 0 && willRun > 0 && !busy;

  async function submit() {
    setBusy(true);
    try {
      const run = await runService.create(project.id, {
        types,
        maxCases: Number(maxCases),
        targetUrl: targetUrl.trim() || undefined,
        apiBaseUrl: apiBaseUrl.trim() || undefined,
        authToken: authToken.trim() || undefined,
        headless: !showBrowser,
        smartOrder,
      });
      toast.info(`Run ${run.runCode} started`);
      onStarted(run);
      onClose();
    } catch (err) {
      toast.error(getErrorMessage(err, "Could not start the run"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => !busy && onClose()}
      title="New test run"
      className="sm:max-w-xl"
    >
      <div className="space-y-5">
        <div>
          <p className="mb-2 text-sm font-medium text-ink">Test types</p>
          <div className="grid grid-cols-2 gap-2 min-[480px]:grid-cols-3">
            {TEST_TYPES.map((t) => {
              const on = types.includes(t);
              return (
                <label
                  key={t}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-xl border p-2.5 transition-colors",
                    on
                      ? "border-primary bg-primary-soft"
                      : "border-line hover:bg-primary-soft/50",
                  )}
                >
                  <input
                    type="checkbox"
                    className="size-4 accent-primary"
                    checked={on}
                    onChange={() => setTypes((prev) => toggle(prev, t))}
                  />
                  <span className="min-w-0 text-sm">
                    <span className="block font-semibold text-ink">
                      {TEST_TYPE_LABEL[t]}
                    </span>
                    <span className="block text-xs text-muted">
                      {counts === null ? "..." : `${counts[t] ?? 0} cases`}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-ink">
            How many to run
          </label>
          <Select
            className="h-10"
            options={MAX_OPTIONS}
            value={maxCases}
            onChange={(e) => setMaxCases(e.target.value)}
          />
          <p className="mt-1.5 text-xs text-muted">
            Highest priority cases run first.
          </p>
        </div>

        {hasUi && (
          <Input
            label="Application URL (UI tests)"
            icon={Globe}
            placeholder="https://staging.example.com"
            value={targetUrl}
            onChange={(e) => setTargetUrl(e.target.value)}
          />
        )}

        {hasApi && (
          <>
            <Input
              label="API base URL (optional)"
              icon={Link2}
              placeholder="Same as the application URL if empty"
              value={apiBaseUrl}
              onChange={(e) => setApiBaseUrl(e.target.value)}
            />
            <Input
              label="Bearer token for API tests (optional)"
              icon={KeyRound}
              type="password"
              autoComplete="off"
              placeholder="Sent as Authorization: Bearer ..."
              value={authToken}
              onChange={(e) => setAuthToken(e.target.value)}
            />
          </>
        )}

        {hasUi && (
          <label className="flex cursor-pointer items-start gap-2.5 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 size-4 accent-primary"
              checked={showBrowser}
              onChange={(e) => setShowBrowser(e.target.checked)}
            />
            <span>
              <span className="block font-medium text-ink">
                Show the browser window
              </span>
              <span className="block text-xs text-muted">
                Watch the test run live. Slightly slower. Useful for debugging.
              </span>
            </span>
          </label>
        )}

        <label className="flex cursor-pointer items-start gap-2.5 text-sm">
          <input
            type="checkbox"
            className="mt-0.5 size-4 accent-primary"
            checked={smartOrder}
            onChange={(e) => setSmartOrder(e.target.checked)}
          />
          <span>
            <span className="block font-medium text-ink">
              Smart order (recommended)
            </span>
            <span className="block text-xs text-muted">
              Runs the tests most likely to catch a bug first, using priority
              and past results. It matters most when you run fewer tests than
              exist.
            </span>
          </span>
        </label>

        <p className="text-xs text-muted">
          {counts === null
            ? "Counting test cases..."
            : willRun === 0
              ? "No test cases for the selected types. Generate some first."
              : `${willRun} test case${willRun === 1 ? "" : "s"} will run. Each UI test takes roughly 30 to 90 seconds on a laptop, and you can keep using the app.`}
        </p>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            icon={Play}
            loading={busy}
            disabled={!canSubmit}
            onClick={submit}
          >
            Start run
          </Button>
        </div>
      </div>
    </Modal>
  );
}
