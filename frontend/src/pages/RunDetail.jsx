import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  ImageIcon,
  SearchX,
  SkipForward,
  StopCircle,
  Trash2,
  XCircle,
} from "lucide-react";
import Card, { CardHeader, CardTitle } from "../components/ui/Card";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import Tabs from "../components/ui/Tabs";
import Spinner from "../components/ui/Spinner";
import EmptyState from "../components/ui/EmptyState";
import ProgressBar from "../components/ui/ProgressBar";
import { Table, THead, TBody, Tr, Th, Td } from "../components/ui/Table";
import { useToast } from "../components/ui/Toast";
import StatCard from "../components/dashboard/StatCard";
import RunStepper from "../components/execution/RunStepper";
import LiveLogPanel from "../components/execution/LiveLogPanel";
import ResultDrawer from "../components/execution/ResultDrawer";
import DeployRiskCard from "../components/analytics/DeployRiskCard";
import { useAuth } from "../hooks/useAuth";
import { useRunProgress } from "../hooks/useRunProgress";
import { runService } from "../services/run.service";
import { getErrorMessage } from "../services/api";
import {
  RESULT_STATUS_LABEL,
  RESULT_STATUS_TONE,
  RUN_STAGES,
  RUN_STATUS_LABEL,
  RUN_STATUS_TONE,
  TEST_TYPE_LABEL,
  TEST_TYPE_TONE,
} from "../utils/constants";
import {
  formatDateTime,
  formatDuration,
  formatMs,
  runSeconds,
} from "../utils/formatters";

const ACTIVE = ["QUEUED", "RUNNING"];
const LIMIT = 20;

export default function RunDetail() {
  const { runId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const canWrite = user?.role !== "VIEWER";

  const [run, setRun] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [results, setResults] = useState({ items: [], total: 0 });
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());

  const loadRun = useCallback(async () => {
    try {
      setRun(await runService.get(runId));
    } catch {
      /* keep the previous data */
    }
  }, [runId]);

  const loadResults = useCallback(async () => {
    try {
      setResults(
        await runService.results(runId, { status: filter, page, limit: LIMIT }),
      );
    } catch {
      /* keep the previous data */
    }
  }, [runId, filter, page]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setNotFound(false);
    runService
      .get(runId)
      .then((r) => !cancelled && setRun(r))
      .catch((err) => {
        if (cancelled) return;
        if ([403, 404].includes(err.response?.status)) setNotFound(true);
        else toast.error(getErrorMessage(err, "Could not load the run"));
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [runId, toast]);

  useEffect(() => {
    loadResults();
  }, [loadResults]);

  const isActive = !!run && ACTIVE.includes(run.status);

  const { snapshot } = useRunProgress({
    enabled: isActive,
    streamPath: `/runs/${runId}/events`,
    statusPath: `/runs/${runId}/status`,
    onFinish: (snap) => {
      if (snap.status === "COMPLETED")
        toast.success(snap.progress?.message ?? "Run finished");
      else if (snap.status === "CANCELLED") toast.info("Run was cancelled");
      else toast.error(snap.error || "Run failed");
      loadRun();
      loadResults();
    },
  });

  // New result arrived: refresh the table and the counters
  const done = snapshot?.progress?.done;
  useEffect(() => {
    if (done != null) {
      loadResults();
      loadRun();
    }
  }, [done, loadResults, loadRun]);

  useEffect(() => {
    if (!isActive) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [isActive]);

  async function onCancel() {
    if (
      !window.confirm(
        "Stop this run? The test that is running now will finish first.",
      )
    )
      return;
    setBusy(true);
    try {
      await runService.cancel(runId);
      toast.info("Cancelling...");
      await loadRun();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function onDelete() {
    if (!window.confirm(`Delete run ${run.runCode} and all of its results?`))
      return;
    setBusy(true);
    try {
      await runService.remove(runId);
      toast.success("Run deleted");
      navigate("/execution", { replace: true });
    } catch (err) {
      toast.error(getErrorMessage(err));
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="grid place-items-center py-24 text-brand">
        <Spinner className="size-8" />
      </div>
    );
  }

  if (notFound || !run) {
    return (
      <div className="mx-auto max-w-2xl pt-10">
        <EmptyState
          icon={SearchX}
          title="Run not found"
          description="It may have been deleted, or you don't have access to it."
          action={
            <Link to="/execution">
              <Button>Back to test execution</Button>
            </Link>
          }
        />
      </div>
    );
  }

  const live = snapshot?.progress;
  const status = snapshot?.status ?? run.status;
  const percent =
    status === "COMPLETED" ? 100 : (live?.percent ?? run.progress);
  const passed = live?.passed ?? run.passed;
  const failed = live?.failed ?? run.failed;
  const skipped = live?.skipped ?? run.skipped;
  const active = ACTIVE.includes(status);

  const stageIndex = status === "COMPLETED" ? RUN_STAGES.length : 2;
  const stepTone =
    status === "FAILED" || status === "CANCELLED" ? "danger" : "primary";

  const b = run.breakdown ?? {};
  const allCount =
    (b.PASSED ?? 0) + (b.FAILED ?? 0) + (b.ERROR ?? 0) + (b.SKIPPED ?? 0);
  const tabs = [
    { value: "", label: `All (${allCount})` },
    { value: "PASSED", label: `Passed (${b.PASSED ?? 0})` },
    { value: "FAILED", label: `Failed (${b.FAILED ?? 0})` },
    { value: "ERROR", label: `Error (${b.ERROR ?? 0})` },
    { value: "SKIPPED", label: `Skipped (${b.SKIPPED ?? 0})` },
  ];
  const totalPages = Math.max(1, Math.ceil(results.total / LIMIT));

  return (
    <div className="space-y-4 sm:space-y-6">
      <Link
        to="/execution"
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-brand"
      >
        <ArrowLeft className="size-4" /> All runs
      </Link>

      <Card>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold text-ink sm:text-2xl">
                {run.runCode}
              </h1>
              <Badge tone={RUN_STATUS_TONE[status]} dot={active}>
                {RUN_STATUS_LABEL[status]}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-muted">
              {run.project?.name} · started by{" "}
              {run.triggeredBy?.name ?? "unknown"} ·{" "}
              {formatDateTime(run.startedAt ?? run.createdAt)}
            </p>
            {run.targetUrl && (
              <p className="mt-1 break-all text-xs text-muted">
                Target: {run.targetUrl}
              </p>
            )}
          </div>
          {canWrite && (
            <div className="flex gap-2">
              {active ? (
                <Button
                  variant="secondary"
                  icon={StopCircle}
                  loading={busy}
                  onClick={onCancel}
                >
                  Cancel run
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  icon={Trash2}
                  className="text-danger"
                  loading={busy}
                  onClick={onDelete}
                >
                  Delete
                </Button>
              )}
            </div>
          )}
        </div>

        <div className="mt-5">
          <RunStepper stageIndex={stageIndex} tone={stepTone} />
        </div>

        <div className="mt-5 flex items-center gap-3">
          <ProgressBar
            value={percent}
            tone={
              status === "FAILED"
                ? "danger"
                : status === "COMPLETED"
                  ? "success"
                  : "primary"
            }
            className="flex-1"
            trackClassName="h-2.5 flex-1"
          />
          <span className="w-10 text-right text-sm font-semibold text-ink">
            {percent}%
          </span>
        </div>
        <p className="mt-2 text-sm text-muted">
          {live?.message ?? (run.errorMsg || "")}
        </p>

        {run.errorMsg && !active && (
          <p className="mt-3 rounded-xl bg-danger-soft p-3 text-sm text-ink">
            {run.errorMsg}
          </p>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
        <StatCard icon={ClipboardCheck} label="Total cases" value={run.total} />
        <StatCard
          icon={CheckCircle2}
          tone="success"
          label="Passed"
          value={passed}
        />
        <StatCard
          icon={XCircle}
          tone="danger"
          label="Failed or error"
          value={failed}
        />
        <StatCard
          icon={SkipForward}
          tone="info"
          label="Skipped"
          value={skipped}
        />
        <StatCard
          icon={Clock}
          label="Duration"
          value={run.startedAt ? formatDuration(runSeconds(run, now)) : "—"}
          note={run.coverage != null ? `${run.coverage}% coverage` : undefined}
        />
      </div>

      {active && (
        <Card>
          <CardHeader>
            <CardTitle>Live log</CardTitle>
          </CardHeader>
          <LiveLogPanel snapshot={snapshot} />
        </Card>
      )}

      {!active && allCount > 0 && <DeployRiskCard runId={runId} />}
      <Card className="space-y-4">
        <CardHeader className="mb-0">
          <CardTitle>Results</CardTitle>
        </CardHeader>
        <Tabs
          tabs={tabs}
          value={filter}
          onChange={(v) => {
            setFilter(v);
            setPage(1);
          }}
        />

        {results.items.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted">
            {active
              ? "Results will appear here as each test finishes."
              : "No results for this filter."}
          </p>
        ) : (
          <Table className="min-w-[720px]">
            <THead>
              <Tr className="hover:bg-transparent">
                <Th>Test case</Th>
                <Th>Type</Th>
                <Th>Status</Th>
                <Th>Duration</Th>
                <Th>Details</Th>
              </Tr>
            </THead>
            <TBody>
              {results.items.map((r) => (
                <Tr
                  key={r.id}
                  className="cursor-pointer"
                  onClick={() => setOpenId(r.id)}
                >
                  <Td className="max-w-xs">
                    <p
                      className="truncate font-medium"
                      title={r.testCase.title}
                    >
                      {r.testCase.title}
                    </p>
                    {r.testCase.module && (
                      <p className="text-xs text-muted">{r.testCase.module}</p>
                    )}
                  </Td>
                  <Td>
                    <Badge tone={TEST_TYPE_TONE[r.testCase.type]}>
                      {TEST_TYPE_LABEL[r.testCase.type]}
                    </Badge>
                  </Td>
                  <Td>
                    <Badge tone={RESULT_STATUS_TONE[r.status]}>
                      {RESULT_STATUS_LABEL[r.status]}
                    </Badge>
                  </Td>
                  <Td className="whitespace-nowrap text-muted">
                    {formatMs(r.durationMs)}
                  </Td>
                  <Td className="max-w-xs">
                    <div className="flex items-center gap-2">
                      {r.screenshotPath && (
                        <ImageIcon className="size-4 shrink-0 text-muted" />
                      )}
                      <span
                        className="truncate text-xs text-muted"
                        title={r.errorMessage ?? ""}
                      >
                        {r.errorMessage ?? ""}
                      </span>
                    </div>
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-end gap-2 text-sm text-muted">
            <Button
              size="sm"
              variant="secondary"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Prev
            </Button>
            <span className="text-xs">
              {page} / {totalPages}
            </span>
            <Button
              size="sm"
              variant="secondary"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        )}
      </Card>

      {openId && (
        <ResultDrawer resultId={openId} onClose={() => setOpenId(null)} />
      )}
    </div>
  );
}
